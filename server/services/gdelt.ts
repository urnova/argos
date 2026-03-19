/**
 * GDELT Project Integration
 * Fetches real-time conflict events from the GDELT 2.0 database.
 * GDELT updates every 15 minutes and covers news in 100+ languages.
 *
 * Uses the GDELT Events export CSV (CAMEO coded) with GPS coordinates.
 * Docs: https://www.gdeltproject.org/data.html
 */

import AdmZip from 'adm-zip';
import { createHash } from 'crypto';
import { storage } from '../storage';

const GDELT_LASTUPDATE_URL = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';

// ─── CAMEO Event codes that represent material conflict ─────────────────────
const CONFLICT_ROOTS = new Set(['14', '17', '18', '19', '20']);

// GDELT 2.0 Events TSV column indices (0-based)
const COL = {
  SQLDATE: 1,            // YYYYMMDD — actual event date
  ACTOR1_NAME: 6,
  ACTOR2_NAME: 16,
  EVENT_CODE: 26,
  QUAD_CLASS: 29,
  GOLDSTEIN: 30,
  NUM_ARTICLES: 33,
  AVG_TONE: 34,
  ACTION_GEO_FULLNAME: 52,
  ACTION_GEO_COUNTRY: 53,
  ACTION_GEO_LAT: 56,
  ACTION_GEO_LONG: 57,
  SOURCE_URL: 60,
} as const;

// ISO country code → French country name
const COUNTRY_NAMES: Record<string, string> = {
  US: 'États-Unis', RU: 'Russie', CN: 'Chine', UA: 'Ukraine',
  IR: 'Iran', IL: 'Israël', PS: 'Palestine', SY: 'Syrie',
  IQ: 'Irak', AF: 'Afghanistan', YE: 'Yémen', LY: 'Libye',
  SD: 'Soudan', ET: 'Éthiopie', SO: 'Somalie', ML: 'Mali',
  NG: 'Nigéria', PK: 'Pakistan', IN: 'Inde', MM: 'Myanmar',
  FR: 'France', DE: 'Allemagne', GB: 'Royaume-Uni', TR: 'Turquie',
  SA: 'Arabie Saoudite', EG: 'Égypte', KP: 'Corée du Nord',
  KR: 'Corée du Sud', JP: 'Japon', TW: 'Taïwan', VN: 'Vietnam',
  PH: 'Philippines', ID: 'Indonésie', MX: 'Mexique', BR: 'Brésil',
  VE: 'Venezuela', CO: 'Colombie', HT: 'Haïti', CD: 'RD Congo',
  CF: 'Centrafrique', SS: 'Soudan du Sud', KE: 'Kenya', MZ: 'Mozambique',
  ZW: 'Zimbabwe', ZA: 'Afrique du Sud', MA: 'Maroc', DZ: 'Algérie',
  TN: 'Tunisie', LB: 'Liban', JO: 'Jordanie', AZ: 'Azerbaïdjan',
  AM: 'Arménie', GE: 'Géorgie', BY: 'Biélorussie', PL: 'Pologne',
  RS: 'Serbie', XK: 'Kosovo', BA: 'Bosnie', MK: 'Macédoine du Nord',
};

// ─── Event code → French action label ───────────────────────────────────────
function getActionLabel(code: string): string {
  const n = parseInt(code);
  if (n >= 203) return 'Génocide signalé';
  if (n >= 201) return 'Massacre de masse';
  if (n >= 200) return 'Violence de masse';
  if (n >= 196) return 'Violation de cessez-le-feu';
  if (n >= 195) return 'Frappe aérienne';
  if (n >= 194) return 'Bombardement d\'artillerie';
  if (n >= 193) return 'Combat à l\'arme légère';
  if (n >= 192) return 'Occupation de territoire';
  if (n >= 191) return 'Blocus naval';
  if (n >= 190) return 'Opération militaire';
  if (n >= 183) return 'Attentat à l\'explosif';
  if (n >= 182) return 'Agression physique';
  if (n >= 181) return 'Prise d\'otage';
  if (n >= 180) return 'Assaut armé';
  if (n >= 174) return 'Arrestation forcée';
  if (n >= 172) return 'Boycott / Embargo';
  if (n >= 170) return 'Coercition signalée';
  if (n >= 145) return 'Émeute violente';
  if (n >= 143) return 'Manifestation armée';
  if (n >= 140) return 'Manifestation violente';
  return 'Incident de sécurité';
}

