// ============================================
// App.tsx — Main Application
// ============================================

import React, { useCallback, useState } from 'react';
import Layout from './components/layout/Layout';
import QuickActions from './components/dashboard/QuickActions';
import DestinationList from './components/destinations/DestinationList';
import LogViewer from './components/logs/LogViewer';
import SettingsModal from './components/settings/SettingsModal';
import AssetsModal from './components/settings/AssetsModal';
import UptimeTimer from './components/dashboard/UptimeTimer';
import LiveChatPanel from './components/dashboard/LiveChatPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { MonitorStats } from './types';

// Default empty stats
const emptyStats: MonitorStats = {
  stream: {
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
  },
  destinations: [],
  connectedCount: 0,
  failedCount: 0,
  totalOutgoingBitrate: 0,
  uptime: 0,
  incomingUptime: 0,
  outgoingUptime: 0,
  inputFps: null,
  outputFps: null,
  inputDroppedFrames: 0,
  outputDroppedFrames: 0,
  inputQuality: null,
  outputQuality: null,
  averageLatencyMs: null,
  brbActive: false,
  brbTimeRemaining: 0,
};

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const App: React.FC = () => {
  const { connected, stats, logs, chatMessages, clearLogs, clearChat } = useWebSocket();
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [assetsModalOpen, setAssetsModalOpen] = useState(false);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);

  const currentStats = stats || emptyStats;
  const streamStatus = currentStats.stream.status;
  const brbActive = currentStats.brbActive === true;
  const brbTimeRemaining = currentStats.brbTimeRemaining ?? 0;
  const ingestStatus = brbActive ? 'brb' : streamStatus;

  const handleRelayAction = useCallback(() => {
    // Stats will update via WebSocket automatically
  }, []);

  // Determine if relay is active based on destination states
  const relayActive = currentStats.destinations.some(
    (d) =>
      d.status === 'live' ||
      d.status === 'connecting' ||
      d.status === 'reconnecting' ||
      d.status === 'brb'
  );

  return (
    <Layout
      streamStatus={streamStatus}
      wsConnected={connected}
      onOpenSettings={() => setSettingsModalOpen(true)}
      onOpenAssets={() => setAssetsModalOpen(true)}
    >
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 h-full">
        {/* Left Column: Ingest Status and Controls */}
        <div className="col-span-4 flex flex-col gap-4 min-h-0">
          
          {/* Card 1: Ingest Status & Live Stats */}
          <div className="glass-card p-4 flex flex-col gap-3 min-h-0 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                OBS Ingest Status
              </h3>
              {ingestStatus === 'live' ? (
                <div className="live-badge text-xs !px-2.5 !py-0.5">
                  <span className="status-dot-live animate-pulse-live" />
                  LIVE
                </div>
              ) : ingestStatus === 'brb' ? (
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-warn/15 text-warn font-bold text-xs tracking-wider uppercase">
                  <span className="status-dot-connecting" />
                  BRB ({formatCountdown(brbTimeRemaining)} remaining)
                </div>
              ) : (
                <div className="offline-badge text-xs !px-2.5 !py-0.5">
                  <span className="status-dot-idle" />
                  OFFLINE
                </div>
              )}
            </div>

            <div className="flex justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3 text-xs">
              <span className="text-gray-500">OBS Connection:</span>
              <span className={streamStatus === 'live' ? 'text-live font-semibold' : 'text-gray-300 font-semibold'}>
                {streamStatus === 'live' ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Uptime Timers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3 text-center">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
                  Incoming Uptime
                </span>
                <UptimeTimer
                  seconds={currentStats.incomingUptime}
                  active={streamStatus === 'live'}
                  className="text-lg font-bold font-mono text-gradient tabular-nums"
                />
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3 text-center">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
                  Outgoing Uptime
                </span>
                <UptimeTimer
                  seconds={currentStats.outgoingUptime}
                  active={(streamStatus === 'live' || brbActive) && currentStats.connectedCount > 0}
                  className="text-lg font-bold font-mono text-gradient tabular-nums"
                />
              </div>
            </div>

            {/* Key Stream Metrics */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-white/[0.04] pt-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Resolution:</span>
                <span className="text-gray-300 font-semibold">
                  {streamStatus === 'live' && currentStats.stream.width && currentStats.stream.height
                    ? `${currentStats.stream.width}x${currentStats.stream.height}`
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">FPS:</span>
                <span className="text-gray-300 font-semibold">
                  {streamStatus === 'live' && currentStats.inputFps !== null ? currentStats.inputFps : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bitrate:</span>
                <span className="text-gray-300 font-semibold">
                  {streamStatus === 'live' && currentStats.stream.totalBitrate !== null
                    ? `${currentStats.stream.totalBitrate.toLocaleString()} kbps`
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Codec:</span>
                <span className="text-gray-300 font-semibold truncate max-w-[80px]">
                  {streamStatus === 'live' && currentStats.stream.videoCodec ? currentStats.stream.videoCodec : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avg Latency:</span>
                <span className="text-gray-300 font-semibold">
                  {currentStats.averageLatencyMs !== null
                    ? currentStats.averageLatencyMs < 1000
                      ? `${currentStats.averageLatencyMs}ms`
                      : `${(currentStats.averageLatencyMs / 1000).toFixed(1)}s`
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dropped:</span>
                <span className={`font-semibold ${currentStats.inputDroppedFrames > 0 ? 'text-warn' : 'text-gray-300'}`}>
                  {streamStatus === 'live' ? currentStats.inputDroppedFrames : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Operations (QuickActions) */}
          <QuickActions
            isLive={streamStatus === 'live'}
            relayActive={relayActive}
            brbActive={brbActive}
            onAction={handleRelayAction}
          />
        </div>

        {/* Center Column: Relay Destinations list */}
        <div className="col-span-4 glass-card p-4 flex flex-col min-h-0 h-full">
          <DestinationList relayStates={currentStats.destinations} />
        </div>

        {/* Right Column: Live Chat Panel */}
        <div className="col-span-4 glass-card p-4 flex flex-col min-h-0 h-full">
          <LiveChatPanel
            key={chatRefreshKey}
            chatMessages={chatMessages}
            onClearChat={clearChat}
            onOpenLogs={() => setLogsModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
          />
        </div>
      </div>

      {/* Logs View Modal */}
      {logsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-3xl p-6 relative animate-zoom-in flex flex-col max-h-[85vh] h-[600px] border border-white/10 shadow-2xl">
            <button
              onClick={() => setLogsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 text-base font-bold transition-colors select-none"
              title="Close Logs"
            >
              ✕
            </button>
            <div className="flex-1 min-h-0 h-full mt-2">
              <LogViewer logs={logs} onClear={clearLogs} />
            </div>
          </div>
        </div>
      )}

      {/* Settings View Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onRefreshChatStatus={() => setChatRefreshKey((k) => k + 1)}
      />

      <AssetsModal
        isOpen={assetsModalOpen}
        onClose={() => setAssetsModalOpen(false)}
      />
    </Layout>
  );
};

export default App;
