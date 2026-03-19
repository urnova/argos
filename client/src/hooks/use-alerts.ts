import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { CreateAlertRequest, UpdateAlertRequest } from "@shared/schema";

function parseWithLogging<T>(schema: any, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useAlerts() {
  return useQuery({
    queryKey: [api.alerts.list.path],
    queryFn: async () => {
      const res = await fetch(api.alerts.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch alerts");
      const data = await res.json();
      return parseWithLogging(api.alerts.list.responses[200], data, "alerts.list");
    },
    refetchInterval: 15_000, // WebSocket handles push; this is the fallback polling
  });
}

export function useAlert(id: number) {
  return useQuery({
    queryKey: [api.alerts.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.alerts.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch alert");
      const data = await res.json();
      return parseWithLogging(api.alerts.get.responses[200], data, "alerts.get");
    },
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAlertRequest) => {
      const res = await fetch(api.alerts.create.path, {
        method: api.alerts.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create alert");
      return parseWithLogging(api.alerts.create.responses[201], await res.json(), "alerts.create");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.alerts.list.path] }),
  });
}
