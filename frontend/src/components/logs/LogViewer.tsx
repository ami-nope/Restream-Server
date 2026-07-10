// ============================================
// LogViewer Component — Live scrolling logs
// ============================================

import React, { useRef, useEffect, useState } from 'react';
import { LogEntry } from '../../types';

interface LogViewerProps {
  logs: LogEntry[];
  onClear: () => void;
}

const levelColors: Record<LogEntry['level'], string> = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

const levelIcons: Record<LogEntry['level'], string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

const LogViewer: React.FC<LogViewerProps> = ({ logs, onClear }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Detect manual scroll (disable auto-scroll if user scrolls up)
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Logs</h2>
          <p className="text-sm text-gray-500 mt-1">
            {logs.length} entries
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAutoScroll(true);
              if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
              }
            }}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
              autoScroll
                ? 'bg-accent/10 text-accent-light border border-accent/20'
                : 'bg-white/[0.04] text-gray-500 hover:text-gray-300'
            }`}
          >
            {autoScroll ? '📌 Pinned' : '📌 Pin to bottom'}
          </button>
          <button onClick={onClear} className="btn-secondary text-xs !px-3 !py-1.5">
            Clear
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="glass-card flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed min-h-0"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <p>No log entries yet. Logs will appear when the server is active.</p>
          </div>
        ) : (
          logs.map((entry) => (
            <div
              key={entry.id}
              className="flex gap-3 py-1 hover:bg-white/[0.02] px-2 rounded animate-fade-in"
            >
              <span className="text-gray-600 flex-shrink-0 tabular-nums">
                {formatTime(entry.timestamp)}
              </span>
              <span className="flex-shrink-0">{levelIcons[entry.level]}</span>
              <span className="text-gray-500 flex-shrink-0">[{entry.source}]</span>
              <span className={levelColors[entry.level]}>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogViewer;
