/**
 * Netlify Scheduled Function — RSS + NASA FIRMS + Telegram collector
 * GDELT disabled (trop de doublons / données trop anciennes).
 * Also purges alerts older than 48h to keep the map clean.
 * Schedule: every 15 minutes
 */

import type { Config, Context } from '@netlify/functions';
import { fetchRssAlerts } from '../../server/services/rss';
import { fetchFirmsAlerts } from '../../server/services/nasa-firms';
import { fetchTelegramAlerts } from '../../server/services/telegram-gramjs';
import { storage } from '../../server/storage';

export default async function handler(_req: Request, _ctx: Context) {
  console.log('[cron] Scheduled fetch starting...');

  // Purge old alerts first (keep 48h)
  const purged = await storage.deleteOldAlerts(48).catch(() => 0);
  console.log(`[cron] Purged ${purged} old alerts`);

  // Fetch all sources in parallel (GDELT excluded)
  const [rssCount, firmsCount, tgCount] = await Promise.allSettled([
    fetchRssAlerts(),
    fetchFirmsAlerts(),
    fetchTelegramAlerts(),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : 0));

  console.log(`[cron] Done — RSS: +${rssCount}, FIRMS: +${firmsCount}, TG: +${tgCount}, purged: ${purged}`);

  return new Response(JSON.stringify({ ok: true, rss: rssCount, firms: firmsCount, telegram: tgCount, purged }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = {
  schedule: '0,15,30,45 * * * *',
};
