/**
 * AI Chat Service — Argos V5
 * Interactive chat with Groq — streaming + context from alert DB.
 * Rate-limited: 6 req/minute server-side (Groq free tier safe).
 */

import { storage } from '../storage';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `Tu es ARGOS, un analyste de renseignement géopolitique militaire de niveau stratégique.
Tu as accès en temps réel aux alertes de la base de données du système ARGOS Intelligence.

Réponds en français, de façon concise et factuelle. Style : militaire, professionnel.
- Structure ta réponse en paragraphes distincts, un par zone géographique ou sujet
- Commence chaque paragraphe par le nom du pays/zone en gras : **Ukraine**, **Gaza**, etc.
- Cite les données de la base quand pertinent
- Pour les questions hors géopolitique/sécurité, réponds brièvement
- Ne spécule pas sur des informations non confirmées
- Limite : 300 mots maximum`;

// Rate limiter: 6 req/minute
const requestLog: number[] = [];
const RATE_LIMIT = 6;

export function checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = now - 60_000;
    while (requestLog.length > 0 && requestLog[0] < windowStart) requestLog.shift();
    if (requestLog.length >= RATE_LIMIT) return false;
    requestLog.push(now);
    return true;
}

export function nextAvailableIn(): number {
    if (requestLog.length < RATE_LIMIT) return 0;
    const oldest = requestLog[0];
    return Math.max(0, 60_000 - (Date.now() - oldest));
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/** Build the full messages array with live alert context prepended. */
export async function buildChatMessages(
    messages: ChatMessage[],
    countryFilter?: string
): Promise<{ role: string; content: string }[]> {
    const allAlerts = await storage.getAlerts();
    const H24 = 24 * 60 * 60 * 1000;
    let recent = allAlerts
        .filter(a => a.aiVerified !== false && (!a.timestamp || Date.now() - new Date(a.timestamp).getTime() < H24))
        .slice(0, 50);

    if (countryFilter) {
        recent = recent.filter(a =>
            a.countryCode === countryFilter ||
            a.country?.toLowerCase().includes(countryFilter.toLowerCase())
        );
    }

    const digest = recent.length > 0
        ? recent.slice(0, 35)
            .map(a => `[${a.severity?.toUpperCase()}][${a.type}][${a.country ?? '?'}] ${a.aiLabel ?? a.title}`)
            .join('\n')
        : 'Aucune alerte active.';

    return [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content: `=== DONNÉES ARGOS TEMPS RÉEL (${recent.length} evt / 24h) ===\n${digest}\n=== FIN ===`,
        },
        {
            role: 'assistant',
            content: 'Données reçues. Prêt.',
        },
        ...messages,
    ];
}

/** Non-streaming fallback */
export async function chatWithArgos(
    messages: ChatMessage[],
    countryFilter?: string
): Promise<string | null> {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) return null;
    if (!checkRateLimit()) return `Limite atteinte. Réessayez dans ${Math.ceil(nextAvailableIn() / 1000)}s.`;

    const fullMessages = await buildChatMessages(messages, countryFilter);

    try {
        const res = await fetch(GROQ_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: fullMessages, max_tokens: 600, temperature: 0.4 }),
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        return data.choices?.[0]?.message?.content?.trim() ?? null;
    } catch {
        return null;
    }
}

/** Streaming: pipes Groq SSE chunks to the provided response writer. */
export async function streamChatWithArgos(
    messages: ChatMessage[],
    write: (chunk: string) => void,
    end: () => void,
    countryFilter?: string
): Promise<void> {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        write('data: {"error":"GROQ_API_KEY manquant"}\n\n');
        end();
        return;
    }
    if (!checkRateLimit()) {
        const wait = Math.ceil(nextAvailableIn() / 1000);
        write(`data: {"error":"Limite atteinte. Réessayez dans ${wait}s."}\n\n`);
        end();
        return;
    }

    const fullMessages = await buildChatMessages(messages, countryFilter);

    try {
        const groqRes = await fetch(GROQ_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: fullMessages,
                max_tokens: 600,
                temperature: 0.4,
                stream: true,
            }),
            signal: AbortSignal.timeout(25_000),
        });

        if (!groqRes.ok || !groqRes.body) {
            write(`data: {"error":"Groq ${groqRes.status}"}\n\n`);
            end();
            return;
        }

        const reader = groqRes.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            write(decoder.decode(value, { stream: true }));
        }
        end();
    } catch (e) {
        console.warn('[ai-chat] stream error:', e);
        write('data: {"error":"Erreur réseau"}\n\n');
        end();
    }
}
