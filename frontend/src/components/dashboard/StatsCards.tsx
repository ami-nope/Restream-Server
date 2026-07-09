// ============================================
// StatsCards Component — Grid of stat cards
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

const StatCard: React.FC<StatCardProps> = ({ label, value, suffix, icon, color, highlight }) => {
  return (
    <div className={`glass-card-hover p-5 animate-slide-up ${highlight ? 'border-danger/30' : ''}`}>
      <div className="flex items-start justify-between">
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
        <span className="text-2xl opacity-60">{icon}</span>
      </div>
    </div>
  );
};

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const { stream, connectedCount, failedCount, totalOutgoingBitrate } = stats;
  const isLive = stream.status === 'live';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard
        label="Incoming Bitrate"
        value={isLive && stream.totalBitrate ? stream.totalBitrate.toLocaleString() : '—'}
        suffix={isLive && stream.totalBitrate ? 'kbps' : ''}
        icon="📥"
        color={isLive ? '#60a5fa' : undefined}
      />
      <StatCard
        label="FPS"
        value={isLive && stream.fps ? stream.fps : '—'}
        icon="🎬"
        color={isLive ? '#a78bfa' : undefined}
      />
      <StatCard
        label="Resolution"
        value={
          isLive && stream.width && stream.height
            ? `${stream.width}×${stream.height}`
            : '—'
        }
        icon="📺"
        color={isLive ? '#34d399' : undefined}
      />
      <StatCard
        label="Connected"
        value={connectedCount}
        suffix="platforms"
        icon="🟢"
        color="#22c55e"
      />
      <StatCard
        label="Failed"
        value={failedCount}
        suffix={failedCount > 0 ? 'platforms' : ''}
        icon="🔴"
        color={failedCount > 0 ? '#ef4444' : '#6b7280'}
        highlight={failedCount > 0}
      />
      <StatCard
        label="Total Outgoing"
        value={totalOutgoingBitrate ? totalOutgoingBitrate.toLocaleString() : '—'}
        suffix={totalOutgoingBitrate ? 'kbps' : ''}
        icon="📤"
        color={totalOutgoingBitrate ? '#06b6d4' : undefined}
      />
    </div>
  );
};

export default StatsCards;
