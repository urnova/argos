import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Globe from 'react-globe.gl';
import { useAlerts } from '@/hooks/use-alerts';
import { useCountryTension } from '@/hooks/use-country-tension';
import { useLanguage } from '@/contexts/language-context';
import { parseSourceBadge } from '@/lib/source-badge';
import { X, Crosshair, Volume2, VolumeX, Brain, Flame, List } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import type { Alert } from '@shared/schema';
import {
  soundMultipleLaunches,
  isMuted, toggleMute,
} from '@/lib/sounds';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#FF003C',
  high: '#FFB800',
  medium: '#00F0FF',
  low: '#FFFFFF',
};

// ISO 3166-1 alpha-2 → flag image HTML (renders on Windows PC)
function isoToFlagHtml(code: string): string {
  if (!code || code.length !== 2) return '';
  const c = code.toLowerCase();
  return `<img src="https://flagcdn.com/20x15/${c}.png" srcset="https://flagcdn.com/40x30/${c}.png 2x" width="20" height="15" alt="${c}" style="display:block;" />`;
}

const TYPE_ICONS: Record<string, string> = {
  // ALERTES
  missile: '🚀', airstrike: '✈️', artillery: '💣', naval: '⚓',
  conflict: '⚔️', explosion: '💥', chemical: '☣️', nuclear: '☢️',
  cyber: '💻', massacre: '💀', terrorism: '🔴', coup: '⚖️',
  // INFORMATIONS
  diplomatic: '🤝', political: '🏛️', 'military-move': '🪖',
  sanctions: '🚫', protest: '📢', humanitarian: '🆘',
  breaking: '📡', warning: '⚠️', info: 'ℹ️',
};

// Tension status → polygon color
const TENSION_POLY_COLORS: Record<string, string> = {
  war: 'rgba(255,0,60,0.18)',
  high: 'rgba(255,85,0,0.14)',
  tension: 'rgba(255,184,0,0.12)',
  sanctions: 'rgba(136,136,255,0.10)',
  watchlist: 'rgba(0,240,255,0.07)',
  stable: 'transparent',
};

function severityColor(s: string) { return SEVERITY_COLORS[s] ?? '#FFFFFF'; }

interface CountryPanel {
  name: string;
  code: string;
  alerts: Alert[];
  tensionStatus?: string;
  tensionReason?: string;
  tensionScore?: number;
}

interface GlobeViewProps {
  focusCountryCode?: string;
  focusLat?: number;
  focusLng?: number;
  onToggleBriefing?: () => void;
  showBriefing?: boolean;
  onToggleTensions?: () => void;
  showTensions?: boolean;
  onToggleFeed?: () => void;
  showFeed?: boolean;

}

