import { useQuery } from '@tanstack/react-query';

export type ServerStatus = 'ok' | 'error' | 'connecting';

export function useServerStatus(): ServerStatus {
  const { data, isError, isLoading } = useQuery<{ status: string }>({
    queryKey: ['/api/health'],
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 25_000,
  });

  if (isLoading) return 'connecting';
  if (isError || data?.status !== 'ok') return 'error';
  return 'ok';
}
