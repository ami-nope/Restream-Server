// ============================================
// Restream Server — Main Entry Point
// ============================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';

import { loadConfig } from './config/manager';
import { startStatsPolling, stopStatsPolling } from './services/srs';
import { cleanup as cleanupRelays } from './services/relay';
import { initWebSocket, shutdownWebSocket } from './websocket';
import { createLogger } from './utils/logger';

// Routes
import callbackRoutes from './routes/callbacks';
import destinationRoutes from './routes/destinations';
import streamRoutes from './routes/stream';
import statsRoutes from './routes/stats';

const log = createLogger('Server');

const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// ---- Initialize ----

// Load config on startup
const config = loadConfig();
log.info(`Stream key: ${config.streamKey}`);
log.info(`Auto-start relay: ${config.settings.autoStartRelay}`);
log.info(`Environment: ${NODE_ENV}`);

// ---- Express Setup ----

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- API Routes ----
app.use('/api/srs', callbackRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api', statsRoutes);

// ---- Static Frontend (production) ----
const frontendPath = path.resolve(__dirname, '../public');
app.use(express.static(frontendPath));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ---- WebSocket ----
initWebSocket(server);

// ---- Start SRS Stats Polling ----
startStatsPolling(config.settings.statsPollingInterval);

// ---- Start Server ----
server.listen(PORT, '0.0.0.0', () => {
  log.success(`Restream Server running on http://0.0.0.0:${PORT}`);
  log.info(`Dashboard: http://localhost:${PORT}`);
  log.info(`API: http://localhost:${PORT}/api`);
  log.info(`WebSocket: ws://localhost:${PORT}/ws`);
  log.info('Waiting for OBS to connect...');
});

// ---- Graceful Shutdown ----
function shutdown(signal: string) {
  log.info(`Received ${signal}, shutting down gracefully...`);

  // Stop stats polling
  stopStatsPolling();

  // Stop all relay processes
  cleanupRelays();

  // Close WebSocket
  shutdownWebSocket();

  // Close HTTP server
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  log.error(`Uncaught exception: ${err.message}`);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  log.error(`Unhandled rejection: ${reason}`);
});
