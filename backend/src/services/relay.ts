// ============================================
// Relay Service - FFmpeg Process Manager
// ============================================
// Spawns one FFmpeg process per destination using -c copy (no transcoding).
// Handles reconnection with exponential backoff.

import { ChildProcess, spawn } from 'child_process';
import { Destination, DestinationState } from '../types';
import { getConfig, getDestinations } from '../config/manager';
import { getActiveStreamName, getInputFrameCount } from './srs';
import { createLogger } from '../utils/logger';
import { getBackoffDelay, sleep } from '../utils/helpers';

const log = createLogger('Relay');

const SRS_HOST = process.env.SRS_HOST || 'srs';
const SRS_RTMP_PORT = parseInt(process.env.SRS_RTMP_PORT || '1935', 10);
const METRICS_STALE_AFTER_MS = 6000;
const RECENT_ERROR_LINES = 8;
const YOUTUBE_RTMPS_SERVER_URL = 'rtmps://a.rtmps.youtube.com/live2';
const KICK_DEFAULT_APP = 'app';

/** Map of destination ID -> relay state */
const relayStates = new Map<string, DestinationState>();

/** Map of destination ID -> FFmpeg child process */
const relayProcesses = new Map<string, ChildProcess>();

/** Map of destination ID -> reconnect cancel flag */
const reconnectFlags = new Map<string, boolean>();

/** Whether the relay system is globally active */
let relayActive = false;

interface RelayMetrics {
  frameCount: number;
  inputFrameBaseline: number | null;
  outputFrameBaseline: number | null;
  lastSampleAt: number | null;
  fps: number | null;
  droppedFrames: number;
}

const relayMetrics = new Map<string, RelayMetrics>();
const relayLogs = new Map<string, string[]>();

// ---- State Management ----

function getOrCreateState(id: string): DestinationState {
  if (!relayStates.has(id)) {
    relayStates.set(id, {
      id,
      status: 'idle',
      reconnectAttempts: 0,
      lastError: null,
      connectedAt: null,
      pid: null,
    });
  }
  return relayStates.get(id)!;
}

function withDestinationMetadata(state: DestinationState): DestinationState {
  const destination = getDestinations().find((dest) => dest.id === state.id);
  if (!destination) return { ...state };

  return {
    ...state,
    name: destination.name,
    platform: destination.platform,
    enabled: destination.enabled,
  };
}

function setState(id: string, updates: Partial<DestinationState>): DestinationState {
  const state = getOrCreateState(id);
  if (updates.status && updates.status !== 'live' && updates.status !== 'connecting') {
    updates.connectedAt = null;
  }
  Object.assign(state, updates);
  relayStates.set(id, state);

  if (stateChangeCallback) {
    stateChangeCallback(withDestinationMetadata(state));
  }

  return state;
}

function resetRelayMetrics(id: string): void {
  relayMetrics.set(id, {
    frameCount: 0,
    inputFrameBaseline: null,
    outputFrameBaseline: null,
    lastSampleAt: null,
    fps: null,
    droppedFrames: 0,
  });
  relayLogs.set(id, []);
}

function updateRelayMetrics(id: string, line: string): boolean {
  const metrics = relayMetrics.get(id) || {
    frameCount: 0,
    inputFrameBaseline: null,
    outputFrameBaseline: null,
    lastSampleAt: null,
    fps: null,
    droppedFrames: 0,
  };

  const normalized = line.replace(/\s+/g, ' ').trim();
  const frameMatch = normalized.match(/\bframe=\s*(\d+)/);
  const fpsMatch = normalized.match(/\bfps=\s*([\d.]+)/);
  const dropMatch = normalized.match(/\bdrop=\s*(\d+)/);

  if (!frameMatch && !fpsMatch && !dropMatch) {
    return false;
  }

  if (frameMatch) {
    const frameCount = parseInt(frameMatch[1], 10);
    const now = Date.now();

    if (metrics.inputFrameBaseline === null || metrics.outputFrameBaseline === null) {
      metrics.inputFrameBaseline = getInputFrameCount();
      metrics.outputFrameBaseline = frameCount;
    }

    if (
      metrics.lastSampleAt !== null &&
      frameCount >= metrics.frameCount &&
      now > metrics.lastSampleAt
    ) {
      const timeDelta = (now - metrics.lastSampleAt) / 1000;
      const frameDelta = frameCount - metrics.frameCount;
      if (timeDelta > 0 && frameDelta > 0) {
        metrics.fps = Math.round(frameDelta / timeDelta);
      }
    }

    metrics.frameCount = frameCount;
    metrics.lastSampleAt = now;
  }

  if (fpsMatch && (!metrics.fps || metrics.fps <= 0)) {
    const parsedFps = Math.round(parseFloat(fpsMatch[1]));
    if (parsedFps > 0) {
      metrics.fps = parsedFps;
    }
  }

  if (dropMatch) {
    metrics.droppedFrames = Math.max(metrics.droppedFrames, parseInt(dropMatch[1], 10));
  }

  relayMetrics.set(id, metrics);
  return metrics.frameCount > 0;
}

