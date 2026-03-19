import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export interface AiSummary {
  text: string;
  generatedAt: string;
  alertCount: number;
  topCountries: string[];
}

export function useAiSummary() {
  const queryClient = useQueryClient();
  const refreshingRef = useRef(false);

  const query = useQuery<AiSummary | null>({
    queryKey: ["/api/summary"],
    refetchInterval: 5 * 60 * 1000, // poll server every 5 min
    staleTime: 4 * 60 * 1000,
    retry: false,
  });

  // Auto-regenerate when briefing is older than 1 hour
  useEffect(() => {
    const data = query.data;
    if (!data?.generatedAt) return;

    const ageMs = Date.now() - new Date(data.generatedAt).getTime();
    if (ageMs < 60 * 60 * 1000) return; // less than 1h — nothing to do

    if (refreshingRef.current) return;
    refreshingRef.current = true;

    fetch('/api/summary/refresh', { method: 'POST' })
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/summary"] }))
      .catch(() => {/* silent fail */})
      .finally(() => { refreshingRef.current = false; });
  }, [query.data, queryClient]);

  return query;
}
