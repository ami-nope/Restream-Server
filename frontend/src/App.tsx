// ============================================
// App.tsx — Main Application
// ============================================

import React, { useState, useCallback } from 'react';
import Layout from './components/layout/Layout';
import { Page } from './components/layout/Sidebar';
import StreamStatus from './components/dashboard/StreamStatus';
import StatsCards from './components/dashboard/StatsCards';
import QuickActions from './components/dashboard/QuickActions';
import DestinationList from './components/destinations/DestinationList';
import LogViewer from './components/logs/LogViewer';
import SettingsPanel from './components/settings/SettingsPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { MonitorStats } from './types';

// Default empty stats
const emptyStats: MonitorStats = {
  stream: {
    status: 'offline',
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
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const { connected, stats, logs, clearLogs } = useWebSocket();

  const currentStats = stats || emptyStats;
  const streamStatus = currentStats.stream.status;

  // Callback when relay action is performed
  const handleRelayAction = useCallback(() => {
    // Stats will update via WebSocket automatically
  }, []);

  // Determine if relay is active based on destination states
  const relayActive = currentStats.destinations.some(
    (d) => d.status === 'live' || d.status === 'connecting' || d.status === 'reconnecting'
  );

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      streamStatus={streamStatus}
      wsConnected={connected}
    >
      {currentPage === 'dashboard' && (
        <div className="space-y-6 animate-fade-in">
          <StreamStatus
            stream={currentStats.stream}
            uptime={currentStats.uptime}
          />
          <StatsCards stats={currentStats} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <QuickActions
              isLive={streamStatus === 'live'}
              relayActive={relayActive}
              onAction={handleRelayAction}
            />
            {/* Mini destination overview */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Destination Overview
              </h3>
              {currentStats.destinations.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No destinations configured.{' '}
                  <button
                    onClick={() => setCurrentPage('destinations')}
                    className="text-accent-light hover:underline"
                  >
                    Add one →
                  </button>
                </p>
              ) : (
                <div className="space-y-2">
                  {currentStats.destinations.map((d) => {
                    const statusColors: Record<string, string> = {
                      live: 'text-live',
                      connecting: 'text-warn',
                      reconnecting: 'text-warn',
                      error: 'text-danger',
                      idle: 'text-gray-500',
                      stopped: 'text-gray-500',
                    };
                    const dotClasses: Record<string, string> = {
                      live: 'status-dot-live',
                      connecting: 'status-dot-connecting',
                      reconnecting: 'status-dot-connecting',
                      error: 'status-dot-error',
                      idle: 'status-dot-idle',
                      stopped: 'status-dot-idle',
                    };

                    return (
                      <div
                        key={d.id}
                        className="flex items-center justify-between py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className={dotClasses[d.status] || 'status-dot-idle'} />
                          <span className="text-sm text-gray-300 truncate">{d.id.slice(0, 8)}</span>
                        </div>
                        <span
                          className={`text-xs font-medium capitalize ${
                            statusColors[d.status] || 'text-gray-500'
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentPage === 'destinations' && (
        <div className="animate-fade-in">
          <DestinationList relayStates={currentStats.destinations} />
        </div>
      )}

      {currentPage === 'logs' && (
        <div className="animate-fade-in h-full">
          <LogViewer logs={logs} onClear={clearLogs} />
        </div>
      )}

      {currentPage === 'settings' && (
        <div className="animate-fade-in">
          <SettingsPanel />
        </div>
      )}
    </Layout>
  );
};

export default App;
