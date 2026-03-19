/**
 * useTranslate — Traduction via MyMemory API (gratuit, sans clé, 1000 mots/jour)
 * Usage :
 *   const { tx, loading, translate } = useTranslate();
 *   translate(text, 'myKey');   // traduit et stocke sous 'myKey'
 *   translate(text, 'myKey');   // deuxième appel → revient à l'original
 *   const displayed = tx('myKey') ?? text;
 */

import { useState, useCallback } from 'react';

// Detect browser language (e.g. "fr", "en", "de")
const BROWSER_LANG = (typeof navigator !== 'undefined'
    ? (navigator.language || 'fr').split('-')[0]
    : 'fr');

// Use browser lang, fallback fr
const TARGET = BROWSER_LANG === 'en' ? 'fr' : BROWSER_LANG;

async function myMemoryTranslate(text: string, from = 'en', to = TARGET): Promise<string> {
    if (!text.trim()) return text;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${from}|${to}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('MyMemory error');
    const data = await res.json() as { responseStatus: number; responseData: { translatedText: string } };
    if (data.responseStatus !== 200) throw new Error('Translation failed');
    return data.responseData.translatedText;
}

export function useTranslate() {
    const [store, setStore] = useState<Record<string, string>>({});
    const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});

    // Returns translated text if available, undefined otherwise
    const tx = useCallback((key: string) => store[key], [store]);

    // Toggle: first call translates, second call reverts to original
    const translate = useCallback(async (text: string, key: string, fromLang = 'en') => {
        if (store[key] !== undefined) {
            // Already translated → revert
            setStore(s => { const n = { ...s }; delete n[key]; return n; });
            return;
        }
        setLoadingKeys(l => ({ ...l, [key]: true }));
        try {
            const translated = await myMemoryTranslate(text, fromLang, TARGET);
            setStore(s => ({ ...s, [key]: translated }));
        } catch {
            // silently fail — original text stays
        } finally {
            setLoadingKeys(l => ({ ...l, [key]: false }));
        }
    }, [store]);

    const isLoading = useCallback((key: string) => !!loadingKeys[key], [loadingKeys]);
    const isTranslated = useCallback((key: string) => store[key] !== undefined, [store]);

    return { tx, translate, isLoading, isTranslated, targetLang: TARGET };
}
