// ============================================
// Restream Server — Shared TypeScript Types
// ============================================

/** Status of an individual relay process */
export type RelayStatus = 'idle' | 'connecting' | 'live' | 'error' | 'reconnecting' | 'stopped';

/** Status of the incoming stream from OBS */
export type StreamStatus = 'offline' | 'live';

/** Supported platform presets */
export type PlatformPreset = 'youtube' | 'twitch' | 'kick' | 'facebook' | 'tiktok' | 'custom';

/** An RTMP destination configuration */
export interface Destination {
  id: string;
  name: string;
  platform: PlatformPreset;
  serverUrl: string;
  streamKey: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Runtime state for a destination relay */
export interface DestinationState {
  id: string;
  status: RelayStatus;
  reconnectAttempts: number;
  lastError: string | null;
  connectedAt: string | null;
  pid: number | null;
}

/** Incoming stream statistics from SRS */
export interface StreamStats {
  status: StreamStatus;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoBitrate: number | null;  // kbps
  audioBitrate: number | null;  // kbps
  totalBitrate: number | null;  // kbps
  clientId: string | null;
  clientIp: string | null;
  connectedAt: string | null;
}

/** Aggregated monitoring stats */
export interface MonitorStats {
  stream: StreamStats;
  destinations: DestinationState[];
  connectedCount: number;
  failedCount: number;
  totalOutgoingBitrate: number;  // kbps (estimated)
  uptime: number;  // seconds since OBS connected
}

/** Application configuration (persisted to JSON) */
export interface AppConfig {
  streamKey: string;
  destinations: Destination[];
  settings: AppSettings;
}

/** Application settings */
export interface AppSettings {
  autoStartRelay: boolean;
  reconnectMaxAttempts: number;
  reconnectBaseDelay: number;  // seconds
  statsPollingInterval: number;  // milliseconds
}

/** Log entry for the dashboard */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  source: string;
}

/** WebSocket message envelope */
export interface WsMessage {
  type: 'stream:status' | 'stream:stats' | 'destination:status' | 'log:entry' | 'monitor:stats';
  data: unknown;
}

/** SRS on_publish callback payload */
export interface SrsPublishPayload {
  action: string;
  client_id: string;
  ip: string;
  vhost: string;
  app: string;
  stream: string;
  param: string;
  server_id?: string;
  tcUrl?: string;
}

/** SRS on_unpublish callback payload */
export interface SrsUnpublishPayload {
  action: string;
  client_id: string;
  ip: string;
  vhost: string;
  app: string;
  stream: string;
  param: string;
  server_id?: string;
}

/** SRS API /api/v1/streams response */
export interface SrsStreamsResponse {
  code: number;
  server: string;
  streams: SrsStream[];
}

export interface SrsStream {
  id: number;
  name: string;
  vhost: string;
  app: string;
  live_ms: number;
  clients: number;
  frames: number;
  send_bytes: number;
  recv_bytes: number;
  kbps: {
    recv_30s: number;
    send_30s: number;
  };
  publish: {
    active: boolean;
    cid: string;
  };
  video?: {
    codec: string;
    profile: string;
    level: string;
    width: number;
    height: number;
  };
  audio?: {
    codec: string;
    sample_rate: number;
    channel: number;
    profile: string;
  };
}