// ─── Event code → Alert type (15 types) ──────────────────────────────────────
function getAlertType(code: string): string {
  const n = parseInt(code);
  if (n >= 200) return 'massacre';
  if (n === 195 || (n >= 193 && n <= 196)) return 'airstrike';
  if (n === 194 || n === 193) return 'artillery';
  if (n === 191) return 'naval';
  if (n >= 190) return 'missile';
  if (n === 183) return 'explosion';
  if (n >= 180) return 'conflict';
  if (n >= 172 && n <= 174) return 'sanctions';
  if (n >= 170) return 'terrorism';
  if (n >= 145) return 'protest';
  if (n >= 140) return 'warning';
  return 'warning';
}

// ─── Alert type → Category ────────────────────────────────────────────────────
function getCategory(type: string): string {
  const map: Record<string, string> = {
    missile: 'MILITARY',
    airstrike: 'MILITARY',
    artillery: 'MILITARY',
    naval: 'MILITARY',
    conflict: 'MILITARY',
    explosion: 'MILITARY',
    chemical: 'MILITARY',
    nuclear: 'MILITARY',
    cyber: 'MILITARY',
    massacre: 'HUMANITARIAN',
    terrorism: 'HUMANITARIAN',
    coup: 'POLITICAL',
    sanctions: 'POLITICAL',
    protest: 'GEOPOLITICAL',
    warning: 'GEOPOLITICAL',
  };
  return map[type] ?? 'GEOPOLITICAL';
}

