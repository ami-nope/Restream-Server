// ============================================
// Monitor Service — Stats aggregation
// ============================================

import { MonitorStats } from '../types';
import { getStreamStats } from './srs';
import { getAllRelayStates } from './relay';

let streamConnectedAt: Date | null = null;

/** Set the stream connected timestamp */
export function setStreamConnected(): void {
  streamConnectedAt = new Date();
}

/** Clear the stream connected timestamp */
export function setStreamDisconnected(): void {
  streamConnectedAt = null;
}

/** Get aggregated monitor stats */
export function getMonitorStats(): MonitorStats {
  const stream = getStreamStats();
  const destinations = getAllRelayStates();

  const connectedCount = destinations.filter((d) => d.status === 'live').length;
  const failedCount = destinations.filter((d) => d.status === 'error').length;

  // Estimate total outgoing bitrate (incoming bitrate × connected destinations)
  const incomingBitrate = stream.totalBitrate || 0;
  const totalOutgoingBitrate = incomingBitrate * connectedCount;

  // Calculate uptime in seconds
  let uptime = 0;
  if (streamConnectedAt && stream.status === 'live') {
    uptime = Math.floor((Date.now() - streamConnectedAt.getTime()) / 1000);
  }

  return {
    stream,
    destinations,
    connectedCount,
    failedCount,
    totalOutgoingBitrate,
    uptime,
  };
}
