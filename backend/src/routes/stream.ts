// ============================================
// Stream Control Routes — Start/Stop/Restart
// ============================================

import { Router, Request, Response } from 'express';
import {
  startAllRelays,
  stopAllRelays,
  restartAllRelays,
  isRelayActive,
  getAllRelayStates,
} from '../services/relay';
import { getStreamStats } from '../services/srs';
import { createLogger } from '../utils/logger';

const log = createLogger('Stream');
const router = Router();

/**
 * POST /api/stream/start
 * Start relaying to all enabled destinations
 */
router.post('/start', (_req: Request, res: Response) => {
  const stats = getStreamStats();

  if (stats.status !== 'live') {
    res.status(400).json({
      error: 'Cannot start relay: No incoming stream from OBS',
    });
    return;
  }

  if (isRelayActive()) {
    res.status(400).json({
      error: 'Relay is already active',
    });
    return;
  }

  startAllRelays();
  res.json({ success: true, message: 'Relays started' });
});

/**
 * POST /api/stream/stop
 * Stop all relays
 */
router.post('/stop', (_req: Request, res: Response) => {
  stopAllRelays();
  res.json({ success: true, message: 'Relays stopped' });
});

/**
 * POST /api/stream/restart
 * Restart all relays
 */
router.post('/restart', (_req: Request, res: Response) => {
  restartAllRelays();
  res.json({ success: true, message: 'Relays restarting...' });
});

/**
 * GET /api/stream/status
 * Get current stream and relay status
 */
router.get('/status', (_req: Request, res: Response) => {
  const stats = getStreamStats();
  const relayStates = getAllRelayStates();
  const active = isRelayActive();

  res.json({
    stream: stats,
    relayActive: active,
    destinations: relayStates,
  });
});

export default router;
