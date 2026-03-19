import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@shared/routes';

// Local dev = WebSocket works. Any deployed env (Netlify, custom domain) = SSE.
const IS_LOCAL = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname === '0.0.0.0');

/**
 * Real-time feed updater.
 *
 * • Local dev   → WebSocket (/ws) — instant push, reconnects up to 3x
 * • Deployed    → Server-Sent Events (/api/events) — works on Netlify/serverless.
 *                 EventSource reconnects automatically every ~20s (server closes
 *                 the connection to stay within Netlify's 26s function timeout).
 *                 Last-Event-ID ensures no alert is missed across reconnects.
 */
export function useAlertWebSocket() {
  const queryClient = useQueryClient();

  // ── Deployed: SSE via EventSource ─────────────────────────────────────────
  useEffect(() => {
    if (IS_LOCAL) return;

    let es: EventSource | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      es = new EventSource('/api/events');

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string };
          if (['alert_created', 'alert_updated', 'alert_deleted', 'rss_refresh', 'firms_refresh'].includes(msg.type)) {
            queryClient.invalidateQueries({ queryKey: [api.alerts.list.path] });
          }
        } catch { /* ignore non-JSON */ }
      };

      es.onerror = () => {
        // EventSource handles reconnect automatically — no manual retry needed
      };
    }

    connect();

    return () => {
      destroyed = true;
      es?.close();
    };
  }, [queryClient]);

  // ── Local dev: WebSocket ───────────────────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);
  const MAX_RETRIES = 3;
  const RECONNECT_DELAY = 5_000;

  useEffect(() => {
    if (!IS_LOCAL) return;

    let destroyed = false;

    function connect() {
      if (destroyed || retries.current >= MAX_RETRIES) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => { retries.current = 0; };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string };
          if (['alert_created', 'alert_updated', 'alert_deleted', 'gdelt_refresh', 'rss_refresh', 'firms_refresh', 'new_alert'].includes(msg.type)) {
            queryClient.invalidateQueries({ queryKey: [api.alerts.list.path] });
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (!destroyed) {
          retries.current++;
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        }
      };

      ws.onerror = () => { ws.close(); };
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [queryClient]);
}
