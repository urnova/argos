/**
 * AI Summary Service — Argos V5
 * Generates an hourly geopolitical situation summary using Groq.
 * Cached for 60 minutes to avoid API abuse.
 */

import { storage } from '../storage';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface AiSummary {
  text: string;
  generatedAt: string; // ISO
  alertCount: number;
  topCountries: string[];
}

/** Lit le dernier briefing depuis la DB — pas de génération à la demande */
export async function getAiSummary(): Promise<AiSummary | null> {
  const b = await storage.getLatestBriefing();
  if (!b) return null;
  return {
    text: b.text,
    generatedAt: b.generatedAt?.toISOString() ?? new Date().toISOString(),
    alertCount: b.alertCount ?? 0,
    topCountries: (() => { try { return JSON.parse(b.topCountries ?? '[]'); } catch { return []; } })(),
  };
}

/** Génère un nouveau briefing, le persiste en DB et le retourne */
export async function refreshAiSummary(): Promise<AiSummary | null> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return null;

  const allAlerts = await storage.getAlerts();
  const H24 = 24 * 60 * 60 * 1000;
  const recent = allAlerts
    .filter(a => a.aiVerified !== false && (!a.timestamp || Date.now() - new Date(a.timestamp).getTime() < H24))
    .slice(0, 60); // max 60 pour tenir dans le contexte

  if (recent.length === 0) return null;

  // Top countries by alert count
  const countryCounts: Record<string, number> = {};
  for (const a of recent) {
    if (a.country) countryCounts[a.country] = (countryCounts[a.country] ?? 0) + 1;
  }
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => c);

  // Build alert digest for the prompt
  const digest = recent
    .slice(0, 40)
    .map(a => `[${a.severity?.toUpperCase()}][${a.type}][${a.country ?? '?'}] ${a.aiLabel ?? a.title}`)
    .join('\n');

  const prompt = `Tu es un analyste de renseignement stratégique. Voici les ${recent.length} événements géopolitiques des dernières 24h détectés par le système ARGOS :

${digest}

Rédige un BRIEFING STRATÉGIQUE en français, structuré ainsi :
1. **Situation générale** (2-3 phrases synthétisant les foyers actifs)
2. **Foyers prioritaires** (liste des 3-4 zones les plus critiques avec 1 phrase chacune)
3. **Tendances à surveiller** (1-2 développements émergents)

Style : concis, militaire, factuel. Maximum 200 mots. Pas de markdown superflu, que du contenu.`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[ai-summary] Groq HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      return null;
    }

    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) return null;

    // Persister en base (même briefing pour tout le monde)
    const saved = await storage.saveBriefing({ text, alertCount: recent.length, topCountries });
    console.log(`[ai-summary] Saved briefing #${saved.id} (${recent.length} alerts, ${text.length} chars)`);
    return {
      text,
      generatedAt: saved.generatedAt?.toISOString() ?? new Date().toISOString(),
      alertCount: recent.length,
      topCountries,
    };
  } catch (e: any) {
    console.error('[ai-summary] Failed:', e?.message ?? e);
    return null;
  }
}
