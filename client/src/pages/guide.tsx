import { AppLayout } from "@/components/layout";
import {
  Navigation2, Zap, AlertTriangle,
  Globe2, Lock, Radio, Clock, Database, BookOpen,
  Activity, Satellite, Brain, MessageSquare,
  MapPin, Waves, Siren, Filter, MousePointer2,
  ChevronRight, TrendingUp, Server, Wifi,
} from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const ALERT_TYPES = [
  { type: "missile",   icon: "🚀", color: "#FF003C", label: "Missile / Projectile",       desc: "Lancement balistique, roquette ou projectile longue portée." },
  { type: "airstrike", icon: "✈️", color: "#FF003C", label: "Frappe aérienne",             desc: "Bombardement par aéronef militaire, drone armé ou hélicoptère." },
  { type: "conflict",  icon: "⚔️", color: "#FFB800", label: "Conflit armé",                desc: "Affrontements terrestres, assauts, contre-offensives entre forces armées." },
  { type: "artillery", icon: "💣", color: "#FFB800", label: "Artillerie / Obus",           desc: "Tirs de mortiers ou pièces lourdes sur positions civiles ou militaires." },
  { type: "explosion", icon: "💥", color: "#FFB800", label: "Explosion / Détonation",      desc: "IED, dépôt de munitions, infrastructure détruite. Détectable via FIRMS." },
  { type: "terrorism", icon: "🔴", color: "#FFB800", label: "Attentat terroriste",         desc: "Attaque revendiquée : attentat-suicide, fusillade de masse, prise d'otage." },
  { type: "coup",      icon: "⚖️", color: "#FFB800", label: "Coup d'État / Putsch",        desc: "Tentative de renversement d'un gouvernement par les militaires." },
  { type: "naval",     icon: "⚓", color: "#00F0FF", label: "Incident naval",              desc: "Affrontements en mer, blocus, abordage. Mer Rouge, Spratleys…" },
  { type: "cyber",     icon: "💻", color: "#00F0FF", label: "Cyberattaque",                desc: "Intrusion ou sabotage visant réseaux électriques, défense, gouvernement." },
  { type: "nuclear",   icon: "☢️", color: "#FF003C", label: "Menace nucléaire / CBRN",    desc: "Essai nucléaire, alerte radiologique, arme chimique ou biologique." },
  { type: "massacre",  icon: "💀", color: "#FF003C", label: "Massacre / Atrocité",         desc: "Violence de masse contre des civils : exécutions, génocide, crimes de guerre." },
  { type: "chemical",  icon: "☣️", color: "#FF003C", label: "Arme chimique",               desc: "Utilisation confirmée ou suspectée d'agent chimique toxique en zone de conflit." },
  { type: "sanctions", icon: "🚫", color: "#8888FF", label: "Sanctions / Embargo",         desc: "Nouvelles sanctions économiques, gel d'avoirs ou embargo entre États." },
  { type: "protest",   icon: "📢", color: "#AAAAAA", label: "Protestation / Révolte",      desc: "Manifestations majeures, émeutes ou mouvements civils à impact géopolitique." },
  { type: "warning",   icon: "⚠️", color: "#AAAAAA", label: "Alerte / Avertissement",      desc: "Mobilisation, escalade diplomatique, tension non encore armée." },
];

const SEVERITIES = [
  {
    level: "critical", label: "CRITIQUE", color: "#FF003C",
    bg: "rgba(255,0,60,0.08)", border: "rgba(255,0,60,0.35)",
    desc: "Victimes confirmées, frappe majeure, arme CBRN, massacre ou coup d'État en cours.",
    effects: ["Overlay rouge plein écran", "Alerte sonore critique", "Animation missile 3D", "Marqueur globe pulsant"],
  },
  {
    level: "high", label: "ÉLEVÉ", color: "#FFB800",
    bg: "rgba(255,184,0,0.08)", border: "rgba(255,184,0,0.35)",
    desc: "Conflit actif, frappe aérienne, lancement missile, attentat significatif.",
    effects: ["Notification live", "Son d'alerte élevé", "Zoom globe automatique", "Anneau propagation orange"],
  },
  {
    level: "medium", label: "MOYEN", color: "#00F0FF",
    bg: "rgba(0,240,255,0.06)", border: "rgba(0,240,255,0.25)",
    desc: "Incident notable mais limité. Escarmouche, explosion isolée, tension diplomatique.",
    effects: ["Entrée dans le flux", "Son discret", "Anneau propagation cyan"],
  },
  {
    level: "low", label: "FAIBLE", color: "#888888",
    bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)",
    desc: "Alerte préventive ou info contextuelle. Déclaration non confirmée, rumeur, exercice.",
    effects: ["Flux uniquement", "Pas de son"],
  },
];