// ─── SHA-256 fingerprint (32-char prefix) ────────────────────────────────────
function fingerprint(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

// ─── Goldstein + articles → severity ────────────────────────────────────────
function getSeverity(goldstein: number, numArticles: number): string {
  const abs = Math.abs(goldstein);
  if (abs >= 9 || numArticles >= 80) return 'critical';
  if (abs >= 7 || numArticles >= 25) return 'high';
  if (abs >= 4 || numArticles >= 8) return 'medium';
  return 'low';
}

// ─── Severity score 1-10 ─────────────────────────────────────────────────────
function getSeverityScore(goldstein: number, numArticles: number, type: string): number {
  if (type === 'nuclear' || type === 'chemical') return 10;
  if (type === 'missile') return 9;
  if (type === 'massacre') return 9;
  if (type === 'airstrike') return 8;
  if (type === 'explosion' || type === 'terrorism') return 7;
  if (type === 'naval' || type === 'artillery') return 6;
  if (type === 'conflict') return Math.abs(goldstein) >= 7 ? 6 : 5;
  if (type === 'coup') return 5;
  if (type === 'sanctions') return 4;
  if (type === 'protest') return 3;
  // Fallback: scale Goldstein magnitude 1-4
  return Math.max(1, Math.min(4, Math.round(Math.abs(goldstein) / 2.5)));
}

// ─── Build a French-language title ───────────────────────────────────────────
function buildTitle(code: string, location: string): string {
  const action = getActionLabel(code);
  const place = location?.split(',')[0]?.trim() || 'Position inconnue';
  return `${action} — ${place}`;
}

// ─── Build a French-language description ─────────────────────────────────────
function buildDescription(actor1: string, actor2: string, location: string, goldstein: number): string {
  const parts: string[] = [];
  if (actor1 && actor1 !== 'UNKNOWN' && actor1.length > 1) parts.push(actor1);
  if (actor2 && actor2 !== 'UNKNOWN' && actor2.length > 1 && actor2 !== actor1) parts.push(actor2);
  const actors = parts.length > 0 ? `Acteurs impliqués: ${parts.join(' / ')}. ` : '';
  const loc = location ? `Secteur: ${location}. ` : '';
  const tension = `Indice Goldstein: ${goldstein.toFixed(1)}/10.`;
  return actors + loc + tension;
}

// ─── State: track last processed file URL to avoid duplicates ───────────────
let lastProcessedFileUrl = '';

// ─── Main GDELT fetch function ───────────────────────────────────────────────
export async function fetchGdeltEvents(): Promise<number> {
  try {
    const listResp = await fetch(GDELT_LASTUPDATE_URL, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!listResp.ok) throw new Error(`GDELT list: HTTP ${listResp.status}`);

    const listText = await listResp.text();

    const exportLine = listText.trim().split('\n')
      .find(l => l.includes('.export.CSV.zip'));
    if (!exportLine) {
      console.log('[gdelt] No export CSV in update list');
      return 0;
    }

    const parts = exportLine.trim().split(/\s+/);
    const fileUrl = parts[2];
    if (!fileUrl) return 0;

    if (fileUrl === lastProcessedFileUrl) {
      console.log('[gdelt] No new data (same file)');
      return 0;
    }

    console.log(`[gdelt] Downloading: ${fileUrl}`);

    const zipResp = await fetch(fileUrl, {
      signal: AbortSignal.timeout(45_000),
    });
    if (!zipResp.ok) throw new Error(`GDELT zip: HTTP ${zipResp.status}`);

    const zipBuf = Buffer.from(await zipResp.arrayBuffer());
    const zip = new AdmZip(zipBuf);
    const entries = zip.getEntries();
    if (entries.length === 0) throw new Error('Empty GDELT ZIP');

    const csv = entries[0].getData().toString('utf8');
    const lines = csv.split('\n');

    console.log(`[gdelt] Parsing ${lines.length} event rows`);

    const existing = await storage.getAlerts();
    const seenSources = new Set(existing.map(a => a.source).filter(Boolean));

    let added = 0;

    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 61) continue;

      const eventCode = cols[COL.EVENT_CODE]?.trim();
      if (!eventCode) continue;

      const root = eventCode.substring(0, 2);
      if (!CONFLICT_ROOTS.has(root)) continue;

      // ── SQLDATE filter: skip events older than 3 days ──────────────────────
      const sqldate = cols[COL.SQLDATE]?.trim();
      let eventDate = new Date();
      if (sqldate && sqldate.length === 8) {
        const y = parseInt(sqldate.slice(0, 4));
        const m = parseInt(sqldate.slice(4, 6)) - 1;
        const d = parseInt(sqldate.slice(6, 8));
        eventDate = new Date(Date.UTC(y, m, d));
        const ageDays = (Date.now() - eventDate.getTime()) / 86_400_000;
        if (ageDays > 3) continue; // Skip historical events
      }

      const quadClass = parseInt(cols[COL.QUAD_CLASS]);
      const goldstein = parseFloat(cols[COL.GOLDSTEIN]);

      if (quadClass !== 4 && goldstein > -3.5) continue;

      const lat = parseFloat(cols[COL.ACTION_GEO_LAT]);
      const lng = parseFloat(cols[COL.ACTION_GEO_LONG]);

      if (isNaN(lat) || isNaN(lng)) continue;
      if (lat === 0 && lng === 0) continue;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

      const location = cols[COL.ACTION_GEO_FULLNAME]?.trim() ?? '';
      const countryCode = cols[COL.ACTION_GEO_COUNTRY]?.trim() ?? '';
      const actor1 = cols[COL.ACTOR1_NAME]?.trim() ?? '';
      const actor2 = cols[COL.ACTOR2_NAME]?.trim() ?? '';
      const numArticles = parseInt(cols[COL.NUM_ARTICLES]) || 1;
      const sourceUrl = cols[COL.SOURCE_URL]?.trim() ?? '';

      if (sourceUrl && seenSources.has(sourceUrl)) continue;

      const severity = getSeverity(goldstein, numArticles);

      if (severity === 'low' && existing.length > 300) continue;

      const type = getAlertType(eventCode);
      const category = getCategory(type);
      const fp = fingerprint(sourceUrl || `${eventCode}|${location}|${lat}|${lng}`);

      // Cross-source dedup: skip if RSS/TELEGRAM already inserted a similar alert in the last 90 min
      const DEDUP_TYPES = new Set(['missile','airstrike','artillery','explosion','nuclear','chemical','massacre','terrorism','naval']);
      if (DEDUP_TYPES.has(type) && countryCode) {
        const similar = await storage.findRecentSimilar(countryCode, type, 90);
        if (similar) continue;
      }

      const inserted = await storage.createAlertIfNew({
        title: buildTitle(eventCode, location),
        description: buildDescription(actor1, actor2, location, goldstein),
        lat: lat.toString(),
        lng: lng.toString(),
        country: COUNTRY_NAMES[countryCode] || countryCode || 'Inconnu',
        countryCode: countryCode,
        source: sourceUrl || null,
        type,
        category,
        sourceType: 'GDELT',
        severity,
        status: 'active',
        fingerprint: fp,
        severityScore: getSeverityScore(goldstein, numArticles, type),
        eventStart: eventDate,
      });

      if (!inserted) continue; // duplicate fingerprint
      if (sourceUrl) seenSources.add(sourceUrl);
      added++;

      if (added >= 60) break;
    }

    lastProcessedFileUrl = fileUrl;
    console.log(`[gdelt] ✓ Added ${added} new conflict alerts`);
    return added;

  } catch (err) {
    console.error('[gdelt] Fetch error:', err);
    return 0;
  }
}
