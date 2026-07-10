// ============================================
// Frontend TypeScript Types
// ============================================

export type RelayStatus = 'idle' | 'connecting' | 'live' | 'error' | 'reconnecting' | 'stopped' | 'brb';
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
  name?: string;
  platform?: PlatformPreset;
  enabled?: boolean;
  status: RelayStatus;
  reconnectAttempts: number;
  lastError: string | null;
  connectedAt: string | null;
  pid: number | null;
}

export interface StreamStats {
  status: StreamStatus;
  streamName: string | null;
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
  incomingUptime: number;
  outgoingUptime: number;
  inputFps: number | null;
  outputFps: number | null;
  inputDroppedFrames: number;
  outputDroppedFrames: number;
  inputQuality: string | null;
  outputQuality: string | null;
  averageLatencyMs: number | null;
  brbActive?: boolean;
  brbTimeRemaining?: number;
}

export interface ChatMessage {
  id: string;
  platform: 'youtube';
  username: string;
  avatar: string;
  message: string;
  sentAt: number;
  receivedAt: number;
  badges: string[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  source: string;
}

export interface WsMessage {
  type: 'stream:status' | 'stream:stats' | 'destination:status' | 'log:entry' | 'monitor:stats' | 'chat:new' | 'chat:history';
  data: unknown;
}

export interface AppSettings {
  streamKey: string;
  settings: {
    autoStartRelay: boolean;
    reconnectMaxAttempts: number;
    reconnectBaseDelay: number;
    statsPollingInterval: number;
    brbTimeout: number;
    enableAutoStop: boolean;
    enableBrbMode: boolean;
  };
  srsHost: string;
  srsRtmpPort: number;
  publicRtmpUrl?: string;
}
