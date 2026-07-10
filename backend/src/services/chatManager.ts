// ============================================
// ChatManager — Manages Chat Providers & WS Broadcasts
// ============================================

import { YouTubeChatProvider } from './youtubeChat';
import { broadcast, setChatHistoryGetter } from '../websocket';
import { getConfig } from '../config/manager';
import { createLogger } from '../utils/logger';
import { ChatMessage } from '../types';

const log = createLogger('ChatManager');

class ChatManager {
  private youtubeProvider: YouTubeChatProvider | null = null;
  private started = false;
  private chatHistory: ChatMessage[] = [];

  constructor() {
    this.youtubeProvider = new YouTubeChatProvider();
    
    // Wire message events to broadcast via WebSockets
    this.youtubeProvider.onMessage((msg) => {
      // Store in history cache
      this.chatHistory.push(msg);
      if (this.chatHistory.length > 200) {
        this.chatHistory.shift();
      }

      // Step 6: WebSocket broadcast chat:new message
      broadcast({
        type: 'chat:new',
        data: msg,
      });
    });

    // Register history getter to avoid circular dependencies
    setChatHistoryGetter(() => this.chatHistory);
  }

  /**
   * Initializes and connects chat providers if credentials exist.
   */
  public async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    log.info('Starting Chat Manager...');

    const config = getConfig();
    const ytSettings = config.youtubeChat;

    // Check if YouTube integration is configured (requires refresh token)
    if (ytSettings && ytSettings.refreshToken) {
      try {
        await this.youtubeProvider?.connect();
        log.success('YouTube Live Chat provider connected');
      } catch (err) {
        log.error(`Failed to connect YouTube Live Chat: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      log.info('YouTube Live Chat is not configured (missing OAuth credentials/tokens)');
    }
  }

  /**
   * Disconnects all active chat providers.
   */
  public async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    log.info('Stopping Chat Manager...');

    await this.youtubeProvider?.disconnect();
  }

  /**
   * Reconnects/Restarts the chat providers (useful after config/token updates).
   */
  public async restart(): Promise<void> {
    log.info('Restarting Chat Manager...');
    const config = getConfig();
    const ytSettings = config.youtubeChat;

    if (ytSettings && ytSettings.refreshToken) {
      await this.youtubeProvider?.reconnect();
    } else {
      await this.youtubeProvider?.disconnect();
      log.info('YouTube chat provider disconnected because credentials are no longer present.');
    }
  }
}

export const chatManager = new ChatManager();
export { ChatManager };
