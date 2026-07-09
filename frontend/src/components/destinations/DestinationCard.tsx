// ============================================
// DestinationCard Component
// ============================================

import React from 'react';
import { Destination, DestinationState, RelayStatus } from '../../types';
import { PLATFORMS } from '../../utils/constants';
import PlatformIcon from './PlatformIcon';
import { api } from '../../utils/api';

interface DestinationCardProps {
  destination: Destination;
  relayState?: DestinationState;
  onEdit: (dest: Destination) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

const statusConfig: Record<RelayStatus, { label: string; class: string; dot: string }> = {
  idle: { label: 'Idle', class: 'text-gray-400', dot: 'status-dot-idle' },
  connecting: { label: 'Connecting...', class: 'text-warn', dot: 'status-dot-connecting' },
  live: { label: 'Live', class: 'text-live', dot: 'status-dot-live' },
  error: { label: 'Error', class: 'text-danger', dot: 'status-dot-error' },
  reconnecting: { label: 'Reconnecting...', class: 'text-warn', dot: 'status-dot-connecting' },
  stopped: { label: 'Stopped', class: 'text-gray-500', dot: 'status-dot-idle' },
};

const DestinationCard: React.FC<DestinationCardProps> = ({
  destination,
  relayState,
  onEdit,
  onDelete,
  onRefresh,
}) => {
  const status = relayState?.status || 'idle';
  const config = statusConfig[status];
  const platformInfo = PLATFORMS[destination.platform] || PLATFORMS.custom;

  const handleToggle = async () => {
    try {
      await api.toggleDestination(destination.id);
      onRefresh();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${destination.name}"?`)) return;
    try {
      await api.deleteDestination(destination.id);
      onDelete(destination.id);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div
      className={`glass-card-hover p-5 animate-slide-up ${
        status === 'live' ? 'border-live/20' : ''
      } ${status === 'error' ? 'border-danger/20' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Icon + Info */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <PlatformIcon platform={destination.platform} size="lg" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-base font-semibold text-gray-100 truncate">
                {destination.name}
              </h3>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: `${platformInfo.color}20`,
                  color: platformInfo.color,
                }}
              >
                {platformInfo.name}
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 mb-2">
              <span className={config.dot} />
              <span className={`text-sm font-medium ${config.class}`}>
                {config.label}
              </span>
              {relayState?.reconnectAttempts ? (
                <span className="text-xs text-gray-500">
                  (attempt {relayState.reconnectAttempts})
                </span>
              ) : null}
            </div>

            {/* Error message */}
            {relayState?.lastError && status === 'error' && (
              <p className="text-xs text-danger/80 mt-1 truncate">
                ⚠ {relayState.lastError}
              </p>
            )}

            {/* Server URL (truncated) */}
            <p className="text-xs text-gray-600 truncate font-mono mt-1">
              {destination.serverUrl}
            </p>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex flex-col items-end gap-3">
          {/* Toggle */}
          <button
            onClick={handleToggle}
            className={
              destination.enabled ? 'toggle-switch-enabled' : 'toggle-switch-disabled'
            }
            title={destination.enabled ? 'Disable' : 'Enable'}
          >
            <span
              className={destination.enabled ? 'toggle-knob-on' : 'toggle-knob-off'}
            />
          </button>

          {/* Edit / Delete */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(destination)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.04]"
            >
              ✏️ Edit
            </button>
            <button
              onClick={handleDelete}
              className="text-xs text-gray-500 hover:text-danger transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.04]"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DestinationCard;
