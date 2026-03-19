/**
 * Source Badge Utility — Argos V4
 * Parses a source URL into a human-readable media name + visual type.
 */

export type SourceKind = 'press' | 'telegram' | 'x' | 'firms' | 'nasa' | 'ucdp' | 'ua-alerts' | 'web';

export interface SourceBadge {
  name: string;
  kind: SourceKind;
  color: string;
}

const PRESS_DOMAINS: Record<string, string> = {
  'reuters.com': 'Reuters',
  'aljazeera.com': 'Al Jazeera',
  'aljazeera.net': 'Al Jazeera',
  'bbc.com': 'BBC',
  'bbc.co.uk': 'BBC',
  'france24.com': 'France 24',
  'dw.com': 'DW',
  'afp.com': 'AFP',
  'apnews.com': 'AP News',
  'theguardian.com': 'The Guardian',
  'nytimes.com': 'NY Times',
  'washingtonpost.com': 'WashPost',
  'lemonde.fr': 'Le Monde',
  'lefigaro.fr': 'Le Figaro',
  'liberation.fr': 'Libération',
  'leparisien.fr': 'Le Parisien',
  'cnn.com': 'CNN',
  'nbcnews.com': 'NBC',
  'foxnews.com': 'Fox News',
  'abcnews.go.com': 'ABC News',
  'cbsnews.com': 'CBS',
  'sky.com': 'Sky News',
  'euronews.com': 'Euronews',
  'rt.com': 'RT',
  'tass.ru': 'TASS',
  'xinhuanet.com': 'Xinhua',
  'kyivindependent.com': 'Kyiv Indep.',
  'ukrinform.ua': 'Ukrinform',
  'timesofisrael.com': 'Times of Israel',
  'haaretz.com': 'Haaretz',
  'middleeasteye.net': 'ME Eye',
  'alarabiya.net': 'Al Arabiya',
  'interfax.ru': 'Interfax',
  'rferl.org': 'RFE/RL',
  'voanews.com': 'VOA',
  'axios.com': 'Axios',
  'politico.com': 'Politico',
  'thehill.com': 'The Hill',
};

export function parseSourceBadge(
  url?: string | null,
  sourceType?: string | null
): SourceBadge {
  // NASA FIRMS satellite data
  if (sourceType === 'FIRMS') {
    return { name: 'NASA FIRMS', kind: 'firms', color: '#FF7700' };
  }

  // UCDP — Uppsala Conflict Data Program
  if (sourceType === 'UCDP') {
    return { name: 'UCDP', kind: 'ucdp', color: '#00FF88' };
  }

  // Ukraine Alerts — alerts.in.ua raids aériens
  if (url?.startsWith('alerts.in.ua') || sourceType === 'UA_ALERTS') {
    return { name: 'UA Alerts', kind: 'ua-alerts', color: '#FFD700' };
  }

  if (!url) {
    return { name: 'RSS', kind: 'web', color: '#FFB800' };
  }

  // Telegram: https://t.me/channel_name/1234
  const tgMatch = url.match(/t\.me\/([^/?#]+)/);
  if (tgMatch) {
    return { name: `@${tgMatch[1]}`, kind: 'telegram', color: '#2AABEE' };
  }

  // Nitter (X/Twitter mirror): https://nitter.net/username/status/...
  const nitterMatch = url.match(/nitter\.[^/]+\/([^/?#]+)/);
  if (nitterMatch && !['status', 'search', 'i'].includes(nitterMatch[1])) {
    return { name: `@${nitterMatch[1]}`, kind: 'x', color: '#E7E9EA' };
  }

  // X/Twitter direct
  const twitterMatch = url.match(/(?:twitter|x)\.com\/([^/?#]+)/);
  if (twitterMatch && !['home', 'search', 'explore', 'i'].includes(twitterMatch[1])) {
    return { name: `@${twitterMatch[1]}`, kind: 'x', color: '#E7E9EA' };
  }

  // Press by known domain
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const name = PRESS_DOMAINS[hostname];
    if (name) return { name, kind: 'press', color: '#FFB800' };
    // Unknown domain: show root domain capitalized
    const root = hostname.split('.').slice(-2, -1)[0] ?? hostname;
    return { name: root.charAt(0).toUpperCase() + root.slice(1), kind: 'web', color: '#666' };
  } catch {
    return { name: 'Web', kind: 'web', color: '#666' };
  }
}

export const KIND_PREFIX: Record<SourceKind, string> = {
  press: '',
  telegram: '',
  x: '',
  firms: '🛰 ',
  nasa: '🛰 ',
  ucdp: '📊 ',
  'ua-alerts': '🚨 ',
  web: '',
};
