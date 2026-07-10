// ============================================
// StatsCards Component - Grid of stat cards
// ============================================

import React from 'react';
import { MonitorStats } from '../../types';

interface StatsCardsProps {
  stats: MonitorStats;
}

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon: string;
  color?: string;
  highlight?: boolean;
}

function formatQualityLabel(value: string | null): string {
  if (!value) return 'Warming Up';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getQualityColor(value: string | null): string | undefined {
  switch (value) {
    case 'excellent':
      return '#22c55e';
    case 'good':
      return '#38bdf8';
    case 'bad':
      return '#f59e0b';
    case 'worse':
      return '#ef4444';
    default:
      return undefined;
  }
}

function formatLatency(valueMs: number | null): { value: string; suffix: string } {
  if (valueMs === null) {
    return { value: '-', suffix: '' };
  }

  if (valueMs < 1000) {
    return { value: valueMs.toLocaleString(), suffix: 'ms' };
  }

  return { value: (valueMs / 1000).toFixed(1), suffix: 's' };
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  suffix,
  icon,
  color,
  highlight,
}) => {
  return (
    <div className={`glass-card-hover p-5 animate-slide-up ${highlight ? 'border-danger/30' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: color || '#e5e7eb' }}
            >
              {value}
            </span>
            {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
          </div>
        </div>
        <span className="text-xs font-semibold tracking-[0.2em] text-gray-500 uppercase">
          {icon}
        </span>
      </div>
    </div>
  );
};

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const {
    stream,
    connectedCount,
    failedCount,
    totalOutgoingBitrate,
    inputFps,
    outputFps,
    inputDroppedFrames,
    outputDroppedFrames,
    inputQuality,
    outputQuality,
    averageLatencyMs,
  } = stats;
  const isLive = stream.status === 'live';
  const latency = formatLatency(averageLatencyMs);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
      <StatCard
        label="Incoming Bitrate"
        value={isLive && stream.totalBitrate !== null ? stream.totalBitrate.toLocaleString() : '-'}
        suffix={isLive && stream.totalBitrate !== null ? 'kbps' : ''}
        icon="IN"
        color={isLive ? '#60a5fa' : undefined}
      />
      <StatCard
        label="Total Outgoing"
        value={totalOutgoingBitrate > 0 ? totalOutgoingBitrate.toLocaleString() : '-'}
        suffix={totalOutgoingBitrate > 0 ? 'kbps' : ''}
        icon="OUT"
        color={totalOutgoingBitrate > 0 ? '#06b6d4' : undefined}
      />
      <StatCard
        label="Input FPS"
        value={isLive && inputFps !== null ? inputFps : '-'}
        icon="FPS"
        color={isLive ? '#a78bfa' : undefined}
      />
      <StatCard
        label="Output FPS"
        value={outputFps !== null ? outputFps : '-'}
        icon="O-FPS"
        color={outputFps !== null ? '#22c55e' : undefined}
      />
      <StatCard
        label="Resolution"
        value={isLive && stream.width && stream.height ? `${stream.width}x${stream.height}` : '-'}
        icon="RES"
        color={isLive ? '#34d399' : undefined}
      />
      <StatCard
        label="Input Dropped"
        value={isLive ? inputDroppedFrames : '-'}
        icon="I-DRP"
        color={isLive && inputDroppedFrames > 0 ? '#f59e0b' : undefined}
        highlight={inputDroppedFrames > 0}
      />
      <StatCard
        label="Output Dropped"
        value={outputFps !== null || connectedCount > 0 ? outputDroppedFrames : '-'}
        icon="O-DRP"
        color={outputDroppedFrames > 0 ? '#f59e0b' : undefined}
        highlight={outputDroppedFrames > 0}
      />
      <StatCard
        label="Input Quality"
        value={isLive ? formatQualityLabel(inputQuality) : '-'}
        icon="I-QLT"
        color={isLive ? getQualityColor(inputQuality) : undefined}
      />
      <StatCard
        label="Output Quality"
        value={connectedCount > 0 ? formatQualityLabel(outputQuality) : '-'}
        icon="O-QLT"
        color={connectedCount > 0 ? getQualityColor(outputQuality) : undefined}
      />
      <StatCard
        label="Average Latency"
        value={latency.value}
        suffix={latency.suffix}
        icon="LAT"
        color={averageLatencyMs !== null ? '#f97316' : undefined}
      />
      <StatCard
        label="Destinations Live"
        value={connectedCount}
        suffix="active"
        icon="LIVE"
        color={connectedCount > 0 ? '#22c55e' : undefined}
      />
      <StatCard
        label="Failed"
        value={failedCount}
        suffix={failedCount > 0 ? 'destinations' : ''}
        icon="ERR"
        color={failedCount > 0 ? '#ef4444' : '#6b7280'}
        highlight={failedCount > 0}
      />
    </div>
  );
};

export default StatsCards;