function isTwitchDestination(destination: Destination): boolean {
  return destination.platform === 'twitch' || destination.serverUrl.includes('twitch.tv');
}

function isKickDestination(destination: Destination): boolean {
  const serverUrl = destination.serverUrl.toLowerCase();
  return (
    destination.platform === 'kick' ||
    serverUrl.includes('kick.com') ||
    serverUrl.includes('global-contribute.live-video.net')
  );
}

function usesIvsCompatibleRtmp(destination: Destination): boolean {
  return isTwitchDestination(destination) || isKickDestination(destination);
}

function isYoutubeHlsUploadUrl(serverUrl: string): boolean {
  const normalized = serverUrl.toLowerCase();
  return (
    normalized.startsWith('https://') &&
    normalized.includes('upload.youtube.com') &&
    normalized.includes('http_upload_hls')
  );
}

function normalizeServerUrl(destination: Destination): string {
  const serverUrl = destination.serverUrl.trim();

  if (destination.platform === 'youtube' && isYoutubeHlsUploadUrl(serverUrl)) {
    log.warn(
      `${destination.name}: YouTube HLS ingest URL detected; using RTMPS ingest for RTMP relay output.`
    );
    return YOUTUBE_RTMPS_SERVER_URL;
  }

  if (isKickDestination(destination)) {
    try {
      const url = new URL(serverUrl);
      if (!url.pathname || url.pathname === '/') {
        url.pathname = `/${KICK_DEFAULT_APP}`;
        return url.toString().replace(/\/$/, '');
      }
    } catch {
      // Fall through to the original URL; FFmpeg will surface the invalid value.
    }
  }

  return serverUrl;
}

function buildOutputUrl(destination: Destination): string {
  const serverUrl = normalizeServerUrl(destination);
  const streamKey = destination.streamKey.trim().replace(/^\/+/, '');

  if (!streamKey) {
    return serverUrl;
  }

  const queryIndex = serverUrl.indexOf('?');
  const base = queryIndex >= 0 ? serverUrl.slice(0, queryIndex) : serverUrl;
  const suffix = queryIndex >= 0 ? serverUrl.slice(queryIndex) : '';
  const normalizedBase = base.replace(/\/+$/, '');

  if (normalizedBase.endsWith(`/${streamKey}`)) {
    return serverUrl;
  }

  return `${normalizedBase}/${streamKey}${suffix}`;
}

function sanitizeRelayLine(destination: Destination, line: string): string {
  const config = getConfig();
  const activeStreamName = getActiveStreamName();
  let sanitized = line;

  if (destination.streamKey) {
    sanitized = sanitized.replaceAll(destination.streamKey, '[destination-stream-key]');
  }
  if (config.streamKey) {
    sanitized = sanitized.replaceAll(config.streamKey, '[input-stream-key]');
  }
  if (activeStreamName) {
    sanitized = sanitized.replaceAll(activeStreamName, '[active-stream-key]');
  }

  return sanitized
    .replace(/([?&]cid=)[^&\s]+/gi, '$1[hidden]')
    .replace(/live_[A-Za-z0-9_]+/g, 'live_[hidden]');
}

function rememberRelayLine(destination: Destination, line: string): void {
  const sanitized = sanitizeRelayLine(destination, line);
  const lines = relayLogs.get(destination.id) || [];
  lines.push(sanitized);
  relayLogs.set(destination.id, lines.slice(-RECENT_ERROR_LINES));
}

function getLastRelayError(id: string): string | null {
  const lines = relayLogs.get(id) || [];
  const meaningful = [...lines].reverse().find((line) => {
    const lower = line.toLowerCase();
    return (
      lower.includes('error') ||
      lower.includes('failed') ||
      lower.includes('invalid') ||
      lower.includes('denied') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden') ||
      lower.includes('broken pipe') ||
      lower.includes('connection') ||
      lower.includes('server returned')
    );
  });

  return meaningful || lines[lines.length - 1] || null;
}

