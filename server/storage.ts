import { db } from "./db";
import { lt, gt, and, gte } from "drizzle-orm";
import {
  alerts,
  apiKeys,
  briefings,
  type Briefing,
  type CreateAlertRequest,
  type UpdateAlertRequest,
  type AlertResponse,
  type AlertsListResponse,
  type CreateApiKeyRequest,
  type ApiKeyResponse,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface IStorage {
  getAlerts(): Promise<AlertsListResponse>;
  getAlertsAfter(id: number): Promise<AlertsListResponse>;
  getAlert(id: number): Promise<AlertResponse | undefined>;
  getAlertsByCountry(countryCode: string): Promise<AlertsListResponse>;
  createAlert(alert: CreateAlertRequest): Promise<AlertResponse>;
  /** Insert only if fingerprint is new — returns null if duplicate */
  createAlertIfNew(alert: CreateAlertRequest): Promise<AlertResponse | null>;
  /** Find a recent alert with same country + type within the given time window (cross-source dedup) */
  findRecentSimilar(countryCode: string, type: string, withinMinutes: number): Promise<AlertResponse | null>;
  updateAlert(id: number, updates: UpdateAlertRequest): Promise<AlertResponse>;
  deleteAlert(id: number): Promise<void>;
  deleteOldAlerts(hoursOld: number): Promise<number>;

  getApiKeys(): Promise<ApiKeyResponse[]>;
  createApiKey(keyReq: CreateApiKeyRequest): Promise<ApiKeyResponse>;
  deleteApiKey(id: number): Promise<void>;
  validateApiKey(key: string): Promise<boolean>;

  // Briefings Argos IA
  getLatestBriefing(): Promise<Briefing | null>;
  getAllBriefings(): Promise<Briefing[]>;
  saveBriefing(data: { text: string; alertCount: number; topCountries: string[] }): Promise<Briefing>;
}

export class DatabaseStorage implements IStorage {
  async getAlerts(): Promise<AlertsListResponse> {
    return await db.select().from(alerts).orderBy(desc(alerts.timestamp));
  }

  async getAlertsAfter(id: number): Promise<AlertsListResponse> {
    return await db.select().from(alerts).where(gt(alerts.id, id)).orderBy(alerts.id);
  }

  async getAlert(id: number): Promise<AlertResponse | undefined> {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
    return alert;
  }

  async getAlertsByCountry(countryCode: string): Promise<AlertsListResponse> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.countryCode, countryCode))
      .orderBy(desc(alerts.timestamp));
  }

  async createAlert(alert: CreateAlertRequest): Promise<AlertResponse> {
    const [newAlert] = await db.insert(alerts).values(alert).returning();
    return newAlert;
  }

  async createAlertIfNew(alert: CreateAlertRequest): Promise<AlertResponse | null> {
    const result = await db.insert(alerts).values(alert).onConflictDoNothing().returning();
    return result[0] ?? null;
  }

  async findRecentSimilar(countryCode: string, type: string, withinMinutes: number): Promise<AlertResponse | null> {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);
    const [found] = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.countryCode, countryCode), eq(alerts.type, type), gte(alerts.timestamp, cutoff)))
      .orderBy(desc(alerts.timestamp))
      .limit(1);
    return found ?? null;
  }

  async updateAlert(id: number, updates: UpdateAlertRequest): Promise<AlertResponse> {
    const [updated] = await db.update(alerts)
      .set(updates)
      .where(eq(alerts.id, id))
      .returning();
    return updated;
  }

  async deleteAlert(id: number): Promise<void> {
    await db.delete(alerts).where(eq(alerts.id, id));
  }

  async deleteOldAlerts(hoursOld: number): Promise<number> {
    const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    const result = await db.delete(alerts).where(lt(alerts.timestamp, cutoff)).returning({ id: alerts.id });
    return result.length;
  }

  async getApiKeys(): Promise<ApiKeyResponse[]> {
    return await db.select().from(apiKeys);
  }

  async createApiKey(keyReq: CreateApiKeyRequest): Promise<ApiKeyResponse> {
    const key = keyReq.key || `astral_${randomBytes(16).toString('hex')}`;
    const [newKey] = await db.insert(apiKeys).values({ ...keyReq, key }).returning();
    return newKey;
  }

  async deleteApiKey(id: number): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  async validateApiKey(key: string): Promise<boolean> {
    const [found] = await db.select().from(apiKeys).where(eq(apiKeys.key, key));
    return !!found;
  }

  // ── Briefings ────────────────────────────────────────────────────────────────
  async getLatestBriefing(): Promise<Briefing | null> {
    const [b] = await db.select().from(briefings).orderBy(desc(briefings.generatedAt)).limit(1);
    return b ?? null;
  }

  async getAllBriefings(): Promise<Briefing[]> {
    return await db.select().from(briefings).orderBy(desc(briefings.generatedAt)).limit(168); // 7 jours max
  }

  async saveBriefing(data: { text: string; alertCount: number; topCountries: string[] }): Promise<Briefing> {
    const [b] = await db.insert(briefings).values({
      text: data.text,
      alertCount: data.alertCount,
      topCountries: JSON.stringify(data.topCountries),
    }).returning();
    return b;
  }
}

export const storage = new DatabaseStorage();
