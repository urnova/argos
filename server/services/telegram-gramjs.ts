/**
 * Telegram GramJS Integration
 * Connects via MTProto to fetch real-time messages from conflict channels.
 *
 * Setup (one-time):
 *   Run `npm run telegram:session` locally to generate TELEGRAM_SESSION string.
 *   Add TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION to Netlify env vars.
 *
 * In serverless context: connect → fetch last 15min → disconnect.
 */

import { createHash } from 'crypto';
import { storage } from '../storage';

// ── Lazy-import GramJS to avoid crash if package missing ──────────────────────
async function getTelegram() {
  try {
    const { TelegramClient } = await import('telegram');
    const { StringSession } = await import('telegram/sessions/index.js');
    return { TelegramClient, StringSession };
  } catch {
    return null;
  }
}

// ── Channels to monitor ───────────────────────────────────────────────────────
const CHANNELS = [
  'WarMonitors',
  'war_monitor',
  'conflict_news',
  'air_alert_ua',
  'clashreport',
  'DeIta_hub',
  'liveuamap',
  'Middle_East_Spectator',
  'BNONews',
  'kpszsu',
  'intelslava',
];

// ── Country keyword → coords ──────────────────────────────────────────────────
const COUNTRY_GEO: Record<string, { code: string; name: string; lat: number; lng: number }> = {
  ukraine: { code: 'UA', name: 'Ukraine', lat: 49.0, lng: 31.0 },
  russia: { code: 'RU', name: 'Russie', lat: 61.5, lng: 90.0 },
  gaza: { code: 'PS', name: 'Palestine', lat: 31.4, lng: 34.4 },
  israel: { code: 'IL', name: 'Israël', lat: 31.0, lng: 35.0 },
  iran: { code: 'IR', name: 'Iran', lat: 32.4, lng: 53.7 },
  syria: { code: 'SY', name: 'Syrie', lat: 35.0, lng: 38.0 },
  iraq: { code: 'IQ', name: 'Irak', lat: 33.2, lng: 43.7 },
  yemen: { code: 'YE', name: 'Yémen', lat: 15.5, lng: 47.5 },
  lebanon: { code: 'LB', name: 'Liban', lat: 33.9, lng: 35.5 },
  sudan: { code: 'SD', name: 'Soudan', lat: 15.6, lng: 32.5 },
  myanmar: { code: 'MM', name: 'Myanmar', lat: 19.2, lng: 96.7 },
  somalia: { code: 'SO', name: 'Somalie', lat: 5.2, lng: 46.2 },
  afghanistan: { code: 'AF', name: 'Afghanistan', lat: 33.9, lng: 67.7 },
  'north korea': { code: 'KP', name: 'Corée du Nord', lat: 40.0, lng: 127.0 },
  taiwan: { code: 'TW', name: 'Taïwan', lat: 23.7, lng: 121.0 },
  congo: { code: 'CD', name: 'RD Congo', lat: -4.0, lng: 21.8 },
  mali: { code: 'ML', name: 'Mali', lat: 17.6, lng: -2.0 },
  sahel: { code: 'ML', name: 'Sahel', lat: 15.0, lng: 2.0 },
  kyiv: { code: 'UA', name: 'Ukraine', lat: 50.45, lng: 30.52 },
  kharkiv: { code: 'UA', name: 'Ukraine', lat: 49.99, lng: 36.23 },
  kherson: { code: 'UA', name: 'Ukraine', lat: 46.63, lng: 32.62 },
  zaporizhzhia: { code: 'UA', name: 'Ukraine', lat: 47.83, lng: 35.14 },
};

