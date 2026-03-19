/**
 * LiveView — Argos V6.2 : Situation Room
 * Drill-down 3 niveaux : galerie pays → galerie villes → dashboard caméra
 * ISS tracker + NASA YouTube live, EarthCam, météo wttr.in
 * Recommandations dynamiques basées sur les alertes temps réel
 */

import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout";
import { useAlerts } from "@/hooks/use-alerts";
import {
  Satellite, ArrowLeft, Thermometer, Wind, Eye, Clock,
  AlertTriangle, Zap, MapPin, Search, ExternalLink, Video, VideoOff,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CamCity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  timezone: string;
  tension?: 'critical' | 'high' | 'medium';
  earthcamId?: string;
  // Skylinewebcams are NOT embedded (X-Frame-Options blocks them).
  // We store the URL only for the external link.
  skylineUrl?: string;
}

interface Country {
  id: string;
  name: string;
  countryCode: string;
  isConflict: boolean;
  isSpace?: boolean;
  cities: CamCity[];
}

interface ISSData {
  lat: number; lng: number; altitude: number; velocity: number;
  timestamp: number; footprint: number; visibility: string;
}

interface Weather {
  temp: number; feelsLike: number; humidity: number;
  windSpeed: number; windDir: string; visibility: number;
  condition: string;
}

type ViewLevel = 'countries' | 'cities' | 'dashboard' | 'iss';

// ── Catalogue des pays et villes ──────────────────────────────────────────────

