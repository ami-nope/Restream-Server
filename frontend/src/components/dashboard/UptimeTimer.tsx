// ============================================
// UptimeTimer Component - Live ticking timer
// ============================================

import React, { useState, useEffect } from 'react';

interface UptimeTimerProps {
  seconds: number;
  active?: boolean;
  className?: string;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((value) => value.toString().padStart(2, '0')).join(':');
}

const UptimeTimer: React.FC<UptimeTimerProps> = ({
  seconds,
  active = false,
  className = 'text-2xl font-bold font-mono text-gradient tabular-nums',
}) => {
  const [displaySeconds, setDisplaySeconds] = useState(seconds);

  useEffect(() => {
    setDisplaySeconds(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!active) return undefined;

    const timer = setInterval(() => {
      setDisplaySeconds((previous) => previous + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [active]);

  return (
    <span className={className}>
      {formatTime(displaySeconds)}
    </span>
  );
};

export default UptimeTimer;
