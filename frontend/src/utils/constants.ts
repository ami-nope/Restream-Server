// ============================================
// Platform Constants & Presets
// ============================================

import { PlatformPreset } from '../types';

export interface PlatformInfo {
  id: PlatformPreset;
  name: string;
  color: string;
  defaultUrl: string;
  icon: string;  // Emoji fallback
}

export const PLATFORMS: Record<PlatformPreset, PlatformInfo> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    color: '#FF0000',
    defaultUrl: 'rtmp://a.rtmp.youtube.com/live2',
    icon: '▶️',
  },
  twitch: {
    id: 'twitch',
    name: 'Twitch',
    color: '#9146FF',
    defaultUrl: 'rtmp://live.twitch.tv/app',
    icon: '💜',
  },
  kick: {
    id: 'kick',
    name: 'Kick',
    color: '#53FC18',
    defaultUrl: 'rtmps://fa723fc1b171.global-contribute.live-video.net/app',
    icon: '💚',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    defaultUrl: 'rtmps://live-api-s.facebook.com:443/rtmp',
    icon: '🔵',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    color: '#00F2EA',
    defaultUrl: 'rtmp://push.tiktokcdn.com/live',
    icon: '🎵',
  },
  custom: {
    id: 'custom',
    name: 'Custom RTMP',
    color: '#6366f1',
    defaultUrl: '',
    icon: '📡',
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);
