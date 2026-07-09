// ============================================
// DestinationModal — Add/Edit destination
// ============================================

import React, { useState, useEffect } from 'react';
import { Destination, PlatformPreset } from '../../types';
import { PLATFORM_LIST, PLATFORMS } from '../../utils/constants';
import { api } from '../../utils/api';

interface DestinationModalProps {
  isOpen: boolean;
  destination: Destination | null;  // null = add mode
  onClose: () => void;
  onSaved: () => void;
}

const DestinationModal: React.FC<DestinationModalProps> = ({
  isOpen,
  destination,
  onClose,
  onSaved,
}) => {
  const isEdit = !!destination;

  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<PlatformPreset>('custom');
  const [serverUrl, setServerUrl] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (destination) {
      setName(destination.name);
      setPlatform(destination.platform);
      setServerUrl(destination.serverUrl);
      setStreamKey(destination.streamKey);
      setEnabled(destination.enabled);
    } else {
      setName('');
      setPlatform('custom');
      setServerUrl('');
      setStreamKey('');
      setEnabled(true);
    }
    setShowKey(false);
    setError(null);
  }, [destination, isOpen]);

  // Auto-fill server URL when platform changes
  const handlePlatformChange = (p: PlatformPreset) => {
    setPlatform(p);
    const info = PLATFORMS[p];
    if (info.defaultUrl && !isEdit) {
      setServerUrl(info.defaultUrl);
      if (!name || PLATFORM_LIST.some((pl) => pl.name === name)) {
        setName(info.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEdit && destination) {
        await api.updateDestination(destination.id, {
          name,
          platform,
          serverUrl,
          streamKey,
          enabled,
        });
      } else {
        await api.addDestination({
          name,
          platform,
          serverUrl,
          streamKey,
          enabled,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="glass-card w-full max-w-lg p-6 relative animate-slide-up z-10">
        <h2 className="text-xl font-bold text-gray-100 mb-6">
          {isEdit ? 'Edit Destination' : 'Add Destination'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Platform selector */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORM_LIST.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePlatformChange(p.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    platform === p.id
                      ? 'bg-accent/15 border border-accent/30 text-accent-light'
                      : 'bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My YouTube Channel"
              className="input-field"
              required
            />
          </div>

          {/* Server URL */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">RTMP Server URL</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="rtmp://a.rtmp.youtube.com/live2"
              className="input-field font-mono text-xs"
              required
            />
          </div>

          {/* Stream Key */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Stream Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                className="input-field font-mono text-xs pr-20"
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showKey ? '🙈 Hide' : '👁️ Show'}
              </button>
            </div>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Enabled</span>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={enabled ? 'toggle-switch-enabled' : 'toggle-switch-disabled'}
            >
              <span className={enabled ? 'toggle-knob-on' : 'toggle-knob-off'} />
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-danger animate-fade-in">⚠ {error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? '⏳ Saving...' : isEdit ? 'Save Changes' : 'Add Destination'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DestinationModal;
