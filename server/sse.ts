/**
 * SSE broadcaster — Server-Sent Events for Netlify compatibility.
 * On Netlify, WebSocket is not supported. SSE works via HTTP streaming.
 * EventSource (client) reconnects automatically; each reconnect sends
 * Last-Event-ID so the server can replay missed alerts.
 *
 * Netlify Functions timeout at ~26s → we close connections after 20s,
 * and EventSource reconnects seamlessly.
 */

import type { Response } from 'express';

const clients = new Set<Response>();

export function addSseClient(res: Response) {
  clients.add(res);
}

export function removeSseClient(res: Response) {
  clients.delete(res);
}

/**
 * Broadcast an SSE event to all connected clients.
 * @param type   Event type string (e.g. 'alert_created')
 * @param payload  Any JSON-serialisable payload
 * @param eventId  Optional numeric ID (used for Last-Event-ID replay)
 */
export function broadcastSse(type: string, payload: unknown, eventId?: number) {
  if (clients.size === 0) return;
  const idLine = eventId != null ? `id: ${eventId}\n` : '';
  const data = JSON.stringify({ type, payload });
  clients.forEach(res => {
    try {
      res.write(`${idLine}data: ${data}\n\n`);
    } catch {
      clients.delete(res);
    }
  });
}
