import { useAlerts } from "@/hooks/use-alerts";
import { useAlertWebSocket } from "@/hooks/use-websocket";
import {
  AlertTriangle, Crosshair, Navigation2, Radio, Zap, Shield, Globe2,
  Cpu, Anchor, FlameKindling, Skull, Gavel, Ban, Megaphone, Layers, Search, X, EyeOff
} from "lucide-react";
import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect, useRef } from "react";
import { parseSourceBadge } from "@/lib/source-badge";
import type { Alert } from "@shared/schema";

// ── Country code → flag image (flagcdn.com, renders on Windows PC) ───────────
function FlagImg({ code }: { code?: string | null }) {
  if (!code || code.length !== 2) return null;
  const c = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/20x15/${c}.png`}
      srcSet={`https://flagcdn.com/40x30/${c}.png 2x`}
      width="20" height="15"
      alt={code}
      style={{ display: 'inline', verticalAlign: 'middle' }}
    />
  );
}

// ── Types & Icons ─────────────────────────────────────────────────────────────
const TYPE_META: Record<string, { icon: unknown; label: string; color: string; category: string }> = {
  // ALERTES
  missile:        { icon: <Navigation2 className="w-3.5 h-3.5 rotate-45" />, label: 'MISSILE',       color: '#FF003C', category: 'MILITAIRE' },
  airstrike:      { icon: <Zap className="w-3.5 h-3.5" />,                   label: 'FRAPPE AÉRO',   color: '#FF5500', category: 'MILITAIRE' },
  artillery:      { icon: <FlameKindling className="w-3.5 h-3.5" />,         label: 'ARTILLERIE',    color: '#FF7700', category: 'MILITAIRE' },
  naval:          { icon: <Anchor className="w-3.5 h-3.5" />,                 label: 'NAVAL',         color: '#0080FF', category: 'MILITAIRE' },
  conflict:       { icon: <Crosshair className="w-3.5 h-3.5" />,             label: 'COMBAT',        color: '#FFB800', category: 'MILITAIRE' },
  explosion:      { icon: <Shield className="w-3.5 h-3.5" />,                label: 'EXPLOSION',     color: '#FF4400', category: 'MILITAIRE' },
  chemical:       { icon: <Cpu className="w-3.5 h-3.5" />,                   label: 'CHIMIQUE',      color: '#00FF88', category: 'MILITAIRE' },
  nuclear:        { icon: <Radio className="w-3.5 h-3.5" />,                  label: 'NUCLÉAIRE',     color: '#FF00FF', category: 'MILITAIRE' },
  cyber:          { icon: <Cpu className="w-3.5 h-3.5" />,                   label: 'CYBER',         color: '#00F0FF', category: 'MILITAIRE' },
  massacre:       { icon: <Skull className="w-3.5 h-3.5" />,                 label: 'MASSACRE',      color: '#CC0000', category: 'HUMANITAIRE' },
  terrorism:      { icon: <FlameKindling className="w-3.5 h-3.5" />,         label: 'TERRORISME',    color: '#FF2200', category: 'HUMANITAIRE' },
  coup:           { icon: <Gavel className="w-3.5 h-3.5" />,                  label: 'COUP D\'ÉTAT',  color: '#AA00FF', category: 'POLITIQUE' },
  // INFORMATIONS
  diplomatic:     { icon: <Globe2 className="w-3.5 h-3.5" />,                label: 'DIPLOMATIQUE',   color: '#44AAFF', category: 'INFO' },
  political:      { icon: <Gavel className="w-3.5 h-3.5" />,                  label: 'POLITIQUE',      color: '#8888FF', category: 'INFO' },
  'military-move':{ icon: <Navigation2 className="w-3.5 h-3.5" />,           label: 'MOUV. MILITAIRE', color: '#88AAFF', category: 'INFO' },
  sanctions:      { icon: <Ban className="w-3.5 h-3.5" />,                   label: 'SANCTIONS',      color: '#8888FF', category: 'INFO' },
  protest:        { icon: <Megaphone className="w-3.5 h-3.5" />,             label: 'MANIFESTATION',  color: '#FFCC00', category: 'INFO' },
  humanitarian:   { icon: <Shield className="w-3.5 h-3.5" />,                label: 'HUMANITAIRE',    color: '#FF7700', category: 'INFO' },
  breaking:       { icon: <Radio className="w-3.5 h-3.5" />,                  label: 'BREAKING',       color: '#FF8800', category: 'INFO' },
  warning:        { icon: <AlertTriangle className="w-3.5 h-3.5" />,         label: 'ALERTE',         color: '#00F0FF', category: 'INFO' },
  info:           { icon: <Search className="w-3.5 h-3.5" />,                label: 'INFO',           color: '#888888', category: 'INFO' },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#FF003C',
  high:     '#FFB800',
  medium:   '#00F0FF',
  low:      '#888888',
};