function getRelayExitError(
  destination: Destination,
  code: number | null,
  lastError: string | null,
  wasLive: boolean
): { message: string; retryable: boolean } {
  const exitCode = code === null ? 'unknown' : code;
  const lower = (lastError || '').toLowerCase();

  if (
    !wasLive &&
    isKickDestination(destination) &&
    lower.includes('input/output error')
  ) {
    return {
      message:
        'Kick rejected the RTMP publish before accepting frames. Check the Kick server URL and stream key.',
      retryable: false,
    };
  }

  if (
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('invalid') ||
    lower.includes('denied') ||
    lower.includes('server returned 401') ||
    lower.includes('server returned 403')
  ) {
    return {
      message: lastError
        ? `FFmpeg exited with code ${exitCode}: ${lastError}`
        : `FFmpeg exited with code ${exitCode}`,
      retryable: false,
    };
  }

  return {
    message: lastError
      ? `FFmpeg exited with code ${exitCode}: ${lastError}`
      : `FFmpeg exited with code ${exitCode}`,
    retryable: true,
  };
}

function markRelayLive(destination: Destination): void {
  const state = getOrCreateState(destination.id);
  if (state.status === 'live') return;

  setState(destination.id, {
    status: 'live',
    reconnectAttempts: 0,
    lastError: null,
    connectedAt: new Date().toISOString(),
  });
  log.success(`Forwarding frames to ${destination.name}`);
}

// ---- Callback for state changes (set by WebSocket module) ----

type StateChangeCallback = (state: DestinationState) => void;
let stateChangeCallback: StateChangeCallback | null = null;

export function onRelayStateChange(callback: StateChangeCallback): void {
  stateChangeCallback = callback;
}

// ---- FFmpeg Process Spawning ----

function buildFfmpegArgs(destination: Destination): string[] {
  const config = getConfig();
  const inputStreamName = getActiveStreamName() || config.streamKey;
  const inputUrl = `rtmp://${SRS_HOST}:${SRS_RTMP_PORT}/live/${inputStreamName}`;

  const outputUrl = buildOutputUrl(destination);

  const videoBitstreamFilter = usesIvsCompatibleRtmp(destination)
    ? 'h264_metadata=level=4.2,dump_extra'
    : null;

  const outputOptions = [
    '-rtmp_live', 'live',
    '-rtmp_buffer', '1000',
    '-flush_packets', '1',
    '-muxdelay', '0',
    '-muxpreload', '0',
  ];

  const bsfArgs = videoBitstreamFilter ? ['-bsf:v', videoBitstreamFilter] : [];

  return [
    '-hide_banner',
    '-loglevel', 'info',
    '-stats_period', '2',

    '-fflags', '+genpts+discardcorrupt',
    '-analyzeduration', '2000000',
    '-probesize', '5000000',
    '-rw_timeout', '5000000',
    '-i', inputUrl,

    '-c:v', 'copy',
    '-c:a', 'copy',
    ...bsfArgs,

    '-f', 'flv',
    '-flvflags', 'no_duration_filesize',
    '-reset_timestamps', '1',
    '-max_muxing_queue_size', '1024',

    ...outputOptions,
    outputUrl,
  ];
}

