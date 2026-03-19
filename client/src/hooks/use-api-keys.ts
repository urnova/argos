import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateApiKeyRequest } from "@shared/routes";

function parseWithLogging<T>(schema: any, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useApiKeys() {
  return useQuery({
    queryKey: [api.keys.list.path],
    queryFn: async () => {
      const res = await fetch(api.keys.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch API keys");
      const data = await res.json();
      return parseWithLogging(api.keys.list.responses[200], data, "keys.list");
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateApiKeyRequest) => {
      const validated = api.keys.create.input.parse(data);
      const res = await fetch(api.keys.create.path, {
        method: api.keys.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.keys.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create API key");
      }
      return parseWithLogging(api.keys.create.responses[201], await res.json(), "keys.create");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.keys.list.path] });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.keys.delete.path, { id });
      const res = await fetch(url, { 
        method: api.keys.delete.method, 
        credentials: "include" 
      });
      if (res.status === 404) throw new Error("API key not found");
      if (!res.ok) throw new Error("Failed to delete API key");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.keys.list.path] });
    },
  });
}
