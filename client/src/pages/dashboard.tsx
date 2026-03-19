import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { GlobeView } from "@/components/globe-view";
import { AlertFeed } from "@/components/alert-feed";
import { CountryTensionPanel } from "@/components/country-tension-panel";
import { AiSummaryPanel } from "@/components/ai-summary-panel";
import { MobileDashboard } from "@/components/mobile-dashboard";
import { TabletDashboard } from "@/components/tablet-dashboard";
import { TVDashboard } from "@/components/tv-dashboard";
import { Activity, Clock, Radio, Hash, Satellite, AlertTriangle, Loader2, Brain, MessageSquare } from "lucide-react";
import { useAlerts } from "@/hooks/use-alerts";
import { useServerStatus } from "@/hooks/use-server-status";
import { useDeviceType } from "@/hooks/use-mobile";
import { LoadingScreen } from "@/components/loading-screen";
import { CriticalAlertOverlay } from "@/components/critical-alert-overlay";
import type { Alert } from "@shared/schema";

// ── Top Keywords widget ────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'the','a','an','in','on','at','to','for','of','and','or','is','are','was',
  'were','has','have','had','de','la','le','les','du','des','un','une','sur',
  'en','à','et','ou','il','elle','par','avec','pour','dans','qui','que','se',
  'ne','pas','au','aux','ce','cette','ces','son','sa','ses','leur','leurs',
  'after','over','amid','from','into','says','report','reports','killed','dead',
  'near','with','that','this','its','into','have','been',
]);

