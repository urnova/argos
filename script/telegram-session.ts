/**
 * One-time Telegram session generator.
 * Run: npx tsx script/telegram-session.ts
 *
 * This will ask for your phone number and the verification code
 * sent to your Telegram app, then print the session string.
 * Copy that string to TELEGRAM_SESSION in Netlify env vars.
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import * as readline from 'readline';

const API_ID = Number(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH ?? '';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(res => rl.question(q, res));

async function main() {
  const session = new StringSession('');
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
    deviceModel: 'Desktop',
    systemVersion: 'Windows 11',
    appVersion: '4.16.8',
    langCode: 'fr',
  });

  await client.start({
    phoneNumber: async () => ask('Numéro de téléphone (ex: +33612345678): '),
    password: async () => ask('Mot de passe 2FA (appuie Entrée si aucun): '),
    phoneCode: async () => ask('Code reçu sur Telegram: '),
    onError: (err) => console.error(err),
  });

  console.log('\n✅ Session générée avec succès !');
  console.log('\nAjoute cette valeur dans Netlify → Environment variables → TELEGRAM_SESSION:\n');
  console.log(client.session.save());
  console.log('');

  rl.close();
  await client.disconnect();
  process.exit(0);
}

main().catch(console.error);
