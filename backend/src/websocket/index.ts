// ============================================
// WebSocket Server — Live updates to dashboard
// ============================================

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WsMessage, LogEntry, DestinationState } from '../types';
import { getMonitorStats } from '../services/monitor';
import { setLogBroadcaster } from '../utils/logger';
import { onRelayStateChange } from '../services/relay';
import { createLogger } from '../utils/logger';

const log = createLogger('WebSocket');

let wss: WebSocketServer;
let statsBroadcastTimer: ReturnType<typeof setInterval> | null = null;
let chatHistoryGetter: (() => any[]) | null = null;

/** Register a getter for the in-memory chat messages history to send on connection */
export function setChatHistoryGetter(getter: () => any[]): void {
  chatHistoryGetter = getter;
}

/** Initialize WebSocket server on the given HTTP server */
export function initWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    log.info(`Dashboard client connected (total: ${wss.clients.size})`);

    // Send current stats immediately on connect
    const stats = getMonitorStats();
    sendTo(ws, { type: 'monitor:stats', data: stats });

    // Send current chat history immediately on connect
    if (chatHistoryGetter) {
      const history = chatHistoryGetter();
      sendTo(ws, { type: 'chat:history', data: history });
    }

    ws.on('close', () => {
      log.info(`Dashboard client disconnected (total: ${wss.clients.size})`);
    });

    ws.on('error', (err) => {
      log.error(`WebSocket client error: ${err.message}`);
    });

    // Heartbeat ping
    ws.on('pong', () => {
      (ws as unknown as { isAlive: boolean }).isAlive = true;
    });
  });

  // Heartbeat interval — detect dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as unknown as { isAlive: boolean };
      if (client.isAlive === false) {
        ws.terminate();
        return;
      }
      client.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  // Set up log broadcaster
  setLogBroadcaster((entry: LogEntry) => {
    broadcast({ type: 'log:entry', data: entry });
  });

  // Set up relay state change listener
  onRelayStateChange((state: DestinationState) => {
    broadcast({ type: 'destination:status', data: state });
  });

  // Start periodic stats broadcast
  startStatsBroadcast();

  log.success('WebSocket server initialized on /ws');
  return wss;
}

/** Broadcast a message to all connected clients */
export function broadcast(message: WsMessage): void {
  if (!wss) return;

  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

/** Send a message to a specific client */
function sendTo(ws: WebSocket, message: WsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/** Start broadcasting stats at regular intervals */
function startStatsBroadcast(intervalMs: number = 2000): void {
  if (statsBroadcastTimer) return;

  statsBroadcastTimer = setInterval(() => {
    if (wss && wss.clients.size > 0) {
      const stats = getMonitorStats();
      broadcast({ type: 'monitor:stats', data: stats });
    }
  }, intervalMs);
}

/** Stop stats broadcast */
export function stopStatsBroadcast(): void {
  if (statsBroadcastTimer) {
    clearInterval(statsBroadcastTimer);
    statsBroadcastTimer = null;
  }
}

/** Broadcast stream status change */
export function broadcastStreamStatus(status: 'live' | 'offline'): void {
  broadcast({ type: 'stream:status', data: { status } });
}

/** Shut down WebSocket server */
export function shutdownWebSocket(): void {
  stopStatsBroadcast();
  if (wss) {
    wss.close();
  }
}
