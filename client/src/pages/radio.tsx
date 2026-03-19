/**
 * Radio — Argos V6.2 : Scanner Radio Militaire & Aviation
 * Streams HTML5 directs — player global sticky + cards immersives
 * Sources : LiveATC (aviation), Ukraine nationale, RFI, France Info, BBC, France 24
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { Play, Square, Volume2, VolumeX, Radio, ExternalLink, Wifi, WifiOff } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Station {
  id: string;
  name: string;
  description: string;
  country: string;
  countryCode: string;
  category: 'Aviation' | 'Militaire' | 'Urgences' | 'Intel';
  streamUrl: string;
  featured?: boolean;
}

// ── Catalogue de stations ─────────────────────────────────────────────────────

const STATIONS: Station[] = [
  // ── SCANNERS AVIATION (LiveATC — Icecast public) ──────────────────────
  {
    id: 'cdg-app',
    name: 'Paris CDG — Approche',
    description: 'Fréquence approche Charles de Gaulle',
    country: 'France', countryCode: 'FR',
    category: 'Aviation',
    streamUrl: 'https://s1-fmt2.liveatc.net/lfpg_app',
    featured: true,
  },
  {
    id: 'orly-twr',
    name: 'Paris Orly — Tour',
    description: 'Tour de contrôle Paris Orly',
    country: 'France', countryCode: 'FR',
    category: 'Aviation',
    streamUrl: 'https://s1-fmt2.liveatc.net/lfpo',
  },
  {
    id: 'llbg',
    name: 'Tel Aviv — Ben Gurion',
    description: 'Approche et tour Ben Gurion',
    country: 'Israël', countryCode: 'IL',
    category: 'Aviation',
    streamUrl: 'https://s1-fmt2.liveatc.net/llbg',
  },
  {
    id: 'olba',
    name: 'Beyrouth — Rafic Hariri',
    description: 'Approche et tour Beyrouth OLBA',
    country: 'Liban', countryCode: 'LB',
    category: 'Aviation',
    streamUrl: 'https://s1-fmt2.liveatc.net/olba',
  },
  {
    id: 'ukbb',
    name: 'Kyiv — Boryspil',
    description: 'Approche Kyiv / Ukraine',
    country: 'Ukraine', countryCode: 'UA',
    category: 'Aviation',
    streamUrl: 'https://s1-fmt2.liveatc.net/ukbb',
  },
  {
    id: 'egll',
    name: 'Londres — Heathrow',
    description: 'Approche Heathrow EGLL',
    country: 'Royaume-Uni', countryCode: 'GB',
    category: 'Aviation',
    streamUrl: 'https://s1-fmt2.liveatc.net/egll_app',
  },
  {
    id: 'kjfk',
    name: 'New York — JFK',
    description: 'Approche John F. Kennedy',
    country: 'États-Unis', countryCode: 'US',
    category: 'Aviation',
    streamUrl: 'https://s1-fmt2.liveatc.net/kjfk_app',
  },
  // ── MILITAIRES / RADIO DE CRISE ───────────────────────────────────────
  {
    id: 'ukr-suspilne',
    name: 'Ukraine — Radio nationale',
    description: 'Suspilne / Radio ukrainienne officielle',
    country: 'Ukraine', countryCode: 'UA',
    category: 'Militaire',
    streamUrl: 'https://radio.ukr.radio/ur1-mp3',
    featured: true,
  },
  {
    id: 'rfe-svoboda',
    name: 'Radio Svoboda (RFE/RL)',
    description: 'Radio Free Europe — émissions ukrainiennes',
    country: 'Ukraine', countryCode: 'UA',
    category: 'Militaire',
    streamUrl: 'https://audio.rfferl.org/ua/ua-all.mp3',
  },
  // ── URGENCES / INFO ───────────────────────────────────────────────────
  {
    id: 'franceinfo',
    name: 'France Info',
    description: 'Information continue 24h/24',
    country: 'France', countryCode: 'FR',
    category: 'Urgences',
    streamUrl: 'https://icecast.radiofrance.fr/franceinfo-midfi.mp3',
    featured: true,
  },
  {
    id: 'france24-fr',
    name: 'France 24 — Français',
    description: 'Chaîne d\'information internationale',
    country: 'France', countryCode: 'FR',
    category: 'Urgences',
    streamUrl: 'https://stream.france24.com/france24-fr-aac-128.aac',
  },
  {
    id: 'rfi',
    name: 'RFI — Monde',
    description: 'Radio France Internationale',
    country: 'France', countryCode: 'FR',
    category: 'Urgences',
    streamUrl: 'https://rfifr.ice.infomaniak.ch/rfifr-midfi.mp3',
  },
  {
    id: 'bbc-world',
    name: 'BBC World Service',
    description: 'Service mondial BBC',
    country: 'Royaume-Uni', countryCode: 'GB',
    category: 'Urgences',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
  },
];

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { color: string; icon: string; desc: string }> = {
  Aviation: { color: '#00F0FF', icon: '✈', desc: 'Fréquences ATC en direct' },
  Militaire: { color: '#FF003C', icon: '⚔', desc: 'Radios de crise & défense' },
  Urgences:  { color: '#FFB800', icon: '📡', desc: 'Info & urgences mondiales' },
  Intel:     { color: '#8B5CF6', icon: '🔍', desc: 'Sources de renseignement' },
};

// ── Spectrum Visualizer ────────────────────────────────────────────────────────

const BAR_COUNT = 32;

interface SpectrumProps {
  analyser: AnalyserNode | null;
  active: boolean;
  color?: string;
  height?: number;
}

function SpectrumBars({ analyser, active, color = '#00F0FF', height = 32 }: SpectrumProps) {
  const [heights, setHeights] = useState<number[]>(Array(BAR_COUNT).fill(0.04));
  const rafRef = useRef<number>();
  const idleRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!active) {
      setHeights(Array(BAR_COUNT).fill(0.04));
      cancelAnimationFrame(rafRef.current!);
      clearInterval(idleRef.current);
      return;
    }

    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      function draw() {
        analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / BAR_COUNT);
        const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
          const slice = data.slice(i * step, (i + 1) * step);
          const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
          return Math.max(0.04, avg / 255);
        });
        setHeights(bars);
        rafRef.current = requestAnimationFrame(draw);
      }
      draw();
      return () => cancelAnimationFrame(rafRef.current!);
    } else {
      // Idle animation when no analyser
      idleRef.current = setInterval(() => {
        setHeights(prev => prev.map(h => Math.max(0.04, Math.min(0.85, h + (Math.random() - 0.5) * 0.2))));
      }, 90);
      return () => clearInterval(idleRef.current);
    }
  }, [analyser, active]);

  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-none"
          style={{
            height: `${Math.round(h * 100)}%`,
            background: color,
            opacity: 0.3 + h * 0.7,
            minHeight: 2,
          }}
        />
      ))}
    </div>
  );
}

// ── Sticky Global Player ──────────────────────────────────────────────────────

function StickyPlayer({ station, analyser, muted, onStop, onToggleMute }: {
  station: Station;
  analyser: AnalyserNode | null;
  muted: boolean;
  onStop: () => void;
  onToggleMute: () => void;
}) {
  const meta = CATEGORY_META[station.category];
  const color = meta?.color ?? '#00F0FF';

  return (
    <div
      className="shrink-0 border-b"
      style={{
        background: `linear-gradient(90deg, ${color}10 0%, rgba(0,0,0,0.97) 60%)`,
        borderBottomColor: `${color}30`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex items-center gap-4 px-5 py-3 max-w-5xl mx-auto">
        {/* Pulsing dot + EN ÉCOUTE */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: color }} />
            <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: color }} />
          </span>
          <span className="text-[7px] font-black uppercase tracking-widest" style={{ color }}>LIVE</span>
        </div>

        {/* Station info */}
        <div className="min-w-0 flex-1">
          <div className="text-[8px] font-bold uppercase tracking-widest mb-0.5" style={{ color: `${color}99` }}>
            {meta?.icon} {station.category}
          </div>
          <div className="text-sm font-bold text-white leading-tight truncate">{station.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <img
              src={`https://flagcdn.com/16x12/${station.countryCode.toLowerCase()}.png`}
              alt={station.countryCode}
              className="w-4 h-3 rounded-sm object-cover"
            />
            <span className="text-[9px] font-mono text-white/40 truncate">{station.description}</span>
          </div>
        </div>

        {/* Spectrum */}
        <div className="w-40 hidden md:block">
          <SpectrumBars analyser={analyser} active={true} color={color} height={36} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleMute}
            className="p-2 rounded-xl border transition-all"
            style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
            title={muted ? 'Activer le son' : 'Muet'}
          >
            {muted
              ? <VolumeX className="w-4 h-4 text-white/30" />
              : <Volume2 className="w-4 h-4" style={{ color }} />
            }
          </button>
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-[11px] font-mono transition-all hover:opacity-80"
            style={{ background: 'rgba(255,0,60,0.14)', borderColor: 'rgba(255,0,60,0.4)', color: '#FF003C' }}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            STOP
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Station Card ─────────────────────────────────────────────────────────────

