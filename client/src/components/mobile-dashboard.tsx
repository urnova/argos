/**
 * MobileDashboard — Argos V6 Mobile
 * Layout : Ticker LIVE en haut, contenu plein écran, navigation en bas.
 * Onglet par défaut : Globe.
 */

import { useState } from "react";
import { Globe2, List, Thermometer, Brain } from "lucide-react";
import { useAlerts } from "@/hooks/use-alerts";
import { AlertFeed } from "@/components/alert-feed";
import { CountryTensionPanel } from "@/components/country-tension-panel";
import { AiSummaryPanel } from "@/components/ai-summary-panel";
import { GlobeView } from "@/components/globe-view";
import { BreakingTicker } from "@/components/breaking-ticker";

type MobileTab = 'globe' | 'flux' | 'tensions' | 'briefing';

const TABS: { id: MobileTab; icon: React.ElementType; label: string }[] = [
  { id: 'globe',    icon: Globe2,      label: 'Globe' },
  { id: 'flux',     icon: List,        label: 'Flux' },
  { id: 'tensions', icon: Thermometer, label: 'Tensions' },
  { id: 'briefing', icon: Brain,       label: 'Briefing' },
];

export function MobileDashboard() {
  const { data: alerts = [] } = useAlerts();
  const [tab, setTab] = useState<MobileTab>('globe');

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">

      {/* BreakingTicker — top */}
      <BreakingTicker alerts={alerts} />

      {/* Content area — plein écran */}
      <div className="flex-1 overflow-hidden relative">

        {/* GLOBE */}
        {tab === 'globe' && (
          <GlobeView
            onToggleBriefing={() => setTab('briefing')}
            showBriefing={false}
            onToggleTensions={() => setTab('tensions')}
            showTensions={false}
            onToggleFeed={() => setTab('flux')}
            showFeed={false}
          />
        )}

        {/* FLUX ALERTES — plein écran */}
        {tab === 'flux' && (
          <div className="h-full overflow-hidden">
            <AlertFeed mobile={true} />
          </div>
        )}

        {/* TENSIONS — plein écran */}
        {tab === 'tensions' && (
          <div className="h-full overflow-y-auto">
            <CountryTensionPanel
              mobile={true}
              onCountryClick={() => setTab('globe')}
              onHide={() => setTab('flux')}
            />
          </div>
        )}

        {/* BRIEFING — plein écran scroll */}
        {tab === 'briefing' && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-4 pb-3 border-b border-white/10">
              <Brain className="w-3.5 h-3.5 text-primary/70" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Argos IA · Briefing Stratégique</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-6">
              <AiSummaryPanel />
            </div>
          </div>
        )}


      </div>

      {/* Bottom navigation */}
      <nav className="shrink-0 flex border-t border-white/10 bg-black/98 z-50">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 relative transition-all"
            style={{
              color: tab === id ? '#00F0FF' : '#444',
              background: tab === id ? 'rgba(0,240,255,0.06)' : 'transparent',
            }}
          >
            {tab === id && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
            )}
            <Icon className="w-4 h-4" />
            <span className="text-[7px] font-bold uppercase tracking-wider">{label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}
