/**
 * RSS Feed Service
 * Fetches conflict-related news from Reuters, AP, and Al Jazeera RSS feeds.
 * Parses XML, extracts geo/type/severity hints from keywords, and stores
 * new alerts in the database. Used as a supplement to GDELT (15-min cadence).
 */

import { createHash } from 'crypto';
import { storage } from '../storage';
import { detectAggressorCoords } from '../../shared/aggressor-detection';
import { classifyAlert } from './groq-classifier';

// ── SHA-256 fingerprint (32-char prefix) ──────────────────────────────────────
function fingerprint(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

// ── Severity score 1-10 ───────────────────────────────────────────────────────
function getSeverityScore(text: string, type: string): number {
    const lower = text.toLowerCase();
    // ALERTES (événements actifs)
    if (type === 'nuclear' || lower.includes('nuclear') || lower.includes('chemical weapon') || lower.includes('genocide')) return 10;
    if (type === 'missile' || lower.includes('ballistic') || lower.includes('icbm')) return 9;
    if (type === 'massacre' || lower.includes('mass kill') || lower.includes('mass murder')) return 9;
    if (type === 'airstrike' || lower.includes('air strike') || lower.includes('bombing')) return 8;
    if (type === 'explosion' || type === 'terrorism' || lower.includes('dozens killed') || lower.includes('hundreds killed')) return 7;
    if (type === 'naval' || type === 'artillery') return 6;
    if (type === 'conflict' || lower.includes('offensive') || lower.includes('combat')) return 5;
    if (type === 'coup' || lower.includes('coup')) return 5;
    // INFORMATIONS (scores bas — cohérent avec la catégorie INFO)
    if (type === 'breaking') return 4;
    if (type === 'humanitarian' || lower.includes('killed') || lower.includes('casualties') || lower.includes('dead')) return 4;
    if (type === 'military-move' || type === 'sanctions' || type === 'warning') return 3;
    if (type === 'protest' || lower.includes('clashes') || lower.includes('unrest')) return 3;
    if (type === 'diplomatic' || type === 'political') return 2;
    if (lower.includes('tensions') || lower.includes('deployment')) return 2;
    return 1; // type === 'info' et tout le reste
}


const RSS_FEEDS = [
    // ── Agences de presse classiques ──────────────────────────────────────────
    { name: 'Reuters World', url: 'https://feeds.reuters.com/reuters/worldNews', region: 'global', sourceType: 'RSS' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', region: 'mideast', sourceType: 'RSS' },
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: 'global', sourceType: 'RSS' },
    { name: 'AFP/World', url: 'https://rss.app/feeds/v1/latest/8L1wD6p4Yp4qX6p4.xml', region: 'global', sourceType: 'RSS' },
    { name: 'France24 EN', url: 'https://www.france24.com/en/rss', region: 'global', sourceType: 'RSS' },
    { name: 'DW World', url: 'https://rss.dw.com/rdf/rss-en-all', region: 'global', sourceType: 'RSS' },

    // ── Canaux Telegram via RSSHub (temps réel, pas besoin de clé) ────────────
    // Alertes missiles & air raid (priorité maximale)
    { name: 'UA Air Force', url: 'https://rsshub.app/telegram/channel/kpszsu', region: 'ukraine', sourceType: 'TELEGRAM' },
    { name: 'War Monitor', url: 'https://rsshub.app/telegram/channel/war_monitor', region: 'global', sourceType: 'TELEGRAM' },
    { name: 'ME Spectator', url: 'https://rsshub.app/telegram/channel/Middle_East_Spectator', region: 'mideast', sourceType: 'TELEGRAM' },

    // Breaking news mondiales
    { name: 'Conflict News', url: 'https://rsshub.app/telegram/channel/conflict_news', region: 'global', sourceType: 'TELEGRAM' },
    { name: 'WarMonitors', url: 'https://rsshub.app/telegram/channel/WarMonitors', region: 'global', sourceType: 'TELEGRAM' },
    { name: 'LiveUAMap', url: 'https://rsshub.app/telegram/channel/liveuamap', region: 'ukraine', sourceType: 'TELEGRAM' },
    { name: 'BNO News', url: 'https://rsshub.app/telegram/channel/BNONews', region: 'global', sourceType: 'TELEGRAM' },

    // Validation & sources officielles
    { name: 'Spectator Index', url: 'https://rsshub.app/telegram/channel/spectatorindex', region: 'global', sourceType: 'TELEGRAM' },
    { name: 'Acta World', url: 'https://rsshub.app/telegram/channel/actaworldnews', region: 'global', sourceType: 'TELEGRAM' },

    // OSINT (surveillance - sources partisanes signalées)
    { name: 'Intel Slava', url: 'https://rsshub.app/telegram/channel/intelslava', region: 'ukraine', sourceType: 'TELEGRAM' },
    { name: 'Rybar', url: 'https://rsshub.app/telegram/channel/rybar', region: 'ukraine', sourceType: 'TELEGRAM' },

    // Canaux additionnels haute priorité
    { name: 'Air Alert UA', url: 'https://rsshub.app/telegram/channel/air_alert_ua', region: 'ukraine', sourceType: 'TELEGRAM' },
    { name: 'Clash Report', url: 'https://rsshub.app/telegram/channel/clashreport', region: 'global', sourceType: 'TELEGRAM' },
    { name: 'Delta Hub', url: 'https://rsshub.app/telegram/channel/DeIta_hub', region: 'global', sourceType: 'TELEGRAM' },
    { name: 'RE Market News', url: 'https://rsshub.app/telegram/channel/RE_MarketNews', region: 'global', sourceType: 'TELEGRAM' },

    // Twitter/X via Nitter RSS (AFP, Reuters, BNO)
    { name: 'AFP via Nitter', url: 'https://nitter.poast.org/AFP/rss', region: 'global', sourceType: 'RSS' },
    { name: 'BNO via Nitter', url: 'https://nitter.poast.org/BNONews/rss', region: 'global', sourceType: 'RSS' },
    { name: 'Reuters via Nitter', url: 'https://nitter.poast.org/Reuters/rss', region: 'global', sourceType: 'RSS' },
];


// ── Keyword → Alert Type mapping ────────────────────────────────────────────
const TYPE_KEYWORDS: { keywords: string[]; type: string; category: string }[] = [
    { keywords: ['missile', 'rocket', 'ballistic', 'icbm', 'scud'], type: 'missile', category: 'MILITARY' },
    { keywords: ['airstrike', 'air strike', 'bombing', 'bomb', 'warplane', 'jet', 'drone strike', 'aerial'], type: 'airstrike', category: 'MILITARY' },
    { keywords: ['artillery', 'shelling', 'mortar', 'barrage', 'cannon'], type: 'artillery', category: 'MILITARY' },
    { keywords: ['naval', 'warship', 'destroyer', 'frigate', 'submarine', 'fleet', 'sea battle'], type: 'naval', category: 'MILITARY' },
    { keywords: ['explosion', 'blast', 'explode', 'detonation'], type: 'explosion', category: 'MILITARY' },
    { keywords: ['chemical weapon', 'chlorine', 'sarin', 'nerve agent'], type: 'chemical', category: 'MILITARY' },
    { keywords: ['nuclear', 'radioactive', 'uranium', 'plutonium', 'warhead'], type: 'nuclear', category: 'MILITARY' },
    { keywords: ['cyberattack', 'cyber attack', 'hacked', 'ransomware', 'malware', 'ddos'], type: 'cyber', category: 'MILITARY' },
    { keywords: ['coup', 'putsch', 'junta', 'overthrow', 'mutiny'], type: 'coup', category: 'POLITICAL' },
    { keywords: ['sanction', 'embargo', 'freeze', 'asset'], type: 'sanctions', category: 'POLITICAL' },
    { keywords: ['massacre', 'genocide', 'ethnic cleansing', 'mass killing', 'atrocity'], type: 'massacre', category: 'HUMANITARIAN' },
    { keywords: ['terror', 'terrorist', 'attack', 'suicide bomb', 'isis', 'al-qaeda', 'boko haram'], type: 'terrorism', category: 'HUMANITARIAN' },
    { keywords: ['protest', 'demonstration', 'riot', 'uprising', 'clashes', 'unrest'], type: 'protest', category: 'GEOPOLITICAL' },
    { keywords: ['troops', 'military', 'soldiers', 'forces', 'combat', 'battle', 'offensive', 'frontline'], type: 'conflict', category: 'MILITARY' },
];

// ── Country name → ISO2 + coords ─────────────────────────────────────────────
const COUNTRY_GEO: Record<string, { code: string; name: string; lat: number; lng: number }> = {
    ukraine: { code: 'UA', name: 'Ukraine', lat: 49.0, lng: 31.0 },
    russia: { code: 'RU', name: 'Russie', lat: 61.5, lng: 90.0 },
    gaza: { code: 'PS', name: 'Palestine', lat: 31.4, lng: 34.4 },
    palestine: { code: 'PS', name: 'Palestine', lat: 31.9, lng: 35.2 },
    israel: { code: 'IL', name: 'Israël', lat: 31.0, lng: 35.0 },
    iran: { code: 'IR', name: 'Iran', lat: 32.4, lng: 53.7 },
    syria: { code: 'SY', name: 'Syrie', lat: 35.0, lng: 38.0 },
    iraq: { code: 'IQ', name: 'Irak', lat: 33.2, lng: 43.7 },
    yemen: { code: 'YE', name: 'Yémen', lat: 15.5, lng: 47.5 },
    sudan: { code: 'SD', name: 'Soudan', lat: 15.6, lng: 32.5 },
    'north korea': { code: 'KP', name: 'Corée du Nord', lat: 40.0, lng: 127.0 },
    taiwan: { code: 'TW', name: 'Taïwan', lat: 23.7, lng: 121.0 },
    china: { code: 'CN', name: 'Chine', lat: 35.9, lng: 104.2 },
    myanmar: { code: 'MM', name: 'Myanmar', lat: 19.2, lng: 96.7 },
    somalia: { code: 'SO', name: 'Somalie', lat: 5.2, lng: 46.2 },
    afghanistan: { code: 'AF', name: 'Afghanistan', lat: 33.9, lng: 67.7 },
    lebanon: { code: 'LB', name: 'Liban', lat: 33.9, lng: 35.5 },
    libya: { code: 'LY', name: 'Libye', lat: 26.3, lng: 17.2 },
    mali: { code: 'ML', name: 'Mali', lat: 17.6, lng: -2.0 },
    ethiopia: { code: 'ET', name: 'Éthiopie', lat: 9.1, lng: 40.5 },
    nigeria: { code: 'NG', name: 'Nigéria', lat: 9.1, lng: 8.7 },
    pakistan: { code: 'PK', name: 'Pakistan', lat: 30.4, lng: 69.3 },
    congo: { code: 'CD', name: 'RD Congo', lat: -4.0, lng: 21.8 },
    haiti: { code: 'HT', name: 'Haïti', lat: 19.0, lng: -72.3 },
    venezuela: { code: 'VE', name: 'Venezuela', lat: 6.4, lng: -66.6 },
    serbia: { code: 'RS', name: 'Serbie', lat: 44.0, lng: 21.0 },
    kosovo: { code: 'XK', name: 'Kosovo', lat: 42.6, lng: 20.9 },
    georgia: { code: 'GE', name: 'Géorgie', lat: 42.3, lng: 43.4 },
    'south sudan': { code: 'SS', name: 'Soudan du Sud', lat: 7.8, lng: 29.7 },
    mozambique: { code: 'MZ', name: 'Mozambique', lat: -18.7, lng: 35.0 },
    azerbaijan: { code: 'AZ', name: 'Azerbaïdjan', lat: 40.1, lng: 47.6 },
    armenia: { code: 'AM', name: 'Arménie', lat: 40.1, lng: 45.0 },
};

function detectTypeAndCategory(text: string): { type: string; category: string } {
    const lower = text.toLowerCase();
    for (const { keywords, type, category } of TYPE_KEYWORDS) {
        if (keywords.some(kw => lower.includes(kw))) {
            return { type, category };
        }
    }
    return { type: 'info', category: 'INFO' };
}

function detectCountry(text: string): { code: string; name: string; lat: number; lng: number } | null {
    const lower = text.toLowerCase();
    // Sort by length descending to match more specific first (e.g., "north korea" before "korea")
    const entries = Object.entries(COUNTRY_GEO).sort((a, b) => b[0].length - a[0].length);
    for (const [keyword, geo] of entries) {
        if (lower.includes(keyword)) return geo;
    }
    return null;
}

function detectSeverity(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('nuclear') || lower.includes('genocide') || lower.includes('massacre')
        || lower.includes('chemical weapon') || lower.includes('ballistic') || lower.includes('mass kill')) {
        return 'critical';
    }
    if (lower.includes('missile') || lower.includes('airstrike') || lower.includes('offensive')
        || lower.includes('dozens killed') || lower.includes('hundreds killed') || lower.includes('attack')) {
        return 'high';
    }
    if (lower.includes('troops') || lower.includes('shelling') || lower.includes('explosion')
        || lower.includes('clashes') || lower.includes('fighting')) {
        return 'medium';
    }
    return 'low';
}

