#!/usr/bin/env python3
"""
AMC Telegram Monitor — GitHub Actions Edition (Polling Mode)
=============================================================
Conçu pour tourner en cron GitHub Actions toutes les 15 minutes.
Récupère les derniers messages des canaux surveillance,
détecte les alertes conflit, et les pousse vers l'API Netlify.

Variables d'environnement requises (GitHub Secrets) :
  TELEGRAM_SESSION   — StringSession Telethon (voir README)
  TELEGRAM_API_ID    — App ID depuis my.telegram.org
  TELEGRAM_API_HASH  — App Hash depuis my.telegram.org
  AMC_API_URL        — https://ton-site.netlify.app/api/alerts
  AMC_API_KEY        — ta clé API (astral_test_key_12345)
"""

import asyncio
import os
import re
import logging
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.sessions import StringSession
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ── Config depuis variables d'environnement ────────────────────────────────────
API_ID       = os.environ["TELEGRAM_API_ID"]
API_HASH     = os.environ["TELEGRAM_API_HASH"]
SESSION_STR  = os.environ["TELEGRAM_SESSION"]
AMC_API_URL  = os.environ["AMC_API_URL"]
AMC_API_KEY  = os.environ["AMC_API_KEY"]

# Fenêtre temporelle : messages des X dernières minutes
LOOKBACK_MINUTES = 20

# Canaux à surveiller
CHANNELS = [
    "@liveuamap",
    "@WarMonitors",
    "@conflict_news",
    "@air_alert_ua",
    "@intelslava",
    "@GazaWarRoom",
    "@AFpost",
    "@middleeasteye",
]

# ── Classification des alertes ─────────────────────────────────────────────────
KEYWORD_RULES = [
    (r'\b(missile|rockets?|ICBM|ballistic)\b',             'missile',   'MILITARY',     'critical'),
    (r'\b(airstrike|air.?strike|bombing|bombed|F-16|Su-\d+)\b', 'airstrike','MILITARY', 'critical'),
    (r'\b(artillery|shelling|shell|mortar|rocket fire)\b', 'artillery', 'MILITARY',     'high'),
    (r'\b(naval|warship|destroyer|submarine)\b',           'naval',     'MILITARY',     'high'),
    (r'\b(explosion|blast|detonation|exploded)\b',         'explosion', 'MILITARY',     'high'),
    (r'\b(chemical|chlorine|sarin|gas attack)\b',           'chemical',  'MILITARY',     'critical'),
    (r'\b(nuclear|radioactive|radiation|nuke)\b',           'nuclear',   'MILITARY',     'critical'),
    (r'\b(cyber|hack|DDoS|malware|cyberattack)\b',          'cyber',     'MILITARY',     'medium'),
    (r'\b(massacre|genocide|mass.?kill|executed)\b',        'massacre',  'HUMANITARIAN', 'critical'),
    (r'\b(terror|terrorist|suicide.?bomb|IED)\b',           'terrorism', 'HUMANITARIAN', 'critical'),
    (r'\b(coup|overthrow|military seized|junta)\b',         'coup',      'POLITICAL',    'critical'),
    (r'\b(sanctions|embargo|freeze assets)\b',              'sanctions', 'POLITICAL',    'medium'),
    (r'\b(protest|riot|demonstration|unrest)\b',            'protest',   'GEOPOLITICAL', 'medium'),
    (r'\b(warning|alert|threat|imminent)\b',                'warning',   'GEOPOLITICAL', 'medium'),
    (r'\b(fighting|combat|clashes|gunfire|troops)\b',       'conflict',  'MILITARY',     'high'),
]

