import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Alert types (15):
 *   MILITARY: missile | airstrike | artillery | naval | conflict | explosion | chemical | nuclear | cyber
 *   POLITICAL: coup | sanctions
 *   HUMANITARIAN: massacre | terrorism
 *   GEOPOLITICAL: protest | warning
 *
 * Categories: MILITARY | POLITICAL | HUMANITARIAN | GEOPOLITICAL
 * Source types: GDELT | RSS | FIRMS | TELEGRAM | MANUAL
 */

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  lat: text("lat").notNull(),
  lng: text("lng").notNull(),
  country: text("country"),
  countryCode: text("country_code"),
  source: text("source"),
  type: text("type").notNull(),         // see types above
  category: text("category"),           // MILITARY | POLITICAL | HUMANITARIAN | GEOPOLITICAL
  sourceType: text("source_type"),      // GDELT | RSS | FIRMS | TELEGRAM | MANUAL
  severity: text("severity").notNull(), // low | medium | high | critical
  status: text("status").notNull().default('active'), // active | resolved
  // Origin coordinates — where the missile/strike was LAUNCHED FROM (aggressor position)
  originLat: text("origin_lat"),        // nullable — only set for missile/airstrike
  originLng: text("origin_lng"),        // nullable
  timestamp: timestamp("timestamp").defaultNow(),
  // Ferrari V3 fields
  fingerprint: text("fingerprint").unique(),          // SHA-256 for persistent dedup
  severityScore: integer("severity_score").default(1), // 1-10 granular score
  isActive: boolean("is_active").default(true),
  eventStart: timestamp("event_start"),               // actual event time (from pubDate / fetch time)
  // V4 — AI verification
  aiVerified: boolean("ai_verified"),                 // null=pending, true=confirmed, false=filtered
  aiLabel: text("ai_label"),                          // French AI-generated label e.g. "Frappe aérienne au Liban"
});

// ── Argos IA Briefings — un par heure, persisté en base ──────────────────────
export const briefings = pgTable("briefings", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),            // Texte markdown du briefing
  generatedAt: timestamp("generated_at").defaultNow(),
  alertCount: integer("alert_count").default(0),
  topCountries: text("top_countries"),     // JSON stringified string[]
});

export type Briefing = typeof briefings.$inferSelect;

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, timestamp: true });
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true });

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type CreateAlertRequest = InsertAlert;
export type UpdateAlertRequest = Partial<InsertAlert>;

export type AlertResponse = Alert;
export type AlertsListResponse = Alert[];

export type CreateApiKeyRequest = InsertApiKey;
export type ApiKeyResponse = ApiKey;
