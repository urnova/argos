/**
 * Sound Manager — Argos Intelligence V5
 *
 * Flux de vérification en 2 temps :
 *   PHASE 1 — Entrée   : nouvelle_donnee → nouvelle_donnee_analyse
 *   PHASE 2 — Résultat : son contextuel selon type/sévérité
 *
 * Fichiers V5 disponibles dans /sounds/ :
 *   nouvelle_donnee.mp3          — signal d'entrée discret
 *   nouvelle_donnee_analyse.mp3  — "Analyse en cours"
 *   nouvelle_donnee_confirme.mp3 — confirmation neutre (medium/low)
 *   alerte_confirmee.mp3         — alerte confirmée (high)
 *   alerte_critique.mp3          — niveau critique
 *   seuil_alerte_atteint.mp3     — seuil élevé atteint
 *   tir_missile_detecte.mp3      — lancement missile confirmé
 *   impact_missile_detecte.mp3   — impact confirmé
 *   lancements_multiples.mp3     — ≥3 missiles simultanés
 *   Information_urgente.mp3      — information urgente (breaking)
 *   flash_special.mp3            — réservé: alerte critique majeure
 *   donnees_actualisees.mp3      — mise à jour silencieuse
 */

let muted = false;
try { muted = localStorage.getItem('argos_muted') === '1'; } catch { /* SSR */ }

export function isMuted() { return muted; }
export function setMuted(v: boolean) {
  muted = v;
  try { localStorage.setItem('argos_muted', v ? '1' : '0'); } catch { /* */ }
}
export function toggleMute() { setMuted(!muted); return muted; }

// ── Queue séquentielle — pas d'empilement ─────────────────────────────────────
const queue: Array<[string, number, number]> = []; // [filename, volume, delay_ms]
let playing = false;

function drainQueue() {
  if (playing || queue.length === 0) return;
  if (muted) { queue.length = 0; return; }
  playing = true;
  const [filename, volume, delay] = queue.shift()!;
  setTimeout(() => {
    try {
      const audio = new Audio(`/sounds/${filename}`);
      audio.volume = Math.min(1, Math.max(0, volume));
      audio.play().catch(() => {});
      // Wait for audio to finish (approx) before playing next
      audio.addEventListener('ended', () => { playing = false; drainQueue(); });
      // Fallback timeout in case 'ended' never fires (e.g. network error)
      setTimeout(() => { if (playing) { playing = false; drainQueue(); } }, 4000);
    } catch {
      playing = false;
      setTimeout(drainQueue, 100);
    }
  }, delay);
}

/** Ajoute un son à la queue. Abandonne les excédents si queue > 5. */
export function playSound(filename: string, volume = 0.7, delay = 0) {
  if (muted) return;
  if (queue.length >= 5) queue.splice(0, queue.length - 4); // garde les 4 plus récents
  queue.push([filename, volume, delay]);
  if (!playing) drainQueue();
}

// ── PHASE 1 : Entrée — signal d'arrivée + analyse en cours ───────────────────

/**
 * Appelé quand une alerte arrive avec aiVerified = null (analyse Groq en cours).
 * Son discret : signal d'entrée → "analyse en cours"
 */
export function soundIncoming() {
  playSound('nouvelle_donnee.mp3', 0.50);
  playSound('nouvelle_donnee_analyse.mp3', 0.40);
}

// ── PHASE 2 : Résultat — son contextuel selon type + sévérité ────────────────

/**
 * Alerte critique confirmée par l'IA.
 * missile/airstrike → tir_missile_detecte ou impact_missile_detecte
 * critique → alerte_critique + flash_special
 * high → seuil_alerte_atteint + Information_urgente
 */
export function soundVerifiedCritical() {
  playSound('alerte_critique.mp3', 0.85);
  playSound('flash_special.mp3', 0.70);
}

export function soundVerifiedHigh() {
  playSound('seuil_alerte_atteint.mp3', 0.75);
  playSound('Information_urgente.mp3', 0.60);
}

export function soundVerifiedMedium() {
  playSound('alerte_confirmee.mp3', 0.60);
}

/** Alerte de faible importance confirmée ou simple mise à jour du flux. */
export function soundVerifiedLow() {
  playSound('nouvelle_donnee_confirme.mp3', 0.45);
}

/** Mise à jour silencieuse — données actualisées périodiquement. */
export function soundDataRefresh() {
  playSound('donnees_actualisees.mp3', 0.35);
}

// ── Missiles (contextuels, appelés depuis le résultat IA) ────────────────────

export function soundMissileLaunch() {
  playSound('tir_missile_detecte.mp3', 0.85);
}

export function soundMissileImpact() {
  playSound('impact_missile_detecte.mp3', 0.90);
}

/** ≥3 missiles simultanés détectés sur le globe. */
export function soundMultipleLaunches() {
  playSound('lancements_multiples.mp3', 0.90);
}

// ── Helpers contextuels combinés ─────────────────────────────────────────────

/**
 * Son de résultat complet selon type + sévérité d'une alerte vérifiée.
 * À appeler dans critical-alert-overlay quand aiVerified passe à true.
 */
export function soundVerifiedResult(type: string, severity: string, title = '') {
  const isMissile = type === 'missile' || type === 'airstrike';
  const isImpact = /impact|frappe|struck|hit|landed/i.test(title);

  if (isMissile) {
    if (isImpact) soundMissileImpact();
    else soundMissileLaunch();
  } else if (severity === 'critical') {
    soundVerifiedCritical();
  } else if (severity === 'high') {
    soundVerifiedHigh();
  } else if (severity === 'medium') {
    soundVerifiedMedium();
  } else {
    soundVerifiedLow();
  }
}
