// ============================================
// YouTubeChatProvider — Live Chat Polling via API
// ============================================

import { ChatMessage, ChatProvider, YouTubeChatSettings } from '../types';
import { getConfig, saveConfig } from '../config/manager';
import { createLogger } from '../utils/logger';

const log = createLogger('YouTubeChat');

/**
 * Helper: Refreshes the Google OAuth access token using the stored refresh token.
 */
async function refreshAccessToken(settings: YouTubeChatSettings): Promise<string> {
  if (!settings.refreshToken) {
    throw new Error('No refresh token available');
  }

  log.info('Refreshing YouTube access token...');

  const params = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    refresh_token: settings.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };

  settings.accessToken = data.access_token;
  settings.expiresAt = Date.now() + data.expires_in * 1000;
  
  // Persist updated credentials to JSON file
  saveConfig();
  log.success('YouTube access token refreshed successfully');
  return data.access_token;
}

/**
 * Helper: Returns a valid access token. Automatically refreshes it if it is expired or close to expiring.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const config = getConfig();
  const settings = config.youtubeChat;
  if (!settings || !settings.refreshToken) {
    return null;
  }

  // Refresh if less than 5 minutes remain on the token
  const bufferMs = 5 * 60 * 1000; 
  const isExpired = !settings.expiresAt || Date.now() + bufferMs >= settings.expiresAt;

  if (isExpired || !settings.accessToken) {
    try {
      return await refreshAccessToken(settings);
    } catch (err) {
      log.error(`Failed to refresh YouTube access token: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  return settings.accessToken;
}

/**
 * YouTubeChatProvider class implementing standard ChatProvider interface
 */
export class YouTubeChatProvider implements ChatProvider {
  private active = false;
  private messageCallback: ((msg: ChatMessage) => void) | null = null;
  private activeChatId: string | null = null;
  private pollTimeout: ReturnType<typeof setTimeout> | null = null;
  private findStreamInterval: ReturnType<typeof setInterval> | null = null;
  private nextPageToken: string | null = null;
  private seenIds = new Set<string>();

  constructor() {}

  public onMessage(callback: (msg: ChatMessage) => void): void {
    this.messageCallback = callback;
  }

  public async connect(): Promise<void> {
    if (this.active) return;
    this.active = true;
    log.info('Connecting to YouTube chat provider...');
    this.seenIds.clear();
    this.nextPageToken = null;
    this.activeChatId = null;

    // Start looking for active live stream broadcast
    await this.startFindingStream();
  }

  public async disconnect(): Promise<void> {
    if (!this.active) return;
    this.active = false;
    log.info('Disconnecting from YouTube chat provider...');

    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    if (this.findStreamInterval) {
      clearInterval(this.findStreamInterval);
      this.findStreamInterval = null;
    }
  }

  public async reconnect(): Promise<void> {
    log.info('Reconnecting YouTube chat...');
    await this.disconnect();
    await this.connect();
  }

  /**
   * Periodically checks for active live broadcast streams every 10 seconds.
   */
  private async startFindingStream(): Promise<void> {
    if (this.findStreamInterval) {
      clearInterval(this.findStreamInterval);
    }

    // Try finding active stream key immediately
    const found = await this.findActiveLiveChatId();
    if (found) return;

    log.info('No active YouTube stream found. Retrying in 10s...');
    this.findStreamInterval = setInterval(async () => {
      if (!this.active) {
        if (this.findStreamInterval) clearInterval(this.findStreamInterval);
        return;
      }
      const foundLater = await this.findActiveLiveChatId();
      if (foundLater && this.findStreamInterval) {
        clearInterval(this.findStreamInterval);
        this.findStreamInterval = null;
      }
    }, 10000); // Poll active stream status every 10 seconds
  }

