// ============================================
// Config Manager — JSON-based persistent config
// ============================================

import fs from 'fs';
import path from 'path';
import { AppConfig, Destination } from '../types';
import { DEFAULT_CONFIG } from './defaults';
import { createLogger } from '../utils/logger';

const log = createLogger('Config');

const DATA_DIR = path.resolve(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

let currentConfig: AppConfig;

/** Ensure data directory exists */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    log.info(`Created data directory: ${DATA_DIR}`);
  }
}

/** Load configuration from disk, or create default */
export function loadConfig(): AppConfig {
  ensureDataDir();

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AppConfig>;

      // Merge with defaults to handle missing fields after upgrades
      currentConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        settings: {
          ...DEFAULT_CONFIG.settings,
          ...(parsed.settings || {}),
        },
      };

      log.success(`Configuration loaded (${currentConfig.destinations.length} destinations)`);
      return currentConfig;
    } catch (err) {
      log.error(`Failed to parse config.json, using defaults: ${err}`);
      currentConfig = {
        ...DEFAULT_CONFIG,
      };
      saveConfig();
      return currentConfig;
    }
  }

  // First run — create default config
  log.info('No config found, creating default configuration');
  currentConfig = {
    ...DEFAULT_CONFIG,
  };
  saveConfig();
  return currentConfig;
}

/** Save configuration to disk (atomic write) */
export function saveConfig(): void {
  ensureDataDir();

  const tmpPath = CONFIG_PATH + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
    fs.renameSync(tmpPath, CONFIG_PATH);
  } catch (err) {
    log.error(`Failed to save config: ${err}`);
    // Clean up temp file if rename failed
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

/** Get current config (in-memory) */
export function getConfig(): AppConfig {
  if (!currentConfig) {
    return loadConfig();
  }
  return currentConfig;
}

/** Update stream key */
export function setStreamKey(key: string): void {
  currentConfig.streamKey = key;
  saveConfig();
  log.info('Stream key updated');
}

/** Get all destinations */
export function getDestinations(): Destination[] {
  return getConfig().destinations;
}

/** Get a single destination by ID */
export function getDestination(id: string): Destination | undefined {
  return getConfig().destinations.find((d) => d.id === id);
}

/** Add a new destination */
export function addDestination(dest: Destination): Destination {
  currentConfig.destinations.push(dest);
  saveConfig();
  log.success(`Destination added: ${dest.name} (${dest.platform})`);
  return dest;
}

/** Update an existing destination */
export function updateDestination(id: string, updates: Partial<Destination>): Destination | null {
  const idx = currentConfig.destinations.findIndex((d) => d.id === id);
  if (idx === -1) return null;

  currentConfig.destinations[idx] = {
    ...currentConfig.destinations[idx],
    ...updates,
    id, // Never allow ID change
    updatedAt: new Date().toISOString(),
  };
  saveConfig();
  log.info(`Destination updated: ${currentConfig.destinations[idx].name}`);
  return currentConfig.destinations[idx];
}

/** Delete a destination */
export function deleteDestination(id: string): boolean {
  const idx = currentConfig.destinations.findIndex((d) => d.id === id);
  if (idx === -1) return false;

  const [removed] = currentConfig.destinations.splice(idx, 1);
  saveConfig();
  log.info(`Destination deleted: ${removed.name}`);
  return true;
}

/** Toggle destination enabled/disabled */
export function toggleDestination(id: string): Destination | null {
  const dest = currentConfig.destinations.find((d) => d.id === id);
  if (!dest) return null;

  dest.enabled = !dest.enabled;
  dest.updatedAt = new Date().toISOString();
  saveConfig();
  log.info(`Destination ${dest.name}: ${dest.enabled ? 'enabled' : 'disabled'}`);
  return dest;
}

/** Update settings */
export function updateSettings(updates: Partial<AppConfig['settings']>): AppConfig['settings'] {
  currentConfig.settings = { ...currentConfig.settings, ...updates };
  saveConfig();
  log.info('Settings updated');
  return currentConfig.settings;
}

/** Export full config (for backup) */
export function exportConfig(): AppConfig {
  return { ...getConfig() };
}

/** Import config (from backup) */
export function importConfig(config: AppConfig): void {
  currentConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    settings: { ...DEFAULT_CONFIG.settings, ...(config.settings || {}) },
  };
  saveConfig();
  log.success('Configuration imported successfully');
}
