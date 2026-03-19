/**
 * Groq AI Classifier — Argos V4
 * Classifies RSS articles: relevance, type, severity, French label.
 * Free tier: 14 400 req/day, ~500ms latency (llama-3.1-8b-instant)
 * Get a free key: https://console.groq.com
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const VALID_TYPES = [
  // ── ALERTES (incidents réels, violence confirmée) ─────────────────────────
  'missile', 'airstrike', 'artillery', 'naval', 'conflict', 'explosion',
  'chemical', 'nuclear', 'cyber', 'coup', 'massacre', 'terrorism',
  // ── INFORMATIONS (pas d'incident actif, mais pertinent géopolitiquement) ──
  'diplomatic',      // négociations, sommets, expulsions, accord/rupture
  'political',       // élections, changement de gouvernement, déclaration officielle majeure
  'military-move',   // déploiement, exercice militaire, mouvement de troupes sans combat
  'sanctions',       // sanctions économiques, embargo, gel d'avoirs
  'protest',         // manifestations, émeutes civiles
  'humanitarian',    // crise humanitaire, réfugiés, aide internationale
  'breaking',        // info urgente très récente, non encore confirmée
  'warning',         // menace potentielle, alerte non confirmée
  'info',            // fallback : info géopolitique qui ne rentre dans aucune autre case
] as const;

export interface GroqClassification {
  relevant: boolean;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  summary: string; // résumé français 1-2 phrases, remplace la description anglaise
}

const SYSTEM_PROMPT = `Tu es un analyste de renseignement géopolitique. Analyse cet article et réponds UNIQUEMENT en JSON valide, sans texte autour.

━━━ ÉTAPE 1 — PERTINENCE ━━━
relevant: true si l'article traite d'un sujet géopolitique/militaire/diplomatique.
relevant: false pour : sport, culture, économie générale non liée à un conflit, météo, fait divers civil, pure opinion sans événement, rétrospective historique ancienne (>1 an).

━━━ ÉTAPE 2 — TYPE : INFO PAR DÉFAUT ━━━

⚠️ RÈGLE ABSOLUE DE PRIORITÉ :
La catégorie INFO est la catégorie par défaut. Les types ALERTE ne s'utilisent QUE si l'événement violent s'est produit dans les 15 dernières minutes et est actuellement en cours ou vient juste d'avoir lieu.

Si un événement violent (tir de missile, frappe, attentat...) s'est passé il y a plus de 30 minutes, hier, ou est mentionné dans un contexte de bilan/analyse/contexte → utilise OBLIGATOIREMENT un type INFO.

━━ TYPES ALERTE (UNIQUEMENT si événement <15 min, en cours maintenant) ━━
• missile       → tir de missile EN COURS à l'instant (<15 min)
• airstrike     → frappe aérienne EN COURS à l'instant (<15 min)
• artillery     → bombardement actif EN COURS à l'instant (<15 min)
• naval         → combat naval EN COURS à l'instant (<15 min)
• conflict      → combat terrestre actif EN COURS à l'instant (<15 min)
• explosion     → explosion venant de se produire (<15 min)
• chemical      → usage d'arme chimique EN COURS ou confirmé <15 min
• nuclear       → essai nucléaire ou incident radiologique <15 min
• cyber         → cyberattaque active détectée <15 min
• coup          → coup d'État EN COURS à l'instant
• massacre      → tuerie de masse EN COURS à l'instant (<15 min)
• terrorism     → attentat EN COURS ou venant de se produire (<15 min)

━━ TYPES INFO (tout le reste — usage par défaut) ━━
• humanitarian  → victimes, bilan de frappes passées, réfugiés, aide humanitaire, génocide rapporté, massacre passé
• military-move → déploiement, mouvement de troupes, exercice militaire, tir de missile passé (>30 min), frappe passée
• breaking      → information urgente très récente (<2h), non confirmée mais crédible
• diplomatic    → négociation, sommet, accord, rupture diplomatique, expulsion, sanctions en préparation
• political     → élection, changement de gouvernement, déclaration politique majeure
• sanctions     → sanctions économiques, embargo, gel d'avoirs annoncé
• protest       → manifestation, émeute, mouvement social
• warning       → menace, ultimatum, alerte non confirmée, risque potentiel
• info          → tout autre contenu géopolitique pertinent (fallback)

EXEMPLES CONCRETS :
- "Iran fires missiles at Israel" publié maintenant → missile / high
- "Iran launched missiles yesterday" → military-move / medium
- "Analysis of last week's strikes in Gaza" → humanitarian / low
- "Genocide in Sudan kills thousands" (bilan) → humanitarian / high
- "Troops deployed near border" → military-move / low
- "North Korea test-fired a missile last month" → military-move / low
- "Ceasefire talks begin in Cairo" → diplomatic / medium
- "Breaking: explosion reported in Kyiv" (<2h, non confirmé) → breaking / medium

━━━ ÉTAPE 3 — SÉVÉRITÉ ━━━
• critical → frappe/attentat actif EN COURS avec nombreuses victimes, CBRN actif, coup réussi en cours
• high     → bilan lourd (>10 morts), escalade majeure, frappe directe sur civils rapportée
• medium   → incident limité, mobilisation, breaking non confirmé, menace crédible
• low      → déclaration, analyse, déplacement diplomatique, information contextuelle

━━━ ÉTAPE 4 — LABEL ━━━
Phrase factuelle en français, max 55 caractères, temps présent ou passé selon le contexte réel.

━━━ ÉTAPE 5 — RÉSUMÉ ━━━
summary: Résumé factuel de l'événement en français, 1-2 phrases, max 200 caractères. Décris CE QUI S'EST PASSÉ concrètement : qui, quoi, où, conséquences si connues. Ne répète pas le label.

Format : {"relevant":bool,"type":"...","severity":"...","label":"...","summary":"..."}`;

export async function classifyAlert(
  title: string,
  description: string
): Promise<GroqClassification | null> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.warn('[groq] No API key — classification skipped');
    return null;
  }

  console.log(`[groq] Classifying: "${title.slice(0, 60)}…"`);
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Titre: ${title}\nDescription: ${description?.slice(0, 600) ?? ''}` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 220,
        temperature: 0.05,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[groq] API error ${res.status}`);
      return null;
    }

    const data = await res.json() as any;
    const raw = JSON.parse(data.choices[0].message.content);

    const result: GroqClassification = {
      relevant: !!raw.relevant,
      type: VALID_TYPES.includes(raw.type) ? raw.type : 'warning',
      severity: ['low', 'medium', 'high', 'critical'].includes(raw.severity)
        ? raw.severity as GroqClassification['severity']
        : 'medium',
      label: String(raw.label ?? title).slice(0, 100),
      summary: String(raw.summary ?? description ?? '').slice(0, 300),
    };
    console.log(`[groq] → ${result.relevant ? '✓' : '✗'} ${result.type}/${result.severity} "${result.label.slice(0,40)}"`);
    return result;
  } catch (e) {
    console.warn('[groq] Classification failed:', e);
    return null;
  }
}