// ── 4 categories (INFO est la catégorie principale) ──────────────────────────
const CATEGORIES = ['ALL', 'INFO', 'MILITAIRE', 'HUMANITAIRE', 'POLITIQUE'] as const;
type Category = typeof CATEGORIES[number];

const CAT_COLORS: Record<string, string> = {
  INFO:         '#44AAFF',
  MILITAIRE:    '#FF003C',
  HUMANITAIRE:  '#FF7700',
  POLITIQUE:    '#AA00FF',
};

// ── Geographic regions ─────────────────────────────────────────────────────────
const REGIONS = {
  ALL:      { label: 'MONDE',         codes: null },
  MIDEAST:  { label: 'MOYEN-ORIENT',  codes: new Set(['IR','IL','PS','SY','IQ','YE','LB','JO','SA','AE','KW','QA','BH','OM','TR']) },
  EUROPE:   { label: 'EUROPE',        codes: new Set(['UA','RU','RS','XK','BY','PL','GE','AM','AZ','BA','MK','FR','DE','GB','MD','RO','HU','BG','HR','AL','ME','LT','LV','EE','FI','SE','NO','CH','IT','ES','PT','NL','BE','GR','CY','SK','CZ','SI']) },
  ASIA:     { label: 'ASIE',          codes: new Set(['CN','KP','KR','TW','IN','PK','AF','MM','VN','PH','ID','JP','BD','NP','TH','KH','LA','MY','MN','KZ','UZ','TM','KG','TJ']) },
  AFRICA:   { label: 'AFRIQUE',       codes: new Set(['SD','ET','SO','ML','NG','CD','CF','SS','LY','MZ','ZW','ZA','MA','DZ','TN','KE','TZ','UG','RW','BI','GN','CI','GH','SN','CM','AO','ZM','BF','NE','TD','ER','HT']) },
  AMERICAS: { label: 'AMÉRIQUES',     codes: new Set(['VE','CO','MX','BR','US','PE','BO','EC','CU','JM','GT','HN','SV','NI','CR','PA','PY','UY','AR','CL','DO','HT']) },
} as const;

// ── Category mapping for legacy data ──────────────────────────────────────────
function normalizeCategory(raw?: string | null, type?: string | null): string {
  // Info sub-types are always INFO category
  const INFO_TYPES = new Set(['info', 'breaking', 'diplomatic', 'political', 'military-move', 'sanctions', 'protest', 'humanitarian', 'warning']);
  if (type && INFO_TYPES.has(type)) return 'INFO';
  if (!raw) return 'MILITAIRE';
  const up = raw.toUpperCase();
  if (up === 'INFO') return 'INFO';
  if (up === 'MILITARY') return 'MILITAIRE';
  if (up === 'HUMANITARIAN') return 'HUMANITAIRE';
  if (up === 'POLITICAL' || up === 'GEOPOLITICAL') return 'POLITIQUE';
  return up;
}

// ── Multi-impact group type ───────────────────────────────────────────────────
interface AlertGroup {
  _group: true;
  country: string;
  countryCode: string;
  count: number;
  items: Alert[];
  latest: Alert;
}