function spawnRelay(destination: Destination): void {
  if (relayProcesses.has(destination.id)) {
    log.warn(`Relay already running for ${destination.name}, skipping spawn`);
    return;
  }

  setState(destination.id, { status: 'connecting', lastError: null });
  log.info(`Starting relay to ${destination.name}...`);
  resetRelayMetrics(destination.id);

  const args = buildFfmpegArgs(destination);
  const proc = spawn('ffmpeg', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  relayProcesses.set(destination.id, proc);
  setState(destination.id, { pid: proc.pid || null });

  proc.stderr?.on('data', (data: Buffer) => {
    const lines = data
      .toString()
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      rememberRelayLine(destination, line);
      const hasFrameProgress = updateRelayMetrics(destination.id, line);

      if (hasFrameProgress) {
        markRelayLive(destination);
      }

      if (line.includes('Output #0') || line.includes('Stream mapping')) {
        setState(destination.id, {
          status: 'connecting',
          lastError: null,
        });
      }

      if (line.includes('Connection refused') || line.includes('Connection timed out')) {
        setState(destination.id, {
          status: 'error',
          lastError: 'Connection refused/timed out',
        });
      }

      if (line.toLowerCase().includes('broken pipe')) {
        setState(destination.id, {
          status: 'error',
          lastError: 'Broken pipe - destination closed connection',
        });
      }
    }
  });

  proc.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) log.info(`[${destination.name}] ${line}`);
  });

  proc.on('error', (err) => {
    log.error(`FFmpeg process error for ${destination.name}: ${err.message}`);
    setState(destination.id, {
      status: 'error',
      lastError: err.message,
    });
    // Ensure the process is killed. The 'close' event will handle cleanup and reconnection.
    try {
      proc.kill('SIGKILL');
    } catch {
      // Ignore
    }
  });

  proc.on('close', (code) => {
    relayProcesses.delete(destination.id);
    relayMetrics.delete(destination.id);
    const currentState = getOrCreateState(destination.id);
    const wasLive = currentState.status === 'live' || Boolean(currentState.connectedAt);

    if (currentState.status === 'stopped') {
      setState(destination.id, { pid: null });
      relayLogs.delete(destination.id);
      log.info(`Relay to ${destination.name} stopped`);
      return;
    }

    if (code !== 0) {
      const lastError = getLastRelayError(destination.id);
      const exitError = getRelayExitError(destination, code, lastError, wasLive);
      setState(destination.id, {
        status: 'error',
        lastError: exitError.message,
        pid: null,
      });
      log.error(`${destination.name} disconnected (exit code: ${code})`);
      if (exitError.retryable) {
        void handleReconnect(destination);
      } else {
        relayLogs.delete(destination.id);
        log.error(`${destination.name}: Not retrying until the destination settings are updated.`);
      }
    } else {
      setState(destination.id, { status: 'idle', pid: null });
      relayLogs.delete(destination.id);
      log.info(`Relay to ${destination.name} ended cleanly`);
    }
  });
}

// ---- Reconnection Logic ----

async function handleReconnect(destination: Destination): Promise<void> {
  if (!relayActive) return;

  const config = getConfig();
  const state = getOrCreateState(destination.id);
  const maxAttempts = config.settings.reconnectMaxAttempts;

  if (state.reconnectAttempts >= maxAttempts) {
    log.error(`${destination.name}: Max reconnect attempts (${maxAttempts}) reached. Giving up.`);
    setState(destination.id, {
      status: 'error',
      lastError: 'Max reconnect attempts reached',
    });
    return;
  }

  const attempt = state.reconnectAttempts + 1;
  const delay = getBackoffDelay(attempt - 1, config.settings.reconnectBaseDelay);

  setState(destination.id, {
    status: 'reconnecting',
    reconnectAttempts: attempt,
  });

  log.warn(
    `${destination.name}: Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt}/${maxAttempts})...`
  );

  reconnectFlags.set(destination.id, false);

  await sleep(delay);

  if (reconnectFlags.get(destination.id) || !relayActive) {
    return;
  }

  const currentDest = getDestinations().find((dest) => dest.id === destination.id);
  if (!currentDest || !currentDest.enabled) {
    log.info(`${destination.name}: Reconnect cancelled (destination disabled/removed)`);
    setState(destination.id, { status: 'idle', reconnectAttempts: 0 });
    return;
  }

  spawnRelay(currentDest);
}

// ---- Public API ----

/** Start relays for all enabled destinations */
export function startAllRelays(): void {
  relayActive = true;
  const destinations = getDestinations().filter((destination) => destination.enabled);

  if (destinations.length === 0) {
    log.warn('No enabled destinations to relay to');
    return;
  }

  log.info(`Starting relays for ${destinations.length} destination(s)...`);

  for (const destination of destinations) {
    spawnRelay(destination);
  }
}

/** Stop all running relays */
export function stopAllRelays(): void {
  relayActive = false;
  log.info('Stopping all relays...');

  for (const [id, proc] of relayProcesses.entries()) {
    setState(id, { status: 'stopped' });
    reconnectFlags.set(id, true);
    proc.kill('SIGTERM');

    setTimeout(() => {
      try {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      } catch {
        // Process already exited.
      }
    }, 5000);
  }

  setTimeout(() => {
    for (const id of relayStates.keys()) {
      if (getOrCreateState(id).status === 'stopped') {
        setState(id, { status: 'idle', pid: null, reconnectAttempts: 0 });
      }
    }
  }, 500);
}

