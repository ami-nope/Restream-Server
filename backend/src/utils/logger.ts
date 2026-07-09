// ============================================
// Logger — Structured logging with WebSocket broadcast
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { LogEntry } from '../types';

type LogLevel = LogEntry['level'];
type LogBroadcaster = (entry: LogEntry) => void;

let broadcaster: LogBroadcaster | null = null;

/** Register a function that will receive all log entries (for WebSocket broadcast) */
export function setLogBroadcaster(fn: LogBroadcaster): void {
  broadcaster = fn;
}

/** Create a structured log entry and optionally broadcast it */
function createLog(level: LogLevel, message: string, source: string): LogEntry {
  const entry: LogEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    level,
    message,
    source,
  };

  // Console output with color
  const prefix = `[${entry.timestamp}] [${source}]`;
  switch (level) {
    case 'info':
      console.log(`\x1b[36m${prefix}\x1b[0m ${message}`);
      break;
    case 'success':
      console.log(`\x1b[32m${prefix}\x1b[0m ${message}`);
      break;
    case 'warning':
      console.warn(`\x1b[33m${prefix}\x1b[0m ${message}`);
      break;
    case 'error':
      console.error(`\x1b[31m${prefix}\x1b[0m ${message}`);
      break;
  }

  // Broadcast to WebSocket clients
  if (broadcaster) {
    broadcaster(entry);
  }

  return entry;
}

/** Logger factory — creates a logger scoped to a source name */
export function createLogger(source: string) {
  return {
    info: (message: string) => createLog('info', message, source),
    success: (message: string) => createLog('success', message, source),
    warn: (message: string) => createLog('warning', message, source),
    error: (message: string) => createLog('error', message, source),
  };
}