function StationCard({ station, isPlaying, onPlay, onStop, error }: {
  station: Station;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  error: string | null;
}) {
  const meta = CATEGORY_META[station.category];
  const color = meta?.color ?? '#00F0FF';
  const hasCorsError = error?.includes('CORS') || error?.includes('Flux indisponible');

  return (
    <div
      className="relative rounded-2xl border flex flex-col overflow-hidden transition-all duration-200"
      style={{
        background: isPlaying
          ? `linear-gradient(135deg, ${color}12 0%, rgba(0,0,0,0.8) 100%)`
          : 'rgba(255,255,255,0.03)',
        borderColor: isPlaying ? `${color}50` : 'rgba(255,255,255,0.07)',
        boxShadow: isPlaying ? `0 0 30px ${color}15, 0 4px 20px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* Top accent bar */}
      <div className="h-0.5 w-full" style={{ background: isPlaying ? color : 'rgba(255,255,255,0.06)' }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <img
            src={`https://flagcdn.com/24x18/${station.countryCode.toLowerCase()}.png`}
            alt={station.countryCode}
            className="w-6 h-4.5 rounded object-cover mt-0.5 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-white leading-tight">{station.name}</div>
            <div className="text-[9px] font-mono text-white/35 mt-0.5 leading-tight">{station.description}</div>
          </div>
          {isPlaying && (
            <div className="shrink-0 flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute h-full w-full rounded-full opacity-75" style={{ background: color }} />
                <span className="relative rounded-full h-1.5 w-1.5" style={{ background: color }} />
              </span>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg p-2 flex items-start gap-2" style={{ background: 'rgba(255,0,60,0.08)', border: '1px solid rgba(255,0,60,0.2)' }}>
            <WifiOff className="w-3 h-3 text-destructive/70 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[9px] font-mono text-destructive/70">{error}</div>
              {(hasCorsError || error.includes('Erreur')) && (
                <a
                  href={station.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[9px] font-bold text-primary/70 hover:text-primary mt-1 transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Ouvrir dans le navigateur
                </a>
              )}
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Play/Stop button */}
        <button
          onClick={isPlaying ? onStop : onPlay}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-[11px] font-mono transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: isPlaying
              ? 'rgba(255,0,60,0.12)'
              : `${color}12`,
            borderColor: isPlaying
              ? 'rgba(255,0,60,0.35)'
              : `${color}30`,
            color: isPlaying ? '#FF003C' : color,
          }}
        >
          {isPlaying ? (
            <><Square className="w-3.5 h-3.5 fill-current" /><span>ARRÊTER</span></>
          ) : (
            <><Play className="w-3.5 h-3.5 fill-current" /><span>ÉCOUTER</span></>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Featured Station Hero ─────────────────────────────────────────────────────

function FeaturedCard({ station, isPlaying, analyser, onPlay, onStop, error }: {
  station: Station;
  isPlaying: boolean;
  analyser: AnalyserNode | null;
  onPlay: () => void;
  onStop: () => void;
  error: string | null;
}) {
  const meta = CATEGORY_META[station.category];
  const color = meta?.color ?? '#00F0FF';

  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color}15 0%, rgba(0,0,0,0.9) 70%)`,
        borderColor: `${color}35`,
        boxShadow: `0 0 40px ${color}12, 0 8px 32px rgba(0,0,0,0.6)`,
      }}
    >
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="p-5">
        {/* Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg"
            style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
            ★ RECOMMANDÉ
          </span>
          <span className="text-[8px] font-mono uppercase tracking-widest px-2 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {meta?.icon} {station.category}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <img
            src={`https://flagcdn.com/32x24/${station.countryCode.toLowerCase()}.png`}
            alt={station.countryCode}
            className="w-8 h-6 rounded object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-white leading-tight">{station.name}</div>
            <div className="text-[10px] font-mono text-white/40 mt-0.5">{station.description}</div>
          </div>
          {isPlaying && (
            <div className="w-32 hidden sm:block">
              <SpectrumBars analyser={analyser} active={isPlaying} color={color} height={28} />
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-[9px] font-mono text-destructive/60">
            <WifiOff className="w-3 h-3 shrink-0" />
            <span>{error}</span>
            <a href={station.streamUrl} target="_blank" rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-1 text-primary/60 hover:text-primary transition-colors font-bold"
              onClick={e => e.stopPropagation()}>
              <ExternalLink className="w-2.5 h-2.5" />Ouvrir
            </a>
          </div>
        )}

        <button
          onClick={isPlaying ? onStop : onPlay}
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl border font-bold text-[12px] font-mono transition-all hover:opacity-90 active:scale-[0.99]"
          style={{
            background: isPlaying ? 'rgba(255,0,60,0.14)' : `${color}18`,
            borderColor: isPlaying ? 'rgba(255,0,60,0.4)' : `${color}40`,
            color: isPlaying ? '#FF003C' : color,
          }}
        >
          {isPlaying
            ? <><Square className="w-4 h-4 fill-current" />ARRÊTER</>
            : <><Play className="w-4 h-4 fill-current" />ÉCOUTER EN DIRECT</>
          }
        </button>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function RadioPage() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [, forceUpdate] = useState(0);

  const stopCurrent = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setPlayingId(null);
    forceUpdate(n => n + 1);
  }, []);

  const playStation = useCallback((station: Station) => {
    stopCurrent();

    const audio = new Audio();
    // Do NOT set crossOrigin — it causes CORS failures on streams without ACAO headers.
    // This means no Web Audio API spectrum on most public streams, but audio plays correctly.
    audio.src = station.streamUrl;
    audio.volume = muted ? 0 : 1;
    audioRef.current = audio;

    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      // createMediaElementSource throws SecurityError if audio lacks CORS headers.
      // Catch it silently — audio still plays, spectrum just shows idle animation.
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      analyserRef.current = null;
    }

    audio.play()
      .then(() => {
        setPlayingId(station.id);
        setErrors(e => ({ ...e, [station.id]: '' }));
        forceUpdate(n => n + 1);
      })
      .catch(() => {
        setErrors(e => ({ ...e, [station.id]: 'Flux indisponible ou CORS bloqué' }));
        stopCurrent();
      });

    audio.onerror = () => {
      setErrors(e => ({ ...e, [station.id]: 'Erreur de connexion au stream' }));
      stopCurrent();
    };
  }, [muted, stopCurrent]);

  const toggleMute = useCallback(() => {
    setMuted(m => {
      if (audioRef.current) audioRef.current.volume = m ? 1 : 0;
      return !m;
    });
  }, []);

  useEffect(() => () => stopCurrent(), [stopCurrent]);

  const featured = STATIONS.filter(s => s.featured);
  const categories = ['Aviation', 'Militaire', 'Urgences'] as const;
  const byCategory = (cat: string) => STATIONS.filter(s => s.category === cat && !s.featured);
  const playingStation = STATIONS.find(s => s.id === playingId);

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-black text-white overflow-hidden">

        {/* Page header */}
        <div className="shrink-0 px-5 py-3 border-b flex items-center gap-3"
          style={{ borderBottomColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.8)' }}>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-widest text-primary">Scanner Radio</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-[9px] font-mono text-white/25">Argos Intelligence</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-emerald-500/60" />
              <span className="text-[8px] font-mono text-white/25">{STATIONS.length} stations</span>
            </div>
          </div>
        </div>

        {/* Sticky player */}
        {playingStation && (
          <StickyPlayer
            station={playingStation}
            analyser={analyserRef.current}
            muted={muted}
            onStop={stopCurrent}
            onToggleMute={toggleMute}
          />
        )}

        {/* Main scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin scrollbar-thumb-white/8 scrollbar-track-transparent">
          <div className="max-w-5xl mx-auto space-y-8">

            {/* Featured section */}
            {featured.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-0.5 h-4 rounded-full bg-primary/60" />
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-primary/80">Sélection recommandée</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featured.map(station => (
                    <FeaturedCard
                      key={station.id}
                      station={station}
                      isPlaying={playingId === station.id}
                      analyser={playingId === station.id ? analyserRef.current : null}
                      onPlay={() => playStation(station)}
                      onStop={stopCurrent}
                      error={errors[station.id] || null}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Category sections */}
            {categories.map(cat => {
              const stations = byCategory(cat);
              if (stations.length === 0) return null;
              const meta = CATEGORY_META[cat];
              return (
                <section key={cat}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-0.5 h-4 rounded-full" style={{ background: meta.color }} />
                    <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: meta.color }}>
                      {meta.icon} {cat}
                    </h2>
                    <span className="text-[8px] font-mono text-white/20">{meta.desc}</span>
                    <span className="ml-auto text-[8px] font-mono text-white/15">
                      {stations.length} station{stations.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {stations.map(station => (
                      <StationCard
                        key={station.id}
                        station={station}
                        isPlaying={playingId === station.id}
                        onPlay={() => playStation(station)}
                        onStop={stopCurrent}
                        error={errors[station.id] || null}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Footer note */}
            <div className="py-6 border-t border-white/5 text-center space-y-1">
              <p className="text-[8px] font-mono text-white/15">
                Streams audio publics — LiveATC.net · Radio France · BBC · RFE/RL · Suspilne
              </p>
              <p className="text-[8px] font-mono text-white/10">
                Si un stream affiche une erreur, cliquez sur "Ouvrir dans le navigateur" pour l'écouter directement.
              </p>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
