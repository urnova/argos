/**
 * AI Chat — Argos V6.2
 * Appel direct Groq (streaming SSE) + checkpoints géographiques.
 * Rate-limit client-side (module-level, reset au rechargement page).
 * Rechargement = nouvelle conversation (pas de persistance).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, Trash2, ChevronRight, MapPin, Loader2 } from 'lucide-react';
import type { Alert } from '@shared/schema';

// ── Config Groq ───────────────────────────────────────────────────────────────
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
// Clé exposée côté client (ajouter VITE_GROQ_API_KEY dans .env)
// Si absent → fallback vers /api/chat (route serveur)
const VITE_GROQ_KEY = (import.meta.env.VITE_GROQ_API_KEY as string | undefined) ?? '';

// ── Rate limit module-level ────────────────────────────────────────────────────
// Persiste entre re-mounts, reset au rechargement de la page
const _reqTimestamps: number[] = [];
const MAX_PER_MIN = 5;

function checkRateLimit(): { ok: boolean; waitSec: number } {
  const now = Date.now();
  const since = now - 60_000;
  while (_reqTimestamps.length > 0 && _reqTimestamps[0] < since) _reqTimestamps.shift();
  if (_reqTimestamps.length >= MAX_PER_MIN) {
    const waitSec = Math.ceil((_reqTimestamps[0] + 60_000 - now) / 1000);
    return { ok: false, waitSec };
  }
  _reqTimestamps.push(now);
  return { ok: true, waitSec: 0 };
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es ARGOS, un analyste de renseignement géopolitique militaire de niveau stratégique.
Tu as accès en temps réel aux alertes du système ARGOS Intelligence.

Réponds en français, de façon concise et factuelle. Style : militaire, professionnel.
- Structure ta réponse en paragraphes distincts, un par zone géographique ou sujet
- Commence chaque paragraphe par le nom du pays/zone en gras : **Ukraine**, **Gaza**, etc.
- Cite les données de la base quand pertinent
- Pour les questions hors géopolitique/sécurité, réponds brièvement
- Ne spécule pas sur des informations non confirmées
- Limite : 300 mots maximum`;

// ── Country coords pour globe fly-to ─────────────────────────────────────────
const COUNTRY_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  'ukraine':       { lat: 49.0,  lng: 31.0,  label: 'Ukraine' },
  'russie':        { lat: 55.7,  lng: 37.6,  label: 'Russie' },
  'moscou':        { lat: 55.7,  lng: 37.6,  label: 'Moscou' },
  'gaza':          { lat: 31.4,  lng: 34.4,  label: 'Gaza' },
  'palestine':     { lat: 31.9,  lng: 35.2,  label: 'Palestine' },
  'israël':        { lat: 31.0,  lng: 35.0,  label: 'Israël' },
  'israel':        { lat: 31.0,  lng: 35.0,  label: 'Israël' },
  'liban':         { lat: 33.9,  lng: 35.5,  label: 'Liban' },
  'syrie':         { lat: 35.0,  lng: 38.0,  label: 'Syrie' },
  'irak':          { lat: 33.2,  lng: 43.7,  label: 'Irak' },
  'iran':          { lat: 32.4,  lng: 53.7,  label: 'Iran' },
  'yémen':         { lat: 15.5,  lng: 47.5,  label: 'Yémen' },
  'yemen':         { lat: 15.5,  lng: 47.5,  label: 'Yémen' },
  'soudan':        { lat: 15.6,  lng: 32.5,  label: 'Soudan' },
  'chine':         { lat: 35.9,  lng: 104.2, label: 'Chine' },
  'taïwan':        { lat: 23.7,  lng: 121.0, label: 'Taïwan' },
  'taiwan':        { lat: 23.7,  lng: 121.0, label: 'Taïwan' },
  'corée du nord': { lat: 40.0,  lng: 127.0, label: 'Corée du Nord' },
  'myanmar':       { lat: 19.2,  lng: 96.7,  label: 'Myanmar' },
  'somalie':       { lat: 5.2,   lng: 46.2,  label: 'Somalie' },
  'afghanistan':   { lat: 33.9,  lng: 67.7,  label: 'Afghanistan' },
  'libye':         { lat: 26.3,  lng: 17.2,  label: 'Libye' },
  'mali':          { lat: 17.6,  lng: -2.0,  label: 'Mali' },
  'nigeria':       { lat: 9.1,   lng: 8.7,   label: 'Nigeria' },
  'congo':         { lat: -4.0,  lng: 21.8,  label: 'RD Congo' },
  'éthiopie':      { lat: 9.1,   lng: 40.5,  label: 'Éthiopie' },
  'ethiopie':      { lat: 9.1,   lng: 40.5,  label: 'Éthiopie' },
  'venezuela':     { lat: 6.4,   lng: -66.6, label: 'Venezuela' },
  'haïti':         { lat: 19.0,  lng: -72.3, label: 'Haïti' },
  'haiti':         { lat: 19.0,  lng: -72.3, label: 'Haïti' },
  'pakistan':      { lat: 30.4,  lng: 69.3,  label: 'Pakistan' },
  'serbie':        { lat: 44.0,  lng: 21.0,  label: 'Serbie' },
  'azerbaïdjan':   { lat: 40.1,  lng: 47.6,  label: 'Azerbaïdjan' },
  'arménie':       { lat: 40.1,  lng: 45.0,  label: 'Arménie' },
  'kharkiv':       { lat: 50.0,  lng: 36.2,  label: 'Kharkiv' },
  'bakhmut':       { lat: 48.6,  lng: 38.0,  label: 'Bakhmut' },
  'kyiv':          { lat: 50.4,  lng: 30.5,  label: 'Kyiv' },
  'kiev':          { lat: 50.4,  lng: 30.5,  label: 'Kyiv' },
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Checkpoint {
  text: string;
  country: string;
  lat: number;
  lng: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  checkpoints?: Checkpoint[];
  checkpointIdx?: number;
}

// ── Suggestions ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Quels sont les foyers actifs en ce moment ?',
  'Résume la situation en Ukraine.',
  'Y a-t-il des missiles détectés ?',
  'Analyse les tensions au Moyen-Orient.',
  'Quels pays sont en état de guerre ?',
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface AiChatProps {
  onClose: () => void;
  alerts?: Alert[];
  countryFilter?: string;
  /** Masque le header interne — pour intégration dans une sidebar */
  embedded?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectCountry(text: string): { lat: number; lng: number; label: string } | null {
  const lower = text.toLowerCase();
  const entries = Object.entries(COUNTRY_COORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [key, val] of entries) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function extractCheckpoints(text: string): Checkpoint[] {
  const paragraphs = text
    .split(/\n{2,}|(?=\*\*[A-ZÀÂÉÈÊËÎÏÔÙÛÇ])/u)
    .map(p => p.trim())
    .filter(p => p.length > 20);

  const checkpoints: Checkpoint[] = [];
  const seen = new Set<string>();
  for (const para of paragraphs) {
    const loc = detectCountry(para);
    if (!loc || seen.has(loc.label)) continue;
    seen.add(loc.label);
    checkpoints.push({ text: para, country: loc.label, lat: loc.lat, lng: loc.lng });
  }
  return checkpoints.length >= 2 ? checkpoints : [];
}

function buildAlertDigest(alerts: Alert[], countryFilter?: string): string {
  const H24 = 24 * 60 * 60 * 1000;
  let recent = alerts
    .filter(a => a.aiVerified !== false && (!a.timestamp || Date.now() - new Date(a.timestamp).getTime() < H24))
    .slice(0, 50);
  if (countryFilter) {
    recent = recent.filter(a =>
      a.countryCode === countryFilter ||
      a.country?.toLowerCase().includes(countryFilter.toLowerCase())
    );
  }
  if (recent.length === 0) return 'Aucune alerte active.';
  return `${recent.length} événements/24h :\n` +
    recent.slice(0, 35)
      .map(a => `[${(a.severity ?? '?').toUpperCase()}][${a.type}][${a.country ?? '?'}] ${(a as any).aiLabel ?? a.title}`)
      .join('\n');
}

// ── SSE stream parser (Groq format) ──────────────────────────────────────────
async function* parseGroqStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;
        try {
          const parsed = JSON.parse(raw);
          const token = parsed.choices?.[0]?.delta?.content ?? '';
          if (token) yield token;
        } catch {
          // partial JSON — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AiChat({ onClose, alerts = [], countryFilter, embedded = false }: AiChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  useEffect(() => {
    if (!embedded) inputRef.current?.focus();
    return () => {
      cooldownTimerRef.current && clearInterval(cooldownTimerRef.current);
      abortRef.current?.abort();
    };
  }, [embedded]);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    cooldownTimerRef.current && clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldown(s => {
        if (s <= 1) { clearInterval(cooldownTimerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const flyTo = useCallback((lat: number, lng: number) => {
    window.dispatchEvent(new CustomEvent('globe-fly-to', { detail: { lat, lng, altitude: 0.85 } }));
  }, []);

  const advanceCheckpoint = useCallback((msgIdx: number) => {
    setMessages(prev => {
      const msgs = [...prev];
      const msg = { ...msgs[msgIdx] };
      const next = (msg.checkpointIdx ?? 0) + 1;
      msg.checkpointIdx = next;
      msgs[msgIdx] = msg;
      const cp = msg.checkpoints?.[next];
      if (cp) flyTo(cp.lat, cp.lng);
      return msgs;
    });
  }, [flyTo]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming || cooldown > 0) return;

    // Client-side rate limit check
    const { ok, waitSec } = checkRateLimit();
    if (!ok) {
      setError(`Limite atteinte. Réessayez dans ${waitSec}s.`);
      startCooldown(waitSec);
      return;
    }

    setInput('');
    setError(null);

    const userMsg: Message = { role: 'user', content };
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);
    setStreamText('');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const alertContext = buildAlertDigest(alerts, countryFilter);

    // Full message array with system prompt + alert context
    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `=== DONNÉES ARGOS TEMPS RÉEL ===\n${alertContext}\n=== FIN ===` },
      { role: 'assistant', content: 'Données reçues. Prêt.' },
      ...history,
      { role: 'user', content },
    ];

    let full = '';

    try {
      let body: ReadableStream<Uint8Array>;

      if (VITE_GROQ_KEY) {
        // ── Direct Groq API call ────────────────────────────────────────────
        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${VITE_GROQ_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: fullMessages,
            max_tokens: 600,
            temperature: 0.4,
            stream: true,
          }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({})) as any;
          throw new Error(err?.error?.message ?? `Groq ${res.status}`);
        }
        body = res.body;
      } else {
        // ── Fallback: server /api/chat ──────────────────────────────────────
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [...history, { role: 'user', content }], countryFilter }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({})) as any;
          throw new Error(err?.message ?? `Serveur ${res.status}`);
        }
        body = res.body;
      }

      // Stream tokens
      for await (const token of parseGroqStream(body, ctrl.signal)) {
        full += token;
        setStreamText(full);
      }

      // Finalise message
      if (full) {
        const checkpoints = extractCheckpoints(full);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: full,
          checkpoints: checkpoints.length >= 2 ? checkpoints : undefined,
          checkpointIdx: 0,
        }]);
        if (checkpoints.length >= 2) flyTo(checkpoints[0].lat, checkpoints[0].lng);
      }

      // Cooldown after successful send
      startCooldown(12);

    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message ?? 'Erreur réseau');
        setMessages(prev => prev.filter(m => m !== userMsg));
        setInput(content);
        // Refund rate limit token on error
        const idx = _reqTimestamps.lastIndexOf(_reqTimestamps[_reqTimestamps.length - 1]);
        if (idx !== -1) _reqTimestamps.splice(idx, 1);
      }
    } finally {
      setStreaming(false);
      setStreamText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const canSend = input.trim().length > 0 && !streaming && cooldown === 0;

  return (
    <div className={`flex flex-col h-full ${embedded ? 'bg-transparent' : 'bg-black/95'}`}>

      {/* Header — masqué en mode embedded */}
      {!embedded && (
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/80">
          <div className="flex items-center gap-2">
            <img src="/argos.svg" alt="Argos" className="w-5 h-5 opacity-90" />
            <span className="text-[11px] font-black tracking-[0.15em] uppercase text-primary">Argos IA</span>
            {countryFilter && (
              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/20">
                {countryFilter}
              </span>
            )}
            {streaming && (
              <span className="text-[8px] font-mono text-primary/50 flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Analyse…
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && !streaming && (
              <button
                onClick={() => setMessages([])}
                className="p-1.5 text-white/25 hover:text-white/60 transition-colors"
                title="Nouvelle conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-white/25 hover:text-white/60 transition-colors">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

        {/* Welcome + suggestions */}
        {messages.length === 0 && !streaming && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/argos.svg" alt="" className="w-4 h-4 opacity-80" />
              </div>
              <div className="glass-card rounded-xl rounded-tl-sm px-3 py-2.5 text-[10px] font-mono text-white/70 leading-relaxed border border-primary/15">
                Système <span className="text-primary font-bold">ARGOS</span> en ligne.<br />
                Posez une question sur la situation géopolitique mondiale.
                {!VITE_GROQ_KEY && (
                  <div className="mt-2 text-[9px] text-amber-400/60">
                    ℹ Ajoutez <code className="bg-white/8 px-1 rounded">VITE_GROQ_API_KEY</code> dans .env pour appel direct Groq
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1 pl-8">
              <div className="text-[8px] font-mono text-white/20 uppercase tracking-widest mb-1.5">Suggestions</div>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  disabled={cooldown > 0}
                  className="block w-full text-left text-[10px] font-mono text-primary/60 hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg border border-primary/10 hover:border-primary/25 bg-primary/3 hover:bg-primary/8 disabled:opacity-30"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message history */}
        {messages.map((msg, msgIdx) => (
          <div key={msgIdx}>
            {msg.role === 'user' && (
              <div className="flex items-start gap-2 flex-row-reverse">
                <div className="w-6 h-6 rounded-full bg-white/8 border border-white/15 flex items-center justify-center shrink-0">
                  <User className="w-3 h-3 text-white/60" />
                </div>
                <div className="max-w-[85%] ml-auto rounded-xl rounded-tr-sm px-3 py-2.5 text-[10px] font-mono leading-relaxed bg-primary/12 border border-primary/25 text-primary/90">
                  {msg.content}
                </div>
              </div>
            )}

            {msg.role === 'assistant' && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                  <img src="/argos.svg" alt="" className="w-4 h-4 opacity-80" />
                </div>
                <div className="flex-1 min-w-0">
                  {msg.checkpoints && msg.checkpoints.length >= 2 ? (
                    <CheckpointView
                      msg={msg}
                      msgIdx={msgIdx}
                      onAdvance={advanceCheckpoint}
                      onFlyTo={flyTo}
                    />
                  ) : (
                    <div className="glass-card rounded-xl rounded-tl-sm px-3 py-2.5 text-[10px] font-mono text-white/80 leading-relaxed whitespace-pre-wrap border border-primary/15">
                      {msg.content}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Streaming in progress */}
        {streaming && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/argos.svg" alt="" className="w-4 h-4 opacity-80 animate-pulse" />
            </div>
            <div className="flex-1 glass-card rounded-xl rounded-tl-sm px-3 py-2.5 text-[10px] font-mono text-white/80 leading-relaxed whitespace-pre-wrap border border-primary/15 min-h-[36px]">
              {streamText
                ? <>{streamText}<span className="animate-pulse text-primary/60">▊</span></>
                : (
                  <span className="inline-flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.18}s` }}
                      />
                    ))}
                  </span>
                )
              }
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-[10px] font-mono text-destructive/70 text-center px-3 py-2 rounded-lg border border-destructive/20 bg-destructive/5">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-white/8">
        {/* Cooldown bar */}
        {cooldown > 0 && (
          <div className="mb-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 flex items-center gap-2">
            <Loader2 className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8px] font-bold uppercase tracking-widest text-amber-400">Cooldown</span>
                <span className="text-[11px] font-black font-mono text-amber-400">{cooldown}s</span>
              </div>
              <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400/60 transition-all duration-1000 rounded-full"
                  style={{ width: `${(cooldown / 12) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={cooldown > 0 ? `Disponible dans ${cooldown}s…` : 'Poser une question… (Entrée)'}
            rows={2}
            disabled={streaming || cooldown > 0}
            className="flex-1 resize-none rounded-xl bg-white/5 border border-white/12 px-3 py-2 text-[10px] font-mono text-white/80 placeholder-white/20 focus:outline-none focus:border-primary/40 transition-colors disabled:opacity-40"
          />
          <button
            onClick={() => send()}
            disabled={!canSend}
            className="p-2 rounded-xl border transition-all disabled:opacity-30"
            style={{
              background: canSend ? 'rgba(0,240,255,0.15)' : 'transparent',
              borderColor: canSend ? 'rgba(0,240,255,0.35)' : 'rgba(255,255,255,0.1)',
              color: canSend ? '#00F0FF' : '#444',
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Clear + hint */}
        <div className="mt-1 flex items-center justify-between">
          {messages.length > 0 && !streaming ? (
            <button
              onClick={() => setMessages([])}
              className="text-[8px] font-mono text-white/20 hover:text-white/50 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-2.5 h-2.5" /> Effacer
            </button>
          ) : <span />}
          <span className="text-[8px] font-mono text-white/15">
            {MAX_PER_MIN}/min · Entrée = envoyer
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Checkpoint view ───────────────────────────────────────────────────────────
function CheckpointView({
  msg,
  msgIdx,
  onAdvance,
  onFlyTo,
}: {
  msg: Message;
  msgIdx: number;
  onAdvance: (i: number) => void;
  onFlyTo: (lat: number, lng: number) => void;
}) {
  const checkpoints = msg.checkpoints!;
  const idx = msg.checkpointIdx ?? 0;
  const cp = checkpoints[idx];
  const isLast = idx >= checkpoints.length - 1;

  useEffect(() => {
    onFlyTo(cp.lat, cp.lng);
  }, [idx]); // eslint-disable-line

  return (
    <div className="space-y-1.5">
      {/* Progress dots */}
      <div className="flex items-center gap-1 ml-0.5">
        {checkpoints.map((c, i) => (
          <div
            key={i}
            className={`rounded-full transition-all ${
              i === idx ? 'w-4 h-1.5 bg-primary' :
              i < idx ? 'w-1.5 h-1.5 bg-primary/40' :
              'w-1.5 h-1.5 bg-white/15'
            }`}
            title={c.country}
          />
        ))}
        <span className="text-[8px] font-mono text-white/30 ml-0.5">
          {idx + 1}/{checkpoints.length}
        </span>
      </div>

      {/* Checkpoint card */}
      <div
        key={idx}
        className="glass-card rounded-xl rounded-tl-sm border border-primary/20 overflow-hidden"
        style={{ animation: 'cp-fade 0.35s ease-out' }}
      >
        <style>{`@keyframes cp-fade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
          <MapPin className="w-2.5 h-2.5 text-primary/60" />
          <span className="text-[8px] font-bold uppercase tracking-widest text-primary/70">{cp.country}</span>
          <span className="text-[7px] font-mono text-white/20 ml-auto">
            {cp.lat.toFixed(1)}° {cp.lng.toFixed(1)}°
          </span>
        </div>
        <div className="px-3 pb-2.5 text-[10px] font-mono text-white/80 leading-relaxed whitespace-pre-wrap">
          {cp.text}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pl-0.5">
        {isLast ? (
          <span className="text-[8px] font-mono text-white/30 italic">Fin de l'analyse</span>
        ) : (
          <button
            onClick={() => onAdvance(msgIdx)}
            className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/18 transition-all"
          >
            Continuer <ChevronRight className="w-2.5 h-2.5" />
          </button>
        )}
        <span className="text-[8px] font-mono text-primary/40">{cp.country}</span>
      </div>
    </div>
  );
}
