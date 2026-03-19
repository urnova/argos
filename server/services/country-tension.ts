/**
 * Country Tension Service
 * Combines static geopolitical knowledge with live alert data
 * to produce a ranked list of countries by tension level.
 */

import { storage } from '../storage';

export type TensionStatus = 'war' | 'high' | 'tension' | 'sanctions' | 'watchlist' | 'stable';

export interface CountryTensionEntry {
    code: string;
    name: string;
    status: TensionStatus;
    score: number;         // 0–100 composite score
    activeAlerts: number;
    reason: string;        // human-readable reason
    flag?: string;         // emoji flag
}

/**
 * Static baseline — LOW scores intentionally.
 * baseScore = géopolitical context only (not current state).
 * Real score is driven by live alerts from the DB.
 * A country only shows red/war if recent alerts justify it.
 *
 * Scale:
 *   30 = active war zone (baseline, still needs alerts to go red)
 *   20 = high tension zone
 *   12 = monitored tension
 *   5  = watchlist / sanctions
 */
const STATIC_TENSIONS: Record<string, { reason: string; name: string; flag: string; baseScore: number }> = {
    UA: { baseScore: 30, name: 'Ukraine', reason: 'Guerre russo-ukrainienne en cours', flag: '🇺🇦' },
    RU: { baseScore: 28, name: 'Russie', reason: 'Invasion de l\'Ukraine, sanctions OTAN', flag: '🇷🇺' },
    PS: { baseScore: 30, name: 'Palestine (Gaza)', reason: 'Conflit Gaza — opération IDF', flag: '🇵🇸' },
    IL: { baseScore: 26, name: 'Israël', reason: 'Guerre à Gaza, tensions Hezbollah', flag: '🇮🇱' },
    SD: { baseScore: 28, name: 'Soudan', reason: 'Guerre civile SAF vs RSF', flag: '🇸🇩' },
    YE: { baseScore: 26, name: 'Yémen', reason: 'Conflit Houthis — coalition saoudienne', flag: '🇾🇪' },
    MM: { baseScore: 25, name: 'Myanmar', reason: 'Guerre civile post-coup d\'État', flag: '🇲🇲' },
    SS: { baseScore: 24, name: 'Soudan du Sud', reason: 'Conflits armés récurrents', flag: '🇸🇸' },
    SO: { baseScore: 23, name: 'Somalie', reason: 'Al-Shabaab — AMISOM', flag: '🇸🇴' },
    AF: { baseScore: 23, name: 'Afghanistan', reason: 'Talibans — résistance armée', flag: '🇦🇫' },
    SY: { baseScore: 22, name: 'Syrie', reason: 'Conflit en cours — post-Assad', flag: '🇸🇾' },
    CD: { baseScore: 22, name: 'RD Congo', reason: 'M23, Rwanda, conflit Est-Congo', flag: '🇨🇩' },
    KP: { baseScore: 20, name: 'Corée du Nord', reason: 'Essais missiles ICBM, troupes en Russie', flag: '🇰🇵' },
    IR: { baseScore: 20, name: 'Iran', reason: 'Programme nucléaire, tensions régionales', flag: '🇮🇷' },
    IQ: { baseScore: 18, name: 'Irak', reason: 'Milices pro-iraniennes actives', flag: '🇮🇶' },
    LY: { baseScore: 18, name: 'Libye', reason: 'Conflit de basse intensité — Est/Ouest', flag: '🇱🇾' },
    ML: { baseScore: 18, name: 'Mali', reason: 'Sahel, groupes armés, djihadisme', flag: '🇲🇱' },
    CF: { baseScore: 18, name: 'Centrafrique', reason: 'Groupes armés, instabilité', flag: '🇨🇫' },
    NG: { baseScore: 16, name: 'Nigéria', reason: 'Boko Haram, ISWAP, nord-est', flag: '🇳🇬' },
    ET: { baseScore: 16, name: 'Éthiopie', reason: 'Conflit Amhara, Oromo, séquelles Tigray', flag: '🇪🇹' },
    PK: { baseScore: 15, name: 'Pakistan', reason: 'TTP, tensions Afghanistan-Inde', flag: '🇵🇰' },
    HT: { baseScore: 15, name: 'Haïti', reason: 'Gangs, effondrement de l\'État', flag: '🇭🇹' },
    TW: { baseScore: 14, name: 'Taïwan', reason: 'Pression militaire chinoise croissante', flag: '🇹🇼' },
    CN: { baseScore: 12, name: 'Chine', reason: 'Détroit de Taïwan, Mer de Chine Sud', flag: '🇨🇳' },
    LB: { baseScore: 12, name: 'Liban', reason: 'Post-conflit Hezbollah, reconstruction', flag: '🇱🇧' },
    AZ: { baseScore: 10, name: 'Azerbaïdjan', reason: 'Post-Karabakh, tensions Arménie', flag: '🇦🇿' },
    AM: { baseScore: 10, name: 'Arménie', reason: 'Pertes Karabakh, pression azerbaïdjane', flag: '🇦🇲' },
    MZ: { baseScore: 10, name: 'Mozambique', reason: 'Insurgés jihadistes Cabo Delgado', flag: '🇲🇿' },
    VE: { baseScore: 8,  name: 'Venezuela', reason: 'Tensions frontalières Guyana/Colombie', flag: '🇻🇪' },
    BY: { baseScore: 7,  name: 'Biélorussie', reason: 'Sanctions UE/US, régime Loukachenko', flag: '🇧🇾' },
    CU: { baseScore: 5,  name: 'Cuba', reason: 'Embargo américain, sanctions', flag: '🇨🇺' },
    VN: { baseScore: 5,  name: 'Vietnam', reason: 'Disputes Mer de Chine Sud', flag: '🇻🇳' },
    PH: { baseScore: 5,  name: 'Philippines', reason: 'Incidents Mer de Chine Sud — Chine', flag: '🇵🇭' },
    RS: { baseScore: 6,  name: 'Serbie', reason: 'Tensions Kosovo-Serbie', flag: '🇷🇸' },
    GE: { baseScore: 5,  name: 'Géorgie', reason: 'Régions occupées, tensions pro-EU', flag: '🇬🇪' },
};

