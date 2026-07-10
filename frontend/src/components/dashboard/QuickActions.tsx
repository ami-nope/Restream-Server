// ============================================
// QuickActions Component - Stream control buttons
// ============================================

import React, { useState } from 'react';
import { api } from '../../utils/api';

interface QuickActionsProps {
  isLive: boolean;
  relayActive: boolean;
  brbActive: boolean;
  onAction: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  isLive,
  relayActive,
  brbActive,
  onAction,
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setLoading(action);
    setError(null);

    try {
      switch (action) {
        case 'start':
          await api.startRelay();
          break;
        case 'stop':
          await api.stopRelay();
          break;
        case 'restart':
          await api.restartRelay();
          break;
      }
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Stream Controls
      </h3>

      <div className="flex items-center gap-3">
        <button
          onClick={() => handleAction('start')}
          disabled={!isLive || (relayActive && !brbActive) || loading !== null}
          className="btn-primary flex items-center gap-2"
        >
          {loading === 'start' ? 'Starting...' : brbActive ? 'Resume Live Relay' : 'Start Relay'}
        </button>

        <button
          onClick={() => handleAction('stop')}
          disabled={!relayActive || loading !== null}
          className="btn-danger flex items-center gap-2"
        >
          {loading === 'stop' ? 'Stopping...' : 'Stop Relay'}
        </button>

        <button
          onClick={() => handleAction('restart')}
          disabled={!relayActive || loading !== null}
          className="btn-warn flex items-center gap-2"
        >
          {loading === 'restart' ? 'Restarting...' : 'Restart'}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger animate-fade-in">
          {error}
        </p>
      )}

      {!isLive && !brbActive && (
        <p className="mt-3 text-xs text-gray-500">
          Connect OBS to enable relay controls
        </p>
      )}

      {brbActive && (
        <p className="mt-3 text-xs text-warn">
          BRB fallback is keeping destinations connected while OBS is disconnected.
        </p>
      )}
    </div>
  );
};

export default QuickActions;
