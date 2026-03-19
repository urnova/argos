import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Soft warning — don't throw at module level (crashes Netlify Function cold start)
if (!process.env.DATABASE_URL) {
  console.error('[db] WARNING: DATABASE_URL is not set. DB operations will fail at query time.');
  // Provide a dummy URL so Pool construction doesn't throw; queries will fail gracefully.
  process.env.DATABASE_URL = 'postgresql://missing:missing@localhost:5432/missing';
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle(pool, { schema });

/**
 * Auto-migration: safely creates/updates the schema on every cold start.
 * Uses IF NOT EXISTS / IF NOT EXISTS so it's idempotent.
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    // ── alerts table ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "alerts" (
        "id"           SERIAL PRIMARY KEY,
        "title"        TEXT NOT NULL,
        "description"  TEXT NOT NULL,
        "lat"          TEXT NOT NULL,
        "lng"          TEXT NOT NULL,
        "country"      TEXT,
        "country_code" TEXT,
        "source"       TEXT,
        "type"         TEXT NOT NULL DEFAULT 'conflict',
        "category"     TEXT,
        "source_type"  TEXT,
        "severity"     TEXT NOT NULL DEFAULT 'medium',
        "status"       TEXT NOT NULL DEFAULT 'active',
        "timestamp"    TIMESTAMP DEFAULT NOW()
      )
    `);

    // ── api_keys table ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "api_keys" (
        "id"         SERIAL PRIMARY KEY,
        "name"       TEXT NOT NULL,
        "key"        TEXT NOT NULL UNIQUE,
        "created_at" TIMESTAMP DEFAULT NOW()
      )
    `);

    // ── Add all newer columns safely (IF NOT EXISTS) ─────────────────────────
    const addCols = [
      // Timestamps
      `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "timestamp"    TIMESTAMP DEFAULT NOW()`,
      `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "event_start"  TIMESTAMP`,
      // Geo origin (for missile arcs) — TEXT to match schema
      `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "origin_lat"   TEXT`,
      `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "origin_lng"   TEXT`,
      // Dedup + scoring
      `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "fingerprint"  TEXT UNIQUE`,
      `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "severity_score" INTEGER DEFAULT 1`,
      `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "is_active"    BOOLEAN DEFAULT TRUE`,
      // V4 — AI verification
      `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "ai_verified"  BOOLEAN`,
      `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "ai_label"     TEXT`,
    ];
    for (const sql of addCols) {
      await client.query(sql).catch(e => {
        // Ignore "column already exists" errors (older PG versions that don't support IF NOT EXISTS)
        if (!e.message?.includes('already exists')) console.warn('[db] col migration warning:', e.message);
      });
    }

    // ── briefings table ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "briefings" (
        "id"           SERIAL PRIMARY KEY,
        "text"         TEXT NOT NULL,
        "generated_at" TIMESTAMP DEFAULT NOW(),
        "alert_count"  INTEGER DEFAULT 0,
        "top_countries" TEXT
      )
    `);

    console.log('[db] Migrations OK');
  } catch (err) {
    console.error('[db] Migration error:', err);
  } finally {
    client.release();
  }
}
