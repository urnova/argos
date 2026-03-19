/**
 * TVDashboard — Argos V6 Grand Écran (≥ 1920px)
 * Layout lecture seule, police grande, alertes critiques très visibles.
 */

import { useState, useEffect } from "react";
import { GlobeView } from "@/components/globe-view";
import { AlertFeed } from "@/components/alert-feed";
import { CountryTensionPanel } from "@/components/country-tension-panel";
import { BreakingTicker } from "@/components/breaking-ticker";
import { useAlerts } from "@/hooks/use-alerts";
import { useServerStatus } from "@/hooks/use-server-status";
import { Activity, AlertTriangle, Loader2 } from "lucide-react";

export function TVDashboard() {
  const { data: alerts = [] } = useAlerts();
  const serverStatus = useServerStatus();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  const H48 = 48 * 60 * 60 * 1000;
  const recent = (alerts ?? []).filter(a => !a.timestamp || Date.now() - new Date(a.timestamp).getTime() < H48);
  const critCount = recent.filter(a => a.severity === 'critical').length;

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">

      {/* Ticker */}
      <BreakingTicker alerts={alerts} />

      {/* Status bar */}
      <div className="shrink-0 flex items-center justify-between px-6 py-2 bg-black/90 border-b border-white/10 z-40">
        <div className="flex items-center gap-3">
          <img src="/argos.svg" alt="Argos" className="h-6 w-auto" />
          <div>
            <div className="text-sm font-black tracking-widest uppercase text-primary leading-none">Argos Intelligence</div>
            <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest">by Astral Security · V6</div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {critCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
              </span>
              <span className="text-sm font-black text-destructive">{critCount} CRITIQUE{critCount > 1 ? 'S' : ''}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm font-mono text-primary/70">
            {serverStatus === 'ok' && <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />}
            {serverStatus === 'connecting' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
            {serverStatus === 'error' && <AlertTriangle className="w-4 h-4 text-destructive" />}
            <span>{timeStr} Paris</span>
          </div>
        </div>
      </div>

      {/* Main layout: Globe (70%) + right column (30%) */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Tensions */}
        <div className="h-full shrink-0">
          <CountryTensionPanel />
        </div>

        {/* CENTER — Globe */}
        <div className="relative flex-1">
          <GlobeView
            onToggleBriefing={() => {}}
            showBriefing={false}
            onToggleTensions={() => {}}
            showTensions={true}
            onToggleFeed={() => {}}
            showFeed={true}
          />
        </div>

        {/* RIGHT — AlertFeed large */}
        <div className="h-full shrink-0" style={{ width: 480 }}>
          <AlertFeed />
        </div>

      </div>
    </div>
  );
}
