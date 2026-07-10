// ============================================
// Restream Server — Shared TypeScript Types
// ============================================

/** Status of an individual relay process */
export type RelayStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'error'
  | 'reconnecting'
  | 'stopped'
  | 'brb';

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
  name?: string;
  platform?: PlatformPreset;
  enabled?: boolean;
  status: RelayStatus;
  reconnectAttempts: number;
  lastError: string | null;
  connectedAt: string | null;
  pid: number | null;
}

/** Incoming stream statistics from SRS */
export interface StreamStats {
  status: StreamStatus;
  streamName: string | null;
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
  incomingUptime: number;  // seconds, only when OBS is live
  outgoingUptime: number;  // seconds, only when at least one relay is live
  inputFps: number | null;
  outputFps: number | null;
  inputDroppedFrames: number;
  outputDroppedFrames: number;
  inputQuality: string | null;   // 'excellent' | 'good' | 'bad' | 'worse'
  outputQuality: string | null;
  averageLatencyMs: number | null;  // estimated OBS/SRS input to relay output
  brbActive?: boolean;
  brbTimeRemaining?: number; // in seconds
}

/** YouTube Chat Integration settings */
export interface YouTubeChatSettings {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // expiration timestamp in ms
}

/** Application configuration (persisted to JSON) */
export interface AppConfig {
  streamKey: string;
  destinations: Destination[];
  settings: AppSettings;
  youtubeChat?: YouTubeChatSettings;
  prochatUrl?: string;
}

/** Application settings */
export interface AppSettings {
  autoStartRelay: boolean;
  reconnectMaxAttempts: number;
  reconnectBaseDelay: number;  // seconds
  statsPollingInterval: number;  // milliseconds
  brbTimeout: number;
  enableAutoStop: boolean;
  enableBrbMode: boolean;
}

/** Standardized multi-platform chat message */
export interface ChatMessage {
  id: string;
  platform: 'youtube';
  username: string;
  avatar: string;
  message: string;
  sentAt: number;     // epoch millisecond from publishedAt
  receivedAt: number; // epoch millisecond when server received it
  badges: string[];   // e.g. ["owner", "moderator", "member", "verified"]
}

/** Standard interface for chat stream providers */
export interface ChatProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  onMessage(callback: (msg: ChatMessage) => void): void;
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
  type: 'stream:status' | 'stream:stats' | 'destination:status' | 'log:entry' | 'monitor:stats' | 'chat:new' | 'chat:history';
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
    fps?: number;
  };
  audio?: {
    codec: string;
    sample_rate: number;
    channel: number;
    profile: string;
  };
}
