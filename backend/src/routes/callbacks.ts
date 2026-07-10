// ============================================
// SRS Callback Routes — on_publish, on_unpublish
// ============================================

import { Router, Request, Response } from 'express';
import { SrsPublishPayload, SrsUnpublishPayload } from '../types';
import { getConfig } from '../config/manager';
import { getStreamStats, setStreamLive, setStreamOffline } from '../services/srs';
import { handleStreamPublish, handleStreamUnpublish } from '../services/relay';
import { setStreamConnected, setStreamDisconnected } from '../services/monitor';
import { broadcastStreamStatus } from '../websocket';
import { createLogger } from '../utils/logger';

const log = createLogger('SRS-Callback');
const router = Router();

/**
 * POST /api/srs/on_publish
 * Called by SRS when a client starts publishing.
 * Validates stream key, starts relays if autoStart is enabled.
 */
router.post('/on_publish', (req: Request, res: Response) => {
  const payload = req.body as SrsPublishPayload;
  const config = getConfig();

  log.info(`on_publish event: app=${payload.app}, stream=${payload.stream}, ip=${payload.ip}`);

  // Validate stream key
  const incomingKey = payload.stream;
  if (incomingKey !== config.streamKey) {
    log.error(`Invalid stream key rejected: "${incomingKey}"`);
    // Return non-zero code to reject the stream
    res.json({ code: 1, msg: 'Invalid stream key' });
    return;
  }

  // Update stream state
  setStreamLive(payload.client_id, payload.ip, payload.stream);
  setStreamConnected();
  broadcastStreamStatus(getStreamStats().status);

  // Auto-start relays or resume from BRB
  setTimeout(() => handleStreamPublish(), 1000); // Small delay to let SRS stabilize

  // SRS requires code: 0 for success
  res.json({ code: 0 });
});

/**
 * POST /api/srs/on_unpublish
 * Called by SRS when a client stops publishing.
 * Stops all relays and updates state.
 */
router.post('/on_unpublish', (req: Request, res: Response) => {
  const payload = req.body as SrsUnpublishPayload;

  log.info(`on_unpublish event: app=${payload.app}, stream=${payload.stream}`);

  // Update stream state
  setStreamOffline();
  setStreamDisconnected();
  broadcastStreamStatus('offline');

  // Switch to BRB mode or stop relays
  handleStreamUnpublish();

  res.json({ code: 0 });
});

export default router;
