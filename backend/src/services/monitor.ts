// ============================================
// Monitor Service - Stats aggregation
// ============================================

import { MonitorStats } from '../types';
import {
  getStreamStats,
  getInputDroppedFrames,
  getInputFps,
  getInputFrameCount,
  getPeakFps,
} from './srs';
import { getAllRelayStates, getAggregateRelayMetrics, getBrbStatus } from './relay';

function secondsSince(dateString: string | null): number {
  if (!dateString) return 0;
  const parsed = Date.parse(dateString);
  if (isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
}

function getQualityLabel(
  expectedFps: number,
  currentFps: number | null,
  droppedFrames: number,
  uptimeSeconds: number
): string | null {
  if (expectedFps <= 0 || !currentFps || uptimeSeconds <= 0) {
    return null;
  }

  const expectedFrames = Math.max(expectedFps * uptimeSeconds, 1);
  const fpsRatio = currentFps / expectedFps;
  const dropRate = droppedFrames / expectedFrames;

  if (dropRate <= 0.01 && fpsRatio >= 0.95) return 'excellent';
  if (dropRate <= 0.05 && fpsRatio >= 0.85) return 'good';
  if (dropRate <= 0.15 && fpsRatio >= 0.65) return 'bad';
  return 'worse';
}

/** Set the stream connected timestamp */
export function setStreamConnected(): void {
  // Keep the function for callback compatibility.
}

/** Clear the stream connected timestamp */
export function setStreamDisconnected(): void {
  // Keep the function for callback compatibility.
}

/** Get aggregated monitor stats */
export function getMonitorStats(): MonitorStats {
  const stream = getStreamStats();
  const destinations = getAllRelayStates();

  const connectedCount = destinations.filter((destination) => destination.status === 'live').length;
  const failedCount = destinations.filter((destination) => destination.status === 'error').length;
  const inputActive = stream.status === 'live';
  const outputActive = inputActive && connectedCount > 0;

  // Calculate incoming uptime based on stream connectedAt timestamp
  const incomingUptime = inputActive ? secondsSince(stream.connectedAt) : 0;

  // Calculate outgoing uptime based on the earliest live relay connectedAt timestamp
  const liveDestinations = destinations.filter((d) => d.status === 'live' && d.connectedAt);
  const earliestOutgoingConnectedAt = liveDestinations.length > 0
    ? liveDestinations.reduce((earliest, d) => {
        if (!earliest) return d.connectedAt;
        return Date.parse(d.connectedAt!) < Date.parse(earliest)
          ? d.connectedAt
          : earliest;
      }, null as string | null)
    : null;

  const outgoingUptime = outputActive ? secondsSince(earliestOutgoingConnectedAt) : 0;
  const inputBitrate = inputActive ? stream.totalBitrate || 0 : 0;
  const totalOutgoingBitrate = outputActive ? inputBitrate * connectedCount : 0;
  const detectedInputFps = inputActive ? getInputFps() || stream.fps : null;
  const relayMetrics = getAggregateRelayMetrics(getInputFrameCount(), detectedInputFps);
  const outputFps = outputActive ? relayMetrics.fps || detectedInputFps : null;
  const inputFps = detectedInputFps || outputFps;
  const inputDroppedFrames = inputActive ? getInputDroppedFrames() : 0;
  const outputDroppedFrames = outputActive ? relayMetrics.droppedFrames : 0;
  const expectedFps = Math.max(getPeakFps(), inputFps || 0, outputFps || 0, stream.fps || 0);
  const inputQuality = inputActive
    ? getQualityLabel(expectedFps, inputFps, inputDroppedFrames, incomingUptime)
    : null;
  const outputQuality = outputActive
    ? getQualityLabel(expectedFps, outputFps, outputDroppedFrames, outgoingUptime)
    : null;

  return {
    stream,
    destinations,
    connectedCount,
    failedCount,
    totalOutgoingBitrate,
    uptime: incomingUptime,
    incomingUptime,
    outgoingUptime,
    inputFps,
    outputFps,
    inputDroppedFrames,
    outputDroppedFrames,
    inputQuality,
    outputQuality,
    averageLatencyMs: outputActive ? relayMetrics.averageLatencyMs : null,
    ...getBrbStatus(),
  };
}