export function GlobeView({ focusCountryCode, focusLat, focusLng, onToggleBriefing, showBriefing, onToggleTensions, showTensions, onToggleFeed, showFeed }: GlobeViewProps) {
  const { t } = useLanguage();
  const [muted, setMutedState] = useState(isMuted());

  const handleToggleMute = () => {
    const nowMuted = toggleMute();
    setMutedState(nowMuted);
  };

  const globeEl = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [countries, setCountries] = useState<{ features: any[] }>({ features: [] });
  const [hoverD, setHoverD] = useState<any>(null);
  const [countryPanel, setCountryPanel] = useState<CountryPanel | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [coords, setCoords] = useState({ lat: 0, lng: 0 });
  const lastAlertCount = useRef(0);
  const lastAlertIds = useRef<Set<number>>(new Set());

  // ── Alarm flash state ────────────────────────────────────────────────────
  const [alarmSeverity, setAlarmSeverity] = useState<string | null>(null);
  const [alarmType, setAlarmType] = useState<string>('warning');
  const alarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  const { data: alerts = [] } = useAlerts();
  const { data: tensions = [] } = useCountryTension();

  // Build a quick lookup: countryCode → tension entry
  const tensionMap = useMemo(() => {
    const m: Record<string, (typeof tensions)[0]> = {};
    for (const t of tensions) m[t.code] = t;
    return m;
  }, [tensions]);

  // Load country polygons
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(r => r.json())
      .then(setCountries);
  }, []);

  // External focus from CountryTensionPanel click
  useEffect(() => {
    if (focusLat !== undefined && focusLng !== undefined && globeEl.current) {
      globeEl.current.pointOfView({ lat: focusLat, lng: focusLng, altitude: 0.9 }, 1400);
    }
  }, [focusCountryCode, focusLat, focusLng]);

  // globe-fly-to — fired by AI chat checkpoints to pan to a location
  useEffect(() => {
    const handler = (e: Event) => {
      const { lat, lng, altitude = 0.9 } = (e as CustomEvent<{ lat: number; lng: number; altitude?: number }>).detail;
      if (globeEl.current) {
        globeEl.current.pointOfView({ lat, lng, altitude }, 1400);
      }
    };
    window.addEventListener('globe-fly-to', handler);
    return () => window.removeEventListener('globe-fly-to', handler);
  }, []);

  // focus-alert custom event — fired by alert feed cards to zoom globe
  useEffect(() => {
    const handler = (e: Event) => {
      const { lat, lng, alertId } = (e as CustomEvent<{ lat: number; lng: number; alertId: number }>).detail;
      if (globeEl.current) {
        globeEl.current.pointOfView({ lat, lng, altitude: 0.8 }, 1200);
      }
      const alert = alerts.find(a => a.id === alertId);
      if (alert) setSelectedAlert(alert);
    };
    window.addEventListener('focus-alert', handler);
    return () => window.removeEventListener('focus-alert', handler);
  }, [alerts]);

  // globe-alert-click — fired by HTML pin markers onclick
  useEffect(() => {
    const handler = (e: Event) => {
      const alertId = (e as CustomEvent<number>).detail;
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        setSelectedAlert(alert);
        if (globeEl.current) {
          globeEl.current.pointOfView({ lat: Number(alert.lat), lng: Number(alert.lng), altitude: 0.8 }, 900);
        }
      }
    };
    window.addEventListener('globe-alert-click', handler);
    return () => window.removeEventListener('globe-alert-click', handler);
  }, [alerts]);

  // Track previous aiVerified states to detect null→true transitions
  const prevAlertsRef = useRef<Map<number, Alert>>(new Map());

  // Sound + zoom + alarm — fires only on AI-verified alerts
  useEffect(() => {
    // First load: seed refs, no animation
    if (lastAlertCount.current === 0 && alerts.length > 0) {
      lastAlertCount.current = alerts.length;
      lastAlertIds.current = new Set(alerts.map(a => a.id));
      prevAlertsRef.current = new Map(alerts.map(a => [a.id, a]));
      return;
    }

    // New alerts (not seen before)
    const newAlerts = alerts.filter(a => !lastAlertIds.current.has(a.id));

    // Alerts that just got aiVerified=true (null/undefined → true)
    const justVerified: Alert[] = [];
    for (const a of alerts) {
      const prev = prevAlertsRef.current.get(a.id);
      if (prev && prev.aiVerified !== true && a.aiVerified === true) {
        justVerified.push(a);
      }
    }

    // Confirmed alerts to act on: new+verified OR just-verified
    const confirmed = [
      ...newAlerts.filter(a => a.aiVerified === true),
      ...justVerified,
    ];

    if (confirmed.length > 0) {
      const newest = confirmed[0];

      // ── Sounds handled by CriticalAlertOverlay (single authority) ──────────
      // Only globe-view-exclusive case: 3+ simultaneous missile alerts
      const missileAlerts = confirmed.filter(a => a.type === 'missile' || a.type === 'airstrike');
      if (missileAlerts.length >= 3) {
        soundMultipleLaunches();
      }

      // ── Alarm flash ───────────────────────────────────────────────────────
      if (alarmTimerRef.current) clearTimeout(alarmTimerRef.current);
      setAlarmSeverity(newest.severity);
      setAlarmType(newest.type ?? 'info');
      alarmTimerRef.current = setTimeout(() => setAlarmSeverity(null), 5000);

      // ── Zoom to newest confirmed alert ────────────────────────────────────
      if (globeEl.current) {
        globeEl.current.pointOfView({ lat: Number(newest.lat), lng: Number(newest.lng), altitude: 0.8 }, 1200);
      }
    }

    lastAlertCount.current = alerts.length;
    lastAlertIds.current = new Set(alerts.map(a => a.id));
    prevAlertsRef.current = new Map(alerts.map(a => [a.id, a]));
  }, [alerts]);

  // Resize observer
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    update();
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.4;
      globeEl.current.pointOfView({ altitude: 2.2 }, 3500);
    }
    return () => ro.disconnect();
  }, []);

  const handleMouseMove = useCallback((e: { clientX: number; clientY: number }) => {
    if (!globeEl.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    try {
      const coord = globeEl.current.toGlobeCoords(e.clientX - rect.left, e.clientY - rect.top);
      if (coord) setCoords({ lat: coord.lat, lng: coord.lng });
    } catch { /* not on globe */ }
  }, []);

  // Globe data
  const globeData = useMemo(() => {
    const now = Date.now();

    // 4h filter + only critical/high — keep globe readable (auto-clean)
    const H4 = 4 * 60 * 60 * 1000;
    const recentAlerts = alerts.filter(a =>
      (a.severity === 'critical' || a.severity === 'high') &&
      (!a.timestamp || (now - new Date(a.timestamp).getTime()) < H4)
    );

    // ── Rings — impact zones with severity-based pulse ──────────────────────
    const ringsData = recentAlerts.map((a: typeof alerts[0]) => {
      const isMissile = a.type === 'missile' || a.type === 'airstrike';
      const isCritical = a.severity === 'critical';
      return {
        lat: Number(a.lat), lng: Number(a.lng),
        maxR: isCritical ? 12 : 7,
        propagationSpeed: isCritical ? (isMissile ? 5 : 3.5) : 2,
        repeatPeriod: isCritical ? (isMissile ? 600 : 800) : 1300,
        color: (t: number) => {
          const c = severityColor(a.severity);
          const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
          return `rgba(${r},${g},${b},${Math.max(0, 1 - t * 1.3)})`;
        },
      };
    });

    // ── Arcs — missile/airstrike trajectories (origin → target) ────────────
    // Altitude proportionnelle à la distance (Haversine) : tir local = arc bas, tir intercontinental = arc haut
    const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const arcsData = recentAlerts
      .filter((a: Alert) =>
        (a.type === 'missile' || a.type === 'airstrike') &&
        a.originLat && a.originLng &&
        !isNaN(Number(a.originLat)) && !isNaN(Number(a.originLng))
      )
      .map((a: Alert) => {
        const isCritical = a.severity === 'critical';
        const dist = haversineKm(Number(a.originLat), Number(a.originLng), Number(a.lat), Number(a.lng));
        // Altitude: 0.04 pour < 50 km (artillerie locale), jusqu'à 0.45 pour > 3000 km (missile balistique)
        const altitude = Math.min(0.45, Math.max(0.04, dist / 7000));
        return {
          startLat: Number(a.originLat),
          startLng: Number(a.originLng),
          endLat: Number(a.lat),
          endLng: Number(a.lng),
          color: isCritical
            ? ['rgba(255,0,60,0)', 'rgba(255,80,0,0.9)', 'rgba(255,0,60,0)']
            : ['rgba(255,184,0,0)', 'rgba(255,220,60,0.85)', 'rgba(255,184,0,0)'],
          stroke: isCritical ? 1.2 : 0.8,
          dashLength: 0.08,
          dashGap: 0.03,
          dashAnimateTime: isCritical ? 1800 : 2800,
          altitude,
        };
      });

    // HTML layer: alert flag pins
    const htmlElementsData = [
      // ── Alert markers — flag + type icon pin
      ...recentAlerts.map(a => {
        const color = severityColor(a.severity);
        const icon = TYPE_ICONS[a.type] || '⚠️';
        const flagHtml = isoToFlagHtml(a.countryCode || '');
        const isCritical = a.severity === 'critical';
        const pinSize = isCritical ? 26 : 22;
        const glowSize = isCritical ? '0 0 14px' : '0 0 8px';
        return {
          lat: Number(a.lat), lng: Number(a.lng),
          html: `<div
            data-alert-id="${a.id}"
            onclick="window.dispatchEvent(new CustomEvent('globe-alert-click',{detail:${a.id}}))"
            style="
              display:flex;flex-direction:column;align-items:center;
              cursor:pointer;pointer-events:auto;user-select:none;
              ${isCritical ? 'animation:pulse 1s ease-in-out infinite alternate;' : ''}
            ">
            <div style="
              width:${pinSize}px;height:${pinSize}px;border-radius:50%;
              background:rgba(0,0,0,0.82);
              border:2px solid ${color};
              box-shadow:${glowSize} ${color};
              display:flex;align-items:center;justify-content:center;
              font-size:${pinSize * 0.52}px;line-height:1;
            ">${icon}</div>
            <div style="width:1.5px;height:6px;background:${color};opacity:0.7;"></div>
            <div>${flagHtml}</div>
          </div>`,
          altitude: 0.02,
          alertId: a.id,
        };
      }),
    ];

    return { ringsData, arcsData, htmlElementsData };
  }, [alerts]);

  const handleCountryClick = useCallback((polygon: any) => {
    const name: string = polygon.properties?.NAME || polygon.properties?.ADMIN || 'Unknown';
    const iso2: string = polygon.properties?.ISO_A2 || '';
    const countryAlerts = alerts.filter(
      a => a.countryCode === iso2 || a.country?.toLowerCase() === name.toLowerCase()
    );
    const tension = tensionMap[iso2];
    setCountryPanel({
      name, code: iso2, alerts: countryAlerts,
      tensionStatus: tension?.status,
      tensionReason: tension?.reason,
      tensionScore: tension?.score,
    });
    if (globeEl.current && polygon.bbox) {
      const [minLng, minLat, maxLng, maxLat] = polygon.bbox;
      globeEl.current.pointOfView({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2, altitude: 1.2 }, 1000);
    }
  }, [alerts, tensionMap]);

  const TENSION_PANEL_COLORS: Record<string, string> = {
    war: '#FF003C', high: '#FF5500', tension: '#FFB800', sanctions: '#8888FF', watchlist: '#00F0FF',
  };

  return (
    <div ref={containerRef} className="absolute inset-0 bg-black cursor-move overflow-hidden" onMouseMove={handleMouseMove}>
      <div className="pointer-events-none absolute inset-0 scanline-effect z-10" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)] z-10" />
      {/* Keyframes */}
      <style>{`
        @keyframes pulse { from { opacity:1; transform:scale(1); } to { opacity:0.55; transform:scale(1.06); } }
        @keyframes alarm-flash { 0%,100% { opacity:0; } 40%,60% { opacity:1; } }
        @keyframes alarm-scan { 0% { transform:translateY(-100%); } 100% { transform:translateY(100vh); } }
        @keyframes notif-slide { from { opacity:0; transform:translateY(20px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes border-pulse { 0%,100% { box-shadow: 0 0 20px var(--ac); } 50% { box-shadow: 0 0 50px var(--ac), 0 0 80px var(--ac); } }
      `}</style>

      {/* Alarm screen flash — severity-based vignette */}
      {alarmSeverity && (() => {
        const ac = alarmSeverity === 'critical' ? '255,0,60' : alarmSeverity === 'high' ? '255,184,0' : '0,240,255';
        return (
          <>
            {/* Corner vignette pulse */}
            <div className="pointer-events-none absolute inset-0 z-20" style={{
              background: `radial-gradient(ellipse at center, transparent 40%, rgba(${ac},0.18) 100%)`,
              animation: 'alarm-flash 0.6s ease-in-out 5',
            }} />
            {/* Horizontal scan line */}
            <div className="pointer-events-none absolute left-0 right-0 z-20" style={{
              height: 2,
              background: `rgba(${ac},0.6)`,
              boxShadow: `0 0 12px rgba(${ac},0.9)`,
              animation: 'alarm-scan 1.2s linear 3',
              top: 0,
            }} />
            {/* Type watermark */}
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" style={{ opacity: 0.04 }}>
              <span style={{ fontSize: 320, lineHeight: 1 }}>{TYPE_ICONS[alarmType] || '⚠️'}</span>
            </div>
          </>
        );
      })()}

      {/* HUD — coordinates + mute toggle + chat toggle */}
      <div className="absolute bottom-6 left-6 z-20 font-mono text-[10px] text-primary/60 space-y-0.5">
        {/* Panel toggles — stacked above coords */}
        {[
          { show: showTensions, onToggle: onToggleTensions, Icon: Flame,         label: 'Tensions' },
          { show: showFeed,     onToggle: onToggleFeed,     Icon: List,          label: 'Flux alertes' },
          { show: showBriefing, onToggle: onToggleBriefing, Icon: Brain,         label: 'Briefing IA' },

        ].map(({ show, onToggle, Icon, label }) => onToggle ? (
          <button
            key={label}
            onClick={onToggle}
            className="flex items-center gap-1.5 text-[9px] font-mono px-2 py-1 rounded border transition-colors pointer-events-auto"
            style={{
              background: show ? 'rgba(0,240,255,0.12)' : 'rgba(0,0,0,0.4)',
              borderColor: show ? 'rgba(0,240,255,0.35)' : 'rgba(255,255,255,0.10)',
              color: show ? '#00F0FF' : '#555',
            }}
          >
            <Icon className="w-3 h-3" />
            <span>{label}</span>
          </button>
        ) : null)}
        <div className="pointer-events-none">{t.hud.lat} {coords.lat.toFixed(4)}°</div>
        <div className="pointer-events-none">{t.hud.lng} {coords.lng.toFixed(4)}°</div>
        <div className="pointer-events-none text-primary/40 pt-1">{t.hud.version}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <button
            onClick={handleToggleMute}
            className="flex items-center gap-1.5 text-[9px] font-mono px-2 py-1 rounded border border-white/10 bg-black/40 hover:border-primary/40 transition-colors pointer-events-auto"
          >
            {muted
              ? <><VolumeX className="w-3 h-3 text-muted-foreground/50" /><span className="text-muted-foreground/50">{t.hud.soundOff}</span></>
              : <><Volume2 className="w-3 h-3 text-primary/70" /><span className="text-primary/70">{t.hud.soundOn}</span></>
            }
          </button>
        </div>
      </div>

      {/* HUD — alert stats */}
      <div className="pointer-events-none absolute bottom-6 right-6 z-20 text-right font-mono text-[10px] space-y-0.5">
        <div className="text-destructive/80">{alerts.filter(a => a.severity === 'critical').length} {t.hud.critical}</div>
        <div className="text-warning/80">{alerts.filter(a => a.severity === 'high').length} {t.hud.high}</div>
        <div className="text-primary/60">{alerts.length} {t.hud.totalEvents}</div>
      </div>

      {/* Globe */}
      {dimensions.width > 0 && (
        <Globe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

          polygonsData={countries.features}
          polygonSideColor={() => 'rgba(0,240,255,0.03)'}
          polygonStrokeColor={() => 'rgba(0,240,255,0.12)'}
          polygonCapColor={d => {
            if (d === hoverD) return 'rgba(0,240,255,0.22)';
            const iso2 = (d as any).properties?.ISO_A2;
            const tension = tensionMap[iso2];
            if (tension) return TENSION_POLY_COLORS[tension.status] ?? 'transparent';
            const hasAlerts = alerts.some(a => a.countryCode === iso2);
            return hasAlerts ? 'rgba(255,0,60,0.07)' : 'transparent';
          }}
          onPolygonHover={setHoverD}
          onPolygonClick={handleCountryClick}
          polygonLabel={(d: any) => {
            const name = d.properties?.NAME || d.properties?.ADMIN || '';
            const iso2 = d.properties?.ISO_A2 || '';
            const count = alerts.filter(a => a.countryCode === iso2).length;
            const tension = tensionMap[iso2];
            const tensionLine = tension ? `<br/><span style="color:${TENSION_PANEL_COLORS[tension.status] ?? '#aaa'}">${tension.status.toUpperCase()}</span>` : '';
            return count > 0
              ? `<div class="globe-tooltip"><b>${name}</b>${tensionLine}<br/>${count} incident${count > 1 ? 's' : ''}</div>`
              : `<div class="globe-tooltip">${name}${tensionLine}</div>`;
          }}

          ringsData={globeData.ringsData}
          ringColor="color" ringMaxRadius="maxR" ringAltitude={0.02}
          ringPropagationSpeed="propagationSpeed" ringRepeatPeriod="repeatPeriod"

          arcsData={globeData.arcsData}
          arcStartLat="startLat" arcStartLng="startLng"
          arcEndLat="endLat" arcEndLng="endLng"
          arcColor="color"
          arcStroke="stroke"
          arcDashLength="dashLength"
          arcDashGap="dashGap"
          arcDashAnimateTime="dashAnimateTime"
          arcAltitude="altitude"

          htmlElementsData={globeData.htmlElementsData}
          htmlElement="html"
          htmlAltitude="altitude"

          atmosphereColor="#00F0FF"
          atmosphereAltitude={0.18}
        />
      )}

      {/* Country panel */}
      {countryPanel && (
        <div className="absolute top-20 left-6 z-30 w-72 glass-panel rounded-xl overflow-hidden border border-primary/20 shadow-[0_0_30px_rgba(0,240,255,0.15)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Secteur analysé</div>
              <div className="font-bold text-primary tracking-wide">
                {countryPanel.code && countryPanel.code.length === 2 && <img src={`https://flagcdn.com/20x15/${countryPanel.code.toLowerCase()}.png`} srcSet={`https://flagcdn.com/40x30/${countryPanel.code.toLowerCase()}.png 2x`} width="20" height="15" alt={countryPanel.code} className="inline mr-1" style={{ verticalAlign: 'middle' }} />}
                {countryPanel.name}
              </div>
              {countryPanel.code && <div className="text-[10px] font-mono text-muted-foreground">ISO: {countryPanel.code}</div>}
            </div>
            <button onClick={() => setCountryPanel(null)} className="p-1 hover:text-destructive transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tension info */}
          {countryPanel.tensionStatus && (
            <div className="px-4 py-2 border-b border-white/5 bg-black/20"
              style={{ borderLeft: `3px solid ${TENSION_PANEL_COLORS[countryPanel.tensionStatus] ?? '#888'}` }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: TENSION_PANEL_COLORS[countryPanel.tensionStatus] ?? '#888' }}>
                  {countryPanel.tensionStatus}
                </span>
                {countryPanel.tensionScore !== undefined && (
                  <span className="text-[9px] font-mono text-muted-foreground">Score: {countryPanel.tensionScore}/100</span>
                )}
              </div>
              {countryPanel.tensionReason && (
                <p className="text-[9px] text-muted-foreground/70 leading-relaxed">{countryPanel.tensionReason}</p>
              )}
            </div>
          )}

          {countryPanel.alerts.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-xs font-mono">
              <Crosshair className="w-6 h-6 mx-auto mb-2 opacity-30" />
              Aucun incident récent.
            </div>
          ) : (
            <div className="overflow-y-auto max-h-56 divide-y divide-white/5">
              {countryPanel.alerts.slice(0, 20).map(a => (
                <div key={a.id} className="px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors" onClick={() => setSelectedAlert(a)}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-base">{TYPE_ICONS[a.type] || '⚠️'}</span>
                    <span className={clsx("text-[9px] font-bold uppercase tracking-widest",
                      a.severity === 'critical' ? "text-destructive" : a.severity === 'high' ? "text-warning" : "text-primary"
                    )}>{a.severity}</span>
                    <span className="ml-auto text-[9px] font-mono text-muted-foreground">
                      {a.timestamp ? formatDistanceToNow(new Date(a.timestamp), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-foreground line-clamp-1">{a.title}</div>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 py-2 border-t border-white/10 bg-black/20 text-[10px] font-mono text-muted-foreground flex justify-between">
            <span>{countryPanel.alerts.length} incident{countryPanel.alerts.length !== 1 ? 's' : ''}</span>
            <span>{countryPanel.alerts.filter(a => a.severity === 'critical').length} critique{countryPanel.alerts.filter(a => a.severity === 'critical').length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Alert detail popup — rendered via portal above the Three.js canvas */}
      {selectedAlert && createPortal(
        <AlertPopup alert={selectedAlert} onClose={() => setSelectedAlert(null)} t={t} />,
        document.body
      )}
    </div>
  );
}

// ── Alert detail popup ────────────────────────────────────────────────────────
const KIND_ICONS: Record<string, string> = {
  telegram: '📡', press: '📰', x: '𝕏', firms: '🛰', nasa: '🛰', web: '🌐',
};

const INFO_TYPES = new Set(['info', 'breaking', 'diplomatic', 'political', 'military-move', 'sanctions', 'protest', 'humanitarian', 'warning']);

function AlertPopup({ alert: a, onClose, t }: { alert: Alert; onClose: () => void; t: any }) {
  const color = SEVERITY_COLORS[a.severity] ?? '#FFFFFF';
  const emoji = TYPE_ICONS[a.type] || '⚠️';
  const badge = parseSourceBadge((a as any).source, (a as any).sourceType);
  const isInfo = INFO_TYPES.has(a.type);
  const isPending = (a as any).aiVerified === null || (a as any).aiVerified === undefined;
  const aiLabel = (a as any).aiLabel as string | null | undefined;

  // Toujours en français — aiLabel (Groq) comme titre, description FR comme corps
  const displayTitle = aiLabel ?? a.title;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        className="w-96 glass-panel rounded-2xl overflow-hidden"
        style={{ border: `1.5px solid ${color}35`, boxShadow: `0 0 50px ${color}20`, pointerEvents: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3.5 border-b border-white/10"
          style={{ background: `linear-gradient(135deg, ${color}12, transparent)` }}>
          <div className="flex items-center gap-3">
            <div className="text-2xl" style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}>{emoji}</div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                {/* Severity */}
                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ background: `${color}20`, color }}>
                  {t.severity[a.severity] ?? a.severity}
                </span>
                {/* Type */}
                <span className="text-[9px] font-mono text-muted-foreground uppercase">{a.type}</span>
                {/* AI label if available */}
                {(a as any).aiLabel && (a as any).aiLabel !== a.title && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground/70 italic line-clamp-1">
                    {(a as any).aiLabel}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-2">{displayTitle}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:text-destructive transition-colors shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Description */}
          {a.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{a.description}</p>
          )}

          {/* Location grid — skip coordinates for info-type alerts */}
          <div className={`grid gap-3 font-mono text-[10px] ${isInfo ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {!isInfo && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-muted-foreground mb-1">{t.popup.coordinates}</div>
                <div className="text-primary">{Number(a.lat).toFixed(4)}°N</div>
                <div className="text-primary">{Number(a.lng).toFixed(4)}°E</div>
              </div>
            )}
            <div className="bg-white/5 rounded-lg px-3 py-2">
              <div className="text-muted-foreground mb-1">{t.popup.sector}</div>
              <div className="text-foreground">{a.country || t.popup.unknown}</div>
              {a.countryCode && <div className="text-muted-foreground/60">ISO: {a.countryCode}</div>}
            </div>
          </div>

          {/* Footer — timestamp + source badge + verification + link */}
          <div className="flex items-center gap-2 flex-wrap text-[9px] font-mono pt-1 border-t border-white/5">
            {/* Timestamp */}
            <span className="text-muted-foreground">
              {a.timestamp ? formatDistanceToNow(new Date(a.timestamp), { addSuffix: true }) : '—'}
            </span>

            {/* Source badge */}
            <span className="px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 ml-auto"
              style={{ background: `${badge.color}18`, color: badge.color }}>
              <span>{KIND_ICONS[badge.kind] ?? '📡'}</span>
              <span>{badge.name}</span>
            </span>

            {/* AI verification badge */}
            <span className="px-1.5 py-0.5 rounded font-bold"
              style={isPending
                ? { background: 'rgba(0,240,255,0.1)', color: '#00F0FF' }
                : { background: `${color}15`, color }}>
              {isPending ? t.popup.pending : t.popup.verified}
            </span>

            {/* Source link */}
            {(a as any).source && (
              <a href={(a as any).source} target="_blank" rel="noopener noreferrer"
                className="text-primary hover:text-primary/70 transition-colors">
                {t.popup.source}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