/** Dynamic score derived from live alerts. High weights so alerts genuinely drive the status. */
const SEVERITY_WEIGHTS: Record<string, number> = {
    critical: 25,
    high: 12,
    medium: 5,
    low: 2,
};

/** Derive TensionStatus from computed score (not from static table). */
function scoreToStatus(score: number): TensionStatus {
    if (score >= 70) return 'war';
    if (score >= 50) return 'high';
    if (score >= 30) return 'tension';
    if (score >= 15) return 'watchlist';
    if (score >= 8)  return 'sanctions';
    return 'stable';
}

export async function getCountryTension(): Promise<CountryTensionEntry[]> {
    const allAlerts = await storage.getAlerts();
    const now = Date.now();
    const cutoff7d  = now - 7  * 24 * 60 * 60 * 1000; // 7j pour alertes fraîches
    const cutoff30d = now - 30 * 24 * 60 * 60 * 1000; // 30j pour données UCDP historiques

    // UCDP events sont historiques — utiliser eventStart si disponible
    const recentAlerts = allAlerts.filter(a => {
        const isUcdp = typeof (a as any).source === 'string' && (a as any).source.startsWith('UCDP');
        const dateMs = isUcdp && (a as any).eventStart
            ? new Date((a as any).eventStart).getTime()
            : a.timestamp ? new Date(a.timestamp).getTime() : 0;
        return dateMs > (isUcdp ? cutoff30d : cutoff7d);
    });

    // Boost par alerte — UCDP utilise severityScore (3–10 basé sur morts) × 3
    const countryAlertMap: Record<string, { count: number; boost: number }> = {};
    for (const a of recentAlerts) {
        if (!a.countryCode) continue;
        if (!countryAlertMap[a.countryCode]) countryAlertMap[a.countryCode] = { count: 0, boost: 0 };
        countryAlertMap[a.countryCode].count++;
        const isUcdp = typeof (a as any).source === 'string' && (a as any).source.startsWith('UCDP');
        const boost = isUcdp && typeof (a as any).severityScore === 'number'
            ? (a as any).severityScore * 3
            : SEVERITY_WEIGHTS[a.severity] ?? 1;
        countryAlertMap[a.countryCode].boost += boost;
    }

    const results: CountryTensionEntry[] = [];

    // Métadonnées statiques + boost live (le vrai score vient des alertes)
    for (const [code, staticData] of Object.entries(STATIC_TENSIONS)) {
        const dynamic = countryAlertMap[code] || { count: 0, boost: 0 };
        const score = Math.min(100, staticData.baseScore + Math.min(dynamic.boost, 75));
        if (dynamic.count === 0 && staticData.baseScore < 5) continue;
        results.push({
            code,
            name: staticData.name,
            status: scoreToStatus(score),
            score,
            activeAlerts: dynamic.count,
            reason: staticData.reason,
            flag: staticData.flag,
        });
    }

    // Pays détectés par UCDP/GDELT absents du tableau statique
    for (const [code, dynamic] of Object.entries(countryAlertMap)) {
        if (STATIC_TENSIONS[code]) continue;
        const alertForCountry = recentAlerts.find(a => a.countryCode === code);
        const countryName = (alertForCountry as any)?.country || code;
        const score = Math.min(100, dynamic.boost);
        results.push({
            code,
            name: countryName,
            status: scoreToStatus(score),
            score,
            activeAlerts: dynamic.count,
            reason: `${dynamic.count} incident(s) détecté(s) — données UCDP/GDELT`,
            flag: '🌍',
        });
    }

    return results.sort((a, b) => b.score - a.score);
}
