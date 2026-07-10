import React, { useEffect, useState } from 'react';
import { api } from '../../utils/api';

interface LiveChatPanelProps {
  chatMessages: any[];
  onClearChat: () => void;
  onOpenLogs: () => void;
  onOpenSettings: () => void;
}

const LiveChatPanel: React.FC<LiveChatPanelProps> = ({
  onOpenLogs,
  onOpenSettings,
}) => {
  const [prochatUrl, setProchatUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const loadUrl = async () => {
    try {
      const data = await api.getYoutubeSettings();
      setProchatUrl(data.prochatUrl || '');
    } catch (err) {
      console.error('Failed to load ProChat URL:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUrl();
    window.addEventListener('focus', loadUrl);
    return () => {
      window.removeEventListener('focus', loadUrl);
    };
  }, []);

  // Extract the token hash to proxy the template with credentials intact
  const tokenHash = prochatUrl.includes('#') ? '#' + prochatUrl.split('#')[1] : '';
  const directUrl = prochatUrl || 'https://prochat.gg/chat/overlay';
  const proxyUrl = `/api/youtube/chat-proxy${tokenHash}`;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Live Chat</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Combined stream comments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onOpenLogs} className="btn-secondary text-[11px] !px-2.5 !py-1" title="View Server Logs">
            Logs
          </button>
          <button onClick={onOpenSettings} className="btn-secondary text-[11px] !px-2.5 !py-1" title="Open Settings">
            Settings
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex-1 glass-card flex flex-col items-center justify-center text-gray-500 border border-white/5 bg-black/40 rounded-xl">
          <span className="text-xs">Loading Live Chat...</span>
        </div>
      ) : !prochatUrl ? (
        <div className="flex-1 glass-card p-6 flex flex-col items-center justify-center text-center border border-white/10 bg-black/20 rounded-xl">
          <span className="text-4xl mb-3">💬</span>
          <p className="text-sm font-semibold text-gray-300">ProChat Overlay not configured</p>
          <p className="text-[10px] text-gray-500 max-w-[240px] mt-1 leading-relaxed mb-4">
            Embed your custom ProChat.gg combined live comments widget directly into your dashboard.
          </p>
          <button
            onClick={onOpenSettings}
            className="btn-primary text-xs !px-4 !py-1.5"
          >
            Configure Chat Settings
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative flex flex-col gap-4 h-full">
          {/* Popout Button for easy access */}
          <div className="glass-card p-4 text-center shrink-0 flex flex-col items-center justify-center border border-white/10 bg-white/[0.01]">
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              ProChat security headers may block local frames. Launch your overlay in a dedicated popout window if needed:
            </p>
            <button
              onClick={() => {
                window.open(
                  directUrl,
                  'ProChatOverlay',
                  'width=450,height=700,menubar=no,toolbar=no,location=no,status=no'
                );
              }}
              className="btn-primary text-xs !px-5 !py-2 flex items-center gap-2 select-none shadow-lg"
            >
              💬 Open Popout Live Chat
            </button>
          </div>

          {/* Proxied Iframe Viewport */}
          <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-white/5 bg-black/40 relative">
            <iframe
              src={proxyUrl}
              title="ProChat Live Chat Overlay"
              className="w-full h-full border-0"
              key={proxyUrl}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveChatPanel;
