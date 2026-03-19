/**
 * BreakingTicker — Bandeau défilant alertes critiques/élevées
 * Partagé entre Desktop, Tablet et Mobile dashboards.
 */

import { formatDistanceToNow } from "date-fns";
import type { Alert } from "@shared/schema";

const SEV_COLOR: Record<string, string> = { critical: '#FF003C', high: '#FFB800' };
const TYPE_ICON: Record<string, string> = {
  missile: '🚀', airstrike: '✈', artillery: '💣', explosion: '💥',
  massacre: '⚠', terrorism: '🔴', naval: '⚓', conflict: '⚔',
  nuclear: '☢', chemical: '☣', coup: '⚖', cyber: '💻',
};

export function BreakingTicker({ alerts }: { alerts: Alert[] }) {
  const H12 = 12 * 60 * 60 * 1000;
  const items = alerts
    .filter(a =>
      (a.severity === 'critical' || a.severity === 'high') &&
      (!a.timestamp || Date.now() - new Date(a.timestamp).getTime() < H12)
    )
    .slice(0, 12);
  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div className="shrink-0 h-7 bg-black/90 border-b border-white/10 flex items-center overflow-hidden z-40 relative">
      <div className="shrink-0 px-3 bg-destructive h-full flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
        </span>
        <span className="text-[9px] font-bold tracking-widest text-white uppercase">LIVE</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="ticker-track flex items-center whitespace-nowrap">
          {doubled.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-5 text-[10px] font-mono">
              <span style={{ color: SEV_COLOR[a.severity] ?? '#fff' }}>
                {TYPE_ICON[a.type] ?? '⚠'}
              </span>
              {a.country && (
                <span className="text-white/40 font-bold">[{a.country.toUpperCase()}]</span>
              )}
              <span className="text-white/75">{a.title}</span>
              <span className="text-white/25 mx-1">·</span>
              <span className="text-white/30 text-[9px]">
                {a.timestamp
                  ? formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })
                  : 'maintenant'}
              </span>
              <span className="text-white/10 ml-3">│</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
