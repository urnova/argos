import { useQuery } from "@tanstack/react-query";

export interface Briefing {
  id: number;
  text: string;
  generatedAt: string;
  alertCount: number;
  topCountries: string[];
}

export function useBriefings() {
  return useQuery<Briefing[]>({
    queryKey: ["/api/briefings"],
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}
