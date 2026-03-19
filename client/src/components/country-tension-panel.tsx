/**
 * CountryTensionPanel
 * Left sidebar showing countries ranked by geopolitical tension.
 * Color-coded tiers: War / High / Tension / Sanctions / Watchlist / Stable
 */

import { useCountryTension, type CountryTensionEntry } from "@/hooks/use-country-tension";
import { clsx } from "clsx";
import { Flame, RefreshCw, ShieldAlert, AlertOctagon, Activity, Eye, EyeOff } from "lucide-react";

type TensionStatus = CountryTensionEntry['status'];

const STATUS_META: Record<TensionStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    war: { label: 'GUERRE', color: '#FF003C', bg: '#FF003C18', icon: <Flame className="w-3 h-3" /> },
    high: { label: 'ÉLEVÉ', color: '#FF5500', bg: '#FF550018', icon: <ShieldAlert className="w-3 h-3" /> },
    tension: { label: 'TENSION', color: '#FFB800', bg: '#FFB80018', icon: <AlertOctagon className="w-3 h-3" /> },
    sanctions: { label: 'SANCTIONS', color: '#8888FF', bg: '#8888FF18', icon: <Activity className="w-3 h-3" /> },
    watchlist: { label: 'SURVEILLANCE', color: '#00F0FF', bg: '#00F0FF12', icon: <Eye className="w-3 h-3" /> },
    stable: { label: 'STABLE', color: '#44AA66', bg: '#44AA6612', icon: null },
};

// Export so GlobeView can use the same colors
export function getTensionStatusColor(status: TensionStatus): string {
    return STATUS_META[status]?.color ?? '#FFFFFF';
}

function ScoreBar({ score }: { score: number }) {
    const pct = Math.min(100, score);
    const color = score >= 80 ? '#FF003C' : score >= 60 ? '#FF5500' : score >= 40 ? '#FFB800' : '#8888FF';
    return (
        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
        </div>
    );
}