  /**
   * Calls YouTube Data API to check for an active broadcast stream.
   */
  private async findActiveLiveChatId(): Promise<boolean> {
    try {
      const token = await getValidAccessToken();
      if (!token) {
        return false;
      }

      // Query with mine=true to get the user's broadcasts, including status
      const url = 'https://www.googleapis.com/youtube/v3/liveBroadcasts?' + new URLSearchParams({
        part: 'snippet,status',
        mine: 'true',
        maxResults: '50',
      }).toString();

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        log.warn(`Authorization rejected during broadcast look-up: Status ${res.status}.`);
        return false;
      }

      if (!res.ok) {
        const text = await res.text();
        log.error(`Failed to fetch active broadcasts: ${res.status} - ${text}`);
        return false;
      }

      const data = (await res.json()) as {
        items?: Array<{
          snippet?: {
            liveChatId?: string;
          };
          status?: {
            lifeCycleStatus?: string;
          };
        }>;
      };

      // Find the first broadcast that is currently active/live and has a chat ID
      const activeBroadcast = data.items?.find(
        (item) => item.status?.lifeCycleStatus === 'live' && item.snippet?.liveChatId
      );

      const liveChatId = activeBroadcast?.snippet?.liveChatId;
      if (liveChatId) {
        this.activeChatId = liveChatId;
        log.success(`Found active YouTube Live Chat ID: ${liveChatId}`);
        // Start polling chat messages
        void this.pollChatMessages();
        return true;
      }

      return false;
    } catch (err) {
      log.error(`Error finding active YouTube live stream: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  /**
   * Polls chat messages from YouTube using nextPageToken and respecting the polling intervals.
   */
  private async pollChatMessages(): Promise<void> {
    if (!this.active || !this.activeChatId) return;

    let nextPollMs = 4000; // Default fallback to 4 seconds

    try {
      const token = await getValidAccessToken();
      if (!token) {
        log.warn('YouTube token refresh failed during chat poll. Retrying in 10s...');
        this.pollTimeout = setTimeout(() => this.pollChatMessages(), 10000);
        return;
      }

      const params: Record<string, string> = {
        liveChatId: this.activeChatId,
        part: 'snippet,authorDetails',
        maxResults: '200',
      };
      if (this.nextPageToken) {
        params.pageToken = this.nextPageToken;
      }

      const url = 'https://www.googleapis.com/youtube/v3/liveChat/messages?' + new URLSearchParams(params).toString();
      log.info(`Polling YouTube chat. pageToken: ${this.nextPageToken || 'none'}, activeChatId: ${this.activeChatId}`);
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Handle authentication or authorization failures
      if (res.status === 401 || res.status === 403) {
        log.error(`YouTube API credentials rejected (${res.status}). Waiting 5 seconds before retrying...`);
        this.pollTimeout = setTimeout(() => this.pollChatMessages(), 5000);
        return;
      }

      // Handle Rate Limiting
      if (res.status === 429) {
        log.warn('YouTube API Rate Limited (429). Waiting 15 seconds...');
        this.pollTimeout = setTimeout(() => this.pollChatMessages(), 15000);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        log.error(`Failed to poll live chat messages: ${res.status} - ${text}`);
        
        // If chat id is no longer valid (e.g. stream ended / chat closed), return to searching
        if (res.status === 404 || text.includes('liveChatNotFound') || text.includes('liveChatEnded')) {
          log.warn('Live chat session ended. Re-initializing stream search...');
          this.activeChatId = null;
          await this.startFindingStream();
          return;
        }

        this.pollTimeout = setTimeout(() => this.pollChatMessages(), 10000);
        return;
      }

      const data = (await res.json()) as {
        nextPageToken?: string;
        pollingIntervalMillis?: number;
        items?: Array<{
          id: string;
          snippet: {
            publishedAt: string;
            displayMessage: string;
          };
          authorDetails: {
            displayName: string;
            profileImageUrl: string;
            isVerified: boolean;
            isChatOwner: boolean;
            isChatModerator: boolean;
            isChatSponsor: boolean;
          };
        }>;
      };

      log.info(`Polled YouTube chat successfully. Items returned: ${data.items?.length || 0}. nextPageToken: ${data.nextPageToken || 'none'}`);
      if (data.items && data.items.length > 0) {
        log.info(`First message content: "${data.items[0].snippet?.displayMessage}" by "${data.items[0].authorDetails?.displayName}"`);
      }

      // Respect recommended polling interval to avoid quota usage issues
      if (data.pollingIntervalMillis) {
        nextPollMs = Math.max(2000, data.pollingIntervalMillis);
      }

      this.nextPageToken = data.nextPageToken || this.nextPageToken;

      const items = data.items || [];
      const newMessages: ChatMessage[] = [];

      for (const item of items) {
        // Step 8: Duplicate Protection
        if (this.seenIds.has(item.id)) continue;
        this.seenIds.add(item.id);

        // Keep seenIds set size bounded to 2000 entries
        if (this.seenIds.size > 2000) {
          const firstAdded = this.seenIds.values().next().value;
          if (firstAdded) this.seenIds.delete(firstAdded);
        }

        // Step 5: Convert authorDetails into badges list
        const badges: string[] = [];
        if (item.authorDetails.isChatOwner) badges.push('owner');
        if (item.authorDetails.isChatModerator) badges.push('moderator');
        if (item.authorDetails.isChatSponsor) badges.push('member');
        if (item.authorDetails.isVerified) badges.push('verified');

        // Step 4: Normalize to standard message format
        const msg: ChatMessage = {
          id: item.id,
          platform: 'youtube',
          username: item.authorDetails.displayName,
          avatar: item.authorDetails.profileImageUrl,
          message: item.snippet.displayMessage,
          sentAt: Date.parse(item.snippet.publishedAt),
          receivedAt: Date.now(),
          badges,
        };

        newMessages.push(msg);
      }

      // Step 9: Sort messages using sentAt
      newMessages.sort((a, b) => a.sentAt - b.sentAt);

      // Emit new messages
      if (this.messageCallback) {
        for (const msg of newMessages) {
          this.messageCallback(msg);
        }
      }

    } catch (err) {
      log.error(`Error polling YouTube chat: ${err instanceof Error ? err.message : err}`);
    }

    // Schedule next poll
    if (this.active) {
      this.pollTimeout = setTimeout(() => this.pollChatMessages(), nextPollMs);
    }
  }
}
