// ============================================
// QuickActions Component — Stream control buttons
// ============================================

import React, { useState } from 'react';
import { api } from '../../utils/api';

interface QuickActionsProps {
  isLive: boolean;
  relayActive: boolean;
  onAction: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ isLive, relayActive, onAction }) => {
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
          disabled={!isLive || relayActive || loading !== null}
          className="btn-primary flex items-center gap-2"
        >
          {loading === 'start' ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <span>▶</span>
          )}
          Start Relay
        </button>

        <button
          onClick={() => handleAction('stop')}
          disabled={!relayActive || loading !== null}
          className="btn-danger flex items-center gap-2"
        >
          {loading === 'stop' ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <span>■</span>
          )}
          Stop Relay
        </button>

        <button
          onClick={() => handleAction('restart')}
          disabled={!relayActive || loading !== null}
          className="btn-warn flex items-center gap-2"
        >
          {loading === 'restart' ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <span>🔄</span>
          )}
          Restart
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger animate-fade-in">
          ⚠ {error}
        </p>
      )}

      {!isLive && (
        <p className="mt-3 text-xs text-gray-500">
          Connect OBS to enable relay controls
        </p>
      )}
    </div>
  );
};

export default QuickActions;