const SOURCES = [
  {
    icon: <Radio className="w-5 h-5" />, color: "#FFB800",
    name: "Flux RSS — Presse mondiale", tag: "RSS",
    items: ["Reuters", "BBC World", "Al Jazeera", "AFP (rss.app)", "France24 EN", "DW World", "AFP · BNO · Reuters via Nitter/X"],
    cadence: "10 min", coverage: "Mondiale",
    desc: "Source primaire pour événements géopolitiques, conflits armés et crises diplomatiques. Chaque article est analysé par Groq AI : label FR, type, sévérité et résumé français générés automatiquement.",
  },
  {
    icon: <MessageSquare className="w-5 h-5" />, color: "#2AABEE",
    name: "Telegram — Canaux OSINT", tag: "OSINT",
    items: ["@kpszsu (UA Air Force)", "@war_monitor", "@conflict_news", "@BNONews", "@clashreport", "@intelslava · @rybar · +9 canaux"],
    cadence: "10 min", coverage: "Ukraine · Gaza · Syrie · Afrique · Global",
    desc: "15+ canaux Telegram OSINT temps réel via RSSHub (aucune clé Telegram requise). Rapports terrain, alertes missiles, OSINT Ukraine/Gaza/MENA et sources vérification cross.",
  },
  {
    icon: <Satellite className="w-5 h-5" />, color: "#F97316",
    name: "NASA FIRMS — Satellite thermique", tag: "FIRMS",
    items: ["VIIRS (375m)", "MODIS (1km)", "10 zones de conflit", "FRP > 100 MW"],
    cadence: "~3h (passage satellite)", coverage: "Zones de conflit ciblées",
    desc: "Anomalies thermiques satellite détectant explosions et incendies en zones de guerre. Source objective, indépendante de tout flux médiatique.",
  },
  {
    icon: <Database className="w-5 h-5" />, color: "#00FF88",
    name: "UCDP GED — Données historiques", tag: "UCDP",
    items: ["Uppsala Conflict Data Program", "GED 25.1", "Événements géolocalisés", "Score sévérité × morts"],
    cadence: "Toutes les 6h (quasi-statique)", coverage: "Mondiale · conflits armés",
    desc: "Base académique référence mondiale sur les conflits armés (Uppsala University). Enrichit le calcul de tension pays avec les données historiques récentes.",
  },
  {
    icon: <Activity className="w-5 h-5" />, color: "#FF6B6B",
    name: "Ukraine Alerts — Raids aériens temps réel", tag: "UA",
    items: ["API alerts.in.ua v3", "Alertes raids aériens + artillerie", "27 oblasts granulaires", "Mis à jour toutes les 2 min"],
    cadence: "2 min", coverage: "Ukraine — 27 oblasts",
    desc: "Système d'alerte officiel ukrainien (alerts.in.ua). Détecte les alertes actives par oblast en temps réel : raids aériens et bombardements d'artillerie. Génère des alertes Argos critiques avec arc de trajectoire depuis Moscou.",
  },
  {
    icon: <Brain className="w-5 h-5" />, color: "#9B6DFF",
    name: "Groq AI — Classification + Résumé + Briefing", tag: "IA",
    items: ["llama-3.1-8b-instant", "~0.5s/alerte", "14 400 req/jour (gratuit)", "Label + Résumé FR + Briefing 24h"],
    cadence: "Instantané + toutes les heures", coverage: "Toutes alertes + résumé stratégique",
    desc: "Chaque alerte reçoit : pertinence, type, sévérité, label français et résumé factuel 1-2 phrases. Un briefing stratégique global est généré toutes les heures et persisté en base.",
  },
];