const TYPE_KEYWORDS: { keywords: string[]; type: string; category: string }[] = [
  { keywords: ['missile', 'rocket', 'ballistic', 'launch'], type: 'missile', category: 'MILITARY' },
  { keywords: ['airstrike', 'air strike', 'bomb', 'drone strike', 'aerial'], type: 'airstrike', category: 'MILITARY' },
  { keywords: ['artillery', 'shelling', 'mortar', 'barrage'], type: 'artillery', category: 'MILITARY' },
  { keywords: ['explosion', 'blast', 'explode', 'detonation'], type: 'explosion', category: 'MILITARY' },
  { keywords: ['naval', 'warship', 'fleet', 'sea'], type: 'naval', category: 'MILITARY' },
  { keywords: ['chemical', 'sarin', 'nerve agent'], type: 'chemical', category: 'MILITARY' },
  { keywords: ['nuclear', 'radioactive', 'warhead'], type: 'nuclear', category: 'MILITARY' },
  { keywords: ['massacre', 'genocide', 'mass killing'], type: 'massacre', category: 'HUMANITARIAN' },
  { keywords: ['terror', 'attack', 'suicide bomb'], type: 'terrorism', category: 'HUMANITARIAN' },
  { keywords: ['troops', 'military', 'combat', 'offensive', 'frontline'], type: 'conflict', category: 'MILITARY' },
];

function detectType(text: string): { type: string; category: string } {
  const lower = text.toLowerCase();
  for (const { keywords, type, category } of TYPE_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) return { type, category };
  }
  return { type: 'warning', category: 'GEOPOLITICAL' };
}

function detectCountry(text: string) {
  const lower = text.toLowerCase();
  const entries = Object.entries(COUNTRY_GEO).sort((a, b) => b[0].length - a[0].length);
  for (const [kw, geo] of entries) {
    if (lower.includes(kw)) return geo;
  }
  return null;
}

function detectSeverity(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('nuclear') || lower.includes('genocide') || lower.includes('massacre') || lower.includes('ballistic')) return 'critical';
  if (lower.includes('missile') || lower.includes('airstrike') || lower.includes('dozens killed') || lower.includes('attack')) return 'high';
  if (lower.includes('shelling') || lower.includes('explosion') || lower.includes('clashes')) return 'medium';
  return 'low';
}

function fingerprint(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

// ── Main fetch function ────────────────────────────────────────────────────────
export async function fetchTelegramAlerts(): Promise<number> {
  const apiId = parseInt(process.env.TELEGRAM_API_ID || '');
  const apiHash = process.env.TELEGRAM_API_HASH || '';
  const sessionStr = process.env.TELEGRAM_SESSION || '';

  if (!apiId || !apiHash || !sessionStr) {
    console.log('[telegram] Credentials not set — skipping (need TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION)');
    return 0;
  }

  const lib = await getTelegram();
  if (!lib) {
    console.log('[telegram] GramJS package not available');
    return 0;
  }

  const { TelegramClient, StringSession } = lib;
  const session = new StringSession(sessionStr);
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 2,
    timeout: 20,
    useWSS: true,
  });

  let added = 0;

  try {
    await client.connect();

    // Fetch messages from last 15 minutes (1 cron cycle)
    const cutoff = Date.now() - 15 * 60 * 1000;

    for (const channel of CHANNELS) {
      try {
        const messages = await client.getMessages(channel, { limit: 30 });

        for (const msg of messages) {
          if (!msg.message) continue;

          const msgTime = (msg.date ?? 0) * 1000;
          if (msgTime < cutoff) continue; // older than 15min

          const text = msg.message.slice(0, 500);
          const country = detectCountry(text);
          if (!country) continue;

          const { type, category } = detectType(text);
          const severity = detectSeverity(text);
          if (severity === 'low' && type === 'warning') continue;

          const fp = fingerprint(`tg|${channel}|${msg.id}`);

          const inserted = await storage.createAlertIfNew({
            title: text.slice(0, 150).replace(/\n/g, ' '),
            description: text.slice(0, 300),
            lat: country.lat.toString(),
            lng: country.lng.toString(),
            country: country.name,
            countryCode: country.code,
            source: `https://t.me/${channel}/${msg.id}`,
            type,
            category,
            sourceType: 'TELEGRAM',
            severity,
            status: 'active',
            fingerprint: fp,
            severityScore: severity === 'critical' ? 9 : severity === 'high' ? 7 : severity === 'medium' ? 5 : 3,
            eventStart: new Date(msgTime),
          });

          if (inserted) added++;
        }
      } catch (err) {
        console.warn(`[telegram] Error reading @${channel}:`, err);
      }
    }

    console.log(`[telegram] ✓ Added ${added} Telegram alerts via GramJS`);
  } catch (err) {
    console.error('[telegram] Connection error:', err);
  } finally {
    await client.disconnect();
  }

  return added;
}
