/**
 * Legend Page — V5 · Types, catégories, sources, niveaux de tension Argos.
 */

import { AppLayout } from "@/components/layout";
import { Link } from "wouter";
import { ArrowLeft, Cpu, Zap, Crosshair, AlertTriangle, Anchor, FlameKindling, Skull, Gavel, Ban, Megaphone, Navigation2, Radio, Shield, Satellite } from "lucide-react";

// ── 15 types V5 ───────────────────────────────────────────────────────────────
const TYPE_META = [
  // ── MILITAIRE ────────────────────────────────────────────────────────────────
  { type: 'missile',   emoji: '🚀', label: 'Missile',         cat: 'MILITAIRE',    catColor: '#FF003C', color: '#FF003C', desc: 'Lancement ou détection de missile balistique, de croisière ou ICBM. Indique une frappe longue portée imminente ou effectuée.' },
  { type: 'airstrike', emoji: '✈️', label: 'Frappe aérienne', cat: 'MILITAIRE',    catColor: '#FF003C', color: '#FF5500', desc: 'Bombardement par avion de combat, drone armé ou hélicoptère. Source : flux RSS/Telegram ou anomalie thermique NASA FIRMS.' },
  { type: 'artillery', emoji: '💣', label: 'Artillerie',      cat: 'MILITAIRE',    catColor: '#FF003C', color: '#FF7700', desc: "Tirs d'obus, de mortier ou de roquettes depuis une position terrestre. Fréquent sur le front ukrainien, Gaza, Yémen." },
  { type: 'naval',     emoji: '⚓', label: 'Incident naval',   cat: 'MILITAIRE',    catColor: '#FF003C', color: '#0080FF', desc: 'Engagement maritime, blocus, abordage ou incident en Mer Rouge / Mer de Chine / Méditerranée.' },
  { type: 'conflict',  emoji: '⚔️', label: 'Combat',          cat: 'MILITAIRE',    catColor: '#FF003C', color: '#FFB800', desc: 'Affrontements armés entre forces militaires, combats au sol, offensive terrestre ou contre-attaque.' },
  { type: 'explosion', emoji: '💥', label: 'Explosion',        cat: 'MILITAIRE',    catColor: '#FF003C', color: '#FF4400', desc: "Explosion détectée — peut provenir de données satellites NASA FIRMS (anomalie thermique > 100 MW) ou sources terrain." },
  { type: 'chemical',  emoji: '☣️', label: 'Arme chimique',   cat: 'MILITAIRE',    catColor: '#FF003C', color: '#00FF88', desc: "Emploi suspecté ou confirmé d'agents chimiques (sarin, chlore, novitchok). Événement rare, toujours critique." },
  { type: 'nuclear',   emoji: '☢️', label: 'Alerte nucléaire', cat: 'MILITAIRE',   catColor: '#FF003C', color: '#FF00FF', desc: "Test nucléaire, alarme radiologique ou rhétorique nucléaire à niveau critique. Extrêmement rare." },
  { type: 'cyber',     emoji: '💻', label: 'Cyberattaque',    cat: 'MILITAIRE',    catColor: '#FF003C', color: '#00F0FF', desc: "Attaque sur infrastructures critiques — réseaux électriques, systèmes militaires, hôpitaux, gouvernements." },
  // ── HUMANITAIRE ──────────────────────────────────────────────────────────────
  { type: 'massacre',  emoji: '💀', label: 'Massacre',         cat: 'HUMANITAIRE', catColor: '#FF7700', color: '#CC0000', desc: 'Violence de masse contre des civils. Violence ethnique, exécutions sommaires. Source : agences ONU, presse internationale.' },
  { type: 'terrorism', emoji: '🔴', label: 'Terrorisme',       cat: 'HUMANITAIRE', catColor: '#FF7700', color: '#FF2200', desc: "Attentat-suicide, attaque asymétrique, fusillade de masse — groupes ISIS, Al-Shabaab, Boko Haram, etc." },
  // ── POLITIQUE ────────────────────────────────────────────────────────────────
  { type: 'coup',      emoji: '⚖️', label: "Coup d'État",     cat: 'POLITIQUE',   catColor: '#AA00FF', color: '#AA00FF', desc: "Renversement ou tentative de renversement d'un gouvernement par l'armée ou un groupe armé." },
  { type: 'sanctions', emoji: '🚫', label: 'Sanctions',        cat: 'POLITIQUE',   catColor: '#AA00FF', color: '#8888FF', desc: "Sanctions économiques, blocus commercial, gel d'avoirs. Indicateur de tension diplomatique majeure." },
  { type: 'protest',   emoji: '📢', label: 'Protestation',     cat: 'POLITIQUE',   catColor: '#AA00FF', color: '#FFCC00', desc: "Manifestation armée, émeute, mouvement de révolte pouvant dégénérer en conflit ouvert." },
  { type: 'warning',   emoji: '⚠️', label: 'Alerte',           cat: 'POLITIQUE',   catColor: '#AA00FF', color: '#00F0FF', desc: "Alerte sécuritaire générale, mouvement de troupes, tension sans incident confirmé. Catégorie fourre-tout." },
];

