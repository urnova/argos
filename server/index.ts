import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { fetchGdeltEvents } from "./services/gdelt";
import { fetchRssAlerts } from "./services/rss";
import { fetchUcdpEvents } from "./services/ucdp";
import { fetchUkraineAlerts } from "./services/ukraine-alerts";
import { refreshAiSummary } from "./services/ai-summary";
import { registerWss, broadcast } from "./ws";

const app = express();
const httpServer = createServer(app);

// ─── WebSocket server ────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
registerWss(wss);

wss.on('connection', (ws) => {
  console.log('[ws] Client connected');
  ws.on('close', () => console.log('[ws] Client disconnected'));
  ws.on('error', (err) => console.error('[ws] Error:', err));
});

declare module "http" {
  interface IncomingMessage { rawBody: unknown; }
}

// Capture raw body for /api/chat BEFORE express.json runs (fixes Express 5 + Vite proxy Buffer bug)
app.use('/api/chat', express.raw({ type: '*/*', limit: '2mb' }), (req: any, _res: any, next: any) => {
  if (Buffer.isBuffer(req.body)) {
    try { req.body = JSON.parse(req.body.toString('utf8')); } catch { req.body = {}; }
  }
  next();
});

// Accept any content-type for POST /api requests (some proxies strip application/json header)
app.use(express.json({
  type: (req: any) => {
    const ct = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (ct === 'application/json' || ct === 'text/plain') return true;
    if (req.method === 'POST' && typeof req.url === 'string' && req.url.startsWith('/api')) return true;
    return false;
  },
  verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  console.log(`${t} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let captured: Record<string, any> | undefined;

  const origJson = res.json;
  res.json = function (body, ...args) {
    captured = body;
    return origJson.apply(res, [body, ...args]);
  };

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      let line = `${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (captured) line += ` :: ${JSON.stringify(captured)}`;
      log(line);
    }
  });
  next();
});

// ─── GDELT Scheduler (every 15 minutes, aligned to clock) ────────────────────
function scheduleGdelt() {
  const msIn15 = 15 * 60 * 1000;
  const msToNext = msIn15 - (Date.now() % msIn15) + 90_000; // +90s buffer

  log(`GDELT: next fetch in ${Math.round(msToNext / 60000)}m${Math.round((msToNext % 60000) / 1000)}s`, 'gdelt');

  setTimeout(async () => {
    const count = await fetchGdeltEvents();
    if (count > 0) {
      broadcast('gdelt_refresh', { count });
      log(`GDELT: pushed ${count} new alerts`, 'gdelt');
    }
    scheduleGdelt();
  }, msToNext);
}

// ─── RSS Scheduler (every 10 minutes) ────────────────────────────────────────
function scheduleRss() {
  const INTERVAL = 10 * 60 * 1000;
  setInterval(async () => {
    try {
      const count = await fetchRssAlerts();
      if (count > 0) {
        broadcast('rss_refresh', { count });
        log(`RSS: pushed ${count} new alerts`, 'rss');
      }
    } catch (err) {
      log(`RSS scheduler error: ${err}`, 'rss');
    }
  }, INTERVAL);
}

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);

    // Initial GDELT fetch 30s after startup
    setTimeout(async () => {
      log('Running initial GDELT fetch...', 'gdelt');
      const count = await fetchGdeltEvents();
      if (count > 0) broadcast('gdelt_refresh', { count });
      scheduleGdelt();
    }, 30_000);

    // Initial RSS fetch 60s after startup, then every 10 min
    setTimeout(async () => {
      log('Running initial RSS fetch...', 'rss');
      try {
        const count = await fetchRssAlerts();
        if (count > 0) broadcast('rss_refresh', { count });
      } catch (err) {
        log(`Initial RSS error: ${err}`, 'rss');
      }
      scheduleRss();
    }, 60_000);

    // UCDP : fetch initial 90s après démarrage, puis toutes les 6h (données quasi-statiques)
    setTimeout(async () => {
      log('Running initial UCDP fetch...', 'ucdp');
      const count = await fetchUcdpEvents();
      if (count > 0) broadcast('gdelt_refresh', { count });
      setInterval(async () => {
        const n = await fetchUcdpEvents();
        if (n > 0) broadcast('gdelt_refresh', { count: n });
      }, 6 * 60 * 60 * 1000);
    }, 90_000);

    // Ukraine Alerts : toutes les 2 minutes (alertes raids aériens en temps réel)
    setTimeout(async () => {
      log('Running initial Ukraine Alerts fetch...', 'ua-alerts');
      const count = await fetchUkraineAlerts();
      if (count > 0) broadcast('rss_refresh', { count });
      setInterval(async () => {
        const n = await fetchUkraineAlerts();
        if (n > 0) broadcast('rss_refresh', { count: n });
      }, 2 * 60 * 1000);
    }, 120_000);

    // ── Briefing Argos IA — 1 par heure, persisté en DB, identique pour tous ──
    // Premier briefing 3 minutes après démarrage (laisser les données s'accumuler)
    setTimeout(async () => {
      log('Generating initial Argos IA briefing...', 'briefing');
      try { await refreshAiSummary(); } catch (e) { log(`Briefing error: ${e}`, 'briefing'); }

      // Puis toutes les heures pile (aligné sur l'horloge)
      const msToNextHour = (60 - new Date().getMinutes()) * 60_000 - new Date().getSeconds() * 1000;
      setTimeout(() => {
        const generate = async () => {
          log('Generating hourly Argos IA briefing...', 'briefing');
          try { await refreshAiSummary(); } catch (e) { log(`Briefing error: ${e}`, 'briefing'); }
        };
        generate();
        setInterval(generate, 60 * 60 * 1000);
      }, msToNextHour);
    }, 3 * 60_000);
  });
})();
