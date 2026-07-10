// ============================================
// API Client — HTTP requests to backend
// ============================================

const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      ...headers,
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ---- Destinations ----

export const api = {
  // Destinations
  getDestinations: () =>
    request<{ destinations: import('../types').Destination[] }>('/destinations'),

  addDestination: (data: {
    name: string;
    platform: string;
    serverUrl: string;
    streamKey: string;
    enabled: boolean;
  }) =>
    request<{ destination: import('../types').Destination }>('/destinations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDestination: (id: string, data: Partial<import('../types').Destination>) =>
    request<{ destination: import('../types').Destination }>(`/destinations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDestination: (id: string) =>
    request<{ success: boolean }>(`/destinations/${id}`, { method: 'DELETE' }),

  toggleDestination: (id: string) =>
    request<{ destination: import('../types').Destination }>(`/destinations/${id}/toggle`, {
      method: 'PATCH',
    }),

  // Stream Control
  startRelay: () =>
    request<{ success: boolean; message: string }>('/stream/start', { method: 'POST' }),

  stopRelay: () =>
    request<{ success: boolean; message: string }>('/stream/stop', { method: 'POST' }),

  restartRelay: () =>
    request<{ success: boolean; message: string }>('/stream/restart', { method: 'POST' }),

  getStreamStatus: () =>
    request<{
      stream: import('../types').StreamStats;
      relayActive: boolean;
      destinations: import('../types').DestinationState[];
    }>('/stream/status'),

  // Stats
  getStats: () => request<import('../types').MonitorStats>('/stats'),

  // Health
  getHealth: () =>
    request<{ status: string; srs: string; stream: string }>('/health'),

  // Settings
  getSettings: () => request<import('../types').AppSettings>('/settings'),

  updateSettings: (data: { streamKey?: string; settings?: Record<string, unknown> }) =>
    request<import('../types').AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Config
  exportConfig: () => request<unknown>('/config/export'),

  importConfig: (config: unknown) =>
    request<{ success: boolean }>('/config/import', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  // YouTube Chat Settings
  getYoutubeSettings: () =>
    request<{ clientId: string; redirectUri: string; authenticated: boolean; prochatUrl?: string }>('/youtube/settings'),

  updateYoutubeSettings: (data: { clientId?: string; clientSecret?: string; redirectUri?: string; prochatUrl?: string }) =>
    request<{ success: boolean }>('/youtube/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logoutYoutube: () =>
    request<{ success: boolean }>('/youtube/logout', { method: 'POST' }),

  // Assets
  getAssets: () =>
    request<Record<string, { exists: boolean; name?: string; size?: number; url?: string }>>('/assets'),

  uploadAsset: (type: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ success: boolean; asset: { exists: boolean; name: string; size: number; url: string } }>(
      `/assets/upload/${type}`,
      {
        method: 'POST',
        body: formData,
      }
    );
  },

  deleteAsset: (type: string) =>
    request<{ success: boolean; message: string }>(`/assets/${type}`, { method: 'DELETE' }),
};
