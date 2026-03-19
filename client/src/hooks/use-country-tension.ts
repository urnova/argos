import { useQuery } from "@tanstack/react-query";

export interface CountryTensionEntry {
    code: string;
    name: string;
    status: 'war' | 'high' | 'tension' | 'sanctions' | 'watchlist' | 'stable';
    score: number;
    activeAlerts: number;
    reason: string;
    flag?: string;
}

export function useCountryTension() {
    return useQuery<CountryTensionEntry[]>({
        queryKey: ['/api/countries/tension'],
        queryFn: async () => {
            const res = await fetch('/api/countries/tension');
            if (!res.ok) throw new Error('Failed to fetch country tension');
            return res.json();
        },
        refetchInterval: 60_000, // refresh every minute
        staleTime: 30_000,
    });
}
