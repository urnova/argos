/**
 * Shared MyMemory translation utility — single queue, shared localStorage cache.
 * One request every 600ms max (~100/min), well under the free-tier 5000/day limit.
 */

const LS_KEY = 'argos_tx_cache_v1';

// Hydrate from localStorage on module load
const txCache = new Map<string, string>(
  (() => {
    try {
      return Object.entries(JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')) as [string, string][];
    } catch {
      return [] as [string, string][];
    }
  })()
);

function saveTxCache() {
  try {
    const entries = Array.from(txCache.entries()).slice(-2000);
    localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* storage quota */ }
}

type TxJob = { text: string; resolve: (t: string) => void; reject: (e: unknown) => void };
const txQueue: TxJob[] = [];
let txRunning = false;

function runTxQueue() {
  if (txRunning || txQueue.length === 0) return;
  txRunning = true;
  const job = txQueue.shift()!;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(job.text.slice(0, 400))}&langpair=en|fr`;
  fetch(url, { signal: AbortSignal.timeout(6000) })
    .then(async res => {
      if (!res.ok) throw new Error(`tx ${res.status}`);
      const data = await res.json() as { responseStatus: number; responseData: { translatedText: string } };
      if (data.responseStatus !== 200) throw new Error('tx failed');
      txCache.set(job.text, data.responseData.translatedText);
      saveTxCache();
      job.resolve(data.responseData.translatedText);
    })
    .catch(job.reject)
    .finally(() => {
      txRunning = false;
      setTimeout(runTxQueue, 600);
    });
}

export function autoTranslate(text: string): Promise<string> {
  if (!text.trim()) return Promise.resolve(text);
  if (txCache.has(text)) return Promise.resolve(txCache.get(text)!);
  return new Promise((resolve, reject) => {
    txQueue.push({ text, resolve, reject });
    runTxQueue();
  });
}
