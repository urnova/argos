/**
 * Critical Alert Overlay — Argos V6.2
 *
 * Flow en 2 phases séquentielles :
 *  1. Nouvelle donnée (aiVerified=null) → son d'entrée discret + carte "ANALYSE EN COURS" (3s)
 *  2a. IA confirme (aiVerified=true) + critical/high → carte alerte + son contextuel (10s)
 *  2b. IA confirme (aiVerified=true) + medium → retrait de l'overlay, son discret
 *  2c. IA rejette (aiVerified=false) → retrait silencieux
 *
 * Cooldown 2s entre notifications consécutives.
 * Sons joués quand la notification devient active à l'écran (pas à l'entrée en queue).
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import { parseSourceBadge } from '@/lib/source-badge';
import {
  soundIncoming, soundVerifiedResult, soundVerifiedLow,
} from '@/lib/sounds';
import type { Alert } from '@shared/schema';

// ── Source badge kind → icon ───────────────────────────────────────────────────
const KIND_ICONS: Record<string, string> = {
  telegram: '📡', press: '📰', x: '𝕏', firms: '🛰', nasa: '🛰', web: '🌐',
};

// ── Type → emoji ────────────────────────────────────────────────────────────────
const TYPE_EMOJIS: Record<string, string> = {
  // ALERTES
  missile: '🚀', airstrike: '✈️', artillery: '💣', naval: '⚓',
  conflict: '⚔️', explosion: '💥', chemical: '☣️', nuclear: '☢️',
  cyber: '💻', massacre: '💀', terrorism: '🔴', coup: '⚖️',
  // INFORMATIONS
  diplomatic: '🤝', political: '🏛️', 'military-move': '🪖',
  sanctions: '🚫', protest: '📢', humanitarian: '🆘',
  breaking: '📡', warning: '⚠️', info: 'ℹ️',
};

// ── Severity → accent ───────────────────────────────────────────────────────────
function accentOf(severity: string): { rgb: string; hex: string } {
  switch (severity) {
    case 'critical': return { rgb: '255,0,60',   hex: '#FF003C' };
    case 'high':     return { rgb: '255,184,0',  hex: '#FFB800' };
    case 'medium':   return { rgb: '0,240,255',  hex: '#00F0FF' };
    default:         return { rgb: '150,150,150', hex: '#999' };
  }
}

// ── Queue item shape ────────────────────────────────────────────────────────────
interface QueueItem {
  alert: Alert;
  phase: 'pending' | 'verified';
}

interface Props {
  alerts: Alert[];
}

export function CriticalAlertOverlay({ alerts }: Props) {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [viewIdx, setViewIdx] = useState(0);
  const [progress, setProgress] = useState(100);
  const [cooldown, setCooldown] = useState(false); // 2s gap between notifications

  // Tracking refs
  const initializedRef    = useRef(false);
  const prevAlertsMap     = useRef<Map<number, Alert>>(new Map());
  const pendingIds        = useRef<Set<number>>(new Set());
  const timerRef          = useRef<ReturnType<typeof setTimeout>>();
  const intervalRef       = useRef<ReturnType<typeof setInterval>>();
  const cooldownRef       = useRef<ReturnType<typeof setTimeout>>();
  const prevCurrentId     = useRef<number | null>(null);
  const prevCurrentPhase  = useRef<string | null>(null);

  // ── Alert processing ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (alerts.length === 0) return;

    if (!initializedRef.current) {
      prevAlertsMap.current = new Map(alerts.map(a => [a.id, a]));
      initializedRef.current = true;
      return;
    }

    const H3 = 3 * 60 * 60 * 1000;
    const toAdd: QueueItem[] = [];

    for (const alert of alerts) {
      const prev = prevAlertsMap.current.get(alert.id);

      if (!prev) {
        // ── NEW alert ─────────────────────────────────────────────────────────
        const age = alert.timestamp ? Date.now() - new Date(alert.timestamp).getTime() : 0;
        if (age > H3) continue;
        if (alert.aiVerified === false) continue;

        if (alert.aiVerified === true) {
          if (alert.severity === 'critical' || alert.severity === 'high' || alert.severity === 'medium') {
            toAdd.push({ alert, phase: 'verified' });
            // Son joué quand l'alerte devient active (dans le useEffect ci-dessous)
          } else {
            soundVerifiedLow(); // low : son discret uniquement
          }
        } else {
          // aiVerified = null → "ANALYSE EN COURS"
          if (alert.severity !== 'low') {
            toAdd.push({ alert, phase: 'pending' });
            pendingIds.current.add(alert.id);
            soundIncoming(); // son discret d'arrivée
          }
        }

      } else {
        // ── MISE À JOUR d'une alerte existante ───────────────────────────────
        const wasNull = prev.aiVerified === null || prev.aiVerified === undefined;
        const nowTrue = alert.aiVerified === true;
        const nowFalse = alert.aiVerified === false;

        if (wasNull && nowTrue && pendingIds.current.has(alert.id)) {
          pendingIds.current.delete(alert.id);

          if (alert.severity === 'critical' || alert.severity === 'high' || alert.severity === 'medium') {
            // Upgrade: pending → verified (son joué quand la carte devient active)
            setQueue(q => q.map(item =>
              item.alert.id === alert.id ? { alert, phase: 'verified' } : item
            ));
          } else {
            // Low confirmé → retrait, son discret
            setQueue(q => q.filter(item => item.alert.id !== alert.id));
            soundVerifiedLow();
          }
        } else if (wasNull && nowFalse && pendingIds.current.has(alert.id)) {
          pendingIds.current.delete(alert.id);
          setQueue(q => q.filter(item => item.alert.id !== alert.id));
        }
      }
    }

    prevAlertsMap.current = new Map(alerts.map(a => [a.id, a]));

    if (toAdd.length > 0) {
      setQueue(q => [...toAdd, ...q]);
      setViewIdx(0);
    }
  }, [alerts]);

  // ── Auto-dismiss timer ───────────────────────────────────────────────────────
  const current = queue[viewIdx] ?? null;

  const startTimer = useCallback((duration: number) => {
    clearTimeout(timerRef.current);
    clearInterval(intervalRef.current);
    setProgress(100);
    const TICK = 50;
    intervalRef.current = setInterval(() => {
      setProgress(p => Math.max(0, p - (TICK / duration) * 100));
    }, TICK);
    timerRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      // Cooldown 2s avant la prochaine notification
      setCooldown(true);
      cooldownRef.current = setTimeout(() => {
        setCooldown(false);
        setQueue(q => {
          const next = q.filter((_, i) => i !== viewIdx);
          setViewIdx(v => Math.min(v, Math.max(0, next.length - 1)));
          return next;
        });
      }, 2000);
    }, duration);
  }, [viewIdx]);

  // ── Son joué quand la notification devient active à l'écran ─────────────────
  useEffect(() => {
    if (!current) return;
    const sameAlert = current.alert.id === prevCurrentId.current;
    const samePhase = current.phase === prevCurrentPhase.current;
    if (sameAlert && samePhase) return;

    prevCurrentId.current = current.alert.id;
    prevCurrentPhase.current = current.phase;

    if (current.phase === 'verified') {
      // Son contextuel joué ICI, quand l'alerte s'affiche
      soundVerifiedResult(current.alert.type, current.alert.severity, current.alert.title);
      const duration = current.alert.severity === 'critical' ? 10000 : current.alert.severity === 'high' ? 8000 : 6000;
      startTimer(duration);
    } else {
      // Pending : vérification brève (3s), pas de son contextuel
      startTimer(3000);
    }

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(intervalRef.current);
    };
  }, [current?.alert.id, current?.phase, startTimer]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const dismissCurrent = useCallback(() => {
    clearTimeout(timerRef.current); clearInterval(intervalRef.current);
    clearTimeout(cooldownRef.current); setCooldown(false);
    setQueue(q => {
      const next = q.filter((_, i) => i !== viewIdx);
      setViewIdx(v => Math.min(v, Math.max(0, next.length - 1)));
      return next;
    });
  }, [viewIdx]);

  const dismissAll = useCallback(() => {
    clearTimeout(timerRef.current); clearInterval(intervalRef.current);
    clearTimeout(cooldownRef.current); setCooldown(false);
    setQueue([]); setViewIdx(0);
  }, []);

  const navigate = useCallback((dir: 1 | -1) => {
    clearTimeout(timerRef.current); clearInterval(intervalRef.current);
    clearTimeout(cooldownRef.current); setCooldown(false);
    setViewIdx(v => Math.max(0, Math.min(queue.length - 1, v + dir)));
  }, [queue.length]);

  // Pendant le cooldown : si il n'y a pas de notifications, afficher rien
  if (!current && !cooldown) return null;
  if (!current) return null; // pendant cooldown avant que setQueue n'update

  const { alert: a, phase } = current;
  const isPending = phase === 'pending';

  // ── Pending card ─────────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="fixed inset-0 z-[9999] pointer-events-none flex items-start justify-center pt-6">
        <div
          className="pointer-events-auto relative overflow-hidden rounded-2xl shadow-xl backdrop-blur-xl"
          style={{
            border: '1px solid rgba(0,240,255,0.25)',
            boxShadow: '0 0 30px rgba(0,240,255,0.12)',
            background: 'rgba(0,5,15,0.92)',
            minWidth: 320, maxWidth: 460,
            animation: 'alert-drop 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
          }}
        >
          <style>{`
            @keyframes alert-drop { from { opacity:0; transform:translateY(-20px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
            @keyframes scan-line { 0% { transform:translateX(-100%); } 100% { transform:translateX(100%); } }
          `}</style>

          {/* Scan animation */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(0,240,255,0.06) 50%, transparent 100%)',
              animation: 'scan-line 1.8s linear infinite',
            }} />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </div>
              <span className="font-black text-[10px] tracking-[0.2em] uppercase text-primary">
                {t.overlay.analyzing}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {queue.length > 1 && (
                <span className="text-[9px] font-mono text-muted-foreground">{viewIdx + 1}/{queue.length}</span>
              )}
              <button onClick={dismissAll} className="opacity-30 hover:opacity-80 transition-opacity text-primary">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="px-4 py-3 flex items-center gap-3">
            <div className="text-2xl animate-pulse">🔍</div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-white/80 line-clamp-2">{a.title}</div>
              <div className="text-[10px] text-primary/60 font-mono mt-0.5">{t.overlay.analyzingDesc}</div>
            </div>
          </div>

          <div className="h-0.5 bg-white/5">
            <div className="h-full transition-none bg-primary/50" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Verified alert card ───────────────────────────────────────────────────────
  const { rgb: ac, hex: accentColor } = accentOf(a.severity);
  const isCritical = a.severity === 'critical';
  const emoji = TYPE_EMOJIS[a.type] ?? '⚠️';

  const INFO_TYPES = new Set(['info', 'diplomatic', 'political', 'military-move', 'sanctions', 'protest', 'humanitarian', 'warning']);
  let headerLabel: string;
  if (a.type === 'breaking')          headerLabel = t.overlay.breaking;
  else if (INFO_TYPES.has(a.type))    headerLabel = t.overlay.info;
  else if (isCritical)                headerLabel = t.overlay.critical;
  else                                headerLabel = t.overlay.high;

  const badge = parseSourceBadge((a as any).source, (a as any).sourceType);
  const isInfoType = ['info', 'breaking', 'diplomatic', 'political', 'military-move', 'sanctions', 'protest', 'humanitarian', 'warning'].includes(a.type);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-start justify-center pt-6">
      {/* Vignette flash — plus intense pour critique */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 35%, rgba(${ac},${isCritical ? 0.18 : 0.10}) 100%)`,
          animation: `alert-vignette ${isCritical ? '1.5s' : '0.6s'} ease-out forwards`,
        }}
      />

      {/* Alert panel */}
      <div
        className="pointer-events-auto relative overflow-hidden rounded-2xl shadow-2xl backdrop-blur-xl"
        style={{
          border: `2px solid rgba(${ac},0.55)`,
          boxShadow: `0 0 50px rgba(${ac},0.35), 0 0 100px rgba(${ac},0.12), inset 0 1px 0 rgba(255,255,255,0.06)`,
          background: `linear-gradient(135deg, rgba(${ac},0.08) 0%, rgba(0,0,0,0.94) 55%)`,
          minWidth: 340, maxWidth: 500,
          animation: `alert-drop 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards${isCritical ? ', critical-pulse 1.5s ease-in-out 0.4s infinite' : ''}`,
        }}
      >
        <style>{`
          @keyframes alert-drop { from { opacity:0; transform:translateY(-24px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
          @keyframes alert-vignette { 0% { opacity:1; } 100% { opacity:0; } }
          @keyframes critical-pulse {
            0%, 100% { box-shadow: 0 0 50px rgba(255,0,60,0.35), 0 0 100px rgba(255,0,60,0.12), inset 0 1px 0 rgba(255,255,255,0.06); }
            50%       { box-shadow: 0 0 80px rgba(255,0,60,0.65), 0 0 160px rgba(255,0,60,0.28), inset 0 1px 0 rgba(255,255,255,0.06); }
          }
        `}</style>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-2.5 border-b"
          style={{ borderColor: `rgba(${ac},0.25)`, background: `rgba(${ac},0.12)` }}
        >
          <div className="flex items-center gap-2">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
                style={{ background: accentColor }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: accentColor }} />
            </div>
            <span className="font-black text-[10px] tracking-[0.2em] uppercase" style={{ color: accentColor }}>
              {headerLabel}
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase"
              style={{ background: `rgba(${ac},0.15)`, color: `rgba(${ac},0.8)` }}>
              {t.types[a.type] ?? a.type.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 1 && (
              <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: `rgba(${ac},0.18)`, color: accentColor }}>
                {viewIdx + 1}/{queue.length}
              </span>
            )}
            <button onClick={dismissAll} className="opacity-35 hover:opacity-90 transition-opacity"
              style={{ color: accentColor }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex items-start gap-4">
          <div className="text-4xl leading-none shrink-0 mt-0.5"
            style={{ filter: `drop-shadow(0 0 10px rgba(${ac},0.65))` }}>
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            {(a as any).aiLabel && (a as any).aiLabel !== a.title && (
              <div className="text-[9px] font-mono uppercase tracking-widest mb-1"
                style={{ color: `rgba(${ac},0.7)` }}>
                {(a as any).aiLabel}
              </div>
            )}
            <h2 className="font-bold text-sm text-white leading-snug mb-2 line-clamp-3">
              {a.title}
            </h2>

            <div className="flex items-center gap-2 flex-wrap text-[9px] font-mono mb-2">
              <span className="px-1.5 py-0.5 rounded font-bold"
                style={{ background: `rgba(${ac},0.15)`, color: accentColor }}>
                {t.overlay.verified}
              </span>
              <span className="px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5"
                style={{ background: `${badge.color}20`, color: badge.color }}>
                <span>{KIND_ICONS[badge.kind] ?? '📡'}</span>
                <span>{badge.name}</span>
              </span>
              {a.timestamp && (
                <span className="text-white/25 ml-auto">
                  {new Date(a.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[10px] font-mono text-white/40">
              <span>{a.country || t.overlay.unknownPos}</span>
              {!isInfoType && a.lat && a.lng && (
                <span className="ml-auto" style={{ color: `rgba(${ac},0.6)` }}>
                  {Number(a.lat).toFixed(2)}° {Number(a.lng).toFixed(2)}°
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer navigation */}
        {queue.length > 1 && (
          <div className="px-5 pb-3 flex items-center justify-between"
            style={{ borderTop: `1px solid rgba(${ac},0.12)`, paddingTop: '10px' }}>
            <button onClick={() => navigate(-1)} disabled={viewIdx === 0}
              className="text-xs font-bold px-3 py-1 rounded-lg disabled:opacity-20 transition-all"
              style={{ color: accentColor, background: `rgba(${ac},0.1)`, border: `1px solid rgba(${ac},0.22)` }}>
              {t.overlay.prev}
            </button>
            <button onClick={dismissCurrent}
              className="text-[9px] font-mono uppercase tracking-widest opacity-40 hover:opacity-80 transition-opacity"
              style={{ color: accentColor }}>
              {t.overlay.ignore}
            </button>
            <button onClick={() => navigate(1)} disabled={viewIdx === queue.length - 1}
              className="text-xs font-bold px-3 py-1 rounded-lg disabled:opacity-20 transition-all"
              style={{ color: accentColor, background: `rgba(${ac},0.1)`, border: `1px solid rgba(${ac},0.22)` }}>
              {t.overlay.next}
            </button>
          </div>
        )}

        {/* Progress bar */}
        <div className="h-0.5 bg-white/5">
          <div className="h-full transition-none" style={{ width: `${progress}%`, background: accentColor }} />
        </div>
      </div>
    </div>
  );
}