function groupAlerts(alerts: Alert[]): (Alert | AlertGroup)[] {
  const WINDOW = 10 * 60 * 1000;
  const MIN_GROUP = 3;
  const result: (Alert | AlertGroup)[] = [];
  let i = 0;
  while (i < alerts.length) {
    const a = alerts[i];
    const code = a.countryCode;
    const ts = a.timestamp ? new Date(a.timestamp).getTime() : Date.now();
    let j = i + 1;
    while (j < alerts.length) {
      const b = alerts[j];
      if (b.countryCode !== code) break;
      const ts2 = b.timestamp ? new Date(b.timestamp).getTime() : Date.now();
      if (Math.abs(ts - ts2) > WINDOW) break;
      j++;
    }
    const count = j - i;
    if (count >= MIN_GROUP && code) {
      const items = alerts.slice(i, j);
      result.push({ _group: true, country: a.country || code, countryCode: code, count, items, latest: a });
    } else {
      for (let k = i; k < j; k++) result.push(alerts[k]);
    }
    i = j;
  }
  return result;
}

// ── AlertCard ─────────────────────────────────────────────────────────────────
function AlertCard({ alert, isNew }: { alert: Alert; isNew: boolean }) {
  const meta = TYPE_META[alert.type] ?? TYPE_META.info;
  const typeColor = meta.color;
  const sevColor = SEVERITY_COLORS[alert.severity] ?? '#FFFFFF';
  const srcBadge = parseSourceBadge(alert.source, (alert as any).sourceType);
  const cat = normalizeCategory((alert as any).category, alert.type);
  const aiVerified = (alert as any).aiVerified as boolean | null | undefined;
  const aiLabel = (alert as any).aiLabel as string | null | undefined;

  // Toujours en français : aiLabel comme titre, description (FR via Groq) comme corps
  const displayTitle = aiLabel ?? alert.title;

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('focus-alert', {
      detail: { lat: Number(alert.lat), lng: Number(alert.lng), alertId: alert.id }
    }));
  };

  return (
    <div
      onClick={handleClick}
      className={clsx(
        "p-3 rounded-xl border backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 relative overflow-hidden group cursor-pointer",
        isNew && "ring-1 animate-pulse-once"
      )}
      style={{
        background: `${typeColor}08`,
        borderColor: isNew ? `${typeColor}60` : `${typeColor}25`,
      }}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 w-14 h-14 rounded-full blur-2xl opacity-10 group-hover:opacity-25 transition-opacity"
        style={{ background: typeColor }} />

      {/* Row 1 — type + severity + NEW badge */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span style={{ color: typeColor }}>{meta.icon as any}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: typeColor }}>
            {meta.label}
          </span>
          <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded"
            style={{ background: `${sevColor}22`, color: sevColor }}>
            {alert.severity === 'critical' ? 'CRITIQUE'
              : alert.severity === 'high' ? 'ÉLEVÉ'
              : alert.severity === 'medium' ? 'MOYEN' : 'BAS'}
          </span>
          {isNew && (
            <span className="text-[8px] bg-primary/20 text-primary px-1 py-0.5 rounded font-bold uppercase">NOUVEAU</span>
          )}
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/60">
          {alert.timestamp ? formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true }) : 'À l\'instant'}
        </span>
      </div>

      {/* Statut vérification IA */}
      {(aiVerified === null || aiVerified === undefined) && (
        <span className="inline-flex items-center gap-1 text-[7px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded mb-1 border border-white/10 text-white/30">
          🔍 analyse en cours…
        </span>
      )}

      {/* Titre (aiLabel en FR si disponible, sinon original) */}
      <h3 className="font-semibold text-xs text-foreground mb-1 leading-snug line-clamp-2">{displayTitle}</h3>

      {/* Description FR générée par Groq */}
      <p className="text-[10px] text-muted-foreground/65 leading-relaxed line-clamp-2">{alert.description}</p>

      {/* Row 3 — country + category + source */}
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[9px] font-mono">
        <div className="flex items-center gap-1 text-muted-foreground/60">
          {alert.countryCode ? <FlagImg code={alert.countryCode} /> : <Globe2 className="w-3 h-3" />}
          <span className="truncate max-w-[100px]">{alert.country || `${Number(alert.lat).toFixed(1)}, ${Number(alert.lng).toFixed(1)}`}</span>
        </div>
        <div className="flex items-center gap-1">
          {cat && (
            <span className="text-[8px] uppercase font-bold px-1 py-0.5 rounded bg-white/5 text-muted-foreground/60"
              style={{ color: CAT_COLORS[cat] ? `${CAT_COLORS[cat]}99` : undefined }}>
              {cat}
            </span>
          )}
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: `${srcBadge.color}18`, color: srcBadge.color }}>
            {srcBadge.name}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── GroupCard ─────────────────────────────────────────────────────────────────
