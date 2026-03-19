/**
 * NASA FIRMS Integration
 * Fetches near-real-time thermal anomalies (explosions, fires, strikes)
 * detected by VIIRS satellite.
 *
 * API Key: register free at https://firms.modaps.eosdis.nasa.gov/api/
 * Set FIRMS_API_KEY in env vars. Without a key, the service is skipped.
 *
 * High brightness + high confidence = likely explosion/artillery/airstrike
 */

import { createHash } from 'crypto';
import { storage } from '../storage';

function fingerprint(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

function getSeverityScore(frp: number): number {
    if (frp >= 500) return 9;
    if (frp >= 200) return 7;
    if (frp >= 100) return 5;
    return 4;
}

const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

// VIIRS sources to try in order (NOAA-20 has better coverage in some regions)
const VIIRS_SOURCES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'];

// World bounding box split into conflict-zone regions to limit noise
const CONFLICT_ZONES: { name: string; bbox: string; country: string; code: string }[] = [
    { name: 'Ukraine', bbox: '22,44,40,52', country: 'Ukraine', code: 'UA' },
    { name: 'Gaza/Israël', bbox: '34,29,36,33', country: 'Palestine', code: 'PS' },
    { name: 'Liban/Syrie', bbox: '35,33,42,37', country: 'Liban', code: 'LB' },
    { name: 'Yemen', bbox: '42,12,54,18', country: 'Yémen', code: 'YE' },
    { name: 'Soudan', bbox: '21,7,40,23', country: 'Soudan', code: 'SD' },
    { name: 'Irak', bbox: '38,29,48,37', country: 'Irak', code: 'IQ' },
    { name: 'Afghanistan', bbox: '60,29,75,38', country: 'Afghanistan', code: 'AF' },
    { name: 'Myanmar', bbox: '97,16,101,28', country: 'Myanmar', code: 'MM' },
    { name: 'Mali/Sahel', bbox: '-6,10,5,23', country: 'Mali', code: 'ML' },
    { name: 'Est Congo', bbox: '27,-5,30,2', country: 'RD Congo', code: 'CD' },
    { name: 'Somalie', bbox: '40,0,51,12', country: 'Somalie', code: 'SO' },
];

// VIIRS CSV columns (0-based)
// latitude, longitude, bright_ti4, scan, track, acq_date, acq_time, satellite, confidence, version, bright_ti5, frp, daynight
const COL = { LAT: 0, LNG: 1, BRIGHTNESS: 2, CONFIDENCE: 8, FRP: 11 };

function parseConfidence(conf: string): number {
    // VIIRS: 'l'=low(25), 'n'=nominal(50), 'h'=high(100)
    if (conf === 'h') return 100;
    if (conf === 'n') return 50;
    if (conf === 'l') return 10;
    return parseInt(conf) || 0;
}

function getSeverityFromFirms(brightness: number, frp: number, confidence: number): string | null {
    // Filter out low-confidence or dim readings
    if (confidence < 50) return null;
    if (frp < 50) return null; // Fire Radiative Power < 50 MW = likely natural fire

    if (frp >= 500 || brightness >= 380) return 'critical'; // Very intense — likely artillery/airstrike
    if (frp >= 200 || brightness >= 360) return 'high';     // Strong anomaly
    if (frp >= 100 || brightness >= 340) return 'medium';
    return null; // Too dim
}

let lastFirmsTimestamps = new Set<string>(); // de-dupe within same cycle

export async function fetchFirmsAlerts(): Promise<number> {
    const apiKey = process.env.FIRMS_API_KEY;
    if (!apiKey) {
        console.log('[firms] FIRMS_API_KEY not set — skipping');
        return 0;
    }

    let added = 0;

    for (const zone of CONFLICT_ZONES) {
        try {
            // Try VIIRS sources in order, use first successful response with data
            let csv = '';
            for (const src of VIIRS_SOURCES) {
                const url = `${FIRMS_BASE}/${apiKey}/${src}/${zone.bbox}/1`;
                const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
                if (!res.ok) {
                    console.warn(`[firms] ${zone.name} (${src}): HTTP ${res.status}`);
                    continue;
                }
                const body = await res.text();
                const lineCount = body.split('\n').length - 2; // minus header + trailing newline
                if (lineCount > 0) { csv = body; break; }
            }
            if (!csv) continue;

            const lines = csv.split('\n');
            // Skip header line
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length < 12) continue;

                const lat = parseFloat(cols[COL.LAT]);
                const lng = parseFloat(cols[COL.LNG]);
                const brightness = parseFloat(cols[COL.BRIGHTNESS]);
                const confidence = parseConfidence(cols[COL.CONFIDENCE]?.trim());
                const frp = parseFloat(cols[COL.FRP]);

                if (isNaN(lat) || isNaN(lng) || isNaN(brightness)) continue;

                const severity = getSeverityFromFirms(brightness, frp, confidence);
                if (!severity) continue;

                // De-dupe by coordinate bucket (round to 2 decimal places)
                const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
                if (lastFirmsTimestamps.has(key)) continue;
                lastFirmsTimestamps.add(key);

                // Cross-source dedup: skip if RSS/GDELT already inserted an explosion for this country in last 90 min
                const existingSimilar = await storage.findRecentSimilar(zone.code, 'explosion', 90);
                if (existingSimilar) continue;

                // Fingerprint by coordinate bucket + day (1 alert per ~1km per day)
                const dateStr = new Date().toISOString().slice(0, 10);
                const fp = fingerprint(`firms|${lat.toFixed(2)}|${lng.toFixed(2)}|${dateStr}`);

                const inserted = await storage.createAlertIfNew({
                    title: `Anomalie thermique satellite — ${zone.name}`,
                    description: `Détectée par VIIRS/SNPP. Luminosité: ${brightness.toFixed(0)}K, FRP: ${frp.toFixed(0)} MW, Confiance: ${confidence}%. Possible impact/explosion.`,
                    lat: lat.toString(),
                    lng: lng.toString(),
                    country: zone.country,
                    countryCode: zone.code,
                    source: 'https://firms.modaps.eosdis.nasa.gov',
                    type: 'explosion',
                    category: 'MILITARY',
                    sourceType: 'FIRMS',
                    severity,
                    status: 'active',
                    fingerprint: fp,
                    severityScore: getSeverityScore(frp),
                    eventStart: new Date(),
                });

                if (!inserted) continue;
                added++;
                if (added >= 20) break; // Cap per cycle
            }
        } catch (err) {
            console.error(`[firms] Error for zone ${zone.name}:`, err);
        }
    }

    // Reset de-dupe set periodically (keep it manageable)
    if (lastFirmsTimestamps.size > 500) lastFirmsTimestamps = new Set();

    console.log(`[firms] ✓ Added ${added} thermal anomaly alerts`);
    return added;
}
