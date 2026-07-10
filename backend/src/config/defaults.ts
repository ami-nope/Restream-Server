// ============================================
// Default Configuration
// ============================================

import { AppConfig } from '../types';

export const DEFAULT_CONFIG: AppConfig = {
  streamKey: 'live',
  destinations: [],
  settings: {
    autoStartRelay: true,
    reconnectMaxAttempts: 50,
    reconnectBaseDelay: 5,        // seconds
    statsPollingInterval: 2000,    // milliseconds
    brbTimeout: 10,
    enableAutoStop: true,
    enableBrbMode: true,
  },
  youtubeChat: {
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
  },
};
