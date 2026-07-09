// ============================================
// Relay Service — FFmpeg Process Manager
// ============================================
// Spawns one FFmpeg process per destination using -c copy (no transcoding).
// Handles reconnection with exponential backoff.

import { ChildProcess, spawn } from 'child_process';
import { Destination, DestinationState, RelayStatus } from '../types';
import { getConfig, getDestinations } from '../config/manager';
import { createLogger } from '../utils/logger';
import { getBackoffDelay, sleep } from '../utils/helpers';

const log = createLogger('Relay');

const SRS_HOST = process.env.SRS_HOST || 'srs';
const SRS_RTMP_PORT = parseInt(process.env.SRS_RTMP_PORT || '1935', 10);

/** Map of destination ID → relay state */
const relayStates = new Map<string, DestinationState>();

/** Map of destination ID → FFmpeg child process */
const relayProcesses = new Map<string, ChildProcess>();

/** Map of destination ID → reconnect cancel flag */
const reconnectFlags = new Map<string, boolean>();

/** Whether the relay system is globally active */
let relayActive = false;

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

function setState(id: string, updates: Partial<DestinationState>): DestinationState {
  const state = getOrCreateState(id);
  Object.assign(state, updates);
  relayStates.set(id, state);

  // Notify WebSocket listeners
  if (stateChangeCallback) {
    stateChangeCallback(state);
  }

  return state;
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
  const inputUrl = `rtmp://${SRS_HOST}:${SRS_RTMP_PORT}/live/${config.streamKey}`;

  // Build the output URL: serverUrl + / + streamKey
  let outputUrl = destination.serverUrl;
  if (!outputUrl.endsWith('/')) outputUrl += '/';
  outputUrl += destination.streamKey;

  return [
    '-rw_timeout', '5000000',     // 5s network timeout
    '-i', inputUrl,                // Input from SRS
    '-c', 'copy',                  // No transcoding!
    '-f', 'flv',                   // FLV container for RTMP
    '-flvflags', 'no_duration_filesize',
    outputUrl,                     // Output to destination
  ];
}

function spawnRelay(destination: Destination): void {
  const state = getOrCreateState(destination.id);

  // Don't spawn if already running
  if (relayProcesses.has(destination.id)) {
    log.warn(`Relay already running for ${destination.name}, skipping spawn`);
    return;
  }

  setState(destination.id, { status: 'connecting', lastError: null });
  log.info(`Starting relay to ${destination.name}...`);

  const args = buildFfmpegArgs(destination);
  const proc = spawn('ffmpeg', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  relayProcesses.set(destination.id, proc);
  setState(destination.id, { pid: proc.pid || null });

  // FFmpeg outputs most info on stderr
  proc.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();

    // Detect successful connection
    if (line.includes('Output #0') || line.includes('Stream mapping')) {
      setState(destination.id, {
        status: 'live',
        reconnectAttempts: 0,
        connectedAt: new Date().toISOString(),
      });
      log.success(`Forwarding to ${destination.name}`);
    }

    // Detect common errors
    if (line.includes('Connection refused') || line.includes('Connection timed out')) {
      setState(destination.id, {
        status: 'error',
        lastError: 'Connection refused/timed out',
      });
    }

    if (line.includes('error') && line.toLowerCase().includes('broken pipe')) {
      setState(destination.id, {
        status: 'error',
        lastError: 'Broken pipe — destination closed connection',
      });
    }
  });

  proc.stdout?.on('data', (data: Buffer) => {
    // FFmpeg rarely outputs to stdout, but capture it
    const line = data.toString().trim();
    if (line) log.info(`[${destination.name}] ${line}`);
  });

  proc.on('error', (err) => {
    log.error(`FFmpeg process error for ${destination.name}: ${err.message}`);
    setState(destination.id, {
      status: 'error',
      lastError: err.message,
      pid: null,
    });
    relayProcesses.delete(destination.id);
    handleReconnect(destination);
  });

  proc.on('close', (code) => {
    relayProcesses.delete(destination.id);
    const currentState = getOrCreateState(destination.id);

    if (currentState.status === 'stopped') {
      // Intentional stop — don't reconnect
      setState(destination.id, { pid: null });
      log.info(`Relay to ${destination.name} stopped`);
      return;
    }

    if (code !== 0) {
      setState(destination.id, {
        status: 'error',
        lastError: `FFmpeg exited with code ${code}`,
        pid: null,
      });
      log.error(`${destination.name} disconnected (exit code: ${code})`);
      handleReconnect(destination);
    } else {
      setState(destination.id, { status: 'idle', pid: null });
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
      lastError: `Max reconnect attempts reached`,
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

  // Set cancel flag for this destination
  reconnectFlags.set(destination.id, false);

  await sleep(delay);

  // Check if reconnect was cancelled during sleep
  if (reconnectFlags.get(destination.id) || !relayActive) {
    return;
  }

  // Re-check that the destination is still enabled
  const currentDest = getDestinations().find((d) => d.id === destination.id);
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
  const destinations = getDestinations().filter((d) => d.enabled);

  if (destinations.length === 0) {
    log.warn('No enabled destinations to relay to');
    return;
  }

  log.info(`Starting relays for ${destinations.length} destination(s)...`);

  for (const dest of destinations) {
    spawnRelay(dest);
  }
}

/** Stop all running relays */
export function stopAllRelays(): void {
  relayActive = false;
  log.info('Stopping all relays...');

  for (const [id, proc] of relayProcesses.entries()) {
    // Mark as intentionally stopped
    setState(id, { status: 'stopped' });
    reconnectFlags.set(id, true); // Cancel any pending reconnect

    // Graceful shutdown
    proc.kill('SIGTERM');

    // Force kill after 5s
    setTimeout(() => {
      try {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      } catch { /* already dead */ }
    }, 5000);
  }

  // Wait a tick then clear
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
  const dest = getDestinations().find((d) => d.id === destId);
  if (!dest) {
    log.error(`Destination ${destId} not found`);
    return;
  }
  relayActive = true;
  spawnRelay(dest);
}

/** Stop relay for a single destination */
export function stopRelay(destId: string): void {
  const proc = relayProcesses.get(destId);
  if (!proc) {
    log.warn(`No running relay for destination ${destId}`);
    return;
  }

  setState(destId, { status: 'stopped' });
  reconnectFlags.set(destId, true);
  proc.kill('SIGTERM');

  setTimeout(() => {
    try {
      if (!proc.killed) proc.kill('SIGKILL');
    } catch { /* already dead */ }
  }, 5000);
}

/** Get all relay states */
export function getAllRelayStates(): DestinationState[] {
  const destinations = getDestinations();
  return destinations.map((d) => getOrCreateState(d.id));
}

/** Get relay state for a single destination */
export function getRelayState(destId: string): DestinationState {
  return getOrCreateState(destId);
}

/** Check if the relay system is active */
export function isRelayActive(): boolean {
  return relayActive;
}

/** Cleanup — kill all processes (for graceful shutdown) */
export function cleanup(): void {
  relayActive = false;
  for (const proc of relayProcesses.values()) {
    try { proc.kill('SIGKILL'); } catch { /* ignore */ }
  }
  relayProcesses.clear();
  relayStates.clear();
}
