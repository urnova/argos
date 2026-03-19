/**
 * TabletDashboard — Argos V6
 * Layout dédié tablette (768px–1024px).
 * Globe haut + Feed bas en split vertical, onglets latéraux pour chat/briefing.
 */

import { useState, useCallback } from "react";
import {
  Activity, AlertTriangle, Brain, List,
  Thermometer,
} from "lucide-react";
import { useAlerts } from "@/hooks/use-alerts";
import { useServerStatus } from "@/hooks/use-server-status";
import { AlertFeed } from "@/components/alert-feed";
import { CountryTensionPanel } from "@/components/country-tension-panel";
import { AiSummaryPanel } from "@/components/ai-summary-panel";
import { GlobeView } from "@/components/globe-view";
import { BreakingTicker } from "@/components/breaking-ticker";
import { Link, useLocation } from "wouter";
import { clsx } from "clsx";
import { Globe, History, BookOpen, Radio, Tv } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

type TabletPanel = 'feed' | 'tensions' | 'briefing';

export function TabletDashboard() {
  const { data: alerts = [] } = useAlerts();
  const serverStatus = useServerStatus();
  const { t } = useLanguage();
  const [location] = useLocation();
  const [panel, setPanel] = useState<TabletPanel>('feed');
  const [focusCountry, setFocusCountry] = useState<{ code: string; lat?: number; lng?: number } | undefined>();

  const handleCountryFocus = useCallback((code: string, lat?: number, lng?: number) => {
    setFocusCountry({ code, lat, lng });
  }, []);

  const navItems = [
    { href: "/", icon: Globe, label: t.nav.live },
    { href: "/history", icon: History, label: t.nav.history },
    { href: "/live", icon: Tv, label: t.nav.liveview },
    { href: "/radio", icon: Radio, label: t.nav.radio },
    { href: "/guide", icon: BookOpen, label: t.nav.guide },
  ];

  const H48 = 48 * 60 * 60 * 1000;
  const recent = (alerts ?? []).filter(a => !a.timestamp || Date.now() - new Date(a.timestamp).getTime() < H48);
  const critCount = recent.filter(a => a.severity === 'critical').length;

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      {/* Breaking news ticker */}
      <BreakingTicker alerts={alerts ?? []} />

      {/* Top navigation */}
      <header className="shrink-0 h-10 flex items-center px-4 gap-3 border-b border-white/10 bg-black/95 z-50">
        <img src="/argos.svg" alt="Argos" className="h-5 w-auto shrink-0" />
        <div className="hidden sm:block">
          <div className="text-[9px] font-black tracking-widest uppercase text-primary leading-none">Argos Intelligence</div>
          <div className="text-[6px] font-mono text-white/30 tracking-widest uppercase leading-none">by Astral Security</div>
        </div>
        <span className="text-[7px] font-black px-1.5 py-0.5 rounded border hidden sm:block"
          style={{ borderColor: 'rgba(0,240,255,0.3)', color: '#00F0FF', background: 'rgba(0,240,255,0.08)' }}>V6</span>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 mx-auto">
          {navItems.map(item => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all text-[9px] font-medium",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/25"
                    : "text-white/40 hover:text-white/70 border border-transparent"
                )}
              >
                <Icon className="w-3 h-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          {critCount > 0 && (
            <span className="text-[9px] font-black text-destructive">{critCount} CRIT</span>
          )}
          {serverStatus === 'ok' && <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />}
          {serverStatus === 'error' && <AlertTriangle className="w-3 h-3 text-destructive" />}
        </div>
      </header>

      {/* Main split: Globe (top) + Panel (bottom) */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Globe — 55% height */}
        <div className="relative" style={{ flex: '0 0 55%' }}>
          <GlobeView
            focusCountryCode={focusCountry?.code}
            focusLat={focusCountry?.lat}
            focusLng={focusCountry?.lng}
            onToggleBriefing={() => setPanel('briefing')}
            showBriefing={panel === 'briefing'}
            onToggleTensions={() => setPanel('tensions')}
            showTensions={panel === 'tensions'}
            onToggleFeed={() => setPanel('feed')}
            showFeed={panel === 'feed'}
          />
        </div>

        {/* Bottom panel with tabs */}
        <div className="flex-1 flex flex-col overflow-hidden border-t border-white/10">
          {/* Panel tab selector */}
          <div className="shrink-0 flex items-center gap-0 border-b border-white/8 bg-black/80">
            {([
              { id: 'feed' as const,     icon: List,        label: 'Flux Alertes' },
              { id: 'tensions' as const, icon: Thermometer, label: 'Tensions' },
              { id: 'briefing' as const, icon: Brain,       label: 'Briefing IA' },
            ]).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setPanel(id)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest border-b-2 transition-all"
                style={{
                  color: panel === id ? '#00F0FF' : '#444',
                  borderBottomColor: panel === id ? '#00F0FF' : 'transparent',
                  background: panel === id ? 'rgba(0,240,255,0.04)' : 'transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {panel === 'feed' && <AlertFeed mobile={true} />}
            {panel === 'tensions' && (
              <div className="h-full overflow-y-auto">
                <CountryTensionPanel mobile={true} onCountryClick={handleCountryFocus} />
              </div>
            )}
            {panel === 'briefing' && (
              <div className="h-full overflow-y-auto p-4">
                <AiSummaryPanel />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
