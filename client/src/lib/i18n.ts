/**
 * Argos V4 — i18n dictionary
 * Supported languages: fr (default), en
 * UI labels only — dynamic alert content stays in its source language.
 */

export type Lang = 'fr' | 'en';

export interface Translations {
  nav: {
    live: string;
    history: string;
    liveview: string;
    radio: string;
    guide: string;
    systemActive: string;
    systemError: string;
    systemConnecting: string;
  };
  feed: {
    title: string;
    noAlerts: string;
    noAlertsDesc: string;
    filterAll: string;
    filterMilitary: string;
    filterPolitical: string;
    filterHumanitarian: string;
    filterGeopolitical: string;
    filterInfo: string;
    sevAll: string;
    sevCritical: string;
    sevHigh: string;
    sevMedium: string;
    sevLow: string;
    regionAll: string;
    sourceAll: string;
    verified: string;
    pending: string;
    total: (n: number) => string;
  };
  overlay: {
    critical: string;
    high: string;
    info: string;
    breaking: string;
    analyzing: string;
    analyzingDesc: string;
    verified: string;
    notVerified: string;
    ignore: string;
    prev: string;
    next: string;
    unknownPos: string;
  };
  popup: {
    coordinates: string;
    sector: string;
    unknown: string;
    source: string;
    verified: string;
    pending: string;
    close: string;
  };
  hud: {
    version: string;
    soundOn: string;
    soundOff: string;
    critical: string;
    high: string;
    totalEvents: string;
    lat: string;
    lng: string;
  };
  types: Record<string, string>;
  severity: Record<string, string>;
}