function GroupCard({ group }: { group: AlertGroup }) {
  const [expanded, setExpanded] = useState(false);
  const sevColor = SEVERITY_COLORS[group.latest.severity] ?? '#FFFFFF';
  return (
    <div className="rounded-xl border backdrop-blur-md overflow-hidden"
      style={{ background: `${sevColor}08`, borderColor: `${sevColor}35` }}>
      <button onClick={() => setExpanded((prev: boolean) => !prev)}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left">
        <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: sevColor }} />
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: sevColor }}>
            MULTI-IMPACT — {group.countryCode && <FlagImg code={group.countryCode} />} {group.country}
          </div>
          <div className="text-[10px] text-white/60 font-mono">{group.count} alertes · 10&nbsp;min</div>
        </div>
        <span className="text-[10px] font-mono text-white/30">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="border-t border-white/5 px-3 pb-2 space-y-2 pt-2">
          {group.items.map(a => (
            <AlertCard key={a.id} alert={a} isNew={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── AlertFeed ─────────────────────────────────────────────────────────────────
export function AlertFeed({ onHide, mobile = false }: { onHide?: () => void; mobile?: boolean }) {
  useAlertWebSocket();

  const { data: alerts, isLoading } = useAlerts();
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<Category>('ALL');
  const [activeSeverity, setActiveSeverity] = useState<string>('ALL');
  const [activeRegion, setActiveRegion] = useState<keyof typeof REGIONS>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const prevIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!alerts) return;
    const currentIds = new Set(alerts.map(a => a.id));
    const fresh = new Set<number>();
    currentIds.forEach(id => { if (!prevIdsRef.current.has(id)) fresh.add(id); });
    if (fresh.size > 0) {
      setNewIds(prev => new Set([...Array.from(prev), ...Array.from(fresh)]));
      setTimeout(() => {
        setNewIds(prev => { const next = new Set(prev); fresh.forEach(id => next.delete(id)); return next; });
      }, 6000);
    }
    prevIdsRef.current = currentIds;
  }, [alerts]);

  if (isLoading) {
    return (
      <div className={`glass-panel ${mobile ? 'w-full' : 'w-[340px]'} h-full flex flex-col p-4 border-l border-white/10`}>
        <div className="flex items-center gap-2 mb-6 text-primary">
          <Radio className="w-5 h-5 animate-spin" />
          <h2 className="font-bold tracking-widest uppercase text-sm">Acquisition...</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  // Live feed = alertes insérées dans les dernières 48h
  const H48 = 48 * 60 * 60 * 1000;
  const allAlerts = (alerts ?? []).filter(a => {
    if (!a.timestamp) return true;
    return (Date.now() - new Date(a.timestamp).getTime()) < H48;
  });

  // Normalize categories
  const categoryCounts: Record<string, number> = { ALL: allAlerts.length };
  for (const a of allAlerts) {
    const cat = normalizeCategory((a as any).category, a.type);
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  }

  // Filter
  let filtered = allAlerts;
  if (activeCategory !== 'ALL') {
    filtered = filtered.filter(a => normalizeCategory((a as any).category, a.type) === activeCategory);
  }
  if (activeSeverity !== 'ALL') {
    filtered = filtered.filter(a => a.severity === activeSeverity);
  }
  if (activeRegion !== 'ALL') {
    const codes = REGIONS[activeRegion].codes;
    if (codes) filtered = filtered.filter(a => a.countryCode && codes.has(a.countryCode));
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      (a.country || '').toLowerCase().includes(q)
    );
  }
  filtered = filtered.slice(0, 80);
  const grouped = groupAlerts(filtered);

  const criticalCount = allAlerts.filter(a => a.severity === 'critical').length;
  const highCount = allAlerts.filter(a => a.severity === 'high').length;

  const SEVERITIES = ['ALL', 'critical', 'high', 'medium', 'low'];
  const SEV_LABELS: Record<string, string> = { critical: 'CRITIQUE', high: 'ÉLEVÉ', medium: 'MOYEN', low: 'BAS' };
  const SEV_COLORS: Record<string, string> = { critical: '#FF003C', high: '#FFB800', medium: '#00F0FF', low: '#888888' };

  return (
    <div className={`glass-panel ${mobile ? 'w-full' : 'w-[340px]'} h-full flex flex-col border-l border-white/10 z-10`}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/10 bg-black/30 backdrop-blur-md shrink-0 space-y-2">

        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </div>
            <h2 className="font-bold tracking-widest uppercase text-[10px] text-foreground">Flux Intelligence</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/50">
              <span className="text-destructive/80">{criticalCount}🔴</span>
              <span className="text-warning/80">{highCount}🟡</span>
              <span>{allAlerts.length} evt</span>
            </div>
            {onHide && (
              <button onClick={onHide} title="Masquer le panneau" className="text-muted-foreground/40 hover:text-primary transition-colors">
                <EyeOff className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Row 1 — Catégories */}
        <div className="flex gap-1">
          {CATEGORIES.map(cat => {
            const count = categoryCounts[cat] ?? 0;
            const isActive = activeCategory === cat;
            const color = CAT_COLORS[cat] ?? '#FFFFFF';
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={clsx("text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md transition-all flex-1 text-center",
                  isActive ? "text-black" : "text-muted-foreground/50 hover:text-foreground/80")}
                style={isActive ? { background: color } : { background: 'rgba(255,255,255,0.06)' }}>
                {cat === 'ALL' ? 'TOUT' : cat}{isActive && count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        {/* Row 2 — Sévérité */}
        <div className="flex gap-1">
          {SEVERITIES.map(sev => {
            const isActive = activeSeverity === sev;
            const color = SEV_COLORS[sev] ?? '#FFFFFF';
            return (
              <button key={sev} onClick={() => setActiveSeverity(sev)}
                className={clsx("text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md transition-all border flex-1 text-center",
                  isActive ? "text-black" : "text-muted-foreground/40 hover:text-foreground/70")}
                style={isActive
                  ? { background: color, borderColor: color }
                  : { background: 'transparent', borderColor: `${color}25` }}>
                {sev === 'ALL' ? 'TOUT' : SEV_LABELS[sev] ?? sev}
              </button>
            );
          })}
        </div>

        {/* Region filter — scrollable horizontal */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
          {(Object.keys(REGIONS) as (keyof typeof REGIONS)[]).map(region => {
            const isActive = activeRegion === region;
            return (
              <button key={region} onClick={() => setActiveRegion(region)}
                className={clsx(
                  "shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md transition-all whitespace-nowrap",
                  isActive ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/4 text-muted-foreground/50 hover:text-foreground/70 border border-white/8"
                )}>
                {REGIONS[region].label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30 pointer-events-none" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher pays, événement..."
            className="w-full bg-white/4 border border-white/8 rounded-lg pl-7 pr-7 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/30 transition-colors" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scroll-smooth">
        {grouped.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground border border-dashed border-white/10 rounded-xl mt-4">
            <Navigation2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-xs font-mono">Aucun événement.</p>
            <p className="text-[10px] mt-1 opacity-50">Scan en cours...</p>
          </div>
        ) : (
          grouped.map((item, idx) =>
            '_group' in item
              ? <GroupCard key={`g-${item.countryCode}-${idx}`} group={item} />
              : <AlertCard key={item.id} alert={item} isNew={newIds.has(item.id)} />
          )
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/10 bg-black/20 text-[9px] font-mono text-muted-foreground/50 flex justify-between">
        <span>SRC: RSS · FIRMS · TG</span>
        <span>ARGOS INTELLIGENCE · ASTRAL SECURITY</span>
      </div>
    </div>
  );
}