COUNTRY_MAP = {
    'ukraine': ('Ukraine', 'UA', 49.0, 31.0),
    'kyiv': ('Ukraine', 'UA', 50.4, 30.5),
    'kharkiv': ('Ukraine', 'UA', 50.0, 36.2),
    'russia': ('Russie', 'RU', 61.5, 90.0),
    'moscow': ('Russie', 'RU', 55.7, 37.6),
    'gaza': ('Palestine', 'PS', 31.5, 34.4),
    'israel': ('Israël', 'IL', 31.0, 35.0),
    'lebanon': ('Liban', 'LB', 33.9, 35.5),
    'beirut': ('Liban', 'LB', 33.9, 35.5),
    'syria': ('Syrie', 'SY', 35.0, 38.0),
    'iran': ('Iran', 'IR', 32.4, 53.7),
    'iraq': ('Irak', 'IQ', 33.2, 43.7),
    'baghdad': ('Irak', 'IQ', 33.3, 44.4),
    'yemen': ('Yémen', 'YE', 15.5, 47.5),
    'sudan': ('Soudan', 'SD', 15.6, 32.5),
    'myanmar': ('Myanmar', 'MM', 19.2, 96.7),
    'afghanistan': ('Afghanistan', 'AF', 33.9, 67.7),
    'somalia': ('Somalie', 'SO', 2.0, 45.3),
    'congo': ('RD Congo', 'CD', -4.0, 21.8),
    'mali': ('Mali', 'ML', 17.6, -2.0),
    'taiwan': ('Taïwan', 'TW', 23.7, 121.0),
    'china': ('Chine', 'CN', 35.9, 104.2),
    'north korea': ('Corée du Nord', 'KP', 40.0, 127.0),
    'pakistan': ('Pakistan', 'PK', 30.4, 69.3),
}


def classify(text: str):
    for pattern, atype, cat, severity in KEYWORD_RULES:
        if re.search(pattern, text, re.IGNORECASE):
            return atype, cat, severity
    return None, None, None


def get_country(text: str):
    tl = text.lower()
    for kw, data in COUNTRY_MAP.items():
        if kw in tl:
            return data
    return None, None, 0.0, 0.0


def post_alert(title, description, atype, category, severity,
               country, country_code, lat, lng, source_url):
    try:
        r = requests.post(AMC_API_URL, json={
            "title": title[:200],
            "description": description[:1000],
            "type": atype,
            "category": category,
            "severity": severity,
            "country": country or "Inconnu",
            "countryCode": country_code or "",
            "lat": str(lat),
            "lng": str(lng),
            "source": source_url,
            "sourceType": "TELEGRAM",
            "status": "active",
        }, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {AMC_API_KEY}",
        }, timeout=10)
        if r.status_code in (200, 201):
            logging.info(f"✅ [{severity.upper()}] {title[:60]}")
        else:
            logging.warning(f"⚠️ API {r.status_code}: {r.text[:80]}")
    except Exception as e:
        logging.error(f"❌ {e}")


async def main():
    client = TelegramClient(StringSession(SESSION_STR), int(API_ID), API_HASH)
    await client.start()
    logging.info("✅ Connecté à Telegram")

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=LOOKBACK_MINUTES)
    total = 0

    for channel in CHANNELS:
        try:
            entity = await client.get_entity(channel)
            async for msg in client.iter_messages(entity, limit=30):
                if not msg.date or msg.date < cutoff:
                    break
                text = msg.raw_text or ""
                if len(text) < 15:
                    continue

                atype, cat, sev = classify(text)
                if not atype:
                    continue

                country, code, lat, lng = get_country(text)
                title = text.split('\n')[0].strip()[:120] or text[:120]
                source = f"https://t.me/{channel.lstrip('@')}/{msg.id}"

                post_alert(title, text, atype, cat, sev,
                           country, code, lat, lng, source)
                total += 1

            logging.info(f"  📡 {channel} — scanned")
        except Exception as e:
            logging.warning(f"  ⚠️ {channel}: {e}")

    await client.disconnect()
    logging.info(f"🏁 Done — {total} alertes envoyées")


if __name__ == "__main__":
    asyncio.run(main())
