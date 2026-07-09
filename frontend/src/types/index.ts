// ============================================
// Frontend TypeScript Types
// ============================================

export type RelayStatus = 'idle' | 'connecting' | 'live' | 'error' | 'reconnecting' | 'stopped';
export type StreamStatus = 'offline' | 'live';
export type PlatformPreset = 'youtube' | 'twitch' | 'kick' | 'facebook' | 'tiktok' | 'custom';

export interface Destination {
  id: string;
  name: string;
  platform: PlatformPreset;
  serverUrl: string;
  streamKey: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  relay?: DestinationState;
}

export interface DestinationState {
  id: string;
  status: RelayStatus;
  reconnectAttempts: number;
  lastError: string | null;
  connectedAt: string | null;
  pid: number | null;
}

export interface StreamStats {
  status: StreamStatus;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoBitrate: number | null;
  audioBitrate: number | null;
  totalBitrate: number | null;
  clientId: string | null;
  clientIp: string | null;
  connectedAt: string | null;
}

export interface MonitorStats {
  stream: StreamStats;
  destinations: DestinationState[];
  connectedCount: number;
  failedCount: number;
  totalOutgoingBitrate: number;
  uptime: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  source: string;
}

export interface WsMessage {
  type: 'stream:status' | 'stream:stats' | 'destination:status' | 'log:entry' | 'monitor:stats';
  data: unknown;
}

export interface AppSettings {
  streamKey: string;
  settings: {
    autoStartRelay: boolean;
    reconnectMaxAttempts: number;
    reconnectBaseDelay: number;
    statsPollingInterval: number;
  };
  srsHost: string;
  srsRtmpPort: number;
}
