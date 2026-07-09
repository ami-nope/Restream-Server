// ============================================
// Helpers — Utility functions
// ============================================

/** Sleep for a given number of milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calculate exponential backoff delay with jitter */
export function getBackoffDelay(attempt: number, baseDelay: number, maxDelay: number = 60): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add up to 20% jitter
  const jitter = delay * 0.2 * Math.random();
  return (delay + jitter) * 1000; // Return in ms
}

/** Format seconds into HH:MM:SS */
export function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
}

/** Mask a stream key for display (show first 4 and last 4 chars) */
export function maskStreamKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