function CountryRow({
    entry,
    rank,
    onClick,
}: {
    entry: CountryTensionEntry;
    rank: number;
    onClick: (entry: CountryTensionEntry) => void;
}) {
    const meta = STATUS_META[entry.status] ?? STATUS_META.stable;

    return (
        <button
            className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors group relative overflow-hidden"
            onClick={() => onClick(entry)}
            title={entry.reason}
        >
            <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: meta.color }} />

            <div className="flex items-center gap-2">
                {/* Rank */}
                <span className="text-[9px] font-mono text-muted-foreground/40 w-4 shrink-0">
                    {rank < 10 ? `0${rank}` : rank}
                </span>

                {/* Flag + name */}
                {entry.code && entry.code.length === 2
                  ? <img src={`https://flagcdn.com/20x15/${entry.code.toLowerCase()}.png`} srcSet={`https://flagcdn.com/40x30/${entry.code.toLowerCase()}.png 2x`} width="20" height="15" alt={entry.code} style={{ display: 'inline', verticalAlign: 'middle' }} className="shrink-0" />
                  : <span className="text-sm leading-none shrink-0">🌍</span>
                }
                <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-foreground truncate">{entry.name}</div>
                    <div className="text-[8px] font-mono truncate" style={{ color: meta.color }}>
                        {meta.label}
                    </div>
                </div>

                {/* Score bar + alert count */}
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <ScoreBar score={entry.score} />
                    {entry.activeAlerts > 0 && (
                        <span className="text-[8px] font-mono" style={{ color: meta.color }}>
                            {entry.activeAlerts} evt
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

interface CountryTensionPanelProps {
    onCountryClick?: (code: string, lat?: number, lng?: number) => void;
    onHide?: () => void;
    mobile?: boolean;
}

// Approximate center coords for zooming the globe
const COUNTRY_CENTERS: Record<string, [number, number]> = {
    UA: [49.0, 31.0], RU: [61.5, 90.0], PS: [31.5, 34.4], IL: [31.0, 35.0],
    SD: [15.6, 32.5], YE: [15.5, 47.5], MM: [19.2, 96.7], SS: [7.8, 29.7],
    SO: [5.2, 46.2], AF: [33.9, 67.7], SY: [35.0, 38.0], KP: [40.0, 127.0],
    IR: [32.4, 53.7], IQ: [33.2, 43.7], LY: [26.3, 17.2], ML: [17.6, -2.0],
    CF: [6.6, 20.9], NG: [9.1, 8.7], ET: [9.1, 40.5], PK: [30.4, 69.3],
    TW: [23.7, 121.0], CN: [35.9, 104.2], LB: [33.9, 35.5], AZ: [40.1, 47.6],
    AM: [40.1, 45.0], MZ: [-18.7, 35.0], HT: [19.0, -72.3], VE: [6.4, -66.6],
    CD: [-4.0, 21.8], RS: [44.0, 21.0], GE: [42.3, 43.4], BY: [53.7, 27.9],
};

export function CountryTensionPanel({ onCountryClick, onHide, mobile = false }: CountryTensionPanelProps) {
    const { data: tensions, isLoading, refetch } = useCountryTension();

    const handleClick = (entry: CountryTensionEntry) => {
        const coords = COUNTRY_CENTERS[entry.code];
        onCountryClick?.(entry.code, coords?.[0], coords?.[1]);
    };

    // Tier counts for header
    const tiers = tensions ? {
        war: tensions.filter(t => t.status === 'war').length,
        high: tensions.filter(t => t.status === 'high').length,
        other: tensions.filter(t => !['war', 'high'].includes(t.status)).length,
    } : { war: 0, high: 0, other: 0 };

    return (
        <div className={`glass-panel ${mobile ? 'w-full' : 'w-[200px]'} h-full flex flex-col border-r border-white/10 z-10`}>
            {/* Header */}
            <div className="px-3 py-3 border-b border-white/10 bg-black/30 backdrop-blur-md shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                        </div>
                        <h2 className="font-bold tracking-widest uppercase text-[10px] text-foreground">Tensions Mondiales</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => refetch()} title="Actualiser" className="text-muted-foreground/40 hover:text-primary transition-colors">
                            <RefreshCw className="w-3 h-3" />
                        </button>
                        {onHide && (
                            <button onClick={onHide} title="Masquer le panneau" className="text-muted-foreground/40 hover:text-primary transition-colors">
                                <EyeOff className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tier stats */}
                <div className="grid grid-cols-3 gap-1 text-center">
                    {[
                        { label: 'GUERRE', count: tiers.war, color: '#FF003C' },
                        { label: 'ÉLEVÉ', count: tiers.high, color: '#FF5500' },
                        { label: 'AUTRE', count: tiers.other, color: '#FFB800' },
                    ].map(t => (
                        <div key={t.label} className="bg-white/5 rounded px-1 py-1">
                            <div className="text-[10px] font-bold" style={{ color: t.color }}>{t.count}</div>
                            <div className="text-[7px] font-mono text-muted-foreground/50">{t.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Country list */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
                {isLoading ? (
                    <div className="p-3 space-y-2">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
                        ))}
                    </div>
                ) : tensions && tensions.length > 0 ? (
                    tensions.slice(0, 35).map((entry, i) => (
                        <CountryRow key={entry.code} entry={entry} rank={i + 1} onClick={handleClick} />
                    ))
                ) : (
                    <div className="p-4 text-center space-y-2">
                        <div className="text-[10px] font-mono text-muted-foreground/40">
                            Chargement des tensions en cours…
                        </div>
                        <div className="text-[8px] font-mono text-muted-foreground/20 leading-snug">
                            Les données apparaissent dès réception des premières alertes
                        </div>
                        <button
                            onClick={() => refetch()}
                            className="text-[8px] font-mono text-primary/40 hover:text-primary/70 underline transition-colors"
                        >
                            Actualiser
                        </button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-white/10 bg-black/20 text-[8px] font-mono text-muted-foreground/40 text-center">
                ASTRAL INTEL · LIVE
            </div>
        </div>
    );
}