// ── Minimal XML RSS parser (no external dependencies) ─────────────────────────
function parseRss(xml: string): { title: string; description: string; link: string; pubDate: string }[] {
    const items: { title: string; description: string; link: string; pubDate: string }[] = [];
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const get = (tag: string) => {
            const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
            return m ? m[1].trim() : '';
        };
        const title = get('title');
        const description = get('description');
        const link = get('link') || get('guid');
        const pubDate = get('pubDate');
        if (title && link) items.push({ title, description, link, pubDate });
    }
    return items;
}

// ── Main RSS fetch ─────────────────────────────────────────────────────────────
export async function fetchRssAlerts(): Promise<number> {
    let added = 0;
    const existing = await storage.getAlerts();
    const seenSources = new Set(existing.map(a => a.source).filter(Boolean));

    for (const feed of RSS_FEEDS) {
        try {
            // Try direct fetch first, fall back to rss2json.com proxy
            let items: { title: string; description: string; link: string; pubDate: string }[] = [];

            try {
                const res = await fetch(feed.url, {
                    signal: AbortSignal.timeout(12_000),
                    headers: { 'User-Agent': 'AMC-ConflictMonitor/2.0' },
                });
                if (res.ok) {
                    const xml = await res.text();
                    items = parseRss(xml);
                } else {
                    throw new Error(`HTTP ${res.status}`);
                }
            } catch {
                // Fallback: rss2json.com public proxy (no key needed, 10k/day free)
                const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
                const proxyRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(12_000) });
                if (proxyRes.ok) {
                    const data = await proxyRes.json() as { status: string; items?: { title: string; description: string; link: string; guid: string; pubDate: string }[] };
                    if (data.status === 'ok' && data.items) {
                        items = data.items.map(i => ({
                            title: i.title,
                            description: i.description ?? '',
                            link: i.link || i.guid,
                            pubDate: i.pubDate,
                        }));
                    }
                }
                if (items.length === 0) {
                    console.warn(`[rss] ${feed.name}: both direct and proxy failed`);
                    continue;
                }
            }

            for (const item of items) {
                if (seenSources.has(item.link)) continue;

                // TTL: Telegram → 30min, RSS classique → 4h
                if (item.pubDate) {
                    const age = Date.now() - new Date(item.pubDate).getTime();
                    const ttl = feed.sourceType === 'TELEGRAM' ? 30 * 60 * 1000 : 4 * 60 * 60 * 1000;
                    if (!isNaN(age) && age > ttl) continue;
                }

                const combined = `${item.title} ${item.description}`;
                const country = detectCountry(combined);

                // Skip articles not mentioning a known conflict country
                if (!country) continue;

                // With GROQ: default to info/low — AI will correct
                // Without GROQ: use keyword-based classification
                const hasGroq = !!process.env.GROQ_API_KEY;
                const { type: kwType, category: kwCategory } = detectTypeAndCategory(combined);
                const kwSeverity = detectSeverity(combined);

                const type = hasGroq ? 'info' : kwType;
                const category = hasGroq ? 'INFO' : kwCategory;
                const severity = hasGroq ? 'low' : kwSeverity;

                // Without GROQ: skip generic low-severity pure-info articles
                if (!hasGroq && kwSeverity === 'low' && kwType === 'info') continue;

                // Clean up HTML entities from title and description
                const cleanTitle = item.title
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/<[^>]+>/g, '');

                const cleanDesc = item.description
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/<[^>]+>/g, '')
                    .trim()
                    .slice(0, 300);

                // Origin coords computed after AI confirms missile/airstrike (see Groq callback below)
                // Not set here to avoid false animations on keyword matches

                const fp = fingerprint(item.link);
                const eventStart = item.pubDate ? new Date(item.pubDate) : new Date();

                // Cross-source dedup: skip if a recent alert of same type+country exists (within 90 min)
                // Always use keyword-detected type for dedup (even when Groq reclassifies later)
                const DEDUP_TYPES = new Set(['missile','airstrike','artillery','explosion','nuclear','chemical','massacre','terrorism','naval']);
                if (DEDUP_TYPES.has(kwType) && country.code) {
                    const similar = await storage.findRecentSimilar(country.code, kwType, 90);
                    if (similar) continue;
                }

                const inserted = await storage.createAlertIfNew({
                    title: cleanTitle.slice(0, 200),
                    description: cleanDesc || `Source: ${feed.name}`,
                    lat: country.lat.toString(),
                    lng: country.lng.toString(),
                    country: country.name,
                    countryCode: country.code,
                    source: item.link,
                    type,
                    category,
                    sourceType: feed.sourceType as 'RSS' | 'TELEGRAM',
                    severity,
                    status: 'active',
                    fingerprint: fp,
                    severityScore: hasGroq ? 1 : getSeverityScore(combined, kwType),
                    eventStart,
                    // originLat/originLng set only after AI confirms missile/airstrike
                });

                if (!inserted) continue; // duplicate fingerprint
                seenSources.add(item.link);
                added++;

                // Fire-and-forget Groq classification (non-blocking)
                const alertId = inserted.id;
                classifyAlert(cleanTitle, cleanDesc).then(async (ai) => {
                  if (!ai) {
                    // No Groq key or error — mark as auto-verified with keyword classification
                    await storage.updateAlert(alertId, {
                      aiVerified: true,
                      aiLabel: cleanTitle.slice(0, 100),
                      type: kwType,
                      severity: kwSeverity,
                      severityScore: getSeverityScore(combined, kwType),
                    }).catch(() => {});
                    return;
                  }
                  if (!ai.relevant) {
                    // AI says not relevant — soft-delete
                    await storage.updateAlert(alertId, { aiVerified: false, isActive: false }).catch(() => {});
                    return;
                  }
                  // Compute origin coords only if AI confirms it's a real missile/airstrike
                  let originData: Record<string, string> = {};
                  if (ai.type === 'missile' || ai.type === 'airstrike') {
                    const origin = detectAggressorCoords(cleanTitle, cleanDesc, country.code);
                    if (origin) {
                      originData = { originLat: origin.lat.toString(), originLng: origin.lng.toString() };
                    }
                  }
                  // Update with AI-corrected classification + French summary
                  await storage.updateAlert(alertId, {
                    aiVerified: true,
                    aiLabel: ai.label,
                    description: ai.summary || combined.slice(0, 300), // résumé FR généré par Groq
                    type: ai.type,
                    severity: ai.severity,
                    severityScore: getSeverityScore(combined, ai.type),
                    ...originData,
                  }).catch(() => {});
                }).catch(() => {});

                if (added >= 60) break;
            }
        } catch (err) {
            console.error(`[rss] Error fetching ${feed.name}:`, err);
        }
    }

    console.log(`[rss] ✓ Added ${added} RSS alerts`);
    return added;
}
