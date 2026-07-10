// ============================================
// YouTube OAuth and Config Routes
// ============================================

import { Router, Request, Response } from 'express';
import { getConfig, saveConfig } from '../config/manager';
import { chatManager } from '../services/chatManager';
import { createLogger } from '../utils/logger';

const log = createLogger('YouTubeRoutes');
const router = Router();

router.get('/settings', (req: Request, res: Response) => {
  const config = getConfig();
  const yt = config.youtubeChat;

  res.json({
    clientId: yt?.clientId || '',
    redirectUri: yt?.redirectUri || '',
    authenticated: !!(yt?.refreshToken),
    prochatUrl: config.prochatUrl || '',
  });
});

/**
 * GET /api/youtube/chat-proxy
 * Bypasses iframeSAMEORIGIN block for ProChat overlay by proxying HTML and base tag injection.
 */
router.get('/chat-proxy', async (req: Request, res: Response) => {
  try {
    const config = getConfig();
    let url = 'https://prochat.gg/chat/overlay';
    if (config.prochatUrl) {
      // Strip the hash from the configured URL to fetch the raw HTML template
      url = config.prochatUrl.split('#')[0];
    }

    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).send('Failed to fetch overlay');
      return;
    }
    let html = await response.text();
    
    // Strip crossorigin and integrity attributes to bypass CORS/integrity blockers
    html = html.replace(/crossorigin=".*?"/g, '');
    html = html.replace(/crossorigin='.*?'/g, '');
    html = html.replace(/crossorigin/g, '');
    
    html = html.replace(/integrity=".*?"/g, '');
    html = html.replace(/integrity='.*?'/g, '');
    
    // Remove headers that restrict embedding
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    log.error(`Proxy error: ${err instanceof Error ? err.message : err}`);
    res.status(500).send('Proxy error');
  }
});

/**
 * POST /api/youtube/settings
 * Save Google OAuth credentials and/or ProChat overlay URL.
 */
router.post('/settings', (req: Request, res: Response) => {
  const { clientId, clientSecret, redirectUri, prochatUrl } = req.body as {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    prochatUrl?: string;
  };

  const config = getConfig();

  if (clientId || clientSecret || redirectUri) {
    config.youtubeChat = {
      ...(config.youtubeChat || { accessToken: null, refreshToken: null, expiresAt: null }),
      clientId: clientId || '',
      clientSecret: clientSecret !== undefined ? clientSecret : (config.youtubeChat?.clientSecret || ''),
      redirectUri: redirectUri || '',
    };
  }

  if (prochatUrl !== undefined) {
    config.prochatUrl = prochatUrl;
  }

  saveConfig();
  log.info('YouTube/Chat settings updated');
  res.json({ success: true });
});

/**
 * GET /api/youtube/auth
 * Redirects the user to Google OAuth consent page.
 */
router.get('/auth', (req: Request, res: Response) => {
  const config = getConfig();
  const yt = config.youtubeChat;

  if (!yt || !yt.clientId || !yt.redirectUri) {
    res.status(400).send('Google OAuth Client settings are not configured. Save them first in the settings panel.');
    return;
  }

  // Construct Google Auth URL with offline access and prompt consent
  // to ensure a refresh token is always returned.
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: yt.clientId,
    redirect_uri: yt.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

  res.redirect(authUrl);
});

/**
 * GET /api/youtube/callback
 * Exchanging authorization code for tokens, save them, restart chatManager, and redirect back.
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query as { code?: string; error?: string };

  if (error) {
    log.error(`OAuth consent returned error: ${error}`);
    res.redirect('/?error=oauth_failed');
    return;
  }

  if (!code) {
    res.status(400).send('Authorization code missing.');
    return;
  }

  try {
    const config = getConfig();
    const yt = config.youtubeChat;

    if (!yt || !yt.clientId || !yt.clientSecret || !yt.redirectUri) {
      throw new Error('OAuth configuration missing on callback handle.');
    }

    log.info('Exchanging OAuth authorization code for tokens...');
    const params = new URLSearchParams({
      client_id: yt.clientId,
      client_secret: yt.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: yt.redirectUri,
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Token exchange failed: ${tokenRes.status} - ${errText}`);
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    yt.accessToken = data.access_token;
    yt.expiresAt = Date.now() + data.expires_in * 1000;
    
    // Store refresh token if returned by Google
    if (data.refresh_token) {
      yt.refreshToken = data.refresh_token;
    }

    saveConfig();
    log.success('YouTube OAuth authentication successful');

    // Notify ChatManager to connect immediately using the new tokens
    void chatManager.restart();

    // Redirect to dashboard page
    res.redirect('/');
  } catch (err) {
    log.error(`OAuth callback error: ${err instanceof Error ? err.message : err}`);
    res.status(500).send(`Authentication failed: ${err instanceof Error ? err.message : err}`);
  }
});

/**
 * POST /api/youtube/logout
 * De-authenticate YouTube and stop live chat polling.
 */
router.post('/logout', async (req: Request, res: Response) => {
  const config = getConfig();
  const yt = config.youtubeChat;

  if (yt) {
    yt.accessToken = null;
    yt.refreshToken = null;
    yt.expiresAt = null;
    saveConfig();
  }

  log.info('YouTube logged out, stopping chat polling...');
  await chatManager.restart();

  res.json({ success: true });
});

export default router;
