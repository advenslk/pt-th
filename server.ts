import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createHelzerxRouter } from './server/helzerxRouter';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const PTERO_URL = (process.env.PTERODACTYL_URL || '').replace(/\/$/, '');
const PTERO_CLIENT_KEY = process.env.PTERODACTYL_CLIENT_API_KEY || '';
const PTERO_APP_KEY = process.env.PTERODACTYL_APP_API_KEY || '';
const BILLING_API_URL = (process.env.BILLING_API_URL || '').replace(/\/$/, '');
const BILLING_API_KEY = process.env.BILLING_API_KEY || '';

function getUpstreamAuth(req: Request, isAppApi: boolean): string | null {
  const incomingAuth = req.headers.authorization;
  if (incomingAuth && incomingAuth.startsWith('Bearer ')) {
    return incomingAuth;
  }
  const envKey = isAppApi ? PTERO_APP_KEY : PTERO_CLIENT_KEY;
  if (envKey) {
    return `Bearer ${envKey}`;
  }
  return null;
}

async function proxyToPterodactyl(req: Request, res: Response, isAppApi: boolean) {
  if (!PTERO_URL) {
    return res.status(503).json({
      error: 'PTERODACTYL_NOT_CONFIGURED',
      message:
        'Pterodactyl Panel URL is not configured. Set PTERODACTYL_URL in .env or build and install MidnightX directly inside your Pterodactyl Panel.',
    });
  }

  const authHeader = getUpstreamAuth(req, isAppApi);
  if (!authHeader && !req.headers.cookie) {
    return res.status(401).json({
      error: 'PTERODACTYL_AUTH_REQUIRED',
      message: isAppApi
        ? 'Missing PTERODACTYL_APP_API_KEY in server environment.'
        : 'Missing PTERODACTYL_CLIENT_API_KEY in server environment or active Pterodactyl session cookie.',
    });
  }

  try {
    const targetUrl = `${PTERO_URL}${req.originalUrl}`;
    const headers: Record<string, string> = {
      Accept: req.headers.accept || 'application/json',
    };

    if (authHeader) headers['Authorization'] = authHeader;
    if (req.headers.cookie) headers['Cookie'] = req.headers.cookie;
    if (req.headers['x-xsrf-token']) headers['X-XSRF-TOKEN'] = String(req.headers['x-xsrf-token']);
    if (req.headers['content-type']) headers['Content-Type'] = String(req.headers['content-type']);

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const body = hasBody
      ? typeof req.body === 'string'
        ? req.body
        : req.body !== undefined
          ? JSON.stringify(req.body)
          : undefined
      : undefined;

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    if (upstreamRes.status === 204) {
      return res.status(204).end();
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/json';
    const contentDisp = upstreamRes.headers.get('content-disposition');
    if (contentDisp) {
      res.setHeader('Content-Disposition', contentDisp);
    }

    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    return res.status(upstreamRes.status).type(contentType).send(buf);
  } catch (err: any) {
    return res.status(502).json({
      error: 'PTERODACTYL_UNREACHABLE',
      message: err?.message || 'Unable to reach upstream Pterodactyl Panel.',
    });
  }
}

async function proxyToBilling(req: Request, res: Response) {
  if (!BILLING_API_URL) {
    return res.status(501).json({
      error: 'BILLING_MODULE_NOT_CONFIGURED',
      configured: false,
      message:
        'External billing & ticketing service is not configured. Set BILLING_API_URL in .env to connect Paymenter, WHMCS, or your custom billing API.',
    });
  }

  try {
    const targetUrl = `${BILLING_API_URL}${req.originalUrl}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (BILLING_API_KEY) headers['Authorization'] = `Bearer ${BILLING_API_KEY}`;

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    return res
      .status(upstreamRes.status)
      .type(upstreamRes.headers.get('content-type') || 'application/json')
      .send(buf);
  } catch (err: any) {
    return res.status(502).json({
      error: 'BILLING_UNREACHABLE',
      message: err?.message || 'Billing API unreachable.',
    });
  }
}

async function startServer() {
  const app = express();

  // Support both JSON and text/plain bodies (required by Pterodactyl /files/write)
  app.use(express.text({ type: ['text/*', 'application/x-yaml', 'application/yaml'], limit: '25mb' }));
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      connected: Boolean(PTERO_URL && PTERO_CLIENT_KEY),
      hasAdminApi: Boolean(PTERO_URL && PTERO_APP_KEY),
      billingConfigured: Boolean(BILLING_API_URL),
      panelVersion: '1.15.2',
      theme: 'HelzerX',
    });
  });

  // HelzerX Platform Features API (must be registered before Pterodactyl client proxy)
  app.use('/api/client/helzerx', createHelzerxRouter());

  // Authentic Pterodactyl Client API Proxy
  app.all('/api/client*', (req, res) => proxyToPterodactyl(req, res, false));

  // Authentic Pterodactyl Application (Admin) API Proxy
  app.all('/api/application*', (req, res) => proxyToPterodactyl(req, res, true));

  // Optional External Billing & Support Proxy
  app.all('/api/billing*', (req, res) => proxyToBilling(req, res));
  app.all('/api/support*', (req, res) => proxyToBilling(req, res));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HelzerX Panel Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
