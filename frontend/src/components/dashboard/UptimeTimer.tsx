// ============================================
// UptimeTimer Component — Live ticking timer
// ============================================

import React, { useState, useEffect } from 'react';

interface UptimeTimerProps {
  seconds: number;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
}

const UptimeTimer: React.FC<UptimeTimerProps> = ({ seconds }) => {
  const [displaySeconds, setDisplaySeconds] = useState(seconds);

  // Keep a local tick for smooth counting between WebSocket updates
  useEffect(() => {
    setDisplaySeconds(seconds);
  }, [seconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDisplaySeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-2xl font-bold font-mono text-gradient tabular-nums">
      {formatTime(displaySeconds)}
    </span>
  );
};

export default UptimeTimer;
