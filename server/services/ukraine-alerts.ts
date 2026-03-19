/**
 * Ukraine Air Raid Alerts — Argos V5
 * API : alerts.in.ua — alertes raids aériens en temps réel par oblast ukrainien.
 *
 * Token : UKRAINE_ALERTS_KEY (format "id:hash")
 * Docs  : https://alerts.in.ua/api/docs
 *
 * Requête toutes les 2 minutes pour capter les alertes actives.
 * Crée des alertes de type 'airstrike' pour les oblasts sous alerte active.
 */

import { createHash } from 'crypto';
import { storage } from '../storage';
import type { InsertAlert } from '@shared/schema';

const UKRAINE_KEY = process.env.UKRAINE_ALERTS_KEY;
const ALERTS_BASE = 'https://alerts.in.ua/api/v3/alerts/active.json';

function fingerprint(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

// Oblast ukrainien → coordonnées approximatives
const OBLAST_COORDS: Record<string, { lat: number; lng: number; fr: string }> = {
    'Київська':       { lat: 50.45, lng: 30.52, fr: 'Kyiv' },
    'Харківська':     { lat: 49.99, lng: 36.23, fr: 'Kharkiv' },
    'Донецька':       { lat: 48.01, lng: 37.80, fr: 'Donetsk' },
    'Запорізька':     { lat: 47.83, lng: 35.16, fr: 'Zaporizhzhia' },
    'Херсонська':     { lat: 46.63, lng: 32.62, fr: 'Kherson' },
    'Миколаївська':   { lat: 46.97, lng: 32.00, fr: 'Mykolaïv' },
    'Одеська':        { lat: 46.48, lng: 30.73, fr: 'Odessa' },
    'Дніпропетровська':{ lat: 48.46, lng: 35.04, fr: 'Dnipro' },
    'Полтавська':     { lat: 49.59, lng: 34.54, fr: 'Poltava' },
    'Сумська':        { lat: 50.91, lng: 34.80, fr: 'Soumy' },
    'Черкаська':      { lat: 49.44, lng: 32.06, fr: 'Tcherkassy' },
    'Чернігівська':   { lat: 51.50, lng: 31.30, fr: 'Tchernihiv' },
    'Житомирська':    { lat: 50.25, lng: 28.66, fr: 'Jytomyr' },
    'Вінницька':      { lat: 49.23, lng: 28.47, fr: 'Vinnytsia' },
    'Хмельницька':    { lat: 49.42, lng: 26.99, fr: 'Khmelnytskyi' },
    'Тернопільська':  { lat: 49.55, lng: 25.59, fr: 'Ternopil' },
    'Рівненська':     { lat: 50.62, lng: 26.25, fr: 'Rivne' },
    'Волинська':      { lat: 50.74, lng: 25.32, fr: 'Volyn' },
    'Львівська':      { lat: 49.84, lng: 24.03, fr: 'Lviv' },
    'Закарпатська':   { lat: 48.62, lng: 22.29, fr: 'Zakarpattia' },
    'Івано-Франківська':{ lat: 48.92, lng: 24.71, fr: 'Ivano-Frankivsk' },
    'Чернівецька':    { lat: 48.29, lng: 25.94, fr: 'Tchernivtsi' },
    'Кіровоградська': { lat: 48.51, lng: 32.26, fr: 'Kirovohrad' },
    'Луганська':      { lat: 48.57, lng: 39.31, fr: 'Louhansk' },
    'Запоріжжя':      { lat: 47.83, lng: 35.16, fr: 'Zaporizhzhia (ville)' },
    'Київ':           { lat: 50.45, lng: 30.52, fr: 'Kyiv (ville)' },
    'Крим':           { lat: 45.34, lng: 34.10, fr: 'Crimée' },
};

interface AlertsApiAlert {
    id: string;
    location_title: string;     // oblast name in Ukrainian
    location_type: string;      // 'oblast', 'raion', 'hromada', 'city'
    started_at: string;         // ISO timestamp
    alert_type: string;         // 'air_raid', 'artillery_shelling', etc.
    all_clear_at?: string;
    notes?: string;
}

interface AlertsApiResponse {
    alerts: AlertsApiAlert[];
    last_updated_at: string;
    disclaimer: string;
}

export async function fetchUkraineAlerts(): Promise<number> {
    if (!UKRAINE_KEY) {
        console.warn('[ua-alerts] UKRAINE_ALERTS_KEY not set — skipping');
        return 0;
    }

    let data: AlertsApiResponse;
    try {
        const res = await fetch(ALERTS_BASE, {
            headers: {
                'X-API-Key': UKRAINE_KEY,
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
            // Essai avec Authorization Bearer (format alternatif)
            const res2 = await fetch(ALERTS_BASE, {
                headers: {
                    'Authorization': `Bearer ${UKRAINE_KEY}`,
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(10_000),
            });
            if (!res2.ok) {
                console.warn(`[ua-alerts] HTTP ${res2.status} — API non disponible`);
                return 0;
            }
            data = await res2.json() as AlertsApiResponse;
        } else {
            data = await res.json() as AlertsApiResponse;
        }
    } catch (err) {
        console.warn('[ua-alerts] Fetch error:', err);
        return 0;
    }

    const activeAlerts = (data.alerts ?? []).filter(a =>
        !a.all_clear_at &&
        (a.location_type === 'oblast' || a.location_type === 'city') &&
        (a.alert_type === 'air_raid' || a.alert_type === 'artillery_shelling')
    );

    let inserted = 0;

    for (const alert of activeAlerts) {
        // Timestamp de début — utiliser started_at pour la fenêtre de dédoublonnage
        const startedAt = new Date(alert.started_at);
        const minuteWindow = Math.floor(startedAt.getTime() / (2 * 60_000)); // fenêtre 2 min
        const fp = fingerprint(`ua-alert-${alert.id}-${minuteWindow}`);

        const existing = await storage.getAlertByFingerprint(fp);
        if (existing) continue;

        // Trouver les coordonnées de l'oblast
        const coords = OBLAST_COORDS[alert.location_title]
            ?? Object.values(OBLAST_COORDS).find(c => alert.location_title.toLowerCase().includes(c.fr.toLowerCase()))
            ?? { lat: 49.0, lng: 32.0, fr: 'Ukraine' };

        const oblastFr = OBLAST_COORDS[alert.location_title]?.fr ?? alert.location_title;
        const isArtillery = alert.alert_type === 'artillery_shelling';

        const title = isArtillery
            ? `Tirs d'artillerie — ${oblastFr}`
            : `Alerte raid aérien — ${oblastFr}`;

        const desc = `Alerte active en Ukraine · Oblast : ${oblastFr} · ${
            isArtillery ? 'Bombardement artillerie' : 'Alerte raid aérien en cours'
        } · Depuis ${startedAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;

        const newAlert: InsertAlert = {
            title,
            description: desc,
            lat: String(coords.lat),
            lng: String(coords.lng),
            country: 'Ukraine',
            countryCode: 'UA',
            source: `alerts.in.ua — ${alert.id}`,
            type: isArtillery ? 'artillery' : 'airstrike',
            category: 'MILITARY',
            sourceType: 'UA_ALERTS',
            severity: isArtillery ? 'high' : 'critical',
            status: 'active',
            severityScore: isArtillery ? 7 : 9,
            isActive: true,
            fingerprint: fp,
            eventStart: startedAt,
            aiVerified: true,
            aiLabel: title,
            // Moscou comme origine approximative pour visualiser l'arc sur le globe
            originLat: isArtillery ? null : '55.75',
            originLng: isArtillery ? null : '37.62',
        };

        const created = await storage.createAlertIfNew(newAlert);
        if (created) inserted++;
    }

    if (inserted > 0) {
        console.log(`[ua-alerts] ${inserted} new Ukraine alerts`);
    }
    return inserted;
}