/** Restart all relays */
export function restartAllRelays(): void {
  log.info('Restarting all relays...');
  stopAllRelays();
  setTimeout(() => {
    startAllRelays();
  }, 2000);
}

/** Start relay for a single destination */
export function startRelay(destId: string): void {
  const destination = getDestinations().find((dest) => dest.id === destId);
  if (!destination) {
    log.error(`Destination ${destId} not found`);
    return;
  }

  relayActive = true;
  spawnRelay(destination);
}

/** Stop relay for a single destination */
export function stopRelay(destId: string): void {
  reconnectFlags.set(destId, true);
  const proc = relayProcesses.get(destId);
  if (!proc) {
    log.warn(`No running relay for destination ${destId}`);
    setState(destId, {
      status: 'idle',
      pid: null,
      reconnectAttempts: 0,
    });
    return;
  }

  setState(destId, { status: 'stopped' });
  proc.kill('SIGTERM');

  setTimeout(() => {
    try {
      if (!proc.killed) proc.kill('SIGKILL');
    } catch {
      // Process already exited.
    }
  }, 5000);
}

/** Get all relay states */
export function getAllRelayStates(): DestinationState[] {
  const destinations = getDestinations();
  return destinations.map((destination) => withDestinationMetadata(getOrCreateState(destination.id)));
}

/** Get aggregated output metrics across all live relays */
export function getAggregateRelayMetrics(inputFrameCount: number = 0, inputFps: number | null = null): {
  fps: number | null;
  droppedFrames: number;
  averageLatencyMs: number | null;
} {
  const liveRelayIds = getAllRelayStates()
    .filter((state) => state.status === 'live')
    .map((state) => state.id);

  if (liveRelayIds.length === 0) {
    return {
      fps: null,
      droppedFrames: 0,
      averageLatencyMs: null,
    };
  }

  let fpsTotal = 0;
  let fpsSamples = 0;
  let droppedFrames = 0;
  let latencyTotalMs = 0;
  let latencySamples = 0;
  const now = Date.now();

  for (const id of liveRelayIds) {
    const metrics = relayMetrics.get(id);
    if (!metrics) continue;

    droppedFrames += metrics.droppedFrames;

    if (
      metrics.fps &&
      metrics.fps > 0 &&
      metrics.lastSampleAt !== null &&
      now - metrics.lastSampleAt <= METRICS_STALE_AFTER_MS
    ) {
      fpsTotal += metrics.fps;
      fpsSamples += 1;
    }

    const latencyFps = metrics.fps && metrics.fps > 0 ? metrics.fps : inputFps;
    if (
      inputFrameCount > 0 &&
      metrics.frameCount > 0 &&
      metrics.inputFrameBaseline !== null &&
      metrics.outputFrameBaseline !== null &&
      latencyFps &&
      latencyFps > 0 &&
      metrics.lastSampleAt !== null &&
      now - metrics.lastSampleAt <= METRICS_STALE_AFTER_MS
    ) {
      const inputFramesSinceBaseline = Math.max(0, inputFrameCount - metrics.inputFrameBaseline);
      const outputFramesSinceBaseline = Math.max(
        0,
        metrics.frameCount - metrics.outputFrameBaseline
      );
      const frameLag = Math.max(0, inputFramesSinceBaseline - outputFramesSinceBaseline);
      latencyTotalMs += (frameLag / latencyFps) * 1000;
      latencySamples += 1;
    }
  }

  return {
    fps: fpsSamples > 0 ? Math.round(fpsTotal / fpsSamples) : null,
    droppedFrames,
    averageLatencyMs: latencySamples > 0 ? Math.round(latencyTotalMs / latencySamples) : null,
  };
}

/** Get relay state for a single destination */
export function getRelayState(destId: string): DestinationState {
  return withDestinationMetadata(getOrCreateState(destId));
}

/** Check if the relay system is active */
export function isRelayActive(): boolean {
  return relayActive;
}

/** Cleanup - kill all processes (for graceful shutdown) */
export function cleanup(): void {
  relayActive = false;
  for (const proc of relayProcesses.values()) {
    try {
      proc.kill('SIGKILL');
    } catch {
      // Ignore cleanup errors.
    }
  }
  relayProcesses.clear();
  relayMetrics.clear();
  relayLogs.clear();
  relayStates.clear();
}
