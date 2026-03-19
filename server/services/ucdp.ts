/**
 * UCDP Georeferenced Events Dataset (GED) — Argos V5
 * Uppsala Conflict Data Program — Uppsala University
 *
 * Fournit des événements de conflits géo-référencés avec victimes, acteurs, type de violence.
 * Version 25.1 couvre jusqu'à fin 2024.
 * Limite : 5 000 requêtes/jour, pagination 100/page.
 *
 * Docs : https://ucdp.uu.se/apidocs/
 * Header : x-ucdp-access-token
 */

import { createHash } from 'crypto';
import { storage } from '../storage';
import type { InsertAlert } from '@shared/schema';

const UCDP_API_KEY = process.env.UCDP_API_KEY;
const UCDP_BASE = 'https://ucdpapi.pcr.uu.se/api/gedevents/25.1';

// Nombre max de pages à fetcher par cycle (100 events/page × 5 pages = 500 events max)
const MAX_PAGES = 5;

function fingerprint(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

// Type of violence → Argos type + category
function violenceToType(tv: number, deaths: number): { type: string; category: string } {
    if (tv === 3) return { type: 'massacre', category: 'HUMANITARIAN' };         // one-sided
    if (tv === 2) return { type: 'conflict', category: 'MILITARY' };             // non-state
    if (deaths >= 20) return { type: 'conflict', category: 'MILITARY' };         // state-based, major
    return { type: 'conflict', category: 'MILITARY' };
}

function deathsToSeverity(best: number): { severity: string; score: number } {
    if (best >= 100) return { severity: 'critical', score: 10 };
    if (best >= 25)  return { severity: 'critical', score: 9 };
    if (best >= 10)  return { severity: 'high', score: 7 };
    if (best >= 3)   return { severity: 'high', score: 6 };
    if (best >= 1)   return { severity: 'medium', score: 4 };
    return { severity: 'medium', score: 3 };
}

// ISO country code lookup (UCDP returns English country names)
const COUNTRY_FR: Record<string, string> = {
    'Ukraine': 'Ukraine', 'Russia': 'Russie', 'Syria': 'Syrie',
    'Iraq': 'Irak', 'Iran': 'Iran', 'Israel': 'Israël', 'Palestine': 'Palestine',
    'Yemen': 'Yémen', 'Libya': 'Libye', 'Somalia': 'Somalie', 'Sudan': 'Soudan',
    'South Sudan': 'Soudan du Sud', 'Afghanistan': 'Afghanistan', 'Pakistan': 'Pakistan',
    'India': 'Inde', 'Myanmar': 'Myanmar', 'Mali': 'Mali', 'Nigeria': 'Nigeria',
    'Niger': 'Niger', 'Burkina Faso': 'Burkina Faso', 'Ethiopia': 'Éthiopie',
    'DR Congo': 'RD Congo', 'Congo': 'Congo', 'Mozambique': 'Mozambique',
    'Cameroon': 'Cameroun', 'Chad': 'Tchad', 'Central African Republic': 'RCA',
    'Venezuela': 'Venezuela', 'Mexico': 'Mexique', 'Colombia': 'Colombie',
    'Haiti': 'Haïti', 'Lebanon': 'Liban', 'Azerbaijan': 'Azerbaïdjan',
    'Armenia': 'Arménie', 'Serbia': 'Serbie', 'China': 'Chine', 'Philippines': 'Philippines',
};

const COUNTRY_CODES: Record<string, string> = {
    'Ukraine': 'UA', 'Russia': 'RU', 'Syria': 'SY', 'Iraq': 'IQ', 'Iran': 'IR',
    'Israel': 'IL', 'Palestine': 'PS', 'Yemen': 'YE', 'Libya': 'LY', 'Somalia': 'SO',
    'Sudan': 'SD', 'South Sudan': 'SS', 'Afghanistan': 'AF', 'Pakistan': 'PK',
    'Myanmar': 'MM', 'Mali': 'ML', 'Nigeria': 'NG', 'Niger': 'NE', 'Ethiopia': 'ET',
    'DR Congo': 'CD', 'Cameroon': 'CM', 'Chad': 'TD', 'Lebanon': 'LB',
    'Azerbaijan': 'AZ', 'Armenia': 'AM', 'China': 'CN', 'Philippines': 'PH',
    'Burkina Faso': 'BF', 'Mexico': 'MX', 'Colombia': 'CO', 'Haiti': 'HT',
};

interface UcdpEvent {
    id: number;
    conflict_new_id: number;
    country: string;
    side_a: string;
    side_b: string;
    latitude: string;
    longitude: string;
    date_start: string;  // YYYY-MM-DD
    deaths_a: number;
    deaths_b: number;
    deaths_civilians: number;
    deaths_unknown: number;
    best: number;        // total deaths best estimate
    type_of_violence: number;  // 1=state-based 2=non-state 3=one-sided
    conflict_name: string;
    source_headline: string;
    where_description: string;
    adm_1: string;
    adm_2: string;
    region: string;
}

interface UcdpResponse {
    Result: UcdpEvent[];
    TotalCount: number;
    pageSize: number;
    page: number;
}

export async function fetchUcdpEvents(): Promise<number> {
    if (!UCDP_API_KEY) {
        console.warn('[ucdp] UCDP_API_KEY not set — skipping');
        return 0;
    }

    // Fetch events from last 12 months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    let totalInserted = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${UCDP_BASE}?pagesize=100&page=${page}&StartDate=${startStr}&EndDate=${endStr}`;

        try {
            const res = await fetch(url, {
                headers: { 'x-ucdp-access-token': UCDP_API_KEY },
                signal: AbortSignal.timeout(20_000),
            });

            if (!res.ok) {
                console.warn(`[ucdp] HTTP ${res.status} on page ${page}`);
                break;
            }

            const data: UcdpResponse = await res.json();
            const events = data.Result ?? [];

            if (events.length === 0) break;

            for (const ev of events) {
                const lat = parseFloat(ev.latitude);
                const lng = parseFloat(ev.longitude);
                if (isNaN(lat) || isNaN(lng)) continue;

                const fp = fingerprint(`ucdp-${ev.id}`);

                const best = ev.best ?? 0;
                const { type, category } = violenceToType(ev.type_of_violence, best);
                const { severity, score } = deathsToSeverity(best);

                const countryFr = COUNTRY_FR[ev.country] ?? ev.country;
                const countryCode = COUNTRY_CODES[ev.country] ?? '';

                const sides = [ev.side_a, ev.side_b].filter(Boolean).join(' vs ');
                const title = ev.source_headline?.trim()
                    || `${ev.conflict_name} — ${sides}`;

                const desc = [
                    ev.conflict_name,
                    `${sides}`,
                    best > 0 ? `${best} victimes (estimation UCDP)` : null,
                    ev.adm_1 ? `Zone : ${ev.adm_1}` : null,
                ].filter(Boolean).join(' · ');

                const alert: InsertAlert = {
                    title: title.slice(0, 280),
                    description: desc.slice(0, 500),
                    lat: String(lat),
                    lng: String(lng),
                    country: countryFr,
                    countryCode,
                    source: `UCDP GED 25.1 — ${ev.id}`,
                    type,
                    category,
                    sourceType: 'UCDP',
                    severity,
                    status: 'active',
                    severityScore: score,
                    isActive: true,
                    fingerprint: fp,
                    eventStart: ev.date_start ? new Date(ev.date_start) : undefined,
                    aiVerified: true,
                    aiLabel: title.slice(0, 150),
                };

                const created = await storage.createAlertIfNew(alert);
                if (created) totalInserted++;
            }

            // Si moins de 100 résultats → dernière page
            if (events.length < 100) break;

        } catch (err) {
            console.warn(`[ucdp] Fetch error page ${page}:`, err);
            break;
        }
    }

    if (totalInserted > 0) {
        console.log(`[ucdp] Inserted ${totalInserted} UCDP events`);
    }
    return totalInserted;
}
