// ============================================
// SettingsPanel Component
// ============================================

import React, { useEffect, useState } from 'react';
import { AppSettings } from '../../types';
import { api } from '../../utils/api';

function generateRandomStreamKey(length: number = 24): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [streamKey, setStreamKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
      setStreamKey(data.streamKey);
    } catch {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaved(false);

    try {
      await api.updateSettings({ streamKey });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleRandomize = () => {
    setSaved(false);
    setStreamKey(generateRandomStreamKey());
  };

  const handleExport = async () => {
    try {
      const config = await api.exportConfig();
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `restream-config-${new Date().toISOString().split('T')[0]}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const config = JSON.parse(text);
        await api.importConfig(config);
        await loadSettings();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch {
        setError('Import failed - invalid config file');
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="glass-card p-12 text-center text-gray-500">
        Loading settings...
      </div>
    );
  }

  const obsUrl = settings?.publicRtmpUrl
    ? settings.publicRtmpUrl
    : (settings ? `rtmp://${window.location.hostname}:${settings.srsRtmpPort}/live` : '');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-gray-100">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure the OBS ingest server and restream behavior.
        </p>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          OBS Ingest
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Server Link</label>
            <div className="flex items-center gap-2">
              <code className="input-field font-mono text-xs !bg-white/[0.02] flex-1">
                {obsUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(obsUrl)}
                className="btn-secondary text-xs !px-3 !py-3"
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Stream Key</label>
            <div className="flex items-center gap-2">
              <code className="input-field font-mono text-xs !bg-white/[0.02] flex-1 overflow-hidden text-ellipsis">
                {showKey ? streamKey : '************************'}
              </code>
              <button
                onClick={() => setShowKey((current) => !current)}
                className="btn-secondary text-xs !px-3 !py-3"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(streamKey)}
                className="btn-secondary text-xs !px-3 !py-3"
              >
                Copy
              </button>
              <button
                onClick={handleRandomize}
                className="btn-secondary text-xs !px-3 !py-3"
              >
                Randomize
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} className="btn-primary">
              Save Stream Key
            </button>
            <p className="text-xs text-gray-600">
              This dashboard key is the OBS key. Docker env files do not override it.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Configuration
        </h3>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="btn-secondary">
            Export Config
          </button>
          <button onClick={handleImport} className="btn-secondary">
            Import Config
          </button>
        </div>
      </div>

      {saved && (
        <p className="text-sm text-live animate-fade-in">Settings saved successfully.</p>
      )}
      {error && (
        <p className="text-sm text-danger animate-fade-in">{error}</p>
      )}
    </div>
  );
};

export default SettingsPanel;
