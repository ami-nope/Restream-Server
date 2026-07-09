// ============================================
// Destination Routes — CRUD for RTMP destinations
// ============================================

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Destination, PlatformPreset } from '../types';
import {
  getDestinations,
  getDestination,
  addDestination,
  updateDestination,
  deleteDestination,
  toggleDestination,
} from '../config/manager';
import { startRelay, stopRelay, getRelayState } from '../services/relay';
import { createLogger } from '../utils/logger';

const log = createLogger('Destinations');
const router = Router();

/**
 * GET /api/destinations
 * List all destinations with their current relay state
 */
router.get('/', (_req: Request, res: Response) => {
  const destinations = getDestinations();
  const withState = destinations.map((d) => ({
    ...d,
    relay: getRelayState(d.id),
  }));
  res.json({ destinations: withState });
});

/**
 * POST /api/destinations
 * Add a new destination
 */
router.post('/', (req: Request, res: Response) => {
  const { name, platform, serverUrl, streamKey, enabled } = req.body;

  // Validation
  if (!name || !serverUrl || !streamKey) {
    res.status(400).json({ error: 'name, serverUrl, and streamKey are required' });
    return;
  }

  const dest: Destination = {
    id: uuidv4(),
    name: name.trim(),
    platform: (platform as PlatformPreset) || 'custom',
    serverUrl: serverUrl.trim(),
    streamKey: streamKey.trim(),
    enabled: enabled !== false, // Default to true
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  addDestination(dest);
  res.status(201).json({ destination: { ...dest, relay: getRelayState(dest.id) } });
});

/**
 * PUT /api/destinations/:id
 * Update an existing destination
 */
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, platform, serverUrl, streamKey, enabled } = req.body;

  const existing = getDestination(id);
  if (!existing) {
    res.status(404).json({ error: 'Destination not found' });
    return;
  }

  const updates: Partial<Destination> = {};
  if (name !== undefined) updates.name = name.trim();
  if (platform !== undefined) updates.platform = platform;
  if (serverUrl !== undefined) updates.serverUrl = serverUrl.trim();
  if (streamKey !== undefined) updates.streamKey = streamKey.trim();
  if (enabled !== undefined) updates.enabled = enabled;

  const updated = updateDestination(id, updates);
  if (!updated) {
    res.status(500).json({ error: 'Failed to update destination' });
    return;
  }

  // If connection details changed and relay is running, restart it
  if (serverUrl !== undefined || streamKey !== undefined) {
    const state = getRelayState(id);
    if (state.status === 'live' || state.status === 'connecting') {
      log.info(`Restarting relay for ${updated.name} due to config change`);
      stopRelay(id);
      setTimeout(() => {
        if (updated.enabled) startRelay(id);
      }, 1000);
    }
  }

  res.json({ destination: { ...updated, relay: getRelayState(id) } });
});

/**
 * DELETE /api/destinations/:id
 * Remove a destination
 */
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = getDestination(id);
  if (!existing) {
    res.status(404).json({ error: 'Destination not found' });
    return;
  }

  // Stop relay if running
  const state = getRelayState(id);
  if (state.status !== 'idle' && state.status !== 'stopped') {
    stopRelay(id);
  }

  deleteDestination(id);
  res.json({ success: true });
});

/**
 * PATCH /api/destinations/:id/toggle
 * Enable or disable a destination
 */
router.patch('/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;

  const updated = toggleDestination(id);
  if (!updated) {
    res.status(404).json({ error: 'Destination not found' });
    return;
  }

  // Start or stop relay based on new state
  if (updated.enabled) {
    // If relays are globally active, start this one
    const { isRelayActive } = require('../services/relay');
    if (isRelayActive()) {
      startRelay(id);
    }
  } else {
    stopRelay(id);
  }

  res.json({ destination: { ...updated, relay: getRelayState(id) } });
});

export default router;
