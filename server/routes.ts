import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { broadcast } from "./ws";
import { addSseClient, removeSseClient, broadcastSse } from "./sse";
import { fetchGdeltEvents } from "./services/gdelt";
import { fetchRssAlerts } from "./services/rss";
import { getCountryTension } from "./services/country-tension";
import { fetchFirmsAlerts } from "./services/nasa-firms";
import { getAiSummary, refreshAiSummary } from "./services/ai-summary";
import { chatWithArgos, streamChatWithArgos, nextAvailableIn } from "./services/ai-chat";
import { runMigrations, pool } from "./db";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Auto-migrate DB schema (safe: IF NOT EXISTS) ───────────────────────────
  await runMigrations();

  // ── Purge all GDELT alerts (source désactivée — trop de doublons) ──────────
  pool.query(`DELETE FROM alerts WHERE source_type = 'GDELT'`)
    .then((r: { rowCount: number }) => { if (r.rowCount) console.log(`[db] Purged ${r.rowCount} GDELT alerts`); })
    .catch(() => {});

  // ── Auto-cleanup: delete alerts older than 72h ─────────────────────────────
  storage.deleteOldAlerts(72).catch(() => {});

  // Seed data function
  async function seedDatabase() {
    const existingAlerts = await storage.getAlerts();
    if (existingAlerts.length === 0) {
      console.log("Seeding database with initial alerts...");

      const seeds = [
        {
          title: "Frappe aérienne — Gaza City",
          description: "Acteurs: IL MIL / PS MIL. Secteur: Gaza City, Palestine. Indice Goldstein: -10.0/10.",
          lat: "31.5", lng: "34.4", country: "Palestine", countryCode: "PS",
          source: null, type: "airstrike", category: "MILITARY", sourceType: "MANUAL", severity: "critical", status: "active"
        },
        {
          title: "Bombardement d'artillerie — Kharkiv Oblast",
          description: "Acteurs: RU MILX / UA MIL. Secteur: Kharkiv, Ukraine. Indice Goldstein: -8.5/10.",
          lat: "50.0", lng: "36.2", country: "Ukraine", countryCode: "UA",
          source: null, type: "artillery", category: "MILITARY", sourceType: "MANUAL", severity: "critical", status: "active"
        },
        {
          title: "Opération militaire — Pyongyang",
          description: "Acteurs: KP MILX. Secteur: Pyongyang, Corée du Nord. Indice Goldstein: -9.0/10.",
          lat: "39.0", lng: "125.8", country: "Corée du Nord", countryCode: "KP",
          source: null, type: "missile", category: "MILITARY", sourceType: "MANUAL", severity: "critical", status: "active"
        },
        {
          title: "Assaut armé — Détroit de Taïwan",
          description: "Manœuvres militaires PLA — zone d'exclusion. Secteur: Taiwan Strait. Indice Goldstein: -7.0/10.",
          lat: "24.5", lng: "122.0", country: "Taïwan", countryCode: "TW",
          source: null, type: "conflict", category: "MILITARY", sourceType: "MANUAL", severity: "high", status: "active"
        },
        {
          title: "Coup d'État — Bamako",
          description: "Junta militaire — dissolution du gouvernement. Secteur: Mali.",
          lat: "12.6", lng: "-8.0", country: "Mali", countryCode: "ML",
          source: null, type: "coup", category: "POLITICAL", sourceType: "MANUAL", severity: "high", status: "active"
        },
        {
          title: "Sanctions économiques — Moscou",
          description: "Nouvelles sanctions OTAN contre le secteur énergétique russe.",
          lat: "55.7", lng: "37.6", country: "Russie", countryCode: "RU",
          source: null, type: "sanctions", category: "POLITICAL", sourceType: "MANUAL", severity: "medium", status: "active"
        },
        {
          title: "Attaque terroriste — Mogadiscio",
          description: "Attentat Al-Shabaab dans le centre gouvernemental. Secteur: Mogadiscio, Somalie.",
          lat: "2.0", lng: "45.3", country: "Somalie", countryCode: "SO",
          source: null, type: "terrorism", category: "HUMANITARIAN", sourceType: "MANUAL", severity: "high", status: "active"
        },
        {
          title: "Massacre de masse — Darfour",
          description: "Violences RSF contre des civils. Secteur: Darfour, Soudan. Victimes reportées.",
          lat: "13.5", lng: "25.0", country: "Soudan", countryCode: "SD",
          source: null, type: "massacre", category: "HUMANITARIAN", sourceType: "MANUAL", severity: "critical", status: "active"
        },
        {
          title: "Cyberattaque d'infrastructure — Kiev",
          description: "Attaque cybernetique sur le réseau électrique ukrainien. Source: CERT-UA.",
          lat: "50.4", lng: "30.5", country: "Ukraine", countryCode: "UA",
          source: null, type: "cyber", category: "MILITARY", sourceType: "MANUAL", severity: "high", status: "active"
        },
        {
          title: "Manifestation armée — Caracas",
          description: "Opposants armés dans les rues de Caracas. Tensions politiques extrêmes.",
          lat: "10.5", lng: "-66.9", country: "Venezuela", countryCode: "VE",
          source: null, type: "protest", category: "GEOPOLITICAL", sourceType: "MANUAL", severity: "medium", status: "active"
        },
        {
          title: "Explosion — Kaboul",
          description: "Explosion dans un marché central. Taliban revendiquent la zone.",
          lat: "34.5", lng: "69.2", country: "Afghanistan", countryCode: "AF",
          source: null, type: "explosion", category: "MILITARY", sourceType: "MANUAL", severity: "high", status: "active"
        },
        {
          title: "Blocus naval — Mer de Chine Sud",
          description: "Navires militaires chinois bloquent les eaux revendiquées. Zone: Spratley Islands.",
          lat: "9.5", lng: "113.0", country: "Chine", countryCode: "CN",
          source: null, type: "naval", category: "MILITARY", sourceType: "MANUAL", severity: "medium", status: "active"
        },
        {
          title: "Alerte sécuritaire — Liban Sud",
          description: "Mouvements de troupes signalés près de la frontière israélienne. UNIFIL alerte.",
          lat: "33.2", lng: "35.6", country: "Liban", countryCode: "LB",
          source: null, type: "warning", category: "GEOPOLITICAL", sourceType: "MANUAL", severity: "medium", status: "active"
        },
      ];

      for (const seed of seeds) {
        await storage.createAlert(seed as any);
      }
    }

    const existingKeys = await storage.getApiKeys();
    if (existingKeys.length === 0) {
      await storage.createApiKey({
        name: "Default Discord Bot",
        key: "astral_test_key_12345"
      });
    }
  }

  seedDatabase().catch(console.error);


  // ── GET /api/alerts ────────────────────────────────────────────────────────
  app.get(api.alerts.list.path, async (req, res) => {
    try {
      const alertsList = await storage.getAlerts();
      res.json(alertsList);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── GET /api/events — Server-Sent Events (Netlify-compatible) ────────────────
  // EventSource auto-reconnects; Last-Event-ID lets us replay missed alerts.
  // We close after 20s to stay within Netlify Function's 26s timeout.
  app.get('/api/events', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Replay any alerts missed since last connection
    const rawLastId = req.headers['last-event-id'];
    const lastId = rawLastId ? parseInt(rawLastId as string, 10) : 0;
    if (lastId > 0) {
      try {
        const missed = await storage.getAlertsAfter(lastId);
        for (const alert of missed) {
          res.write(`id: ${alert.id}\ndata: ${JSON.stringify({ type: 'alert_created', payload: alert })}\n\n`);
        }
      } catch { /* ignore */ }
    }

    // Register client
    addSseClient(res);

    // Keepalive every 15s (prevents proxy timeouts)
    const keepalive = setInterval(() => { res.write(': keepalive\n\n'); }, 15_000);

    // Auto-close after 20s for Netlify compatibility (EventSource reconnects automatically)
    const autoClose = setTimeout(() => {
      clearInterval(keepalive);
      removeSseClient(res);
      res.end();
    }, 20_000);

    req.on('close', () => {
      clearInterval(keepalive);
      clearTimeout(autoClose);
      removeSseClient(res);
    });
  });

  // ── GET /api/alerts/country/:code ──────────────────────────────────────────
  app.get('/api/alerts/country/:code', async (req, res) => {
    try {
      const alerts = await storage.getAlertsByCountry(req.params.code.toUpperCase());
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── GET /api/alerts/:id ────────────────────────────────────────────────────
  app.get(api.alerts.get.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const alert = await storage.getAlert(id);
      if (!alert) return res.status(404).json({ message: "Alert not found" });
      res.json(alert);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/alerts (protected by API key) ────────────────────────────────
  app.post(api.alerts.create.path, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Bearer token required" });
      }
      const key = authHeader.split(' ')[1];
      const isValid = await storage.validateApiKey(key);
      if (!isValid) return res.status(401).json({ message: "Invalid API Key" });

      const input = api.alerts.create.input.parse(req.body);
      const newAlert = await storage.createAlert(input);

      broadcast('alert_created', newAlert);
      broadcastSse('alert_created', newAlert, newAlert.id);

      res.status(201).json(newAlert);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── PUT /api/alerts/:id ────────────────────────────────────────────────────
  app.put(api.alerts.update.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.alerts.update.input.parse(req.body);
      const existing = await storage.getAlert(id);
      if (!existing) return res.status(404).json({ message: "Alert not found" });
      const updated = await storage.updateAlert(id, input);
      broadcast('alert_updated', updated);
      broadcastSse('alert_updated', updated, updated.id);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── DELETE /api/alerts/:id ─────────────────────────────────────────────────
  app.delete(api.alerts.delete.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteAlert(id);
      broadcast('alert_deleted', { id });
      broadcastSse('alert_deleted', { id });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/gdelt/trigger (manual GDELT fetch) ───────────────────────────
  app.post('/api/gdelt/trigger', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Bearer token required" });
      }
      const isValid = await storage.validateApiKey(authHeader.split(' ')[1]);
      if (!isValid) return res.status(401).json({ message: "Invalid API Key" });

      const count = await fetchGdeltEvents();
      if (count > 0) broadcast('gdelt_refresh', { count });
      res.json({ message: `GDELT fetch complete`, newAlerts: count });
    } catch (err) {
      res.status(500).json({ message: "GDELT fetch failed" });
    }
  });

  // ── POST /api/rss/trigger (manual RSS fetch) ───────────────────────────────
  app.post('/api/rss/trigger', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Bearer token required" });
      }
      const isValid = await storage.validateApiKey(authHeader.split(' ')[1]);
      if (!isValid) return res.status(401).json({ message: "Invalid API Key" });

      const count = await fetchRssAlerts();
      if (count > 0) { broadcast('rss_refresh', { count }); broadcastSse('rss_refresh', { count }); }
      res.json({ message: `RSS fetch complete`, newAlerts: count });
    } catch (err) {
      res.status(500).json({ message: "RSS fetch failed" });
    }
  });

  // ── POST /api/firms/trigger (manual NASA FIRMS fetch) ───────────────────────
  app.post('/api/firms/trigger', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Bearer token required" });
      }
      const isValid = await storage.validateApiKey(authHeader.split(' ')[1]);
      if (!isValid) return res.status(401).json({ message: "Invalid API Key" });

      const count = await fetchFirmsAlerts();
      if (count > 0) broadcast('firms_refresh', { count });
      res.json({ message: `NASA FIRMS fetch complete`, newAlerts: count });
    } catch (err) {
      res.status(500).json({ message: "FIRMS fetch failed" });
    }
  });

  // ── POST /api/alerts/cleanup (delete alerts older than N hours) ────────────
  app.post('/api/alerts/cleanup', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Bearer token required" });
      }
      const isValid = await storage.validateApiKey(authHeader.split(' ')[1]);
      if (!isValid) return res.status(401).json({ message: "Invalid API Key" });

      const hours = Number(req.body?.hours ?? 48);
      const deleted = await storage.deleteOldAlerts(hours);
      broadcast('alerts_cleanup', { deleted });
      res.json({ message: `Deleted ${deleted} alerts older than ${hours}h`, deleted });
    } catch (err) {
      res.status(500).json({ message: "Cleanup failed" });
    }
  });

  // ── GET /api/summary — AI situational briefing (cached 1h) ───────────────────
  app.get('/api/summary', async (_req, res) => {
    try {
      const summary = await getAiSummary();
      if (!summary) {
        // No briefing in DB yet — trigger background generation if key exists
        if (process.env.GROQ_API_KEY) {
          refreshAiSummary().catch(() => {});
        }
        return res.json(null); // Client shows "en cours de génération"
      }
      res.json(summary);
    } catch {
      res.status(500).json({ message: 'Summary failed' });
    }
  });

  // ── POST /api/chat — interactive AI (streaming SSE) ──────────────────────
  app.post('/api/chat', async (req, res) => {
    // Defensive body parsing — handles 3 cases that occur in Express 5 + Vite proxy:
    // 1. Normal: req.body = { messages: [...] }
    // 2. Buffer serialized as JSON: req.body = { type:'Buffer', data:[123,...] }
    // 3. rawBody fallback (verify callback was called)
    let body: any = req.body;
    if (!body?.messages) {
      // Case 2: body-parser received a Buffer and JSON.stringified it
      if (body?.type === 'Buffer' && Array.isArray(body?.data)) {
        try { body = JSON.parse(Buffer.from(body.data).toString('utf8')); } catch {}
      }
    }
    if (!body?.messages) {
      const raw = (req as any).rawBody as Buffer | undefined;
      if (raw?.length) {
        try { body = JSON.parse(raw.toString('utf8')); } catch {}
      }
    }
    const messages: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(body?.messages) ? body.messages : [];
    const countryFilter: string | undefined = body?.countryFilter;

    if (messages.length === 0) {
      const diag = `ct=${req.headers['content-type'] ?? 'none'} | body=${JSON.stringify(body ?? req.body)} | rawBody=${(req as any).rawBody ? 'ok' : 'missing'}`;
      console.warn('[chat] 400 —', diag);
      return res.status(400).json({ message: `messages array required — debug: ${diag}` });
    }

    // Fail fast (before SSE headers) so client can show a proper error
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ message: 'Clé GROQ_API_KEY manquante sur le serveur' });
    }

    // SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Expose rate-limit wait time as initial meta event
    const waitMs = nextAvailableIn();
    if (waitMs > 0) {
      res.write(`data: {"wait":${Math.ceil(waitMs / 1000)}}\n\n`);
      return res.end();
    }

    await streamChatWithArgos(
      messages,
      (chunk) => res.write(chunk),
      () => res.end(),
      countryFilter
    );
  });

  // ── POST /api/summary/refresh — force regeneration ────────────────────────
  app.post('/api/summary/refresh', async (_req, res) => {
    try {
      const summary = await refreshAiSummary();
      if (!summary) return res.status(503).json({ message: 'Refresh failed' });
      res.json(summary);
    } catch {
      res.status(500).json({ message: 'Refresh failed' });
    }
  });

  // ── GET /api/briefings — historique des briefings Argos IA ───────────────────
  app.get('/api/briefings', async (_req, res) => {
    try {
      const list = await storage.getAllBriefings();
      res.json(list.map(b => ({
        ...b,
        topCountries: (() => { try { return JSON.parse(b.topCountries ?? '[]'); } catch { return []; } })(),
      })));
    } catch {
      res.status(500).json({ message: 'Failed to fetch briefings' });
    }
  });

  // ── GET /api/countries/tension ─────────────────────────────────────────────
  app.get('/api/countries/tension', async (_req, res) => {
    try {
      const tensions = await getCountryTension();
      res.json(tensions);
    } catch (err) {
      res.status(500).json({ message: "Tension fetch failed" });
    }
  });

  // ── GET /api/health — DB connectivity check ───────────────────────────────
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', message: 'Database unreachable' });
    }
  });

  // ── GET /api/stats ─────────────────────────────────────────────────────────
  app.get('/api/stats', async (_req, res) => {
    try {
      const all = await storage.getAlerts();
      const byType: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const bySourceType: Record<string, number> = {};
      const byCountry: Record<string, number> = {};

      for (const a of all) {
        byType[a.type] = (byType[a.type] || 0) + 1;
        bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
        if (a.category) byCategory[a.category] = (byCategory[a.category] || 0) + 1;
        if (a.sourceType) bySourceType[a.sourceType] = (bySourceType[a.sourceType] || 0) + 1;
        if (a.country) byCountry[a.country] = (byCountry[a.country] || 0) + 1;
      }

      const topCountries = Object.entries(byCountry)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([country, count]) => ({ country, count }));

      res.json({ total: all.length, byType, bySeverity, byCategory, bySourceType, topCountries });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // ── API Keys Endpoints ─────────────────────────────────────────────────────
  app.get(api.keys.list.path, async (req, res) => {
    try {
      const keys = await storage.getApiKeys();
      res.json(keys);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.keys.create.path, async (req, res) => {
    try {
      const input = api.keys.create.input.parse(req.body);
      const newKey = await storage.createApiKey(input);
      res.status(201).json(newKey);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.keys.delete.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteApiKey(id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });


  return httpServer;
}
