/**
 * Aggressor Detection Utility
 * ===========================
 * Given alert text (title + description) and the impact country code,
 * returns the best-guess origin coordinates (launch point) for missile/airstrike arcs.
 *
 * Priority:
 *   1. Keyword match in text → specific aggressor country
 *   2. Impact country code → known common aggressors for that theatre
 *   3. Fallback → null (arc won't be drawn)
 */

// Known country positions (capital / major launch site)
export const COUNTRY_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
    RU: { lat: 55.75, lng: 37.62, name: 'Russie' },          // Moscow
    UA: { lat: 50.45, lng: 30.52, name: 'Ukraine' },          // Kyiv
    IL: { lat: 31.77, lng: 35.21, name: 'Israël' },           // Jerusalem
    PS: { lat: 31.52, lng: 34.46, name: 'Gaza' },             // Gaza City
    IR: { lat: 35.69, lng: 51.39, name: 'Iran' },             // Tehran
    YE: { lat: 15.37, lng: 44.19, name: 'Yémen (Houthis)' }, // Sanaa
    SA: { lat: 24.69, lng: 46.72, name: 'Arabie Saoudite' },  // Riyadh
    SY: { lat: 33.51, lng: 36.29, name: 'Syrie' },            // Damascus
    LB: { lat: 33.89, lng: 35.50, name: 'Liban (Hezbollah)' },  // Beirut
    KP: { lat: 39.03, lng: 125.75, name: 'Corée du Nord' },   // Pyongyang
    CN: { lat: 39.91, lng: 116.39, name: 'Chine' },           // Beijing
    AF: { lat: 34.52, lng: 69.18, name: 'Afghanistan' },      // Kabul
    PK: { lat: 33.72, lng: 73.06, name: 'Pakistan' },         // Islamabad
    IN: { lat: 28.61, lng: 77.21, name: 'Inde' },             // New Delhi
    US: { lat: 38.90, lng: -77.04, name: 'États-Unis' },      // Washington
    MM: { lat: 19.74, lng: 96.08, name: 'Myanmar (junta)' },  // Naypyidaw
    AZ: { lat: 40.41, lng: 49.87, name: 'Azerbaïdjan' },      // Baku
    AM: { lat: 40.18, lng: 44.51, name: 'Arménie' },          // Yerevan
    ET: { lat: 9.02, lng: 38.75, name: 'Éthiopie' },         // Addis Ababa
    SO: { lat: 2.05, lng: 45.34, name: 'Somalie (Al-Shabaab)' },
    ML: { lat: 12.65, lng: -8.00, name: 'Mali' },
};

// Text keyword → aggressor country code
const AGGRESSOR_KEYWORDS: { pattern: RegExp; code: string }[] = [
    { pattern: /\b(russia|russian|kremlin|moscow|putin)\b/i, code: 'RU' },
    { pattern: /\b(ukraine|ukrainian|kyiv|zelensky|uaf)\b/i, code: 'UA' },
    { pattern: /\b(israel|idf|israeli)\b/i, code: 'IL' },
    { pattern: /\b(hamas|gaza|islamic jihad)\b/i, code: 'PS' },
    { pattern: /\b(hezbollah|lebanon|lebanese)\b/i, code: 'LB' },
    { pattern: /\b(iran|iranian|irgc|tehran)\b/i, code: 'IR' },
    { pattern: /\b(houthi|houthis|ansar allah|yemen|sanaa)\b/i, code: 'YE' },
    { pattern: /\b(north korea|dprk|kim jong)\b/i, code: 'KP' },
    { pattern: /\b(china|chinese|pla|beijing)\b/i, code: 'CN' },
    { pattern: /\b(pakistan|pakistani|isi)\b/i, code: 'PK' },
    { pattern: /\b(myanmar|junta|tatmadaw)\b/i, code: 'MM' },
    { pattern: /\b(azerbaijan|azeri|baku)\b/i, code: 'AZ' },
    { pattern: /\b(armenia|armenian|yerevan)\b/i, code: 'AM' },
    { pattern: /\b(ethiopia|ethiopian|tigray)\b/i, code: 'ET' },
    { pattern: /\b(al.?shabaab|somalia)\b/i, code: 'SO' },
    { pattern: /\b(mali|malian)\b/i, code: 'ML' },
    { pattern: /\b(syria|syrian|assad)\b/i, code: 'SY' },
];

// Known theatre → likely aggressors (when text keywords fail)
// Key = impacted country code, value = ranked list of likely launchers
const THEATRE_AGGRESSORS: Record<string, string[]> = {
    UA: ['RU'],          // Ukraine hit → Russia fired
    IL: ['PS', 'LB', 'IR', 'YE'], // Israel hit → Gaza/Hezbollah/Iran/Houthis
    PS: ['IL'],          // Gaza hit → Israel
    SA: ['YE', 'IR'],   // Saudi hit → Houthis/Iran
    IQ: ['IR', 'US'],   // Iraq → Iran-backed or US
    SY: ['IL', 'RU', 'US'],
    LB: ['IL'],
    IN: ['PK', 'CN'],
    PK: ['IN'],
    KR: ['KP'],          // South Korea hit → North Korea
    JP: ['KP', 'CN'],
    TW: ['CN'],
    AM: ['AZ'],
    AZ: ['AM'],
    ET: ['SO'],
};

/**
 * Returns {lat, lng} of the most likely launch origin for a missile/airstrike alert.
 * Returns null if we can't determine it (arc won't be drawn).
 */
export function detectAggressorCoords(
    title: string,
    description: string,
    impactCountryCode: string | undefined | null,
): { lat: number; lng: number; name: string } | null {
    const text = `${title} ${description}`;

    // 1. Try direct keyword match
    for (const { pattern, code } of AGGRESSOR_KEYWORDS) {
        if (pattern.test(text)) {
            const coords = COUNTRY_COORDS[code];
            // Don't use aggressor = target (self-strike doesn't make sense for arcs)
            if (coords && code !== impactCountryCode) {
                return coords;
            }
        }
    }

    // 2. Fall back to known theatre aggressors
    if (impactCountryCode && THEATRE_AGGRESSORS[impactCountryCode]) {
        for (const aggressorCode of THEATRE_AGGRESSORS[impactCountryCode]) {
            const coords = COUNTRY_COORDS[aggressorCode];
            if (coords) return coords;
        }
    }

    return null;
}
