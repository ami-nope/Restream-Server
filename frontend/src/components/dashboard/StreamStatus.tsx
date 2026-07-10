// ============================================
// StreamStatus Component - Hero status display
// ============================================

import React from 'react';
import { StreamStats } from '../../types';
import UptimeTimer from './UptimeTimer';

interface StreamStatusProps {
  stream: StreamStats;
  incomingUptime: number;
  outgoingUptime: number;
  incomingActive: boolean;
  outgoingActive: boolean;
  inputQuality: string | null;
  outputQuality: string | null;
}

function formatQualityLabel(value: string | null): string {
  if (!value) return 'Warming Up';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getQualityClasses(value: string | null): string {
  switch (value) {
    case 'excellent':
      return 'border-live/30 bg-live/10 text-live';
    case 'good':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-300';
    case 'bad':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
    case 'worse':
      return 'border-danger/30 bg-danger/10 text-danger';
    default:
      return 'border-white/10 bg-white/[0.04] text-gray-400';
  }
}

const StreamStatus: React.FC<StreamStatusProps> = ({
  stream,
  incomingUptime,
  outgoingUptime,
  incomingActive,
  outgoingActive,
  inputQuality,
  outputQuality,
}) => {
  const isLive = stream.status === 'live';

  return (
    <div className={`glass-card p-6 relative overflow-hidden ${isLive ? 'border-live/20' : ''}`}>
      {isLive && (
        <div className="absolute inset-0 bg-gradient-to-br from-live/[0.03] to-transparent pointer-events-none" />
      )}

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            {isLive ? (
              <div className="live-badge text-base">
                <span className="status-dot-live animate-pulse-live" />
                LIVE
              </div>
            ) : (
              <div className="offline-badge text-base">
                <span className="status-dot-idle" />
                OFFLINE
              </div>
            )}

            <p className="text-sm text-gray-500">
              {isLive ? 'OBS is actively sending video.' : 'Waiting for OBS to send video...'}
            </p>
          </div>

          <div className="flex flex-wrap gap-5 text-sm">
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs uppercase tracking-wider">Resolution</span>
              <span className="text-gray-200 font-semibold">
                {isLive && stream.width && stream.height
                  ? `${stream.width}x${stream.height}`
                  : '-'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs uppercase tracking-wider">Codec</span>
              <span className="text-gray-200 font-semibold">
                {isLive && stream.videoCodec ? stream.videoCodec : '-'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs uppercase tracking-wider">Incoming Bitrate</span>
              <span className="text-gray-200 font-semibold">
                {isLive && stream.totalBitrate !== null
                  ? `${stream.totalBitrate.toLocaleString()} kbps`
                  : '-'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs uppercase tracking-wider">Source IP</span>
              <span className="text-gray-200 font-semibold font-mono text-xs">
                {isLive && stream.clientIp ? stream.clientIp : '-'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className={`px-3 py-2 rounded-xl border text-sm ${getQualityClasses(inputQuality)}`}>
              <span className="text-xs uppercase tracking-wider text-gray-500 block">Input Quality</span>
              <span className="font-semibold">{formatQualityLabel(inputQuality)}</span>
            </div>
            <div className={`px-3 py-2 rounded-xl border text-sm ${getQualityClasses(outputQuality)}`}>
              <span className="text-xs uppercase tracking-wider text-gray-500 block">Output Quality</span>
              <span className="font-semibold">{formatQualityLabel(outputQuality)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-[280px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <span className="text-gray-500 text-xs uppercase tracking-wider block mb-2">
              Incoming Uptime
            </span>
            <UptimeTimer
              seconds={incomingUptime}
              active={incomingActive}
              className="text-xl font-bold font-mono text-gradient tabular-nums"
            />
            <p className="text-xs text-gray-500 mt-2">
              Runs only while video is being received.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <span className="text-gray-500 text-xs uppercase tracking-wider block mb-2">
              Outgoing Uptime
            </span>
            <UptimeTimer
              seconds={outgoingUptime}
              active={outgoingActive}
              className="text-xl font-bold font-mono text-gradient tabular-nums"
            />
            <p className="text-xs text-gray-500 mt-2">
              Runs only while relays are sending video.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamStatus;
