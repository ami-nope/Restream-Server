// ============================================
// useWebSocket — Live connection to backend
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { WsMessage, MonitorStats, LogEntry, DestinationState } from '../types';

interface UseWebSocketReturn {
  connected: boolean;
  stats: MonitorStats | null;
  logs: LogEntry[];
  clearLogs: () => void;
}

const MAX_LOGS = 500;

export function useWebSocket(): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Build WebSocket URL relative to current host
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      // Reconnect after 2s
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WsMessage;

        switch (message.type) {
          case 'monitor:stats':
            setStats(message.data as MonitorStats);
            break;

          case 'log:entry':
            setLogs((prev) => {
              const next = [...prev, message.data as LogEntry];
              return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
            });
            break;

          case 'destination:status': {
            const destState = message.data as DestinationState;
            setStats((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                destinations: prev.destinations.map((d) =>
                  d.id === destState.id ? destState : d
                ),
              };
            });
            break;
          }

          case 'stream:status': {
            const { status } = message.data as { status: string };
            setStats((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                stream: { ...prev.stream, status: status as 'live' | 'offline' },
              };
            });
            break;
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [connect]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { connected, stats, logs, clearLogs };
}
