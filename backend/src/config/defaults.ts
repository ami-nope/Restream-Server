// ============================================
// Default Configuration
// ============================================

import { AppConfig } from '../types';

export const DEFAULT_CONFIG: AppConfig = {
  streamKey: process.env.STREAM_KEY || 'live',
  destinations: [],
  settings: {
    autoStartRelay: true,
    reconnectMaxAttempts: 50,
    reconnectBaseDelay: 5,        // seconds
    statsPollingInterval: 2000,    // milliseconds
  },
};
