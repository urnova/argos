/**
 * Netlify Function — Express API wrapper
 * Database: set DATABASE_URL env var in Netlify dashboard
 */

import serverless from 'serverless-http';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';
import { registerRoutes } from '../../server/routes';
import { fetchRssAlerts } from '../../server/services/rss';
import { storage } from '../../server/storage';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const httpServer = createServer(app);

let handlerReady = false;
const init = registerRoutes(httpServer, app).then(() => {
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || 'Internal Server Error' });
  });
  handlerReady = true;

  // Fire RSS fetch in background AFTER handler is ready — don't block!
  storage.getAlerts()
    .then(existing => {
      if (existing.length < 5) {
        console.log('[api] DB sparse, background RSS fetch starting...');
        return fetchRssAlerts();
      }
    })
    .then(count => { if (count) console.log(`[api] Background RSS: +${count}`); })
    .catch(e => console.error('[api] Background RSS error:', e));
});

const serverlessHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  try {
    if (!handlerReady) await init;
  } catch (e) {
    console.error('[api] Init failed:', e);
    return { statusCode: 503, body: JSON.stringify({ error: 'Service unavailable', detail: String(e) }) };
  }
  return serverlessHandler(event, context);
};
