import { AppLayout } from "@/components/layout";
import { useAlerts } from "@/hooks/use-alerts";
import { useBriefings } from "@/hooks/use-briefings";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Navigation2, ShieldAlert, Search, Globe2, Zap, AlertTriangle, BarChart3, ExternalLink, Brain } from "lucide-react";
import { useState, useMemo } from "react";
import type { Alert } from "@shared/schema";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "border-destructive/50 text-destructive bg-destructive/10",
  high:     "border-warning/50 text-warning bg-warning/10",
  medium:   "border-primary/50 text-primary bg-primary/10",
  low:      "border-white/20 text-muted-foreground bg-white/5",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  missile:   <Navigation2 className="w-3 h-3 text-destructive rotate-45" />,
  airstrike: <Zap className="w-3 h-3 text-destructive" />,
  conflict:  <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />,
  warning:   <AlertTriangle className="w-3 h-3 text-warning" />,
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function History() {
  const { data: alerts, isLoading } = useAlerts();
  const { data: briefings, isLoading: briefingsLoading } = useBriefings();
  const [activeTab, setActiveTab] = useState<"alerts" | "briefings">("alerts");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  // Unique countries
  const countries = useMemo(() => {
    const seen = new Set<string>();
    const list: { name: string; code: string }[] = [];
    alerts?.forEach(a => {
      if (a.country && !seen.has(a.country)) {
        seen.add(a.country);
        list.push({ name: a.country, code: a.countryCode ?? '' });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [alerts]);

  // Stats
  const stats = useMemo(() => {
    if (!alerts) return null;
    return {
      total:    alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high:     alerts.filter(a => a.severity === 'high').length,
      missiles: alerts.filter(a => a.type === 'missile' || a.type === 'airstrike').length,
    };
  }, [alerts]);

  // Filtered list
  const filtered = useMemo(() => {
    return (alerts ?? [])
      .filter(a => {
        const q = search.toLowerCase();
        if (q && !a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q) && !(a.country ?? '').toLowerCase().includes(q)) return false;
        if (typeFilter !== 'all' && a.type !== typeFilter) return false;
        if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
        if (countryFilter !== 'all' && a.country !== countryFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const sd = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (sd !== 0) return sd;
        return new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime();
      });
  }, [alerts, search, typeFilter, severityFilter, countryFilter]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 h-full overflow-y-auto w-full max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <ShieldAlert className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-glow-primary uppercase">Archives Mondiales</h1>
              <p className="text-muted-foreground font-mono text-xs">Historique GDELT — incidents géolocalisés en temps réel</p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl w-fit">
          {([
            { key: "alerts",    label: "Incidents",    icon: <ShieldAlert className="w-3.5 h-3.5" /> },
            { key: "briefings", label: "Briefings IA", icon: <Brain className="w-3.5 h-3.5" /> },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-widest transition-all ${
                activeTab === tab.key
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {activeTab === "briefings" && (
          <div className="space-y-4">
            {briefingsLoading && (
              <div className="glass-card rounded-xl p-8 border border-white/10 text-center text-primary/50 font-mono text-xs uppercase animate-pulse">
                Chargement des briefings...
              </div>
            )}
            {!briefingsLoading && (!briefings || briefings.length === 0) && (
              <div className="glass-card rounded-xl p-8 border border-white/10 text-center text-muted-foreground font-mono text-xs">
                Aucun briefing disponible. Le premier sera généré automatiquement.
              </div>
            )}
            {briefings?.map(b => {
              const parsedCountries: string[] = Array.isArray(b.topCountries) ? b.topCountries : [];
              const ago = formatDistanceToNow(new Date(b.generatedAt), { addSuffix: true, locale: fr });
              return (
                <div key={b.id} className="glass-card rounded-xl border border-primary/15 bg-black/50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-primary/5">
                    <div className="flex items-center gap-2">
                      <Brain className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-primary">
                        Argos IA · {format(new Date(b.generatedAt), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-mono text-muted-foreground/50">{b.alertCount} evt · {ago}</span>
                    </div>
                  </div>
                  {parsedCountries.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-4 pt-3">
                      {parsedCountries.map((c: string) => (
                        <span key={c} className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/15">{c}</span>
                      ))}
                    </div>
                  )}
                  <div className="px-4 py-3 text-[10px] font-mono text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {b.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "alerts" && <>
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total incidents', value: stats.total, color: 'text-primary', icon: <BarChart3 className="w-4 h-4" /> },
              { label: 'Critiques', value: stats.critical, color: 'text-destructive', icon: <ShieldAlert className="w-4 h-4" /> },
              { label: 'Élevés', value: stats.high, color: 'text-warning', icon: <AlertTriangle className="w-4 h-4" /> },
              { label: 'Frappes / Missiles', value: stats.missiles, color: 'text-destructive', icon: <Navigation2 className="w-4 h-4 rotate-45" /> },
            ].map(card => (
              <div key={card.label} className="glass-card rounded-xl p-4 border border-white/10">
                <div className={`flex items-center gap-2 mb-1 ${card.color} opacity-70`}>{card.icon}<span className="text-[10px] font-mono uppercase tracking-widest">{card.label}</span></div>
                <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Recherche..."
              className="w-52 bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-primary/50 transition-all font-mono"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Type filter */}
          <select
            className="bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-primary/50 font-mono text-muted-foreground"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="all">Tous les types</option>
            <option value="missile">Missile</option>
            <option value="airstrike">Frappe aérienne</option>
            <option value="conflict">Conflit</option>
            <option value="warning">Alerte</option>
          </select>

          {/* Severity filter */}
          <select
            className="bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-primary/50 font-mono text-muted-foreground"
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
          >
            <option value="all">Toutes sévérités</option>
            <option value="critical">Critique</option>
            <option value="high">Élevé</option>
            <option value="medium">Moyen</option>
            <option value="low">Faible</option>
          </select>

          {/* Country filter */}
          <select
            className="bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-primary/50 font-mono text-muted-foreground"
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
          >
            <option value="all">Tous les pays</option>
            {countries.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>

          <div className="ml-auto text-[10px] font-mono text-muted-foreground self-center">
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table */}
        <div className="glass-panel border border-white/10 rounded-2xl overflow-hidden">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/10">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest py-3">Date/Heure</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest">Type</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest">Pays</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest">Incident</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest">Sévérité</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center p-12 text-primary/50 animate-pulse font-mono text-xs uppercase">
                    Acquisition des données GDELT...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center p-12 text-muted-foreground font-mono text-xs">
                    Aucun incident trouvé avec ces filtres.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((alert) => (
                  <TableRow key={alert.id} className="hover:bg-white/5 border-white/5 transition-colors">
                    <TableCell className="font-mono text-[10px] text-muted-foreground py-3 whitespace-nowrap">
                      {alert.timestamp ? format(new Date(alert.timestamp), 'dd/MM/yy HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {TYPE_ICONS[alert.type] ?? <AlertTriangle className="w-3 h-3" />}
                        <span className="uppercase text-[9px] font-bold tracking-tight">{alert.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Globe2 className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px]">{alert.country || '—'}</span>
                      </div>
                      {alert.countryCode && (
                        <div className="text-[9px] font-mono text-muted-foreground">{alert.countryCode}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="font-semibold text-xs text-foreground line-clamp-1">{alert.title}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{alert.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${SEVERITY_COLORS[alert.severity] ?? ''} text-[9px] uppercase`}>
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {alert.source ? (
                        <a
                          href={alert.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/70 transition-colors"
                          title={alert.source}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-[9px] text-muted-foreground font-mono">seed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        </>}
      </div>
    </AppLayout>
  );
}