// ── Niveaux de tension (panneau gauche) ───────────────────────────────────────
const TENSIONS = [
  { status: 'war',       color: '#FF003C', label: 'GUERRE',      desc: 'Conflit armé actif à grande échelle — front ouvert, combats quotidiens.' },
  { status: 'high',      color: '#FF5500', label: 'ÉLEVÉ',       desc: 'Conflit de basse intensité, frappes régulières ou tension extrême.' },
  { status: 'tension',   color: '#FFB800', label: 'TENSION',     desc: 'Pression militaire, incidents sporadiques, pas de guerre ouverte.' },
  { status: 'sanctions', color: '#8888FF', label: 'SANCTIONS',   desc: 'Régime sous embargo occidental ou sanctions économiques significatives.' },
  { status: 'watchlist', color: '#00F0FF', label: 'SURVEILLANCE', desc: 'Pays à surveiller — tension latente, disputes territoriales.' },
  { status: 'stable',    color: '#44AA66', label: 'STABLE',      desc: 'Aucun conflit actif détecté.' },
];

// ── Sources V5 ────────────────────────────────────────────────────────────────
const SOURCES = [
  { label: 'RSS',        color: '#FFB800', desc: 'Reuters, Al Jazeera, BBC, AFP, France24, DW + Nitter/X. Mise à jour toutes les 10 minutes. Source primaire pour événements géopolitiques et crises diplomatiques.' },
  { label: 'TELEGRAM',  color: '#2AABEE', desc: '15+ canaux OSINT via RSSHub (@kpszsu, @war_monitor, @conflict_news, @BNONews, @clashreport, @intelslava, @rybar…). Rapports terrain en temps réel.' },
  { label: 'FIRMS',     color: '#FF7700', desc: 'NASA FIRMS — satellites VIIRS/SNPP. Anomalies thermiques intenses (> 100 MW) dans les zones de conflit = possible impact, explosion ou bombardement.' },
  { label: 'UCDP',      color: '#00FF88', desc: 'Uppsala Conflict Data Program GED 25.1 — événements géolocalisés avec estimation des victimes. Base académique mondiale, mise à jour toutes les 6h.' },
  { label: 'UA ALERTS', color: '#FF6B6B', desc: 'alerts.in.ua v3 — alertes raids aériens et artillerie ukrainiennes en temps réel. 27 oblasts, mise à jour toutes les 2 minutes.' },
  { label: 'GROQ AI',   color: '#9B6DFF', desc: 'Classification IA (llama-3.1-8b) : vérifie la pertinence, corrige type/sévérité, génère label FR + résumé. Briefing stratégique horaire en DB.' },
  { label: 'MANUEL',    color: '#AA88FF', desc: "Données saisies manuellement ou via l'API REST Argos (bot Discord, scripts externes)." },
];

// ── Sévérités V5 ─────────────────────────────────────────────────────────────
const SEVERITIES = [
  { sev: 'critical', color: '#FF003C', label: 'CRITIQUE', desc: 'Victimes confirmées, frappe majeure, arme CBRN, massacre, coup d\'État en cours. Alerte sonore + overlay plein écran.' },
  { sev: 'high',     color: '#FFB800', label: 'ÉLEVÉ',    desc: 'Conflit actif, frappe aérienne, lancement missile, attentat significatif. Notification live.' },
  { sev: 'medium',   color: '#00F0FF', label: 'MOYEN',    desc: 'Incident notable mais limité. Explosion isolée, tension diplomatique, mobilisation.' },
  { sev: 'low',      color: '#888888', label: 'FAIBLE',   desc: 'Alerte préventive, rumeur non confirmée, exercice militaire, déclaration mineure.' },
];