function TopKeywords({ alerts }: { alerts: Alert[] }) {
  const H24 = 24 * 60 * 60 * 1000;
  const wordCount: Record<string, number> = {};
  for (const a of alerts) {
    const ref = a.timestamp;
    if (ref && Date.now() - new Date(ref).getTime() > H24) continue;
    const words = a.title
      .toLowerCase()
      .split(/[\s\-—·,.:!?()\[\]"']+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w));
    for (const w of words) wordCount[w] = (wordCount[w] ?? 0) + 1;
  }
  const top = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (top.length === 0) return null;

  return (
    <div className="glass-card rounded-xl border border-white/10 p-3 w-44 backdrop-blur-xl bg-black/60">
      <div className="flex items-center gap-1.5 mb-2">
        <Hash className="w-3 h-3 text-primary/60" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Tendances 24h</span>
      </div>
      <div className="space-y-1">
        {top.map(([word, count], i) => (
          <div key={word} className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-muted-foreground/60">
              <span className="text-primary/30 mr-1">#{i + 1}</span>
              {word.charAt(0).toUpperCase() + word.slice(1)}
            </span>
            <span className="text-primary/70 font-bold">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Router: picks the right layout based on device ────────────────────────────
export default function Dashboard() {
  const device = useDeviceType();
  if (device === 'mobile') return <MobileDashboard />;
  if (device === 'tablet') return <TabletDashboard />;
  if (device === 'tv') return <TVDashboard />;
  return <DesktopDashboard />;
}

// ── Desktop dashboard ─────────────────────────────────────────────────────────
function DesktopDashboard() {
  const { data: alerts } = useAlerts();
  const serverStatus = useServerStatus();
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof sessionStorage === 'undefined') return true;
    return !sessionStorage.getItem('amc_loaded');
  });
  const [time, setTime] = useState(new Date());
  const [focusCountry, setFocusCountry] = useState<{ code: string; lat?: number; lng?: number } | undefined>();

  // Panel visibility toggles
  const [showTensions, setShowTensions] = useState(true);
  const [showFeed, setShowFeed] = useState(true);
  const [showAiSummary, setShowAiSummary] = useState(true);
  const [briefingCollapsed, setBriefingCollapsed] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleCountryFocus = useCallback((code: string, lat?: number, lng?: number) => {
    setFocusCountry({ code, lat, lng });
  }, []);

  // Stats — fenêtre 48h sur timestamp d'insertion
  const H48 = 48 * 60 * 60 * 1000;
  const recentAlerts = (alerts ?? []).filter(a =>
    !a.timestamp || (Date.now() - new Date(a.timestamp).getTime()) < H48
  );
  const criticalCount = recentAlerts.filter(a => a.severity === 'critical').length;
  const highCount = recentAlerts.filter(a => a.severity === 'high').length;
  const countryCount = new Set(recentAlerts.map(a => a.countryCode).filter(Boolean)).size;

  const timeStr = time.toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }) + ' Paris';

  return (
    <>
      {isLoading && <LoadingScreen onComplete={() => {
        sessionStorage.setItem('amc_loaded', '1');
        setIsLoading(false);
      }} />}
      <CriticalAlertOverlay alerts={alerts ?? []} />

      <AppLayout>
        <div className="flex flex-col h-full overflow-hidden bg-black">

          {/* 3-column layout */}
          <div className="flex flex-1 overflow-hidden relative">

            {/* LEFT — Country Tension Panel */}
            {showTensions && (
              <div className="hidden lg:block h-full relative z-30 shadow-[0_0_50px_rgba(0,0,0,0.6)]">
                <CountryTensionPanel onCountryClick={handleCountryFocus} />
              </div>
            )}

            {/* CENTER — Globe */}
            <div className="relative flex-1">
              <GlobeView
                focusCountryCode={focusCountry?.code}
                focusLat={focusCountry?.lat}
                focusLng={focusCountry?.lng}
                onToggleBriefing={() => setShowAiSummary(p => !p)}
                showBriefing={showAiSummary}
                onToggleTensions={() => setShowTensions(p => !p)}
                showTensions={showTensions}
                onToggleFeed={() => setShowFeed(p => !p)}
                showFeed={showFeed}
              />

              {/* Top HUD bar — stats */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
                <div className="glass-card px-4 py-2 rounded-2xl flex items-center gap-3 border border-white/10 backdrop-blur-xl shadow-[0_0_30px_rgba(0,240,255,0.06)]">
                  <div className="flex items-center gap-1.5">
                    {serverStatus === 'ok' && <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />}
                    {serverStatus === 'connecting' && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
                    {serverStatus === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                    <div>
                      <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">Statut</div>
                      <div className={`text-[10px] font-bold tracking-widest uppercase ${
                        serverStatus === 'ok' ? 'text-primary' :
                        serverStatus === 'connecting' ? 'text-amber-400' :
                        'text-destructive'
                      }`}>
                        {serverStatus === 'ok' ? 'Surveillance active' :
                         serverStatus === 'connecting' ? 'Connexion…' :
                         'Erreur serveur'}
                      </div>
                    </div>
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div>
                    <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">Critiques</div>
                    <div className="text-xs font-bold text-destructive flex items-center gap-1">
                      {criticalCount}
                      {criticalCount > 0 && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div>
                    <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">Élevés</div>
                    <div className="text-xs font-bold text-warning">{highCount}</div>
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div>
                    <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">Pays</div>
                    <div className="text-xs font-bold text-primary">{countryCount}</div>
                  </div>
                </div>
              </div>

              {/* Top-right — Clock + sources */}
              <div className="absolute top-3 right-3 z-20 glass-card px-3 py-2 rounded-xl border border-white/10 text-right">
                <div className="flex items-center gap-2 text-[10px] font-mono text-primary">
                  <Clock className="w-3 h-3" />
                  <span>{timeStr}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground mt-0.5 justify-end flex-wrap">
                  <Radio className="w-2.5 h-2.5 text-amber-400" />
                  <span className="text-amber-400">RSS</span>
                  <span className="text-muted-foreground/40">·</span>
                  <Satellite className="w-2.5 h-2.5 text-orange-400" />
                  <span className="text-orange-400">FIRMS</span>
                  <span className="text-muted-foreground/40">·</span>
                  <MessageSquare className="w-2.5 h-2.5 text-sky-400" />
                  <span className="text-sky-400">OSINT</span>
                  <span className="text-muted-foreground/40">·</span>
                  <Brain className="w-2.5 h-2.5 text-violet-400" />
                  <span className="text-violet-400">IA</span>
                </div>
              </div>

              {/* Top-left — Tendances 24h */}
              <div className="absolute top-3 left-3 z-20 pointer-events-none">
                <TopKeywords alerts={alerts ?? []} />
              </div>

              {/* Floating Briefing column — right side of globe */}
              {showAiSummary && (
                <div
                  className="absolute top-20 right-3 z-20 w-72 hidden lg:flex flex-col"
                  style={{ maxHeight: 'calc(100% - 6rem)' }}
                >
                  <div className="flex flex-col overflow-hidden rounded-xl border border-primary/20 bg-black/90 backdrop-blur-xl shadow-lg h-full">
                    <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10">
                      <div className="flex items-center gap-1.5">
                        <Brain className="w-3 h-3 text-primary/60" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary">Briefing Stratégique</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setBriefingCollapsed(p => !p)}
                          className="text-[8px] font-mono text-white/30 hover:text-white/60 px-1.5 py-0.5 rounded border border-white/8 hover:border-white/20 transition-all"
                        >
                          {briefingCollapsed ? '▼' : '▲'}
                        </button>
                        <button
                          onClick={() => setShowAiSummary(false)}
                          className="text-white/20 hover:text-white/60 px-1 transition-colors text-xs"
                        >✕</button>
                      </div>
                    </div>
                    {!briefingCollapsed && (
                      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <AiSummaryPanel headless={true} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom hint */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div className="text-[9px] font-mono text-muted-foreground/20 text-center">
                  CLIQUER SUR UN PAYS · CLIQUER SUR UN POINT · PANEL GAUCHE = TENSIONS
                </div>
              </div>
            </div>

            {/* RIGHT — AlertFeed always */}
            {showFeed && (
              <div className="hidden md:flex flex-col h-full relative z-30 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-l border-white/10" style={{ width: 340 }}>
                <AlertFeed />
              </div>
            )}

          </div>
        </div>
      </AppLayout>
    </>
  );
}
