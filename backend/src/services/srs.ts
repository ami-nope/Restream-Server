// ============================================
// SRS API Client - Polls SRS for stream stats
// ============================================

import { StreamStats, SrsStream, SrsStreamsResponse } from '../types';
import { getConfig } from '../config/manager';
import { createLogger } from '../utils/logger';

const log = createLogger('SRS');

const SRS_HOST = process.env.SRS_HOST || 'srs';
const SRS_API_PORT = parseInt(process.env.SRS_API_PORT || '1985', 10);
const SRS_BASE_URL = `http://${SRS_HOST}:${SRS_API_PORT}`;
const MEDIA_ACTIVITY_GRACE_MS = 6000;
const MIN_ACTIVE_BITRATE_KBPS = 32;
const FPS_STALE_AFTER_MS = 6000;

let currentStreamStats: StreamStats = createEmptyStats();
let pollTimer: ReturnType<typeof setInterval> | null = null;

// ---- FPS Calculation from frame count deltas ----
let previousFrameCount = 0;
let previousRecvBytes = 0;
let previousPollTime = 0;
let calculatedFps: number | null = null;
let lastFpsSampleAt = 0;
let peakFps = 0;
let totalExpectedFrames = 0;
let totalActualFrames = 0;
let lastActiveMediaAt = 0;

