// ============================================
// SettingsModal Component — Unified Config
// ============================================

import React, { useEffect, useState } from 'react';
import { AppSettings } from '../../types';
import { api } from '../../utils/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshChatStatus: () => void;
}

function generateRandomStreamKey(length: number = 24): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onRefreshChatStatus }) => {
  // OBS Settings states
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [streamKey, setStreamKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [autoStart, setAutoStart] = useState(true);
  const [autoStop, setAutoStop] = useState(true);
  const [brbMode, setBrbMode] = useState(true);
  const [brbTimeout, setBrbTimeout] = useState('10');

  // YouTube OAuth states
  const [ytAuthStatus, setYtAuthStatus] = useState<{
    clientId: string;
    redirectUri: string;
    authenticated: boolean;
    prochatUrl?: string;
  } | null>(null);
  
  const [ytClientId, setYtClientId] = useState('');
  const [ytClientSecret, setYtClientSecret] = useState('');
  const [ytRedirectUri, setYtRedirectUri] = useState('');
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytSaving, setYtSaving] = useState(false);

  // ProChat states
  const [prochatUrl, setProchatUrl] = useState('');
  const [prochatSaved, setProchatSaved] = useState(false);
  const [prochatError, setProchatError] = useState<string | null>(null);

  // Toggle active configure sections
  const [activeChatConfig, setActiveChatConfig] = useState<'prochat' | 'youtube' | 'twitch' | 'kick' | null>(null);

  useEffect(() => {
    if (isOpen) {
      void loadSettings();
      void loadYtStatus();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
      setStreamKey(data.streamKey);
      setAutoStart(data.settings.autoStartRelay);
      setAutoStop(data.settings.enableAutoStop !== false);
      setBrbMode(data.settings.enableBrbMode !== false);
      setBrbTimeout((data.settings.brbTimeout ?? 10).toString());
    } catch {
      setSettingsError('Failed to load Ingest settings');
    }
  };

  const loadYtStatus = async () => {
    try {
      const data = await api.getYoutubeSettings();
      setYtAuthStatus(data);
      setYtClientId(data.clientId);
      setYtRedirectUri(data.redirectUri || `${window.location.origin}/api/youtube/callback`);
      setProchatUrl(data.prochatUrl || '');
    } catch (err) {
      console.error('Failed to load YouTube status:', err);
    }
  };

  // OBS Ingest saving handlers
  const handleSaveSettings = async () => {
    setSettingsError(null);
    setSavedSettings(false);
    try {
      await api.updateSettings({
        streamKey,
        settings: {
          autoStartRelay: autoStart,
          enableAutoStop: autoStop,
          enableBrbMode: brbMode,
          brbTimeout: parseInt(brbTimeout, 10) || 10,
        }
      });
      setSavedSettings(true);
      setTimeout(() => setSavedSettings(false), 3000);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleRandomize = () => {
    setSavedSettings(false);
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
      setSettingsError('Export failed');
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
        setSavedSettings(true);
        setTimeout(() => setSavedSettings(false), 3000);
      } catch {
        setSettingsError('Import failed - invalid config file');
      }
    };
    input.click();
  };

  // YouTube OAuth saving handlers
  const handleSaveYtAndAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setYtSaving(true);
    setYtError(null);
    try {
      await api.updateYoutubeSettings({
        clientId: ytClientId,
        clientSecret: ytClientSecret,
        redirectUri: ytRedirectUri,
      });
      // Redirect to authorization endpoint
      window.location.href = '/api/youtube/auth';
    } catch (err) {
      setYtError(err instanceof Error ? err.message : 'Failed to save settings');
      setYtSaving(false);
    }
  };

  const handleSaveProchat = async (e: React.FormEvent) => {
    e.preventDefault();
    setProchatError(null);
    setProchatSaved(false);
    try {
      await api.updateYoutubeSettings({
        prochatUrl,
      });
      setProchatSaved(true);
      setTimeout(() => setProchatSaved(false), 3000);
      onRefreshChatStatus();
    } catch (err) {
      setProchatError(err instanceof Error ? err.message : 'Failed to save ProChat URL');
    }
  };

  const handleLogoutYt = async () => {
    if (!window.confirm('De-authorize YouTube Live Chat connection?')) return;
    try {
      await api.logoutYoutube();
      await loadYtStatus();
      onRefreshChatStatus();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (!isOpen) return null;

  const obsUrl = settings?.publicRtmpUrl
    ? settings.publicRtmpUrl
    : (settings ? `rtmp://${window.location.hostname}:${settings.srsRtmpPort}/live` : '');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-xl p-6 relative animate-zoom-in flex flex-col max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-white/[0.06] mb-5">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            ⚙️ System Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm font-bold p-1 select-none"
            title="Close Settings"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          
          {/* OBS Ingest Section */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              OBS Ingest Configuration
            </h3>
            <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl space-y-3.5">
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Ingest Server Link</label>
                <div className="flex items-center gap-1.5">
                  <code className="input-field font-mono text-xs !py-1.5 !px-2 flex-1 truncate select-all">
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
                <label className="text-[10px] text-gray-500 mb-0.5 block">Stream Key (Dashboard)</label>
                <div className="flex items-center gap-1.5">
                  <code className="input-field font-mono text-xs !py-1.5 !px-2 flex-1 truncate select-all">
                    {showKey ? streamKey : '************************'}
                  </code>
                  <button
                    onClick={() => setShowKey((s) => !s)}
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

              <div className="grid grid-cols-2 gap-3 border-t border-white/[0.04] pt-3">
                <div className="flex items-center justify-between p-2 rounded bg-white/[0.01] border border-white/[0.03]">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-300 block">Auto Start Relays</span>
                    <span className="text-[9px] text-gray-500 block">Start relays on stream start</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoStart}
                    onChange={(e) => setAutoStart(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent-light accent-accent-light"
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white/[0.01] border border-white/[0.03]">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-300 block">BRB Fallback Mode</span>
                    <span className="text-[9px] text-gray-500 block">Stream image on disconnect</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={brbMode}
                    onChange={(e) => setBrbMode(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent-light accent-accent-light"
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white/[0.01] border border-white/[0.03]">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-300 block">Auto Stop Relays</span>
                    <span className="text-[9px] text-gray-500 block">Stop relays after timeout</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoStop}
                    onChange={(e) => setAutoStop(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent-light accent-accent-light"
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white/[0.01] border border-white/[0.03]">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-300 block">BRB Timeout (min)</span>
                    <span className="text-[9px] text-gray-500 block">Duration to keep BRB stream</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    disabled={!brbMode && !autoStop}
                    value={brbTimeout}
                    onChange={(e) => setBrbTimeout(e.target.value)}
                    className="w-16 input-field text-xs text-center !py-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04] mt-2">
                <div className="flex items-center gap-2">
                  <button onClick={handleSaveSettings} className="btn-primary text-xs !px-3 !py-1.5">
                    Save Settings
                  </button>
                  {savedSettings && <span className="text-[10px] text-live">Saved!</span>}
                  {settingsError && <span className="text-[10px] text-danger">{settingsError}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={handleExport} className="btn-secondary text-[10px] !px-2.5 !py-1">
                    Export Backup
                  </button>
                  <button onClick={handleImport} className="btn-secondary text-[10px] !px-2.5 !py-1">
                    Import Backup
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Settings Section */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Chat Settings
            </h3>
            
            <div className="flex flex-col gap-2.5">
              
              {/* ProChat Provider Row */}
              <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none">💬</span>
                    <div>
                      <span className="text-xs font-semibold text-gray-200">ProChat Overlay</span>
                      <span className="text-[9px] text-gray-500 block">Embed ProChat.gg combined live comments</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      prochatUrl
                        ? 'bg-live/15 text-live border border-live/25'
                        : 'bg-white/[0.04] text-gray-500 border border-white/5'
                    }`}>
                      {prochatUrl ? 'Configured' : 'Not Configured'}
                    </span>
                    <button
                      onClick={() => setActiveChatConfig(activeChatConfig === 'prochat' ? null : 'prochat')}
                      className="btn-secondary text-xs !px-2.5 !py-1"
                    >
                      {activeChatConfig === 'prochat' ? 'Hide' : 'Configure'}
                    </button>
                  </div>
                </div>

                {activeChatConfig === 'prochat' && (
                  <div className="border-t border-white/[0.04] pt-3.5 mt-1">
                    <form onSubmit={handleSaveProchat} className="space-y-3">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">ProChat Custom Chat Overlay Link</label>
                        <input
                          type="text"
                          required
                          value={prochatUrl}
                          onChange={(e) => setProchatUrl(e.target.value)}
                          className="input-field w-full text-xs font-mono !py-1.5"
                          placeholder="https://prochat.gg/chat/overlay#token=..."
                        />
                        <span className="text-[9px] text-gray-600 mt-1 block">
                          Paste the full overlay widget URL with token from your prochat.gg dashboard.
                        </span>
                      </div>

                      {prochatError && <p className="text-[10px] text-danger">{prochatError}</p>}

                      <div className="flex gap-2 justify-between items-center pt-1 border-t border-white/[0.04] mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="btn-primary text-xs !px-4 !py-1.5"
                          >
                            Save Overlay Link
                          </button>
                          {prochatSaved && <span className="text-[10px] text-live">Saved!</span>}
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* YouTube Provider Row */}
              <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none">▶️</span>
                    <div>
                      <span className="text-xs font-semibold text-gray-200">YouTube Live Chat</span>
                      <span className="text-[9px] text-gray-500 block">Read live comments via YouTube API v3</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      ytAuthStatus?.authenticated
                        ? 'bg-live/15 text-live border border-live/25'
                        : 'bg-white/[0.04] text-gray-500 border border-white/5'
                    }`}>
                      {ytAuthStatus?.authenticated ? 'Connected' : 'Not Configured'}
                    </span>
                    <button
                      onClick={() => setActiveChatConfig(activeChatConfig === 'youtube' ? null : 'youtube')}
                      className="btn-secondary text-xs !px-2.5 !py-1"
                    >
                      {activeChatConfig === 'youtube' ? 'Hide' : 'Configure'}
                    </button>
                  </div>
                </div>

                {activeChatConfig === 'youtube' && (
                  <div className="border-t border-white/[0.04] pt-3.5 mt-1">
                    <form onSubmit={handleSaveYtAndAuth} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">OAuth Client ID</label>
                          <input
                            type="text"
                            required
                            value={ytClientId}
                            onChange={(e) => setYtClientId(e.target.value)}
                            className="input-field w-full text-xs font-mono !py-1.5"
                            placeholder="Client ID"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">OAuth Client Secret</label>
                          <input
                            type="password"
                            required={!ytAuthStatus?.authenticated}
                            value={ytClientSecret}
                            onChange={(e) => setYtClientSecret(e.target.value)}
                            className="input-field w-full text-xs font-mono !py-1.5"
                            placeholder="Client Secret"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Authorized Redirect URI</label>
                        <input
                          type="text"
                          required
                          value={ytRedirectUri}
                          onChange={(e) => setYtRedirectUri(e.target.value)}
                          className="input-field w-full text-xs font-mono !py-1.5"
                        />
                      </div>

                      {ytError && <p className="text-[10px] text-danger">{ytError}</p>}

                      <div className="flex gap-2 justify-between items-center pt-1 border-t border-white/[0.04] mt-2">
                        {ytAuthStatus?.authenticated ? (
                          <button
                            type="button"
                            onClick={handleLogoutYt}
                            className="px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/20 text-red-300 text-xs font-medium transition-all"
                          >
                            Disconnect Account
                          </button>
                        ) : (
                          <div />
                        )}
                        <button
                          type="submit"
                          disabled={ytSaving}
                          className="btn-primary text-xs !px-4 !py-1.5"
                        >
                          {ytSaving ? 'Saving...' : 'Authorize YouTube'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Twitch Provider Row */}
              <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none">💜</span>
                    <div>
                      <span className="text-xs font-semibold text-gray-200">Twitch Live Chat</span>
                      <span className="text-[9px] text-gray-500 block">Read chat via Twitch IRC</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.02] text-gray-600 border border-white/[0.04]">
                      Coming Soon
                    </span>
                    <button
                      onClick={() => setActiveChatConfig(activeChatConfig === 'twitch' ? null : 'twitch')}
                      className="btn-secondary text-xs !px-2.5 !py-1"
                    >
                      {activeChatConfig === 'twitch' ? 'Hide' : 'Configure'}
                    </button>
                  </div>
                </div>

                {activeChatConfig === 'twitch' && (
                  <div className="border-t border-white/[0.04] pt-3 text-xs text-gray-500 leading-relaxed">
                    Twitch live chat integration via Twitch IRC is currently in development and will be available in a future update. No settings configuration is required at this time.
                  </div>
                )}
              </div>

              {/* Kick Provider Row */}
              <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none">💚</span>
                    <div>
                      <span className="text-xs font-semibold text-gray-200">Kick Live Chat</span>
                      <span className="text-[9px] text-gray-500 block">Read chat via Kick WebSockets</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.02] text-gray-600 border border-white/[0.04]">
                      Coming Soon
                    </span>
                    <button
                      onClick={() => setActiveChatConfig(activeChatConfig === 'kick' ? null : 'kick')}
                      className="btn-secondary text-xs !px-2.5 !py-1"
                    >
                      {activeChatConfig === 'kick' ? 'Hide' : 'Configure'}
                    </button>
                  </div>
                </div>

                {activeChatConfig === 'kick' && (
                  <div className="border-t border-white/[0.04] pt-3 text-xs text-gray-500 leading-relaxed">
                    Kick live chat integration is currently in development and will be available in a future update. No settings configuration is required at this time.
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
