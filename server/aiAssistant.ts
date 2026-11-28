import { GoogleGenAI, Type, type Content, type FunctionDeclaration } from '@google/genai';
import type { Request } from 'express';
import type { AiActionTrace, AiChatMessage } from '../src/types/helzerx';

// Try the preferred model first, then fall back when Google reports high demand,
// quota exhaustion, or a temporary server error for that specific model.
const AI_MODELS = (process.env.GEMINI_MODEL || 'gemini-4-hydrogen,gemini-3.5-flash,gemini-3.5-flash-lite')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const MODRINTH_API = 'https://api.modrinth.com/v2';
const SPIGET_API = 'https://api.spiget.org/v2';

type ServerLoaderId =
  | 'paper'
  | 'purpur'
  | 'spigot'
  | 'bukkit'
  | 'folia'
  | 'velocity'
  | 'bungeecord'
  | 'waterfall'
  | 'forge'
  | 'neoforge'
  | 'fabric'
  | 'quilt'
  | 'unknown';

interface DetectedEnv {
  loader: ServerLoaderId;
  mcVersion: string;
  kind: 'plugin' | 'mod' | 'unknown';
  sources: string[];
}

export interface RunAiInput {
  req: Request;
  serverId: string;
  message: string;
  recentMessages: AiChatMessage[];
  maxSteps: number;
  isAdmin: boolean;
  isGlobalLocked: boolean;
}

export interface RunAiResult {
  reply: string;
  serverName: string;
  actions: AiActionTrace[];
  mutatingActionCount: number;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set on the server. Add it in Settings > Secrets to enable the AI Assistant.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isRetryableModelError(err: any): boolean {
  const raw = String(err?.message || err || '');
  const codeMatch = raw.match(/"code"\s*:\s*(\d{3})/);
  if (codeMatch) {
    const code = Number(codeMatch[1]);
    return code === 404 || code === 429 || code >= 500;
  }
  return /high demand|UNAVAILABLE|RESOURCE_EXHAUSTED|temporarily/i.test(raw);
}

async function generateAiContent(ai: GoogleGenAI, params: { contents: any; config?: any }): Promise<any> {
  let lastError: any;
  for (const model of AI_MODELS) {
    try {
      return await ai.models.generateContent({ model, ...params } as any);
    } catch (err: any) {
      lastError = err;
      if (!isRetryableModelError(err)) throw err;
      console.warn(`[HelzerX AI] Model ${model} unavailable, trying next fallback.`);
    }
  }
  throw lastError;
}

function isValidServerId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{4,64}$/.test(id);
}

function normalizeServerPath(rawPath: string, fallback = '/'): string {
  const raw = String(rawPath || fallback).trim().replace(/\\/g, '/');
  const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
  const segments: string[] = [];
  for (const part of prefixed.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      throw new Error('Path traversal ("..") is not allowed.');
    }
    segments.push(part);
  }
  return `/${segments.join('/')}`;
}

