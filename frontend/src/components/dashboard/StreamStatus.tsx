// ============================================
// StreamStatus Component — Hero status display
// ============================================

import React from 'react';
import { StreamStats } from '../../types';
import UptimeTimer from './UptimeTimer';

interface StreamStatusProps {
  stream: StreamStats;
  uptime: number;
}

const StreamStatus: React.FC<StreamStatusProps> = ({ stream, uptime }) => {
  const isLive = stream.status === 'live';

  return (
    <div className={`glass-card p-6 relative overflow-hidden ${isLive ? 'border-live/20' : ''}`}>
      {/* Animated background glow when live */}
      {isLive && (
        <div className="absolute inset-0 bg-gradient-to-br from-live/[0.03] to-transparent pointer-events-none" />
      )}

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Status badge */}
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

          {/* Stream details */}
          {isLive && (
            <div className="flex items-center gap-6 text-sm animate-fade-in">
              {stream.width && stream.height && (
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs uppercase tracking-wider">Resolution</span>
                  <span className="text-gray-200 font-semibold">
                    {stream.width}×{stream.height}
                  </span>
                </div>
              )}
              {stream.videoCodec && (
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs uppercase tracking-wider">Codec</span>
                  <span className="text-gray-200 font-semibold">{stream.videoCodec}</span>
                </div>
              )}
              {stream.totalBitrate && (
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs uppercase tracking-wider">Bitrate</span>
                  <span className="text-gray-200 font-semibold">
                    {stream.totalBitrate.toLocaleString()} kbps
                  </span>
                </div>
              )}
              {stream.clientIp && (
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs uppercase tracking-wider">Source IP</span>
                  <span className="text-gray-200 font-semibold font-mono text-xs">{stream.clientIp}</span>
                </div>
              )}
            </div>
          )}

          {!isLive && (
            <p className="text-gray-500 text-sm">
              Waiting for OBS to connect...
            </p>
          )}
        </div>

        {/* Uptime */}
        {isLive && (
          <div className="text-right animate-fade-in">
            <span className="text-gray-500 text-xs uppercase tracking-wider block">Uptime</span>
            <UptimeTimer seconds={uptime} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamStatus;
