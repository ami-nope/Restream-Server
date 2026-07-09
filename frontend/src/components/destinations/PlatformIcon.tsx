// ============================================
// PlatformIcon Component
// ============================================

import React from 'react';
import { PlatformPreset } from '../../types';
import { PLATFORMS } from '../../utils/constants';

interface PlatformIconProps {
  platform: PlatformPreset;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-lg',
  lg: 'w-14 h-14 text-2xl',
};

const PlatformIcon: React.FC<PlatformIconProps> = ({ platform, size = 'md' }) => {
  const info = PLATFORMS[platform] || PLATFORMS.custom;

  return (
    <div
      className={`${sizeClasses[size]} rounded-xl flex items-center justify-center flex-shrink-0`}
      style={{
        background: `${info.color}18`,
        border: `1px solid ${info.color}30`,
      }}
    >
      {info.icon}
    </div>
  );
};

export default PlatformIcon;