function buildPteroHeaders(req: Request, contentType?: string): Record<string, string> {
  const pteroClientKey = process.env.PTERODACTYL_CLIENT_API_KEY || '';
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (authHeader && authHeader.startsWith('Bearer ')) {
    headers['Authorization'] = authHeader;
  } else if (pteroClientKey) {
    headers['Authorization'] = `Bearer ${pteroClientKey}`;
  }
  if (cookieHeader) headers['Cookie'] = cookieHeader;
  if (req.headers['x-xsrf-token']) headers['X-XSRF-TOKEN'] = String(req.headers['x-xsrf-token']);
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

async function pteroRequest(
  req: Request,
  pteroPath: string,
  options: { method?: string; body?: string; contentType?: string; acceptText?: boolean } = {}
): Promise<any> {
  const pteroUrl = (process.env.PTERODACTYL_URL || '').replace(/\/$/, '');
  if (!pteroUrl) {
    throw new Error('PTERODACTYL_URL is not configured on the server.');
  }

  const headers = buildPteroHeaders(req, options.contentType);
  if (options.acceptText) {
    headers['Accept'] = 'text/plain, application/json';
  }

  const res = await fetch(`${pteroUrl}${pteroPath}`, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  if (res.status === 204) return null;

  const text = await res.text();
  if (!res.ok) {
    let msg = `Panel HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.errors?.[0]?.detail || parsed?.message || msg;
    } catch {
      if (text && text.length < 300) msg = text;
    }
    throw new Error(msg);
  }

  if (options.acceptText) return text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function detectLoaderFromText(text: string): ServerLoaderId {
  const lower = text.toLowerCase();
  if (/\bneoforge\b|\bneoforged\b/.test(lower)) return 'neoforge';
  if (/\bforge\b|\bminecraftforge\b/.test(lower)) return 'forge';
  if (/\bquilt\b/.test(lower)) return 'quilt';
  if (/\bfabric\b/.test(lower)) return 'fabric';
  if (/\bfolia\b/.test(lower)) return 'folia';
  if (/\bpurpur\b/.test(lower)) return 'purpur';
  if (/\bpaper\b|\bpapermc\b|\bpufferfish\b/.test(lower)) return 'paper';
  if (/\bspigot\b/.test(lower)) return 'spigot';
  if (/\bcraftbukkit\b|\bbukkit\b/.test(lower)) return 'bukkit';
  if (/\bvelocity\b/.test(lower)) return 'velocity';
  if (/\bwaterfall\b/.test(lower)) return 'waterfall';
  if (/\bbungeecord\b|\bbungee\b/.test(lower)) return 'bungeecord';
  return 'unknown';
}

function extractMcVersion(raw: string | undefined | null): string {
  if (!raw) return '';
  const cleaned = String(raw).trim();
  if (!cleaned || cleaned.toLowerCase() === 'latest' || cleaned.toLowerCase() === 'recommended') {
    return '';
  }
  const match = cleaned.match(/(?:^|[^0-9.])(1\.\d{1,2}(?:\.\d{1,2})?)(?:[^0-9.]|$)/);
  return match ? match[1] : '';
}

function getCompatibleLoaders(loader: ServerLoaderId, kind: 'plugins' | 'mods'): string[] {
  if (kind === 'plugins') {
    switch (loader) {
      case 'folia':
        return ['folia', 'paper'];
      case 'purpur':
        return ['purpur', 'paper', 'spigot', 'bukkit'];
      case 'paper':
        return ['paper', 'spigot', 'bukkit'];
      case 'spigot':
        return ['spigot', 'bukkit'];
      case 'bukkit':
        return ['bukkit'];
      case 'velocity':
        return ['velocity'];
      case 'waterfall':
        return ['waterfall', 'bungeecord'];
      case 'bungeecord':
        return ['bungeecord'];
      default:
        return [];
    }
  }
  switch (loader) {
    case 'forge':
      return ['forge'];
    case 'neoforge':
      return ['neoforge'];
    case 'fabric':
      return ['fabric'];
    case 'quilt':
      return ['quilt', 'fabric'];
    default:
      return [];
  }
}

async function detectServerEnv(req: Request, serverId: string): Promise<{
  serverAttrs: any;
  resources: any;
  startup: any;
  env: DetectedEnv;
}> {
  const [serverRes, resRes, startupRes, rootRes, vhRes, vjRes] = await Promise.allSettled([
    pteroRequest(req, `/api/client/servers/${encodeURIComponent(serverId)}`),
    pteroRequest(req, `/api/client/servers/${encodeURIComponent(serverId)}/resources`),
    pteroRequest(req, `/api/client/servers/${encodeURIComponent(serverId)}/startup`),
    pteroRequest(
      req,
      `/api/client/servers/${encodeURIComponent(serverId)}/files/list?directory=%2F`
    ),
    pteroRequest(
      req,
      `/api/client/servers/${encodeURIComponent(serverId)}/files/contents?file=%2Fversion_history.json`,
      { acceptText: true }
    ),
    pteroRequest(
      req,
      `/api/client/servers/${encodeURIComponent(serverId)}/files/contents?file=%2Fversion.json`,
      { acceptText: true }
    ),
  ]);

  const serverAttrs = serverRes.status === 'fulfilled' ? serverRes.value?.attributes || {} : {};
  const resources = resRes.status === 'fulfilled' ? resRes.value?.attributes || {} : {};
  const startup = startupRes.status === 'fulfilled' ? startupRes.value : null;
  const rootFiles: any[] =
    rootRes.status === 'fulfilled' && Array.isArray(rootRes.value?.data)
      ? rootRes.value.data.map((d: any) => d.attributes)
      : [];

  let loader: ServerLoaderId = 'unknown';
  let mcVersion = '';
  const sources: string[] = [];

  if (vhRes.status === 'fulfilled' && typeof vhRes.value === 'string') {
    try {
      const parsed = JSON.parse(vhRes.value);
      const cur = String(parsed?.currentVersion || parsed?.current_version || '');
      const det = detectLoaderFromText(cur);
      if (det !== 'unknown') loader = det;
      const mc = cur.match(/\(MC:\s*(1\.\d{1,2}(?:\.\d{1,2})?)\)/i)?.[1] || extractMcVersion(cur);
      if (mc) mcVersion = mc;
      if (det !== 'unknown' || mc) sources.push('version_history.json');
    } catch {
      // ignore
    }
  }

  if (!mcVersion && vjRes.status === 'fulfilled' && typeof vjRes.value === 'string') {
    try {
      const parsed = JSON.parse(vjRes.value);
      const v = extractMcVersion(parsed?.id || parsed?.name || parsed?.release_target);
      if (v) {
        mcVersion = v;
        sources.push('version.json');
      }
    } catch {
      // ignore
    }
  }

  const startupVars: any[] = Array.isArray(startup?.data)
    ? startup.data.map((d: any) => d.attributes)
    : [];

  if (startupVars.length > 0) {
    for (const v of startupVars) {
      const key = String(v.env_variable || '').toUpperCase();
      const val = String(v.server_value || v.default_value || '').trim();
      if (!val) continue;
      if (loader === 'unknown') {
        if (key.startsWith('NEOFORGE')) loader = 'neoforge';
        else if (key.startsWith('FORGE')) loader = 'forge';
        else if (key.startsWith('FABRIC')) loader = 'fabric';
        else if (key.startsWith('QUILT')) loader = 'quilt';
        else if (key.startsWith('PAPER')) loader = 'paper';
        else if (key.startsWith('PURPUR')) loader = 'purpur';
        else if (key.startsWith('FOLIA')) loader = 'folia';
        else if (key.startsWith('VELOCITY')) loader = 'velocity';
        else if (key.startsWith('BUNGEE')) loader = 'bungeecord';
      }
      if (!mcVersion && /(MC|MINECRAFT|VERSION)/.test(key)) {
        const extracted = extractMcVersion(val);
        if (extracted) {
          mcVersion = extracted;
          sources.push(`startup:${key}`);
        }
      }
    }
  }

  const fileNames = rootFiles.map((f) => String(f?.name || ''));
  if (loader === 'unknown') {
    const joined = fileNames.join(' ');
    const det = detectLoaderFromText(joined);
    if (det !== 'unknown') {
      loader = det;
      sources.push('server files');
    } else if (fileNames.some((n) => n === 'mods')) {
      loader = 'forge';
      sources.push('/mods folder');
    } else if (fileNames.some((n) => n === 'plugins')) {
      loader = 'paper';
      sources.push('/plugins folder');
    }
  }

  if (loader === 'unknown' && serverAttrs?.invocation) {
    const det = detectLoaderFromText(String(serverAttrs.invocation));
    if (det !== 'unknown') {
      loader = det;
      sources.push('startup command');
    }
  }

  const kind: DetectedEnv['kind'] =
    ['forge', 'neoforge', 'fabric', 'quilt'].includes(loader)
      ? 'mod'
      : loader !== 'unknown'
        ? 'plugin'
        : 'unknown';

  return {
    serverAttrs,
    resources,
    startup,
    env: { loader, mcVersion, kind, sources },
  };
}

function selectBestModrinthVersion(
  versions: any[],
  env: DetectedEnv,
  kind: 'plugins' | 'mods'
): any | null {
  if (!Array.isArray(versions) || versions.length === 0) return null;
  const compatLoaders = getCompatibleLoaders(env.loader, kind);
  const mcMinor = env.mcVersion ? env.mcVersion.split('.').slice(0, 2).join('.') : '';

  const scored = versions
    .filter((v) => Array.isArray(v.files) && v.files.some((f: any) => String(f.filename).endsWith('.jar')))
    .map((v) => {
      const vLoaders: string[] = Array.isArray(v.loaders) ? v.loaders.map((l: string) => l.toLowerCase()) : [];
      const vGames: string[] = Array.isArray(v.game_versions) ? v.game_versions : [];
      let score = 0;

      if (compatLoaders.length > 0) {
        const idx = compatLoaders.findIndex((l) => vLoaders.includes(l));
        if (idx === -1) return { v, score: -1 };
        score += 100 - idx * 12;
      }

      if (env.mcVersion) {
        if (vGames.includes(env.mcVersion)) score += 80;
        else if (mcMinor && vGames.some((g) => g === mcMinor || g.startsWith(`${mcMinor}.`))) score += 45;
        else return { v, score: -1 };
      }

      if (v.version_type === 'release') score += 20;
      else if (v.version_type === 'beta') score += 8;

      return { v, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.v || null;
}

async function pullOrUploadModrinthFile(
  req: Request,
  serverId: string,
  targetDir: string,
  fileUrl: string,
  filename: string
): Promise<void> {
  // Verify allowed CDN host before downloading/pulling
  const parsedUrl = new URL(fileUrl);
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('modrinth.com')) {
    throw new Error(`Blocked untrusted download host: ${parsedUrl.hostname}`);
  }

  // Ensure target folder exists cleanly
  const folderName = targetDir.replace(/^\//, '');
  if (folderName) {
    await pteroRequest(req, `/api/client/servers/${encodeURIComponent(serverId)}/files/create-folder`, {
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify({ root: '/', name: folderName }),
    }).catch(() => {});
  }

  try {
    await pteroRequest(req, `/api/client/servers/${encodeURIComponent(serverId)}/files/pull`, {
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify({
        url: fileUrl,
        directory: targetDir,
        filename,
        use_header: false,
        foreground: true,
      }),
    });
    return;
  } catch {
    // Fallback: download server-side & upload via Pterodactyl signed upload URL
    const uploadInfo = await pteroRequest(
      req,
      `/api/client/servers/${encodeURIComponent(serverId)}/files/upload`
    );
    const signedUrl: string | undefined = uploadInfo?.attributes?.url;
    if (!signedUrl) throw new Error('Unable to pull or upload plugin jar to Wings.');

    const dlRes = await fetch(fileUrl);
    if (!dlRes.ok) throw new Error(`Modrinth download failed (${dlRes.status})`);
    const arrayBuf = await dlRes.arrayBuffer();
    const form = new FormData();
    form.append('files', new Blob([arrayBuf], { type: 'application/java-archive' }), filename);

    const uploadUrl = `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}directory=${encodeURIComponent(targetDir)}`;
    const upRes = await fetch(uploadUrl, { method: 'POST', body: form });
    if (!upRes.ok) throw new Error(`Wings upload failed (${upRes.status})`);
  }
}

const AI_TOOLS: FunctionDeclaration[] = [
  {
    name: 'get_server_overview',
    description:
      'Inspect the active server details, live CPU/RAM/disk resources, detected Minecraft server software (Paper/Purpur/Spigot/Forge/Fabric/etc.), Minecraft version, and startup variables.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'list_server_files',
    description:
      'List files and folders inside a server directory such as "/", "/plugins", "/mods", "/plugins/Essentials", or "/logs".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        directory: {
          type: Type.STRING,
          description: 'Directory path starting with "/", e.g. "/plugins" or "/".',
        },
      },
      required: ['directory'],
    },
  },
  {
    name: 'read_server_file',
    description:
      'Read the text contents of a server file such as a plugin config.yml, messages.yml, server.properties, bukkit.yml, spigot.yml, or /logs/latest.log.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: 'Full file path starting with "/", e.g. "/plugins/Essentials/config.yml".',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'write_server_file',
    description:
      'Write or update a server configuration file (YAML, JSON, TOML, .properties, .txt) to customize plugins, mods, permissions, messages, or gameplay settings.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: 'Full destination file path starting with "/", e.g. "/plugins/Essentials/config.yml".',
        },
        content: {
          type: Type.STRING,
          description: 'Complete updated text content to write into the file.',
        },
      },
      required: ['filePath', 'content'],
    },
  },
  {
    name: 'search_plugins_or_mods',
    description:
      'Search Modrinth (and Spiget for plugins) for plugins or mods compatible with the server software and Minecraft version.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Search query such as plugin/mod name or functionality (e.g. "EssentialsX", "LuckPerms", "economy", "claims", "optimization").',
        },
        kind: {
          type: Type.STRING,
          description: '"plugins" or "mods". Defaults to matching the detected server environment.',
        },
        limit: {
          type: Type.NUMBER,
          description: 'Max results to return (1-10, default 6).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'install_plugin_or_mod',
    description:
      'Download and install a compatible version of a Modrinth plugin or mod (plus any required dependencies) directly into /plugins or /mods on the server.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        projectId: {
          type: Type.STRING,
          description: 'Modrinth project ID or slug (e.g. "luckperms", "vaultunlocked", or project_id from search results).',
        },
        kind: {
          type: Type.STRING,
          description: '"plugins" or "mods".',
        },
      },
      required: ['projectId', 'kind'],
    },
  },
  {
    name: 'delete_server_files',
    description:
      'Delete specified files or plugins/mods from a directory on the server.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        directory: {
          type: Type.STRING,
          description: 'Parent directory path, e.g. "/plugins" or "/mods".',
        },
        files: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Exact filenames inside the directory to remove.',
        },
      },
      required: ['directory', 'files'],
    },
  },
  {
    name: 'send_console_command',
    description:
      'Send a console command to the live running server (e.g. "save-all", "lp sync", "essentials reload", "whitelist list").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: {
          type: Type.STRING,
          description: 'Console command without leading slash.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'power_server',
    description:
      'Send a power signal ("start", "stop", "restart", or "kill") to the server.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        signal: {
          type: Type.STRING,
          description: 'One of "start", "stop", "restart", "kill".',
        },
      },
      required: ['signal'],
    },
  },
  {
    name: 'update_startup_variable',
    description:
      'Update an editable startup environment variable on the server.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        key: {
          type: Type.STRING,
          description: 'Exact env_variable key name (e.g. "MINECRAFT_VERSION", "STARTUP_FLAGS").',
        },
        value: {
          type: Type.STRING,
          description: 'New value for the variable.',
        },
      },
      required: ['key', 'value'],
    },
  },
];

export async function runServerAiAssistant(input: RunAiInput): Promise<RunAiResult> {
  if (!isValidServerId(input.serverId)) {
    throw new Error('Invalid server identifier.');
  }

  const ai = getGeminiClient();
  const actions: AiActionTrace[] = [];
  let mutatingActionCount = 0;

  // Pre-fetch lightweight server snapshot for system context
  const initialCtx = await detectServerEnv(input.req, input.serverId);
  const serverName = String(initialCtx.serverAttrs?.name || input.serverId);

  const systemInstruction = [
    'You are HelzerX Server AI, an expert Minecraft & Pterodactyl hosting assistant.',
    `Active target server: "${serverName}" (ID: ${input.serverId}).`,
    `Detected runtime: loader=${initialCtx.env.loader}, mcVersion=${initialCtx.env.mcVersion || 'unknown'}, kind=${initialCtx.env.kind}.`,
    'Capabilities: You can inspect server files, read & customize plugin/mod configs (YAML/TOML/JSON/properties), search & install compatible plugins/mods from Modrinth, remove broken files, run console commands, update startup variables, and restart servers.',
    'Rules:',
    '1. Always inspect existing files/configs before rewriting them unless creating a brand-new config requested by the user.',
    '2. Preserve valid YAML/JSON/properties syntax and indentation when customizing plugin configs.',
    '3. When installing plugins/mods, prefer Modrinth compatible versions matching the detected loader and Minecraft version.',
    '4. Respond cleanly and concisely in the same language the user wrote in (Sinhala, English, etc.). Do not invent actions you did not execute.',
    '5. Never ask for or mention API keys.',
  ].join('\n');

  const priorTurns: Content[] = input.recentMessages.slice(-8).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text.slice(0, 4000) }],
  }));

  const contents: Content[] = [
    ...priorTurns,
    { role: 'user', parts: [{ text: input.message }] },
  ];

  const executeTool = async (name: string, args: Record<string, any>): Promise<Record<string, any>> => {
    try {
      switch (name) {
        case 'get_server_overview': {
          const fresh = await detectServerEnv(input.req, input.serverId);
          const vars = Array.isArray(fresh.startup?.data)
            ? fresh.startup.data.map((d: any) => ({
                key: d.attributes?.env_variable,
                value: d.attributes?.server_value,
                editable: Boolean(d.attributes?.is_editable),
              }))
            : [];
          actions.push({
            tool: name,
            summary: `Inspected ${fresh.serverAttrs?.name || input.serverId} (${fresh.env.loader} ${fresh.env.mcVersion || ''})`.trim(),
            status: 'success',
          });
          return {
            name: fresh.serverAttrs?.name,
            identifier: fresh.serverAttrs?.identifier,
            node: fresh.serverAttrs?.node,
            limits: fresh.serverAttrs?.limits,
            status: fresh.resources?.current_state,
            resources: fresh.resources?.resources,
            detectedEnv: fresh.env,
            startupVariables: vars,
          };
        }

        case 'list_server_files': {
          const dir = normalizeServerPath(args.directory, '/');
          const res = await pteroRequest(
            input.req,
            `/api/client/servers/${encodeURIComponent(input.serverId)}/files/list?directory=${encodeURIComponent(dir)}`
          );
          const files = (res?.data || []).slice(0, 120).map((d: any) => ({
            name: d.attributes?.name,
            isFile: Boolean(d.attributes?.is_file),
            size: Number(d.attributes?.size || 0),
          }));
          actions.push({
            tool: name,
            summary: `Listed ${files.length} item(s) in ${dir}`,
            target: dir,
            status: 'success',
          });
          return { directory: dir, files };
        }

        case 'read_server_file': {
          const filePath = normalizeServerPath(args.filePath);
          const raw = await pteroRequest(
            input.req,
            `/api/client/servers/${encodeURIComponent(input.serverId)}/files/contents?file=${encodeURIComponent(filePath)}`,
            { acceptText: true }
          );
          const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '', null, 2);
          const truncated = text.length > 40_000;
          actions.push({
            tool: name,
            summary: `Read ${filePath}`,
            target: filePath,
            status: 'success',
          });
          return {
            filePath,
            truncated,
            content: truncated ? `${text.slice(0, 40_000)}\n...[truncated]` : text,
          };
        }

        case 'write_server_file': {
          const filePath = normalizeServerPath(args.filePath);
          const content = String(args.content ?? '');
          if (content.length > 512_000) {
            throw new Error('File content exceeds 512KB limit.');
          }
          const parentParts = filePath.split('/').filter(Boolean);
          if (parentParts.length > 1) {
            const folderName = parentParts[parentParts.length - 2];
            const rootDir = parentParts.length > 2 ? `/${parentParts.slice(0, -2).join('/')}` : '/';
            await pteroRequest(
              input.req,
              `/api/client/servers/${encodeURIComponent(input.serverId)}/files/create-folder`,
              {
                method: 'POST',
                contentType: 'application/json',
                body: JSON.stringify({ root: rootDir, name: folderName }),
              }
            ).catch(() => {});
          }
          await pteroRequest(
            input.req,
            `/api/client/servers/${encodeURIComponent(input.serverId)}/files/write?file=${encodeURIComponent(filePath)}`,
            {
              method: 'POST',
              contentType: 'text/plain',
              body: content,
            }
          );
          mutatingActionCount += 1;
          actions.push({
            tool: name,
            summary: `Updated ${filePath}`,
            target: filePath,
            status: 'success',
          });
          return { ok: true, filePath, bytesWritten: Buffer.byteLength(content, 'utf8') };
        }

        case 'search_plugins_or_mods': {
          const query = String(args.query || '').trim();
          const kind: 'plugins' | 'mods' =
            args.kind === 'mods' || (args.kind !== 'plugins' && initialCtx.env.kind === 'mod')
              ? 'mods'
              : 'plugins';
          const limit = Math.max(1, Math.min(10, Number(args.limit || 6)));
          const compatLoaders = getCompatibleLoaders(initialCtx.env.loader, kind);

          const facets: string[][] = [[`project_type:${kind === 'plugins' ? 'plugin' : 'mod'}`]];
          if (compatLoaders.length > 0) {
            facets.push(compatLoaders.map((l) => `categories:${l}`));
          }
          if (initialCtx.env.mcVersion) {
            facets.push([`versions:${initialCtx.env.mcVersion}`]);
          }

          const url = new URL(`${MODRINTH_API}/search`);
          url.searchParams.set('query', query);
          url.searchParams.set('limit', String(limit));
          url.searchParams.set('index', 'downloads');
          url.searchParams.set('facets', JSON.stringify(facets));

          const mRes = await fetch(url.toString(), {
            headers: { 'User-Agent': 'HelzerX-Panel/1.0' },
          });
          let hits: any[] = [];
          if (mRes.ok) {
            const json: any = await mRes.json();
            hits = json?.hits || [];
          }

          // Fallback without strict MC version facet if zero results
          if (hits.length === 0 && initialCtx.env.mcVersion) {
            const fallbackUrl = new URL(`${MODRINTH_API}/search`);
            fallbackUrl.searchParams.set('query', query);
            fallbackUrl.searchParams.set('limit', String(limit));
            fallbackUrl.searchParams.set('index', 'downloads');
            fallbackUrl.searchParams.set(
              'facets',
              JSON.stringify([[`project_type:${kind === 'plugins' ? 'plugin' : 'mod'}`]])
            );
            const fRes = await fetch(fallbackUrl.toString(), {
              headers: { 'User-Agent': 'HelzerX-Panel/1.0' },
            });
            if (fRes.ok) {
              const fJson: any = await fRes.json();
              hits = fJson?.hits || [];
            }
          }

          let spigetResults: any[] = [];
          if (hits.length === 0 && kind === 'plugins' && query) {
            const sRes = await fetch(
              `${SPIGET_API}/search/resources/${encodeURIComponent(query)}?size=5&sort=-downloads`,
              { headers: { 'User-Agent': 'HelzerX-Panel/1.0' } }
            ).catch(() => null);
            if (sRes && sRes.ok) {
              const sJson: any = await sRes.json();
              spigetResults = (Array.isArray(sJson) ? sJson : []).map((r: any) => ({
                source: 'spiget',
                id: r.id,
                name: r.name,
                tag: r.tag,
                downloads: r.downloads,
              }));
            }
          }

          actions.push({
            tool: name,
            summary: `Searched ${kind} for "${query}" (${hits.length} Modrinth match${hits.length === 1 ? '' : 'es'})`,
            target: query,
            status: 'success',
          });

          return {
            kind,
            detectedEnv: initialCtx.env,
            modrinthResults: hits.map((h: any) => ({
              projectId: h.project_id,
              slug: h.slug,
              title: h.title,
              description: h.description,
              downloads: h.downloads,
            })),
            spigetResults,
          };
        }

        case 'install_plugin_or_mod': {
          const projectId = String(args.projectId || '').trim();
          if (!projectId) throw new Error('projectId is required');
          const kind: 'plugins' | 'mods' =
            args.kind === 'mods' || (args.kind !== 'plugins' && initialCtx.env.kind === 'mod')
              ? 'mods'
              : 'plugins';
          const targetDir = kind === 'plugins' ? '/plugins' : '/mods';

          const verRes = await fetch(
            `${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version`,
            { headers: { 'User-Agent': 'HelzerX-Panel/1.0' } }
          );
          if (!verRes.ok) {
            throw new Error(`Modrinth project "${projectId}" not found (${verRes.status}).`);
          }
          const versions: any[] = await verRes.json();
          const chosen = selectBestModrinthVersion(versions, initialCtx.env, kind);
          if (!chosen) {
            throw new Error(
              `No compatible ${kind.slice(0, -1)} version found for ${initialCtx.env.loader} ${initialCtx.env.mcVersion || ''}.`
            );
          }

          const installedFiles: string[] = [];
          const existingRes = await pteroRequest(
            input.req,
            `/api/client/servers/${encodeURIComponent(input.serverId)}/files/list?directory=${encodeURIComponent(targetDir)}`
          ).catch(() => ({ data: [] }));
          const existingNames = new Set<string>(
            (existingRes?.data || []).map((d: any) => String(d.attributes?.name || '').toLowerCase())
          );

          // Install required dependencies first
          const deps = Array.isArray(chosen.dependencies)
            ? chosen.dependencies.filter((d: any) => d.dependency_type === 'required' && d.project_id)
            : [];
          for (const dep of deps.slice(0, 4)) {
            try {
              const dVerRes = await fetch(
                `${MODRINTH_API}/project/${encodeURIComponent(dep.project_id)}/version`,
                { headers: { 'User-Agent': 'HelzerX-Panel/1.0' } }
              );
              if (!dVerRes.ok) continue;
              const dVersions: any[] = await dVerRes.json();
              const dBest = selectBestModrinthVersion(dVersions, initialCtx.env, kind);
              const dFile = dBest?.files?.find((f: any) => f.primary) || dBest?.files?.[0];
              if (dFile && !existingNames.has(String(dFile.filename).toLowerCase())) {
                await pullOrUploadModrinthFile(
                  input.req,
                  input.serverId,
                  targetDir,
                  dFile.url,
                  dFile.filename
                );
                installedFiles.push(dFile.filename);
                existingNames.add(String(dFile.filename).toLowerCase());
              }
            } catch {
              // non-fatal dependency skip
            }
          }

          const primaryFile = chosen.files.find((f: any) => f.primary) || chosen.files[0];
          if (!primaryFile) throw new Error('Chosen version has no downloadable .jar file.');

          await pullOrUploadModrinthFile(
            input.req,
            input.serverId,
            targetDir,
            primaryFile.url,
            primaryFile.filename
          );
          installedFiles.push(primaryFile.filename);

          mutatingActionCount += 1;
          actions.push({
            tool: name,
            summary: `Installed ${primaryFile.filename} (${chosen.version_number}) into ${targetDir}`,
            target: `${targetDir}/${primaryFile.filename}`,
            status: 'success',
          });

          return {
            ok: true,
            directory: targetDir,
            versionNumber: chosen.version_number,
            gameVersions: chosen.game_versions,
            loaders: chosen.loaders,
            installedFiles,
          };
        }

        case 'delete_server_files': {
          const dir = normalizeServerPath(args.directory, '/plugins');
          const files = Array.isArray(args.files) ? args.files.map((f: any) => String(f)) : [];
          if (files.length === 0) throw new Error('No files specified.');
          await pteroRequest(
            input.req,
            `/api/client/servers/${encodeURIComponent(input.serverId)}/files/delete`,
            {
              method: 'POST',
              contentType: 'application/json',
              body: JSON.stringify({ root: dir, files }),
            }
          );
          mutatingActionCount += 1;
          actions.push({
            tool: name,
            summary: `Deleted ${files.join(', ')} from ${dir}`,
            target: dir,
            status: 'success',
          });
          return { ok: true, directory: dir, deleted: files };
        }

        case 'send_console_command': {
          const command = String(args.command || '').trim();
          if (!command) throw new Error('Command is empty.');
          await pteroRequest(
            input.req,
            `/api/client/servers/${encodeURIComponent(input.serverId)}/command`,
            {
              method: 'POST',
              contentType: 'application/json',
              body: JSON.stringify({ command }),
            }
          );
          mutatingActionCount += 1;
          actions.push({
            tool: name,
            summary: `Ran console command "${command}"`,
            target: command,
            status: 'success',
          });
          return { ok: true, command };
        }

        case 'power_server': {
          const signal = String(args.signal || '').toLowerCase();
          if (!['start', 'stop', 'restart', 'kill'].includes(signal)) {
            throw new Error(`Invalid power signal "${signal}".`);
          }
          if ((signal === 'start' || signal === 'restart') && input.isGlobalLocked && !input.isAdmin) {
            throw new Error('Server start is currently locked by Administration.');
          }
          await pteroRequest(
            input.req,
            `/api/client/servers/${encodeURIComponent(input.serverId)}/power`,
            {
              method: 'POST',
              contentType: 'application/json',
              body: JSON.stringify({ signal }),
            }
          );
          mutatingActionCount += 1;
          actions.push({
            tool: name,
            summary: `Sent power signal "${signal}"`,
            target: serverName,
            status: 'success',
          });
          return { ok: true, signal };
        }

        case 'update_startup_variable': {
          const key = String(args.key || '').trim();
          const value = String(args.value ?? '');
          if (!key) throw new Error('Variable key is required.');
          await pteroRequest(
            input.req,
            `/api/client/servers/${encodeURIComponent(input.serverId)}/startup/variable`,
            {
              method: 'PUT',
              contentType: 'application/json',
              body: JSON.stringify({ key, value }),
            }
          );
          mutatingActionCount += 1;
          actions.push({
            tool: name,
            summary: `Updated startup variable ${key}`,
            target: key,
            status: 'success',
          });
          return { ok: true, key, value };
        }

        default:
          return { error: `Unknown tool ${name}` };
      }
    } catch (err: any) {
      actions.push({
        tool: name,
        summary: err?.message || `Failed ${name}`,
        status: 'error',
      });
      return { error: err?.message || 'Tool execution failed.' };
    }
  };

  let finalText = '';

  for (let step = 0; step < input.maxSteps; step++) {
    const response = await generateAiContent(ai, {
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: AI_TOOLS }],
      },
    });

    const modelContent = response.candidates?.[0]?.content;
    const calls = response.functionCalls;

    if (!calls || calls.length === 0) {
      finalText = (response.text || '').trim();
      break;
    }

    if (modelContent) {
      contents.push(modelContent);
    }

    const responseParts = [];
    for (const call of calls) {
      const result = await executeTool(call.name || '', (call.args as Record<string, any>) || {});
      responseParts.push({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: result,
        },
      });
    }

    contents.push({
      role: 'user',
      parts: responseParts,
    });

    // If this was the final allowed tool step, ask for a concise summary without tools
    if (step === input.maxSteps - 1) {
      const wrapUp = await generateAiContent(ai, {
        contents,
        config: {
          systemInstruction,
        },
      });
      finalText = (wrapUp.text || '').trim();
    }
  }

  return {
    reply: finalText || 'Done. Review the executed server actions below.',
    serverName,
    actions,
    mutatingActionCount,
  };
}
