/**
 * WebSocket broadcaster — singleton to avoid circular imports.
 * index.ts registers the WSS here; routes.ts imports broadcast() from here.
 */

import { WebSocket, WebSocketServer } from 'ws';

export let wss: WebSocketServer | null = null;

export function registerWss(server: WebSocketServer) {
  wss = server;
}

export function broadcast(type: string, payload: unknown) {
  if (!wss) return;
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}
