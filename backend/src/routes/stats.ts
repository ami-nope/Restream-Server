// ============================================
// Stats Routes — SRS stats proxy
// ============================================

import { Router, Request, Response } from 'express';
import { getMonitorStats } from '../services/monitor';
import { getStreamStats, checkSrsHealth } from '../services/srs';
import { getConfig, updateSettings, setStreamKey, exportConfig, importConfig } from '../config/manager';

const router = Router();

/**
 * GET /api/stats
 * Get aggregated monitoring stats
 */
router.get('/stats', (_req: Request, res: Response) => {
  const stats = getMonitorStats();
  res.json(stats);
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', async (_req: Request, res: Response) => {
  const srsOk = await checkSrsHealth();
  const streamStats = getStreamStats();

  res.json({
    status: 'ok',
    srs: srsOk ? 'connected' : 'disconnected',
    stream: streamStats.status,
    timestamp: new Date().toISOString(),
  });
});

router.get('/settings', (_req: Request, res: Response) => {
  const config = getConfig();
  res.json({
    streamKey: config.streamKey,
    settings: config.settings,
    srsHost: process.env.SRS_HOST || 'srs',
    srsRtmpPort: parseInt(process.env.SRS_RTMP_PORT || '1935', 10),
    publicRtmpUrl: process.env.PUBLIC_RTMP_URL || '',
  });
});

/**
 * PUT /api/settings
 * Update settings
 */
router.put('/settings', (req: Request, res: Response) => {
  const { streamKey, settings } = req.body;

  if (streamKey !== undefined) {
    setStreamKey(streamKey);
  }

  if (settings !== undefined) {
    updateSettings(settings);
  }

  const config = getConfig();
  res.json({
    streamKey: config.streamKey,
    settings: config.settings,
    srsHost: process.env.SRS_HOST || 'srs',
    srsRtmpPort: parseInt(process.env.SRS_RTMP_PORT || '1935', 10),
  });
});

/**
 * GET /api/config/export
 * Export full configuration
 */
router.get('/config/export', (_req: Request, res: Response) => {
  const config = exportConfig();
  res.json(config);
});

/**
 * POST /api/config/import
 * Import configuration
 */
router.post('/config/import', (req: Request, res: Response) => {
  try {
    importConfig(req.body);
    res.json({ success: true, message: 'Configuration imported' });
  } catch (err) {
    res.status(400).json({ error: `Import failed: ${err}` });
  }
});

export default router;