const COUNTRIES: Country[] = [
  {
    id: 'iss', name: 'Station Spatiale (ISS)', countryCode: 'ISS',
    isConflict: false, isSpace: true, cities: [],
  },
  {
    id: 'ua', name: 'Ukraine', countryCode: 'UA', isConflict: true,
    cities: [
      { id: 'kyiv', name: 'Kyiv', lat: 50.4501, lng: 30.5234, timezone: 'Europe/Kiev', tension: 'critical',
        skylineUrl: 'https://www.skylinewebcams.com/en/webcam/ukraine/kyiv/city/kyiv-city.html' },
      { id: 'odessa', name: 'Odessa', lat: 46.4825, lng: 30.7233, timezone: 'Europe/Kiev', tension: 'critical' },
      { id: 'kharkiv', name: 'Kharkiv', lat: 49.9935, lng: 36.2304, timezone: 'Europe/Kiev', tension: 'critical' },
    ],
  },
  {
    id: 'il', name: 'Israël', countryCode: 'IL', isConflict: true,
    cities: [
      { id: 'jerusalem', name: 'Jérusalem', lat: 31.7683, lng: 35.2137, timezone: 'Asia/Jerusalem', tension: 'critical',
        skylineUrl: 'https://www.skylinewebcams.com/en/webcam/israel/jerusalem/city/jerusalem-city.html' },
      { id: 'telaviv', name: 'Tel Aviv', lat: 32.0853, lng: 34.7818, timezone: 'Asia/Jerusalem', tension: 'high' },
    ],
  },
  {
    id: 'lb', name: 'Liban', countryCode: 'LB', isConflict: true,
    cities: [
      { id: 'beirut', name: 'Beyrouth', lat: 33.8886, lng: 35.4955, timezone: 'Asia/Beirut', tension: 'high',
        skylineUrl: 'https://www.skylinewebcams.com/en/webcam/lebanon/beirut/city/beirut.html' },
    ],
  },
  {
    id: 'sy', name: 'Syrie', countryCode: 'SY', isConflict: true,
    cities: [
      { id: 'damascus', name: 'Damas', lat: 33.5138, lng: 36.2765, timezone: 'Asia/Damascus', tension: 'high' },
      { id: 'aleppo', name: 'Alep', lat: 36.2021, lng: 37.1343, timezone: 'Asia/Damascus', tension: 'high' },
    ],
  },
  {
    id: 'ps', name: 'Palestine', countryCode: 'PS', isConflict: true,
    cities: [
      { id: 'gaza', name: 'Gaza', lat: 31.5017, lng: 34.4668, timezone: 'Asia/Gaza', tension: 'critical' },
      { id: 'ramallah', name: 'Ramallah', lat: 31.9038, lng: 35.2034, timezone: 'Asia/Hebron', tension: 'high' },
    ],
  },
  {
    id: 'ru', name: 'Russie', countryCode: 'RU', isConflict: true,
    cities: [
      { id: 'moscow', name: 'Moscou', lat: 55.7558, lng: 37.6173, timezone: 'Europe/Moscow' },
      { id: 'stpetersburg', name: 'Saint-Pétersbourg', lat: 59.9311, lng: 30.3609, timezone: 'Europe/Moscow' },
    ],
  },
  {
    id: 'tr', name: 'Turquie', countryCode: 'TR', isConflict: false,
    cities: [
      { id: 'istanbul', name: 'Istanbul', lat: 41.0082, lng: 28.9784, timezone: 'Europe/Istanbul', tension: 'medium',
        skylineUrl: 'https://www.skylinewebcams.com/en/webcam/turkey/istanbul/city/bosphore.html' },
      { id: 'ankara', name: 'Ankara', lat: 39.9334, lng: 32.8597, timezone: 'Europe/Istanbul' },
    ],
  },
  {
    id: 'fr', name: 'France', countryCode: 'FR', isConflict: false,
    cities: [
      { id: 'paris', name: 'Paris', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris', earthcamId: 'eiffeltower2' },
      { id: 'marseille', name: 'Marseille', lat: 43.2965, lng: 5.3698, timezone: 'Europe/Paris',
        skylineUrl: 'https://www.skylinewebcams.com/en/webcam/france/provence-alpes-cote-dazur/marseille/vieux-port.html' },
    ],
  },
  {
    id: 'us', name: 'États-Unis', countryCode: 'US', isConflict: false,
    cities: [
      { id: 'newyork', name: 'New York', lat: 40.7580, lng: -73.9855, timezone: 'America/New_York', earthcamId: 'timessquare4' },
      { id: 'losangeles', name: 'Los Angeles', lat: 34.0522, lng: -118.2437, timezone: 'America/Los_Angeles' },
    ],
  },
  {
    id: 'gb', name: 'Royaume-Uni', countryCode: 'GB', isConflict: false,
    cities: [
      { id: 'london', name: 'Londres', lat: 51.5074, lng: -0.1278, timezone: 'Europe/London', earthcamId: 'londonwestminster' },
    ],
  },
  {
    id: 'jp', name: 'Japon', countryCode: 'JP', isConflict: false,
    cities: [
      { id: 'tokyo', name: 'Tokyo', lat: 35.6595, lng: 139.7004, timezone: 'Asia/Tokyo', earthcamId: 'tokyoshibuya' },
      { id: 'osaka', name: 'Osaka', lat: 34.6937, lng: 135.5023, timezone: 'Asia/Tokyo' },
    ],
  },
  {
    id: 'it', name: 'Italie', countryCode: 'IT', isConflict: false,
    cities: [
      { id: 'rome', name: 'Rome', lat: 41.9009, lng: 12.4833, timezone: 'Europe/Rome', earthcamId: 'trevifrountain' },
      { id: 'venice', name: 'Venise', lat: 45.4408, lng: 12.3155, timezone: 'Europe/Rome',
        skylineUrl: 'https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/gran-canal.html' },
    ],
  },
  {
    id: 'cz', name: 'Tchéquie', countryCode: 'CZ', isConflict: false,
    cities: [
      { id: 'prague', name: 'Prague', lat: 50.0755, lng: 14.4378, timezone: 'Europe/Prague', earthcamId: 'prague' },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function flagImg(code: string, size: '16x12' | '24x18' | '32x24' = '24x18') {
  if (code === 'ISS') return null;
  return `https://flagcdn.com/${size}/${code.toLowerCase()}.png`;
}

const TENSION_COLOR: Record<string, string> = {
  critical: '#FF003C',
  high: '#FFB800',
  medium: '#00F0FF',
};

const TENSION_LABEL: Record<string, string> = {
  critical: 'CRITIQUE',
  high: 'ÉLEVÉ',
  medium: 'TENSION',
};

function countryMaxTension(country: Country): 'critical' | 'high' | 'medium' | undefined {
  if (country.cities.some(c => c.tension === 'critical')) return 'critical';
  if (country.cities.some(c => c.tension === 'high')) return 'high';
  if (country.cities.some(c => c.tension === 'medium')) return 'medium';
  if (country.isConflict) return 'medium';
  return undefined;
}

function tensionScore(t?: string) {
  if (t === 'critical') return 3;
  if (t === 'high') return 2;
  if (t === 'medium') return 1;
  return 0;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Only EarthCam supports iframe embedding. Skylinewebcams blocks with X-Frame-Options.
function getEmbedUrl(city: CamCity): string | null {
  if (city.earthcamId) return `https://www.earthcam.com/camembed.php?id=${city.earthcamId}`;
  return null;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useISSTracker() {
  const [iss, setIss] = useState<ISSData | null>(null);
  useEffect(() => {
    let active = true;
    async function fetchISS() {
      try {
        const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        if (!res.ok || !active) return;
        const d = await res.json();
        setIss({ lat: d.latitude, lng: d.longitude, altitude: d.altitude, velocity: d.velocity, timestamp: d.timestamp, footprint: d.footprint, visibility: d.visibility });
      } catch {}
    }
    fetchISS();
    const t = setInterval(fetchISS, 5000);
    return () => { active = false; clearInterval(t); };
  }, []);
  return iss;
}

function useWeather(lat: number, lng: number, enabled: boolean) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<string, Weather>>({});
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;

  useEffect(() => {
    if (!enabled) return;
    if (cache.current[key]) { setWeather(cache.current[key]); return; }
    setLoading(true);
    fetch(`https://wttr.in/${lat},${lng}?format=j1`)
      .then(r => r.json())
      .then(d => {
        const c = d?.current_condition?.[0];
        if (!c) return;
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
        const w: Weather = {
          temp: Number(c.temp_C),
          feelsLike: Number(c.FeelsLikeC),
          humidity: Number(c.humidity),
          windSpeed: Number(c.windspeedKmph),
          windDir: dirs[Math.round(Number(c.winddirDegree) / 45) % 8],
          visibility: Number(c.visibility),
          condition: c.weatherDesc?.[0]?.value ?? '',
        };
        cache.current[key] = w;
        setWeather(w);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [key, enabled]);

  return { weather, loading };
}

function useLocalClock(timezone: string) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const now = new Date();
  return {
    time: now.toLocaleTimeString('fr-FR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: now.toLocaleDateString('fr-FR', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

// ── Components ────────────────────────────────────────────────────────────────

function TensionBadge({ level }: { level: string }) {
  const color = TENSION_COLOR[level];
  if (!color) return null;
  return (
    <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 leading-none"
      style={{ color, borderColor: `${color}40`, background: `${color}15` }}>
      {TENSION_LABEL[level]}
    </span>
  );
}

function Breadcrumb({ view, country, city, onHome, onBackToCountry }: {
  view: ViewLevel; country: Country | null; city: CamCity | null;
  onHome: () => void; onBackToCountry: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40">
      <button onClick={onHome} className="hover:text-primary transition-colors">Tout</button>
      {view === 'iss' && (
        <><span className="mx-0.5 text-white/15">/</span><span className="text-white/70">Station Spatiale ISS</span></>
      )}
      {(view === 'cities' || view === 'dashboard') && country && (
        <>
          <span className="mx-0.5 text-white/15">/</span>
          {view === 'dashboard'
            ? <button onClick={onBackToCountry} className="hover:text-primary transition-colors">{country.name}</button>
            : <span className="text-white/70">{country.name}</span>
          }
        </>
      )}
      {view === 'dashboard' && city && (
        <><span className="mx-0.5 text-white/15">/</span><span className="text-white font-bold">{city.name}</span></>
      )}
    </div>
  );
}

// ── Country card ──────────────────────────────────────────────────────────────

function CountryCard({ country, alertCount24h, onClick }: {
  country: Country; alertCount24h: number; onClick: () => void;
}) {
  if (country.isSpace) {
    return (
      <button
        onClick={onClick}
        className="group relative flex flex-col gap-3 p-4 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
        style={{
          background: 'linear-gradient(135deg, rgba(0,240,255,0.08) 0%, rgba(0,0,0,0.7) 100%)',
          borderColor: 'rgba(0,240,255,0.35)',
          boxShadow: '0 0 24px rgba(0,240,255,0.08)',
        }}
      >
        <style>{`@keyframes spin-slow { to { transform: rotate(360deg); } }`}</style>
        <div className="flex items-center gap-2.5">
          <Satellite className="w-6 h-6 text-primary shrink-0" style={{ animation: 'spin-slow 6s linear infinite' }} />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-white">Station Spatiale</div>
            <div className="text-[9px] font-mono text-primary/50 mt-0.5">ISS · Orbite basse terrestre</div>
          </div>
          <span className="text-[7px] font-black px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/10 shrink-0">LIVE</span>
        </div>
        <div className="flex items-center gap-1.5 text-[8px] font-mono text-white/30">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping inline-block" />
          Vue NASA en direct
        </div>
      </button>
    );
  }

  const maxTension = countryMaxTension(country);
  const color = maxTension ? TENSION_COLOR[maxTension] : undefined;
  const isCritical = maxTension === 'critical';

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col gap-3 p-4 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
      style={{
        background: isCritical
          ? 'linear-gradient(135deg, rgba(255,0,60,0.1) 0%, rgba(0,0,0,0.85) 100%)'
          : country.isConflict
            ? 'linear-gradient(135deg, rgba(255,85,0,0.06) 0%, rgba(0,0,0,0.8) 100%)'
            : 'rgba(255,255,255,0.03)',
        borderColor: color ? `${color}45` : 'rgba(255,255,255,0.08)',
        boxShadow: isCritical ? `0 0 20px rgba(255,0,60,0.12)` : 'none',
      }}
    >
      {isCritical && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ animation: 'pulse 2s ease-in-out infinite', boxShadow: `0 0 0 1px rgba(255,0,60,0.25)` }} />
      )}

      {/* Flag + name */}
      <div className="flex items-center gap-2.5">
        {flagImg(country.countryCode) && (
          <img src={flagImg(country.countryCode)!} alt="" className="w-7 h-5 rounded-sm object-cover shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-white leading-tight">{country.name}</div>
          <div className="text-[9px] font-mono text-white/30 mt-0.5">
            {country.cities.length} ville{country.cities.length > 1 ? 's' : ''}
          </div>
        </div>
        {maxTension && <TensionBadge level={maxTension} />}
      </div>

      {/* Alert count */}
      {alertCount24h > 0 && (
        <div className="flex items-center gap-1.5 text-[8px] font-mono"
          style={{ color: isCritical ? '#FF003C' : '#FFB80080' }}>
          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
          <span>{alertCount24h} alerte{alertCount24h > 1 ? 's' : ''} · 24h</span>
        </div>
      )}
    </button>
  );
}

// ── City card ─────────────────────────────────────────────────────────────────

function CityCard({ city, countryCode, alertCount, onClick }: {
  city: CamCity; countryCode: string; alertCount: number; onClick: () => void;
}) {
  const color = city.tension ? TENSION_COLOR[city.tension] : undefined;
  const hasEmbed = !!city.earthcamId;
  const hasExternalCam = !!(city.skylineUrl || city.earthcamId);

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col gap-3 p-4 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
      style={{
        background: city.tension === 'critical'
          ? 'linear-gradient(135deg, rgba(255,0,60,0.08) 0%, rgba(0,0,0,0.85) 100%)'
          : 'rgba(255,255,255,0.03)',
        borderColor: color ? `${color}40` : 'rgba(255,255,255,0.08)',
        boxShadow: city.tension === 'critical' ? '0 0 16px rgba(255,0,60,0.1)' : 'none',
      }}
    >
      <div className="flex items-center gap-2.5">
        <img src={`https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`} alt="" className="w-6 h-4 rounded-sm shrink-0" />
        <span className="text-[13px] font-bold text-white flex-1 min-w-0">{city.name}</span>
        {city.tension && <TensionBadge level={city.tension} />}
      </div>

      <div className="flex items-center gap-1.5 text-[8px] font-mono"
        style={{ color: hasEmbed ? '#22c55e' : hasExternalCam ? '#00F0FF80' : '#ffffff20' }}>
        {hasEmbed
          ? <><Video className="w-2.5 h-2.5 shrink-0" /><span>Caméra intégrée</span></>
          : hasExternalCam
            ? <><ExternalLink className="w-2.5 h-2.5 shrink-0" /><span>Caméra externe</span></>
            : <><VideoOff className="w-2.5 h-2.5 shrink-0" /><span>Pas de caméra</span></>
        }
      </div>

      {alertCount > 0 && (
        <div className="flex items-center gap-1 text-[8px] font-mono text-amber-400/60">
          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
          <span>{alertCount} alerte{alertCount > 1 ? 's' : ''}</span>
        </div>
      )}
    </button>
  );
}

// ── Recommendations section ───────────────────────────────────────────────────

function Recommendations({ countries, alertsByCountry, onSelect }: {
  countries: Country[];
  alertsByCountry: Record<string, number>;
  onSelect: (c: Country) => void;
}) {
  const hotZones = countries
    .filter(c => !c.isSpace)
    .map(c => ({
      country: c,
      tension: countryMaxTension(c),
      alerts: alertsByCountry[c.countryCode] ?? 0,
      score: tensionScore(countryMaxTension(c)) * 1000 + (alertsByCountry[c.countryCode] ?? 0),
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (hotZones.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-0.5 h-4 rounded-full bg-destructive/70" />
        <span className="text-[10px] font-black uppercase tracking-widest text-destructive/80">Zones sous surveillance</span>
        <span className="text-[8px] font-mono text-white/20">— basé sur les alertes temps réel</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {hotZones.map(({ country, tension, alerts }) => {
          const color = tension ? TENSION_COLOR[tension] : '#FF003C';
          return (
            <button
              key={country.id}
              onClick={() => onSelect(country)}
              className="relative overflow-hidden rounded-2xl border p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: `linear-gradient(135deg, ${color}14 0%, rgba(0,0,0,0.9) 100%)`,
                borderColor: `${color}45`,
                boxShadow: `0 0 30px ${color}10`,
              }}
            >
              <div className="h-0.5 w-full mb-3 rounded-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
              <div className="flex items-center gap-2.5 mb-2">
                {flagImg(country.countryCode) && (
                  <img src={flagImg(country.countryCode)!} alt="" className="w-8 h-6 rounded object-cover shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white">{country.name}</div>
                  {tension && (
                    <div className="text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color }}>
                      {TENSION_LABEL[tension]}
                    </div>
                  )}
                </div>
              </div>
              {alerts > 0 && (
                <div className="flex items-center gap-1.5 text-[9px] font-mono" style={{ color: `${color}99` }}>
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span className="font-bold">{alerts}</span>
                  <span>alerte{alerts > 1 ? 's' : ''} dans les 24h</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── City Dashboard ────────────────────────────────────────────────────────────

function CityDashboard({ city, country, onBack }: {
  city: CamCity; country: Country; onBack: () => void;
}) {
  const { data: alerts } = useAlerts();
  const { weather, loading: weatherLoading } = useWeather(city.lat, city.lng, true);
  const { time: localTime, date: localDate } = useLocalClock(city.timezone);

  const countryAlerts = (alerts ?? []).filter(a =>
    a.countryCode === country.countryCode &&
    a.timestamp && Date.now() - new Date(a.timestamp).getTime() < 24 * 3600 * 1000
  ).slice(0, 8);

  const embedUrl = getEmbedUrl(city);
  const color = city.tension ? TENSION_COLOR[city.tension] : 'rgba(255,255,255,0.2)';

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 hover:text-primary transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour
        </button>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <img src={`https://flagcdn.com/24x18/${country.countryCode.toLowerCase()}.png`} alt="" className="w-6 h-4 rounded-sm" />
          <span className="text-sm font-bold text-white">{city.name}</span>
          <span className="text-[10px] font-mono text-white/30">{country.name}</span>
          {city.tension && <TensionBadge level={city.tension} />}
        </div>
      </div>

      {/* Main layout: Camera + Sidebar */}
      <div className="flex gap-4 flex-col lg:flex-row flex-1 min-h-0">

        {/* Camera — left / main */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {embedUrl ? (
            <div className="relative w-full rounded-2xl overflow-hidden border"
              style={{ paddingBottom: '56.25%', borderColor: `${color}30` }}>
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allowFullScreen
                title={`Caméra ${city.name}`}
              />
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 px-2 py-1 rounded-lg pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[8px] font-bold text-white uppercase tracking-wider">EN DIRECT</span>
              </div>
              <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-md px-3 py-2 rounded-xl pointer-events-none flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-white">{city.name}</div>
                  <div className="text-[9px] font-mono text-white/40">{country.name}</div>
                </div>
                {city.tension && <TensionBadge level={city.tension} />}
              </div>
            </div>
          ) : (
            /* No embeddable stream — show placeholder with external links */
            <div className="relative rounded-2xl overflow-hidden border flex flex-col items-center justify-center gap-4 py-16 px-6 text-center"
              style={{ borderColor: `${color}25`, background: `linear-gradient(135deg, ${color}08 0%, rgba(0,0,0,0.9) 100%)` }}>
              <VideoOff className="w-12 h-12" style={{ color: `${color}40` }} />
              <div>
                <div className="text-sm font-bold text-white/60 mb-1">{city.name}</div>
                <div className="text-[10px] font-mono text-white/25 max-w-xs">
                  Les flux caméras de cette ville nécessitent un navigateur externe en raison des restrictions d'intégration.
                </div>
              </div>
              {city.skylineUrl && (
                <a
                  href={city.skylineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border font-bold text-[11px] font-mono transition-all hover:opacity-90"
                  style={{ background: `${color}15`, borderColor: `${color}40`, color }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  OUVRIR LA CAMÉRA EN DIRECT
                </a>
              )}
            </div>
          )}
        </div>

        {/* Sidebar — right */}
        <div className="w-full lg:w-56 shrink-0 flex flex-col gap-3">
          {/* Local time */}
          <div className="rounded-2xl border border-white/8 bg-black/60 p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3 h-3 text-primary/50" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-primary/50">Heure locale</span>
            </div>
            <div className="text-xl font-black font-mono text-primary">{localTime}</div>
            <div className="text-[9px] font-mono text-white/25 mt-0.5 capitalize">{localDate}</div>
          </div>

          {/* Weather */}
          <div className="rounded-2xl border border-white/8 bg-black/60 p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Thermometer className="w-3 h-3 text-primary/50" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-primary/50">Météo</span>
            </div>
            {weatherLoading && <div className="text-[9px] font-mono text-white/20 animate-pulse py-1">Chargement…</div>}
            {weather && (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-white">{weather.temp}°C</span>
                  <span className="text-[9px] font-mono text-white/30">ressenti {weather.feelsLike}°</span>
                </div>
                <div className="text-[9px] font-mono text-white/40 leading-snug">{weather.condition}</div>
                <div className="flex items-center gap-1 text-[9px] font-mono text-white/30 mt-1">
                  <Wind className="w-2.5 h-2.5" /><span>{weather.windSpeed} km/h {weather.windDir}</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono text-white/30">
                  <Eye className="w-2.5 h-2.5" /><span>{weather.visibility} km vis.</span>
                </div>
                <div className="text-[8px] font-mono text-white/20">Humidité {weather.humidity}%</div>
              </div>
            )}
            {!weatherLoading && !weather && (
              <div className="text-[9px] font-mono text-white/20 py-1">Indisponible</div>
            )}
          </div>

          {/* Alerts */}
          <div className="rounded-2xl border border-white/8 bg-black/60 p-3.5 flex-1 min-h-[100px] overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3 h-3 text-destructive/50" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-destructive/50">Alertes 24h</span>
            </div>
            {countryAlerts.length === 0 ? (
              <div className="text-[9px] font-mono text-white/20">Aucune alerte active</div>
            ) : (
              <div className="space-y-2">
                {countryAlerts.map(a => (
                  <div key={a.id} className="text-[9px] font-mono">
                    <span className={`font-bold mr-1 ${a.severity === 'critical' ? 'text-destructive' : a.severity === 'high' ? 'text-amber-400' : 'text-primary/60'}`}>
                      [{a.severity.slice(0, 3).toUpperCase()}]
                    </span>
                    <span className="text-white/50 line-clamp-2">{a.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ISS Detail ────────────────────────────────────────────────────────────────

function ISSDetail({ onBack }: { onBack: () => void }) {
  const { data: alerts } = useAlerts();
  const iss = useISSTracker();

  const conflictCities = COUNTRIES
    .filter(c => c.isConflict)
    .flatMap(c => c.cities.map(city => ({ ...city, countryCode: c.countryCode, countryName: c.name })));

  const nearConflicts = iss
    ? conflictCities
      .filter(c => c.tension === 'critical' || c.tension === 'high')
      .map(c => ({ ...c, dist: distanceKm(iss.lat, iss.lng, c.lat, c.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5)
    : [];

  const critAlerts = (alerts ?? []).filter(a =>
    (a.severity === 'critical' || a.severity === 'high') &&
    a.timestamp && Date.now() - new Date(a.timestamp).getTime() < 12 * 3600 * 1000
  ).slice(0, 6);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 hover:text-primary transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour
        </button>
        <div className="w-px h-4 bg-white/10" />
        <Satellite className="w-4 h-4 text-primary" style={{ animation: 'spin-slow 6s linear infinite' }} />
        <span className="text-sm font-bold text-white">Station Spatiale Internationale</span>
        <span className="text-[7px] font-black px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/10">LIVE</span>
      </div>

      {/* Main layout: Live feed + sidebar */}
      <div className="flex gap-4 flex-col lg:flex-row flex-1 min-h-0">

        {/* NASA ISS YouTube live feed */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="relative w-full rounded-2xl overflow-hidden border border-primary/20"
            style={{ paddingBottom: '56.25%' }}>
            <iframe
              src="https://www.youtube.com/embed/P57pHPzj4qU?autoplay=1&mute=1&controls=1"
              className="absolute inset-0 w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="NASA ISS Live"
            />
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 px-2 py-1 rounded-lg pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[8px] font-bold text-white uppercase tracking-wider">EN DIRECT</span>
            </div>
            <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-2 rounded-xl pointer-events-none">
              <div className="text-[10px] font-bold text-white">Vue depuis l'ISS</div>
              {iss && (
                <div className="text-[8px] font-mono text-primary/70 mt-0.5">
                  {iss.lat.toFixed(2)}° {iss.lng.toFixed(2)}° · Alt {Math.round(iss.altitude)} km
                </div>
              )}
            </div>
          </div>

          {/* Orbital stats */}
          {iss && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Latitude', value: `${iss.lat.toFixed(3)}°` },
                { label: 'Longitude', value: `${iss.lng.toFixed(3)}°` },
                { label: 'Altitude', value: `${Math.round(iss.altitude)} km` },
                { label: 'Vitesse', value: `${Math.round(iss.velocity / 1000)} km/s` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-white/8 bg-black/60 p-3 text-center">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-primary/40 mb-1">{label}</div>
                  <div className="text-sm font-black font-mono text-primary">{value}</div>
                </div>
              ))}
            </div>
          )}

          {!iss && (
            <div className="flex items-center justify-center py-8 gap-2 text-[10px] font-mono text-white/30">
              <Satellite className="w-4 h-4 animate-pulse" />
              Connexion ISS en cours…
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-56 shrink-0 flex flex-col gap-3">
          {/* Nearby conflict zones */}
          {nearConflicts.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-black/60 p-3.5">
              <div className="flex items-center gap-1.5 mb-2.5">
                <MapPin className="w-3 h-3 text-destructive/50" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-destructive/50">Zones de conflit proches</span>
              </div>
              <div className="space-y-2">
                {nearConflicts.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-[9px] font-mono">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <img src={`https://flagcdn.com/16x12/${c.countryCode.toLowerCase()}.png`} alt="" className="w-4 h-3 rounded-sm shrink-0" />
                      <span className="text-white/50 truncate">{c.name}</span>
                    </div>
                    <span className="text-primary/60 font-bold shrink-0 ml-1">{c.dist.toLocaleString('fr-FR')} km</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent critical alerts */}
          <div className="rounded-2xl border border-white/8 bg-black/60 p-3.5 flex-1 overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Zap className="w-3 h-3 text-amber-400/50" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-amber-400/50">Alertes crit/élevées · 12h</span>
            </div>
            {critAlerts.length === 0 ? (
              <div className="text-[9px] font-mono text-white/20">Aucune alerte récente</div>
            ) : (
              <div className="space-y-2">
                {critAlerts.map(a => (
                  <div key={a.id} className="text-[9px] font-mono">
                    <span className={`font-bold mr-1 ${a.severity === 'critical' ? 'text-destructive' : 'text-amber-400'}`}>
                      {a.country}
                    </span>
                    <span className="text-white/40 line-clamp-2">{a.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function LiveView() {
  const { data: alerts } = useAlerts();
  const [view, setView] = useState<ViewLevel>('countries');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedCity, setSelectedCity] = useState<CamCity | null>(null);
  const [search, setSearch] = useState('');

  // Alert counts by country code (24h)
  const alertsByCountry: Record<string, number> = {};
  for (const a of alerts ?? []) {
    if (!a.countryCode || (a.timestamp && Date.now() - new Date(a.timestamp).getTime() > 24 * 3600 * 1000)) continue;
    alertsByCountry[a.countryCode] = (alertsByCountry[a.countryCode] ?? 0) + 1;
  }

  // Filtered + sorted
  const filteredCountries = search
    ? COUNTRIES.filter(c => c.isSpace || c.name.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;

  const sortedCountries = [...filteredCountries].sort((a, b) => {
    if (a.isSpace) return -1;
    if (b.isSpace) return 1;
    const scoreA = tensionScore(countryMaxTension(a)) * 1000 + (alertsByCountry[a.countryCode] ?? 0);
    const scoreB = tensionScore(countryMaxTension(b)) * 1000 + (alertsByCountry[b.countryCode] ?? 0);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.name.localeCompare(b.name, 'fr');
  });

  const goHome = () => { setView('countries'); setSelectedCountry(null); setSelectedCity(null); setSearch(''); };
  const goToISS = () => { setView('iss'); };
  const goToCities = (c: Country) => { setSelectedCountry(c); setSelectedCity(null); setView('cities'); };
  const goToDashboard = (city: CamCity) => { setSelectedCity(city); setView('dashboard'); };
  const goBackToCountries = () => { setView('countries'); setSelectedCountry(null); setSelectedCity(null); };
  const goBackToCities = () => { setView('cities'); setSelectedCity(null); };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-black text-white overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b"
          style={{ borderBottomColor: 'rgba(255,255,255,0.07)' }}>
          <Breadcrumb
            view={view}
            country={selectedCountry}
            city={selectedCity}
            onHome={goHome}
            onBackToCountry={goBackToCities}
          />
          {view === 'countries' && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-40 text-[10px] font-mono rounded-lg text-white placeholder-white/20 focus:outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-white/8 scrollbar-track-transparent">

          {/* View 1 — Countries grid */}
          {view === 'countries' && (
            <>
              <Recommendations
                countries={COUNTRIES}
                alertsByCountry={alertsByCountry}
                onSelect={goToCities}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {sortedCountries.map(c => (
                  <CountryCard
                    key={c.id}
                    country={c}
                    alertCount24h={alertsByCountry[c.countryCode] ?? 0}
                    onClick={() => c.isSpace ? goToISS() : goToCities(c)}
                  />
                ))}
                {sortedCountries.length === 0 && (
                  <div className="col-span-full text-center py-12 text-[10px] font-mono text-white/20">
                    Aucun résultat pour « {search} »
                  </div>
                )}
              </div>
            </>
          )}

          {/* View 2 — Cities */}
          {view === 'cities' && selectedCountry && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={goBackToCountries} className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 hover:text-primary transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Retour aux pays
                </button>
                <div className="w-px h-4 bg-white/10" />
                <img src={`https://flagcdn.com/24x18/${selectedCountry.countryCode.toLowerCase()}.png`} alt="" className="w-7 h-5 rounded-sm" />
                <span className="text-sm font-bold text-white">{selectedCountry.name}</span>
                {selectedCountry.isConflict && (
                  <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded border border-destructive/40 text-destructive bg-destructive/10">
                    ZONE DE CONFLIT
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedCountry.cities.map(city => (
                  <CityCard
                    key={city.id}
                    city={city}
                    countryCode={selectedCountry.countryCode}
                    alertCount={alertsByCountry[selectedCountry.countryCode] ?? 0}
                    onClick={() => goToDashboard(city)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* View 3 — City dashboard */}
          {view === 'dashboard' && selectedCity && selectedCountry && (
            <CityDashboard city={selectedCity} country={selectedCountry} onBack={goBackToCities} />
          )}

          {/* View: ISS */}
          {view === 'iss' && (
            <ISSDetail onBack={goBackToCountries} />
          )}

        </div>
      </div>
    </AppLayout>
  );
}
