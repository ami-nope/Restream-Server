// ============================================
// SRS API Client — Polls SRS for stream stats
// ============================================

import { StreamStats, SrsStreamsResponse } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('SRS');

const SRS_HOST = process.env.SRS_HOST || 'srs';
const SRS_API_PORT = parseInt(process.env.SRS_API_PORT || '1985', 10);
const SRS_BASE_URL = `http://${SRS_HOST}:${SRS_API_PORT}`;

let currentStreamStats: StreamStats = createEmptyStats();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function createEmptyStats(): StreamStats {
  return {
    status: 'offline',
    videoCodec: null,
    audioCodec: null,
    width: null,
    height: null,
    fps: null,
    videoBitrate: null,
    audioBitrate: null,
    totalBitrate: null,
    clientId: null,
    clientIp: null,
    connectedAt: null,
  };
}

/** Fetch stream info from SRS HTTP API */
async function fetchStreams(): Promise<SrsStreamsResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${SRS_BASE_URL}/api/v1/streams`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    return (await res.json()) as SrsStreamsResponse;
  } catch {
    // SRS might not be ready yet — this is normal on startup
    return null;
  }
}

/** Poll SRS for the active stream and extract stats */
async function pollStats(): Promise<void> {
  const data = await fetchStreams();

  if (!data || !data.streams || data.streams.length === 0) {
    // No active streams — if we were live, OBS might have disconnected
    // The on_unpublish callback handles the definitive state change,
    // so we don't reset status here to avoid race conditions.
    if (currentStreamStats.status === 'live') {
      // Update stats to reflect zero bitrate while still technically connected
      currentStreamStats.videoBitrate = 0;
      currentStreamStats.audioBitrate = 0;
      currentStreamStats.totalBitrate = 0;
      currentStreamStats.fps = 0;
    }
    return;
  }

  // Use the first active stream (we only accept one)
  const stream = data.streams.find((s) => s.publish?.active) || data.streams[0];

  currentStreamStats.status = 'live';

  if (stream.video) {
    currentStreamStats.videoCodec = stream.video.codec || null;
    currentStreamStats.width = stream.video.width || null;
    currentStreamStats.height = stream.video.height || null;
  }

  if (stream.audio) {
    currentStreamStats.audioCodec = stream.audio.codec || null;
  }

  // Bitrate from kbps object
  if (stream.kbps) {
    currentStreamStats.totalBitrate = Math.round(stream.kbps.recv_30s) || null;
    // Estimate video bitrate as total minus ~128kbps for audio
    if (currentStreamStats.totalBitrate) {
      currentStreamStats.audioBitrate = 128; // Estimated
      currentStreamStats.videoBitrate = Math.max(0, currentStreamStats.totalBitrate - 128);
    }
  }

  // FPS — SRS may provide it in video object or we estimate from frames
  if (stream.video && (stream.video as unknown as { fps?: number }).fps) {
    currentStreamStats.fps = (stream.video as unknown as { fps: number }).fps;
  }
}

/** Start polling SRS for stats */
export function startStatsPolling(intervalMs: number = 2000): void {
  if (pollTimer) return;
  pollTimer = setInterval(pollStats, intervalMs);
  log.info(`Stats polling started (every ${intervalMs}ms)`);
}

/** Stop polling */
export function stopStatsPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    log.info('Stats polling stopped');
  }
}

/** Get current stream stats */
export function getStreamStats(): StreamStats {
  return { ...currentStreamStats };
}

/** Set stream as live (called by on_publish callback) */
export function setStreamLive(clientId: string, ip: string): void {
  currentStreamStats.status = 'live';
  currentStreamStats.clientId = clientId;
  currentStreamStats.clientIp = ip;
  currentStreamStats.connectedAt = new Date().toISOString();
  log.success(`OBS connected from ${ip} (client: ${clientId})`);
}

/** Set stream as offline (called by on_unpublish callback) */
export function setStreamOffline(): void {
  currentStreamStats = createEmptyStats();
  log.info('OBS disconnected — stream offline');
}

/** Check if SRS is reachable */
export async function checkSrsHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${SRS_BASE_URL}/api/v1/versions`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}
