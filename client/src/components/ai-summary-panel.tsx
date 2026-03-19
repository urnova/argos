/**
 * AiSummaryPanel — Argos V5
 * Hourly AI-generated geopolitical briefing (Groq, server-side cached).
 * Shown as a collapsible overlay on the globe center.
 */

import { useAiSummary } from "@/hooks/use-ai-summary";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Brain, EyeOff, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useState, useCallback } from "react";

/** Render markdown-lite : **bold**, *italic*, numbered/bullet lists, section headers */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="text-[10px] font-mono text-foreground/80 leading-relaxed space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        // Section header: **Titre** on its own line
        const headerMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
        if (headerMatch) {
          return (
            <div key={i} className="text-primary font-bold tracking-wider uppercase text-[9px] pt-1 border-t border-white/8 mt-1">
              {headerMatch[1]}
            </div>
          );
        }

        // Numbered list item: "1. ..."
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-primary/50 shrink-0 font-bold">{numMatch[1]}.</span>
              <span>{renderInline(numMatch[2])}</span>
            </div>
          );
        }

        // Bullet list
        const bulletMatch = trimmed.match(/^[-•]\s+(.+)$/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-primary/50 shrink-0">·</span>
              <span>{renderInline(bulletMatch[1])}</span>
            </div>
          );
        }

        return <div key={i}>{renderInline(trimmed)}</div>;
      })}
    </div>
  );
}

/** Inline bold: **text** → <strong> */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*(.+?)\*\*$/);
    if (m) return <strong key={i} className="text-primary/90 font-bold">{m[1]}</strong>;
    return part;
  });
}

interface AiSummaryPanelProps {
  onHide?: () => void;
  headless?: boolean; // supprime le header interne (quand intégré dans un panel qui a son propre header)
}

export function AiSummaryPanel({ onHide, headless = false }: AiSummaryPanelProps) {
  const { data, isLoading, isError, refetch } = useAiSummary();
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const ago = data?.generatedAt
    ? formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true, locale: fr })
    : null;

  // Age in hours for warning badge
  const ageHours = data?.generatedAt
    ? (Date.now() - new Date(data.generatedAt).getTime()) / 3_600_000
    : null;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/summary/refresh', { method: 'POST' });
      await refetch?.();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <div className={headless ? "" : "glass-card rounded-xl border border-primary/20 backdrop-blur-xl bg-black/70 shadow-[0_0_30px_rgba(0,240,255,0.08)]"}>
      {/* Header — masqué en mode headless */}
      {!headless && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-primary">Argos IA · Rapide</span>
            {data && (
              <span className="text-[8px] font-mono text-muted-foreground/40">{data.alertCount} evt</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {ageHours !== null && ageHours > 2 && (
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-400 bg-amber-400/10">
                &gt;{Math.floor(ageHours)}h
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Régénérer le briefing"
              className="text-muted-foreground/40 hover:text-primary transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setCollapsed(p => !p)} title={collapsed ? 'Déplier' : 'Réduire'} className="text-muted-foreground/40 hover:text-primary transition-colors">
              {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
            {onHide && (
              <button onClick={onHide} title="Masquer" className="text-muted-foreground/40 hover:text-primary transition-colors">
                <EyeOff className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="px-3 py-2.5 max-h-[38vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {isLoading && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-2.5 bg-white/5 rounded animate-pulse" style={{ width: `${70 + i * 8}%` }} />
              ))}
            </div>
          )}

          {(isError || data === null) && (
            <div className="flex items-center gap-2 py-2">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary/40" />
              </span>
              <p className="text-[9px] font-mono text-muted-foreground/50">
                {isError ? 'Erreur de connexion' : 'Génération en cours… 1er briefing dans ~3 min'}
              </p>
            </div>
          )}

          {data && (
            <>
              {/* Top countries pills */}
              {data.topCountries.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {data.topCountries.map(c => (
                    <span key={c} className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/15">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Summary text — rendu markdown */}
              <MarkdownText text={data.text} />

              {/* Timestamp */}
              {ago && (
                <p className="mt-2 text-[8px] font-mono text-muted-foreground/30 text-right">
                  Généré {ago}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