const GLOBE_FEATURES = [
  { icon: <MapPin className="w-4 h-4" />, title: "Marqueurs pin drapeaux", desc: "Icône de type + drapeau pays. Remplace les cylindres 3D. Cliquer → détail alerte + zoom." },
  { icon: <Waves className="w-4 h-4" />, title: "Anneaux de propagation", desc: "Ondes concentriques colorées par sévérité (rouge critique, orange élevé, cyan moyen)." },
  { icon: <Navigation2 className="w-4 h-4 rotate-45" />, title: "Animation missile", desc: "Arc 3D animé + point mobile de l'origine vers l'impact. Effet sonore en 3 phases." },
  { icon: <Globe2 className="w-4 h-4" />, title: "Polygones pays", desc: "Teintés selon le statut de tension : rouge guerre, orange élevé, jaune tension, cyan watchlist." },
];

const AI_STEPS = [
  { step: "01", color: "#FFB800", title: "Ingestion", desc: "Article RSS/Telegram inséré en DB avec aiVerified = null." },
  { step: "02", color: "#9B6DFF", title: "Classification + Résumé IA", desc: "Groq reçoit titre + description (600 car). Retourne JSON : { relevant, type, severity, label, summary }. Le résumé (1-2 phrases FR, max 200 car) remplace la description anglaise en DB." },
  { step: "03", color: "#00FF88", title: "Alerte validée", desc: "aiVerified = true · label et description en français · type/sévérité corrigés · visible dans le flux et sur le globe." },
  { step: "04", color: "#00F0FF", title: "Briefing horaire", desc: "Toutes les heures, Groq génère un briefing stratégique 24h (max 200 mots) depuis les 60 dernières alertes. Persisté en DB, identique pour tous les utilisateurs." },
  { step: "✕",  color: "#FF003C", title: "Rejet silencieux", desc: "aiVerified = false · isActive = false · jamais affiché ni sur le globe ni dans l'historique." },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Guide() {
  return (
    <AppLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto px-5 py-8 space-y-12 pb-16">

          {/* ── Header ── */}
          <header className="flex items-start gap-5">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-2xl font-black uppercase tracking-tight text-glow-primary">Guide Argos</h1>
                <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border"
                  style={{ background: 'rgba(0,240,255,0.1)', color: '#00F0FF', borderColor: 'rgba(0,240,255,0.3)' }}>V6.2</span>
              </div>
              <p className="text-muted-foreground text-xs font-mono leading-relaxed">
                Architecture · Sources · Globe 3D · Vérification IA · API REST
              </p>
              {/* Stats strip */}
              <div className="flex flex-wrap gap-3 mt-3">
                {[
                  { icon: <Database className="w-3 h-3" />, label: "6 sources", sub: "indépendantes" },
                  { icon: <Brain className="w-3 h-3" />, label: "IA Groq", sub: "label + résumé + briefing" },
                  { icon: <Satellite className="w-3 h-3" />, label: "ISS Tracker", sub: "wheretheiss.at" },
                  { icon: <Globe2 className="w-3 h-3" />, label: "Situation Room", sub: "webcams + météo" },
                ].map((s, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-[10px] font-mono bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10">
                    <span className="text-primary">{s.icon}</span>
                    <span className="text-foreground font-semibold">{s.label}</span>
                    <span className="text-muted-foreground/60">· {s.sub}</span>
                  </span>
                ))}
              </div>
            </div>
          </header>

          {/* ── Comment fonctionne Argos ── */}
          <section>
            <SectionTitle icon={<Activity className="w-4 h-4" />} title="Comment fonctionne ARGOS V6.2 ?" />
            <div className="glass-panel rounded-xl border border-white/10 p-5 space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                ARGOS collecte en continu des données de <strong className="text-foreground">6 sources indépendantes</strong> — flux RSS presse mondiale,
                canaux Telegram OSINT (via RSSHub), NASA FIRMS satellite, UCDP GED historique, alertes raids Ukraine (alerts.in.ua) et classification Groq AI — et les affiche en temps quasi-réel sur un globe 3D interactif.
              </p>
              <p>
                Chaque article RSS/Telegram est immédiatement <strong className="text-foreground">analysé par Groq AI</strong> (llama-3.1-8b) :
                les contenus non militaires/géopolitiques sont rejetés silencieusement ; les alertes pertinentes reçoivent
                un <strong className="text-foreground">label français</strong>, un type et une sévérité corrigés.
              </p>
              <p>
                Les mises à jour temps réel sont transmises via <strong className="text-foreground">SSE (Server-Sent Events)</strong> —
                compatible Netlify Functions et tout hébergement serverless. Le client se reconnecte automatiquement
                et rejoue les alertes manquées grâce au champ <code className="text-primary/80 text-[10px] bg-white/5 px-1 rounded">Last-Event-ID</code>.
              </p>
              <p>
                <strong className="text-foreground">Nouveautés V6.2 :</strong> LiveView Situation Room restructuré en <strong className="text-foreground">drill-down 3 niveaux</strong> (galerie pays → villes → dashboard caméra 16:9 + météo + alertes),
                barre de recherche pays, breadcrumb navigable, ISS entrée spéciale directe. Radio OSINT : <strong className="text-foreground">player global sticky</strong> avec visualiseur spectre
                affiché lors de la lecture, cards stations compactes. Panel Tensions Mondiales : seuil abaissé pour afficher
                les données statiques sans alertes actives. Chat Argos IA : bouton d'accès "Q" dans le panel Briefing.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  { icon: <Clock className="w-3.5 h-3.5" />, label: "Globe", value: "4h (crit/high)" },
                  { icon: <Radio className="w-3.5 h-3.5" />, label: "Notif live", value: "< 3h" },
                  { icon: <Database className="w-3.5 h-3.5" />, label: "Historique", value: "complet" },
                  { icon: <Server className="w-3.5 h-3.5" />, label: "Polling fallback", value: "15s" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/8 text-center">
                    <div className="flex justify-center mb-1 text-primary">{item.icon}</div>
                    <div className="text-[9px] font-mono text-muted-foreground uppercase">{item.label}</div>
                    <div className="text-[11px] font-bold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Flux IA ── */}
          <section>
            <SectionTitle icon={<Brain className="w-4 h-4" />} title="Pipeline de vérification IA" />
            <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
              {AI_STEPS.map((s, i) => (
                <div key={i} className={`flex gap-4 items-start px-5 py-4 ${i % 2 === 0 ? 'bg-white/3' : ''} border-b border-white/5 last:border-0`}>
                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black font-mono border"
                    style={{ color: s.color, borderColor: `${s.color}50`, background: `${s.color}12` }}>
                    {s.step}
                  </div>
                  <div>
                    <div className="text-xs font-bold mb-0.5" style={{ color: s.color }}>{s.title}</div>
                    <div className="text-xs text-muted-foreground">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Globe 3D ── */}
          <section>
            <SectionTitle icon={<Globe2 className="w-4 h-4" />} title="Globe 3D — Couches visuelles" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GLOBE_FEATURES.map((f, i) => (
                <div key={i} className="glass-panel rounded-xl border border-white/10 p-4 flex gap-3 items-start">
                  <div className="shrink-0 p-2 rounded-lg bg-primary/10 text-primary mt-0.5">{f.icon}</div>
                  <div>
                    <div className="text-xs font-bold text-foreground mb-0.5">{f.title}</div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactions */}
            <div className="mt-3 glass-panel rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/8 bg-white/3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <MousePointer2 className="w-3.5 h-3.5" /> Interactions
                </span>
              </div>
              {[
                { action: "Cliquer sur un marqueur pin", result: "Ouvre le détail de l'alerte + zoom globe vers la position" },
                { action: "Cliquer sur un pays", result: "Panneau pays : statut tension, score, raison, liste des incidents" },
                { action: "Cliquer alerte dans le Feed", result: "Zoom animé vers la localisation sur le globe" },
                { action: "Glisser / scroll", result: "Rotation manuelle — désactive temporairement la rotation auto" },
                { action: "Filtres Feed (3 lignes)", result: "Catégorie · Sévérité · Région — chaque filtre est indépendant" },
                { action: "Bouton son 🔊", result: "Active/coupe les alertes sonores (bas gauche du globe)" },
                { action: "Boutons HUD bas-gauche", result: "Masquer/afficher Tensions · Flux alertes · Briefing IA individuellement" },
                { action: "Bouton ARGOS IA (cerveau)", result: "Ouvre le chat IA en streaming — questions géopolitiques, résumé par pays" },
              ].map((item, i) => (
                <div key={i} className={`flex gap-3 items-start px-5 py-2.5 text-xs ${i % 2 === 0 ? 'bg-white/3' : ''} border-b border-white/5 last:border-0`}>
                  <ChevronRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                  <span className="text-primary font-mono shrink-0 w-52">{item.action}</span>
                  <span className="text-muted-foreground">{item.result}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Sévérités ── */}
          <section>
            <SectionTitle icon={<Siren className="w-4 h-4" />} title="Niveaux de sévérité" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SEVERITIES.map(s => (
                <div key={s.level} className="glass-panel rounded-xl p-4 border" style={{ borderColor: s.border, background: s.bg }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                    <span className="font-black text-sm uppercase tracking-widest" style={{ color: s.color }}>{s.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2.5 leading-relaxed">{s.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {s.effects.map(e => (
                      <span key={e} className="text-[9px] font-mono px-2 py-0.5 rounded border border-white/10 bg-white/5 text-muted-foreground">{e}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Types d'alertes ── */}
          <section>
            <SectionTitle icon={<Filter className="w-4 h-4" />} title={`Types d'alertes (${ALERT_TYPES.length})`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ALERT_TYPES.map(t => (
                <div key={t.type} className="glass-panel rounded-xl border border-white/10 p-3.5 flex gap-3 items-start hover:border-white/20 transition-colors">
                  <span className="text-xl shrink-0 leading-none mt-0.5">{t.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-bold" style={{ color: t.color }}>{t.label}</span>
                    </div>
                    <span className="text-[9px] font-mono bg-white/5 px-1.5 py-0.5 rounded text-muted-foreground/60 border border-white/8">{t.type}</span>
                    <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Sources ── */}
          <section>
            <SectionTitle icon={<TrendingUp className="w-4 h-4" />} title="Sources de données V6.2" />
            <div className="space-y-3">
              {SOURCES.map(s => (
                <div key={s.name} className="glass-panel rounded-xl border border-white/10 p-5">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 p-2.5 rounded-xl border" style={{ color: s.color, borderColor: `${s.color}40`, background: `${s.color}12` }}>
                      {s.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-bold text-sm text-foreground">{s.name}</span>
                        <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded uppercase"
                          style={{ color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}40` }}>{s.tag}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">{s.desc}</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {s.items.map(item => (
                          <span key={item} className="text-[9px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-muted-foreground">{item}</span>
                        ))}
                      </div>
                      <div className="flex gap-4 text-[10px] font-mono text-muted-foreground/60">
                        <span>Cadence: <span className="text-foreground">{s.cadence}</span></span>
                        <span>Zone: <span className="text-foreground">{s.coverage}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── API REST ── */}
          <section className="pb-4">
            <SectionTitle icon={<Lock className="w-4 h-4" />} title="API REST Argos" />
            <div className="glass-panel rounded-xl border border-white/10 p-5 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Envoie des alertes depuis un bot, script ou service externe via l'endpoint REST.
                Génère ta clé API dans la section <strong className="text-foreground">API Keys</strong>.
              </p>
              <pre className="bg-black/60 rounded-xl p-4 text-xs font-mono text-primary/80 overflow-x-auto border border-white/10 leading-relaxed">{`POST /api/alerts
Authorization: Bearer astral_XXXXXX
Content-Type: application/json

{
  "title":       "Nom de l'alerte",
  "description": "Description détaillée",
  "lat":         "48.85",
  "lng":         "2.35",
  "country":     "France",
  "countryCode": "FR",
  "type":        "warning",
  "severity":    "high",
  "status":      "active"
}`}
              </pre>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] font-mono">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="text-muted-foreground uppercase tracking-widest mb-2 text-[9px]">Types valides (15)</div>
                  <div className="flex flex-wrap gap-1">
                    {["missile","airstrike","conflict","artillery","explosion","terrorism","coup","naval","cyber","nuclear","chemical","massacre","sanctions","protest","warning"].map(t => (
                      <span key={t} className="bg-black/40 px-1.5 py-0.5 rounded text-muted-foreground border border-white/8">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="text-muted-foreground uppercase tracking-widest mb-2 text-[9px]">Sévérités valides (4)</div>
                  {[
                    { v: "critical", c: "#FF003C" }, { v: "high", c: "#FFB800" },
                    { v: "medium", c: "#00F0FF" },   { v: "low", c: "#888888" },
                  ].map(({ v, c }) => (
                    <div key={v} className="flex items-center gap-2 py-0.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                      <span style={{ color: c }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </AppLayout>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="text-[11px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
      {icon}
      <span>{title}</span>
      <span className="flex-1 h-px bg-white/8 ml-1" />
    </h2>
  );
}
