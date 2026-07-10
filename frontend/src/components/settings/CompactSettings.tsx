// ============================================
// CompactSettings Component — OBS Ingest Config
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

const CompactSettings: React.FC = () => {
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
      <div className="glass-card p-4 text-center text-xs text-gray-500">
        Loading Ingest Settings...
      </div>
    );
  }

  const obsUrl = settings
    ? `rtmp://${window.location.hostname}:${settings.srsRtmpPort}/live`
    : '';

  return (
    <div className="glass-card p-4 flex flex-col gap-3 min-h-0">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        OBS Ingest Configuration
      </h3>

      <div className="flex flex-col gap-2">
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Server URL</label>
          <div className="flex items-center gap-1.5">
            <code className="input-field font-mono text-[11px] !py-1.5 !px-2 !bg-white/[0.01] flex-1 truncate select-all">
              {obsUrl}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(obsUrl)}
              className="btn-secondary text-[11px] !px-2.5 !py-1.5 shrink-0"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Stream Key</label>
          <div className="flex items-center gap-1.5">
            <code className="input-field font-mono text-[11px] !py-1.5 !px-2 !bg-white/[0.01] flex-1 truncate select-all">
              {showKey ? streamKey : '************************'}
            </code>
            <button
              onClick={() => setShowKey((current) => !current)}
              className="btn-secondary text-[11px] !px-2.5 !py-1.5 shrink-0"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(streamKey)}
              className="btn-secondary text-[11px] !px-2.5 !py-1.5 shrink-0"
            >
              Copy
            </button>
            <button
              onClick={handleRandomize}
              className="btn-secondary text-[11px] !px-2.5 !py-1.5 shrink-0"
            >
              Rand
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="btn-primary text-[11px] !px-3 !py-1.5">
              Save Key
            </button>
            {saved && (
              <span className="text-[10px] text-live animate-fade-in">Saved!</span>
            )}
            {error && (
              <span className="text-[10px] text-danger animate-fade-in">{error}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleExport} className="btn-secondary text-[10px] !px-2 !py-1">
              Export Backup
            </button>
            <button onClick={handleImport} className="btn-secondary text-[10px] !px-2 !py-1">
              Import Backup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactSettings;
