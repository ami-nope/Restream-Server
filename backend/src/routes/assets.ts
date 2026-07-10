// ============================================
// Assets Routes — Manage image resources
// ============================================

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../utils/logger';

const log = createLogger('Assets');
const router = Router();

const DATA_DIR = path.resolve(__dirname, '../../data');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');

const ASSET_TYPES = ['brb', 'starting_soon', 'ending', 'offline'] as const;

/** Ensure assets directory exists */
function ensureAssetsDir(): void {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }
}

/** Get the absolute file path for a specific asset type */
export function getAssetPath(type: string): string | null {
  ensureAssetsDir();
  try {
    const files = fs.readdirSync(ASSETS_DIR);
    const file = files.find((f) => f.startsWith(type + '.'));
    return file ? path.join(ASSETS_DIR, file) : null;
  } catch {
    return null;
  }
}

// Multer disk storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureAssetsDir();
    cb(null, ASSETS_DIR);
  },
  filename: (req, file, cb) => {
    const { type } = req.params;
    const ext = path.extname(file.originalname);
    cb(null, `${type}${ext}`);
  },
});

// Multer upload config
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, JPEG, GIF, WEBP) are allowed.'));
    }
  },
});

/**
 * GET /api/assets
 * Lists existence status and details of all standard assets
 */
router.get('/', (req, res) => {
  try {
    ensureAssetsDir();
    const result: Record<string, any> = {};

    for (const type of ASSET_TYPES) {
      const filePath = getAssetPath(type);
      if (filePath && fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        result[type] = {
          exists: true,
          name: path.basename(filePath),
          size: stats.size,
          url: `/api/assets/${type}?t=${stats.mtimeMs}`,
        };
      } else {
        result[type] = {
          exists: false,
        };
      }
    }
    res.json(result);
  } catch (err) {
    log.error(`Failed to list assets: ${err}`);
    res.status(500).json({ error: 'Failed to list assets' });
  }
});

/**
 * POST /api/assets/upload/:type
 * Handles upload for a single asset type. Overwrites existing matching type prefix file first.
 */
router.post('/upload/:type', (req, res) => {
  const { type } = req.params;
  if (!(ASSET_TYPES as readonly string[]).includes(type)) {
    res.status(400).json({ error: `Invalid asset type: "${type}"` });
    return;
  }

  // Handle file upload
  upload.single('file')(req, res, (err) => {
    if (err) {
      log.error(`File upload error: ${err.message}`);
      res.status(400).json({ error: err.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const uploadedFile = req.file;

    try {
      const files = fs.readdirSync(ASSETS_DIR);
      for (const file of files) {
        if (file.startsWith(type + '.') && file !== uploadedFile.filename) {
          fs.unlinkSync(path.join(ASSETS_DIR, file));
        }
      }
    } catch (cleanupErr) {
      log.error(`Failed during old asset cleanup: ${cleanupErr}`);
    }

    log.success(`Uploaded asset "${type}": ${uploadedFile.filename} (${uploadedFile.size} bytes)`);
    res.json({
      success: true,
      asset: {
        exists: true,
        name: uploadedFile.filename,
        size: uploadedFile.size,
        url: `/api/assets/${type}?t=${Date.now()}`,
      },
    });
  });
});

/**
 * GET /api/assets/:type
 * Serves/streams the asset file
 */
router.get('/:type', (req, res) => {
  const { type } = req.params;
  const filePath = getAssetPath(type);

  if (filePath && fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});

/**
 * DELETE /api/assets/:type
 * Deletes the asset file
 */
router.delete('/:type', (req, res) => {
  const { type } = req.params;
  if (!(ASSET_TYPES as readonly string[]).includes(type)) {
    res.status(400).json({ error: `Invalid asset type: "${type}"` });
    return;
  }

  ensureAssetsDir();
  const filePath = getAssetPath(type);

  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      log.info(`Deleted asset: ${type}`);
      res.json({ success: true, message: `Asset "${type}" deleted` });
    } catch (err) {
      log.error(`Failed to delete asset file: ${err}`);
      res.status(500).json({ error: 'Failed to delete asset file' });
    }
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});

export default router;
