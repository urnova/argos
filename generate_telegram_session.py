#!/usr/bin/env python3
"""
Générateur de session Telegram — à lancer UNE SEULE FOIS chez toi
puis copier la STRING générée dans GitHub Secrets (TELEGRAM_SESSION)

Prérequis : pip install telethon
"""

from telethon.sync import TelegramClient
from telethon.sessions import StringSession

API_ID   = input("Ton API_ID (my.telegram.org) : ").strip()
API_HASH = input("Ton API_HASH : ").strip()

with TelegramClient(StringSession(), int(API_ID), API_HASH) as client:
    session_string = client.session.save()

print("\n" + "="*60)
print("✅ TELEGRAM_SESSION (copie ça dans GitHub Secrets) :")
print("="*60)
print(session_string)
print("="*60)
print("\nGarde aussi :")
print(f"  TELEGRAM_API_ID   = {API_ID}")
print(f"  TELEGRAM_API_HASH = {API_HASH}")