function createEmptyStats(): StreamStats {
  return {
    status: 'offline',
    streamName: null,
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

function resetTracking(): void {
  previousFrameCount = 0;
  previousRecvBytes = 0;
  previousPollTime = 0;
  calculatedFps = null;
  lastFpsSampleAt = 0;
  peakFps = 0;
  totalExpectedFrames = 0;
  totalActualFrames = 0;
  lastActiveMediaAt = 0;
}

function hasSessionMetadata(): boolean {
  return Boolean(
    currentStreamStats.clientId ||
    currentStreamStats.clientIp ||
    currentStreamStats.connectedAt
  );
}

function selectRelevantStream(streams: SrsStream[]): SrsStream | null {
  if (streams.length === 0) return null;

  const { streamKey } = getConfig();

  return (
    streams.find((stream) =>
      stream.publish?.active &&
      stream.app === 'live' &&
      stream.name === streamKey
    ) ||
    streams.find((stream) => stream.publish?.active && stream.name === streamKey) ||
    streams.find((stream) => stream.publish?.active && stream.app === 'live') ||
    streams.find((stream) => stream.publish?.active) ||
    null
  );
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
    // SRS might not be ready yet - this is normal on startup.
    return null;
  }
}

/** Poll SRS for the active stream and extract stats */
async function pollStats(): Promise<void> {
  const data = await fetchStreams();
  if (!data) return;

  const stream = selectRelevantStream(data.streams || []);
  if (!stream) {
    if (currentStreamStats.status === 'live' || hasSessionMetadata()) {
      setStreamOffline();
    }
    return;
  }

  if (stream.video) {
    currentStreamStats.streamName = stream.name || null;
    currentStreamStats.videoCodec = stream.video.codec || null;
    currentStreamStats.width = stream.video.width || null;
    currentStreamStats.height = stream.video.height || null;
  } else {
    currentStreamStats.streamName = stream.name || null;
    currentStreamStats.videoCodec = null;
    currentStreamStats.width = null;
    currentStreamStats.height = null;
  }

  if (stream.audio) {
    currentStreamStats.audioCodec = stream.audio.codec || null;
  } else {
    currentStreamStats.audioCodec = null;
  }

  const totalBitrate = stream.kbps ? Math.round(stream.kbps.recv_30s) : 0;
  currentStreamStats.totalBitrate = totalBitrate > 0 ? totalBitrate : null;
  if (currentStreamStats.totalBitrate !== null) {
    currentStreamStats.audioBitrate = 128;
    currentStreamStats.videoBitrate = Math.max(0, currentStreamStats.totalBitrate - 128);
  } else {
    currentStreamStats.audioBitrate = null;
    currentStreamStats.videoBitrate = null;
  }

  const now = Date.now();
  const currentFrames = stream.frames || 0;
  const currentRecvBytes = stream.recv_bytes || 0;
  const timeDelta = previousPollTime > 0 ? (now - previousPollTime) / 1000 : 0;
  const frameDelta =
    previousPollTime > 0 && currentFrames >= previousFrameCount
      ? currentFrames - previousFrameCount
      : 0;
  const recvDelta =
    previousPollTime > 0 && currentRecvBytes >= previousRecvBytes
      ? currentRecvBytes - previousRecvBytes
      : 0;
  const nativeFps = stream.video?.fps ? Math.round(stream.video.fps) : null;

  if (timeDelta > 0 && frameDelta > 0) {
    const sampleFps = Math.round(frameDelta / timeDelta);
    if (sampleFps > 0 && sampleFps <= 120) {
      calculatedFps = sampleFps;
      lastFpsSampleAt = now;
      peakFps = Math.max(peakFps, sampleFps);
    }
  }

  if (!calculatedFps && nativeFps && nativeFps > 0 && nativeFps <= 120) {
    calculatedFps = nativeFps;
    lastFpsSampleAt = now;
    peakFps = Math.max(peakFps, nativeFps);
  }

  const hasVideoSignal = Boolean(
    (currentStreamStats.width && currentStreamStats.height) ||
    currentFrames > 0 ||
    frameDelta > 0
  );
  const hasMediaMovement = Boolean(
    frameDelta > 0 ||
    recvDelta > 0 ||
    totalBitrate >= MIN_ACTIVE_BITRATE_KBPS
  );

  if (hasVideoSignal && hasMediaMovement) {
    lastActiveMediaAt = now;
  }

  const hasRecentMedia =
    lastActiveMediaAt > 0 && now - lastActiveMediaAt <= MEDIA_ACTIVITY_GRACE_MS;
  const streamIsActive =
    hasVideoSignal &&
    (hasRecentMedia || totalBitrate >= MIN_ACTIVE_BITRATE_KBPS);

  if (streamIsActive && timeDelta > 0 && peakFps > 0) {
    totalExpectedFrames += peakFps * timeDelta;
    totalActualFrames += frameDelta;
  }

  currentStreamStats.status = streamIsActive ? 'live' : 'offline';
  const fpsIsFresh = lastFpsSampleAt > 0 && now - lastFpsSampleAt <= FPS_STALE_AFTER_MS;
  currentStreamStats.fps = streamIsActive ? (fpsIsFresh ? calculatedFps : nativeFps) : null;

  if (stream.publish?.cid) {
    currentStreamStats.clientId = stream.publish.cid;
  }

  if (streamIsActive && !currentStreamStats.connectedAt) {
    currentStreamStats.connectedAt = new Date().toISOString();
  }

  previousFrameCount = currentFrames;
  previousRecvBytes = currentRecvBytes;
  previousPollTime = now;
}

/** Start polling SRS for stats */
export function startStatsPolling(intervalMs: number = 2000): void {
  if (pollTimer) return;
  void pollStats();
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

/** Get the currently active SRS stream name for relays */
export function getActiveStreamName(): string | null {
  return currentStreamStats.streamName;
}

/** Get calculated input FPS */
export function getInputFps(): number | null {
  const now = Date.now();
  if (calculatedFps && lastFpsSampleAt > 0 && now - lastFpsSampleAt <= FPS_STALE_AFTER_MS) {
    return calculatedFps;
  }
  return currentStreamStats.fps;
}

/** Get the latest input frame count reported by SRS */
export function getInputFrameCount(): number {
  return previousFrameCount;
}

/** Get estimated input dropped frames */
export function getInputDroppedFrames(): number {
  if (totalExpectedFrames <= 0 || totalActualFrames <= 0) return 0;
  return Math.max(0, Math.round(totalExpectedFrames - totalActualFrames));
}

/** Get peak detected FPS */
export function getPeakFps(): number {
  return peakFps;
}

/** Set stream as live (called by on_publish callback) */
export function setStreamLive(clientId: string, ip: string, streamName?: string): void {
  currentStreamStats.streamName = streamName || currentStreamStats.streamName;
  currentStreamStats.clientId = clientId;
  currentStreamStats.clientIp = ip;
  if (!currentStreamStats.connectedAt) {
    currentStreamStats.connectedAt = new Date().toISOString();
  }
  log.success(`OBS publish session opened from ${ip} (client: ${clientId})`);
}

/** Set stream as offline (called by on_unpublish callback) */
export function setStreamOffline(): void {
  const hadActiveSession = currentStreamStats.status === 'live' || hasSessionMetadata();
  currentStreamStats = createEmptyStats();
  resetTracking();
  if (hadActiveSession) {
    log.info('OBS disconnected - stream offline');
  }
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