export default function Legend() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-black text-foreground overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <Link href="/">
              <button className="flex items-center gap-2 text-primary/60 hover:text-primary transition-colors text-sm font-mono">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-widest uppercase text-primary">Guide des alertes</h1>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-primary/30 text-primary/70 font-mono uppercase tracking-widest">V6</span>
              </div>
              <p className="text-muted-foreground text-sm font-mono mt-0.5">Lexique complet — types, catégories, sources, niveaux de tension</p>
            </div>
          </div>

          {/* Alert Types */}
          <section className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 pb-2 border-b border-white/10">
              Types d'alertes (15) — 3 catégories
            </h2>
            {(['MILITAIRE', 'HUMANITAIRE', 'POLITIQUE'] as const).map(cat => {
              const catTypes = TYPE_META.filter(t => t.cat === cat);
              const catColor = catTypes[0]?.catColor ?? '#fff';
              return (
                <div key={cat} className="mb-6">
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: catColor }}>
                    <span className="w-8 h-px inline-block" style={{ background: catColor }} />
                    {cat}
                    <span className="text-muted-foreground/30 font-normal">({catTypes.length} types)</span>
                  </div>
                  <div className="grid gap-2">
                    {catTypes.map(t => (
                      <div key={t.type}
                        className="flex items-start gap-4 p-3 rounded-xl border"
                        style={{ background: `${t.color}08`, borderColor: `${t.color}20` }}
                      >
                        <span className="text-2xl shrink-0 mt-0.5">{t.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.color }}>{t.label}</span>
                            <span className="text-[9px] font-mono text-muted-foreground/40 uppercase bg-white/5 px-1.5 py-0.5 rounded">{t.type}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{t.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Severity */}
          <section className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 pb-2 border-b border-white/10">
              Niveaux de sévérité — déterminés par IA (Groq)
            </h2>
            <div className="grid gap-2">
              {SEVERITIES.map(s => (
                <div key={s.sev} className="flex items-start gap-4 p-3 rounded-xl border"
                  style={{ background: `${s.color}08`, borderColor: `${s.color}20` }}>
                  <div className="flex items-center gap-2 shrink-0 w-28 mt-0.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.sev === 'critical' ? 'animate-pulse' : ''}`} style={{ background: s.color }} />
                    <span className="text-xs font-black uppercase" style={{ color: s.color }}>{s.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Country Tensions */}
          <section className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 pb-2 border-b border-white/10">
              Niveaux de tension pays (panneau gauche)
            </h2>
            <div className="grid gap-2">
              {TENSIONS.map(t => (
                <div key={t.status} className="flex items-center gap-4 p-3 rounded-xl border"
                  style={{ background: `${t.color}08`, borderColor: `${t.color}20` }}>
                  <span className="text-xs font-black w-28 shrink-0 uppercase" style={{ color: t.color }}>{t.label}</span>
                  <p className="text-[11px] text-muted-foreground/70">{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Sources */}
          <section className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 pb-2 border-b border-white/10">
              Sources de données V6
            </h2>
            <div className="grid gap-2">
              {SOURCES.map(s => (
                <div key={s.label} className="flex items-start gap-4 p-3 rounded-xl border"
                  style={{ background: `${s.color}08`, borderColor: `${s.color}20` }}>
                  <span className="text-xs font-black w-20 shrink-0 uppercase mt-0.5" style={{ color: s.color }}>{s.label}</span>
                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Globe legend */}
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-white/10">
              Lecture du globe
            </h2>
            <div className="space-y-1.5 text-[11px] text-muted-foreground/70 font-mono">
              <p>• <span className="text-destructive">Rouge</span> — pays en guerre (polygone coloré sur le globe)</p>
              <p>• <span style={{ color: '#FF5500' }}>Orange</span> — tension élevée / conflit de basse intensité</p>
              <p>• <span className="text-warning">Jaune</span> — tension modérée, incidents sporadiques</p>
              <p>• <span className="text-primary">Anneaux propagés</span> — localisation d'un incident actif (cliquable)</p>
              <p>• <span className="text-primary">Arc animé</span> — trajectoire d'un missile ou d'une frappe aérienne</p>
              <p>• Cliquer un pays → fiche tension + liste des incidents récents</p>
              <p>• Cliquer un point → détail complet de l'incident</p>
            </div>
          </section>

          {/* AI verification */}
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-white/10">
              Vérification IA — badge sur chaque alerte
            </h2>
            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/5">
                <span className="text-white/30 border border-white/10 px-1.5 py-0.5 rounded text-[10px]">🔍 vérification en cours...</span>
                <span className="text-muted-foreground/60">— Groq en train d'analyser l'article (délai ~0.5s)</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/5">
                <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ color: '#FFB80099', borderColor: '#FFB80030', background: '#FFB80008' }}>✓ Frappe aérienne confirmée en Syrie</span>
                <span className="text-muted-foreground/60">— Événement pertinent, label généré en français</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/5">
                <span className="text-white/20 text-[10px] italic">alerte masquée</span>
                <span className="text-muted-foreground/60">— Groq a jugé l'article non pertinent (sport, opinion, météo…)</span>
              </div>
            </div>
          </section>

          <div className="text-center text-[10px] font-mono text-muted-foreground/30 py-4 border-t border-white/5">
            ARGOS INTELLIGENCE V6 · ASTRAL SECURITY · DATA: RSS · TELEGRAM · FIRMS · UCDP · UA ALERTS · GROQ AI
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