export const dict: Record<Lang, Translations> = {
  fr: {
    nav: {
      live: 'Live Radar',
      history: 'Historique',
      guide: 'Guide',
      liveview: 'Live View',
      radio: 'Radio',
      systemActive: 'Système actif',
      systemError: 'Erreur serveur',
      systemConnecting: 'Connexion…',
    },
    feed: {
      title: 'FLUX D\'ALERTES',
      noAlerts: 'Aucune alerte active',
      noAlertsDesc: 'Le système surveille les sources en temps réel.',
      filterAll: 'Tous',
      filterMilitary: 'Militaire',
      filterPolitical: 'Politique',
      filterHumanitarian: 'Humanitaire',
      filterGeopolitical: 'Géopolitique',
      filterInfo: 'Info',
      sevAll: 'Toutes',
      sevCritical: 'Critique',
      sevHigh: 'Élevé',
      sevMedium: 'Moyen',
      sevLow: 'Faible',
      regionAll: 'Monde',
      sourceAll: 'Toutes sources',
      verified: 'Vérifié IA',
      pending: 'En analyse…',
      total: (n) => `${n} alerte${n !== 1 ? 's' : ''}`,
    },
    overlay: {
      critical: '⚡ ALERTE CRITIQUE',
      high: '⚠ ALERTE ÉLEVÉE',
      info: 'ℹ INFORMATION',
      breaking: '🔴 BREAKING',
      analyzing: '🔍 NOUVELLE DONNÉE',
      analyzingDesc: 'Analyse IA en cours…',
      verified: '✓ Vérifié',
      notVerified: 'Non pertinent',
      ignore: 'Ignorer',
      prev: '◄ Préc.',
      next: 'Suiv. ►',
      unknownPos: 'Position inconnue',
    },
    popup: {
      coordinates: 'COORDONNÉES',
      sector: 'SECTEUR',
      unknown: 'Inconnu',
      source: 'Source →',
      verified: '✓ Vérifié IA',
      pending: '⏳ En analyse',
      close: 'Fermer',
    },
    hud: {
      version: 'ARGOS INTELLIGENCE v6.2',
      soundOn: 'SON ON',
      soundOff: 'SON OFF',
      critical: 'CRITIQUE',
      high: 'ÉLEVÉ',
      totalEvents: 'ÉVÉNEMENTS TOTAL',
      lat: 'LAT',
      lng: 'LNG',
    },
    types: {
      missile: 'LANCEMENT MISSILE', airstrike: 'FRAPPE AÉRIENNE', artillery: 'BOMBARDEMENT',
      naval: 'INCIDENT NAVAL', conflict: 'COMBAT ACTIF', explosion: 'EXPLOSION',
      chemical: 'ARME CHIMIQUE', nuclear: 'ALERTE NUCLÉAIRE', cyber: 'CYBERATTAQUE',
      massacre: 'MASSACRE', terrorism: 'ATTENTAT', coup: 'COUP D\'ÉTAT',
      diplomatic: 'DIPLOMATIQUE', political: 'POLITIQUE', 'military-move': 'MOUVEMENT MILITAIRE',
      sanctions: 'SANCTIONS', protest: 'MANIFESTATION', humanitarian: 'HUMANITAIRE',
      breaking: 'BREAKING NEWS', warning: 'ALERTE SÉCURITÉ', info: 'INFORMATION',
    },
    severity: {
      critical: 'Critique', high: 'Élevé', medium: 'Moyen', low: 'Faible',
    },
  },

  en: {
    nav: {
      live: 'Live Radar',
      history: 'History',
      guide: 'Guide',
      liveview: 'Live View',
      radio: 'Radio',
      systemActive: 'System active',
      systemError: 'Server error',
      systemConnecting: 'Connecting…',
    },
    feed: {
      title: 'ALERT FEED',
      noAlerts: 'No active alerts',
      noAlertsDesc: 'The system is monitoring sources in real time.',
      filterAll: 'All',
      filterMilitary: 'Military',
      filterPolitical: 'Political',
      filterHumanitarian: 'Humanitarian',
      filterGeopolitical: 'Geopolitical',
      filterInfo: 'Info',
      sevAll: 'All',
      sevCritical: 'Critical',
      sevHigh: 'High',
      sevMedium: 'Medium',
      sevLow: 'Low',
      regionAll: 'World',
      sourceAll: 'All sources',
      verified: 'AI Verified',
      pending: 'Analyzing…',
      total: (n) => `${n} alert${n !== 1 ? 's' : ''}`,
    },
    overlay: {
      critical: '⚡ CRITICAL ALERT',
      high: '⚠ HIGH ALERT',
      info: 'ℹ INTELLIGENCE',
      breaking: '🔴 BREAKING',
      analyzing: '🔍 NEW DATA',
      analyzingDesc: 'AI analysis in progress…',
      verified: '✓ Verified',
      notVerified: 'Not relevant',
      ignore: 'Dismiss',
      prev: '◄ Prev',
      next: 'Next ►',
      unknownPos: 'Unknown position',
    },
    popup: {
      coordinates: 'COORDINATES',
      sector: 'SECTOR',
      unknown: 'Unknown',
      source: 'Source →',
      verified: '✓ AI Verified',
      pending: '⏳ Analyzing',
      close: 'Close',
    },
    hud: {
      version: 'ARGOS INTELLIGENCE v6.2',
      soundOn: 'SOUND ON',
      soundOff: 'SOUND OFF',
      critical: 'CRITICAL',
      high: 'HIGH',
      totalEvents: 'TOTAL EVENTS',
      lat: 'LAT',
      lng: 'LNG',
    },
    types: {
      missile: 'MISSILE LAUNCH', airstrike: 'AIR STRIKE', artillery: 'ARTILLERY',
      naval: 'NAVAL INCIDENT', conflict: 'ACTIVE CONFLICT', explosion: 'EXPLOSION',
      chemical: 'CHEMICAL WEAPON', nuclear: 'NUCLEAR ALERT', cyber: 'CYBERATTACK',
      massacre: 'MASSACRE', terrorism: 'TERRORIST ATTACK', coup: 'COUP D\'ÉTAT',
      diplomatic: 'DIPLOMATIC', political: 'POLITICAL', 'military-move': 'MILITARY MOVEMENT',
      sanctions: 'SANCTIONS', protest: 'PROTEST', humanitarian: 'HUMANITARIAN',
      breaking: 'BREAKING NEWS', warning: 'SECURITY ALERT', info: 'INTELLIGENCE',
    },
    severity: {
      critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
    },
  },
};
