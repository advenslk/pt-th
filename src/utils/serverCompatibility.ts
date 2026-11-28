import { panelApi } from '../api/client';
import type { FileEntry, PterodactylServer, ServerStartupData } from '../types/panel';

export type ServerLoaderId =
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

export interface DetectedServerEnv {
  loader: ServerLoaderId;
  loaderLabel: string;
  kind: 'plugin' | 'mod' | 'unknown';
  mcVersion: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
}

export interface ModrinthVersionCandidate {
  id: string;
  name: string;
  version_number: string;
  version_type?: 'release' | 'beta' | 'alpha' | string;
  date_published?: string;
  game_versions: string[];
  loaders: string[];
  dependencies?: Array<{
    version_id?: string | null;
    project_id?: string | null;
    file_name?: string | null;
    dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded' | string;
  }>;
  files: Array<{
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }>;
}

export const LOADER_LABELS: Record<ServerLoaderId, string> = {
  paper: 'Paper',
  purpur: 'Purpur',
  spigot: 'Spigot',
  bukkit: 'Bukkit / CraftBukkit',
  folia: 'Folia',
  velocity: 'Velocity',
  bungeecord: 'BungeeCord',
  waterfall: 'Waterfall',
  forge: 'Forge',
  neoforge: 'NeoForge',
  fabric: 'Fabric',
  quilt: 'Quilt',
  unknown: 'Unknown',
};

const MOD_LOADERS: ReadonlySet<ServerLoaderId> = new Set(['forge', 'neoforge', 'fabric', 'quilt']);
const PLUGIN_LOADERS: ReadonlySet<ServerLoaderId> = new Set([
  'paper',
  'purpur',
  'spigot',
  'bukkit',
  'folia',
  'velocity',
  'bungeecord',
  'waterfall',
]);

export function extractMcVersion(raw: string | undefined | null): string {
  if (!raw) return '';
  const cleaned = String(raw).trim();
  if (!cleaned || cleaned.toLowerCase() === 'latest' || cleaned.toLowerCase() === 'recommended') {
    return '';
  }
  const match = cleaned.match(/(?:^|[^0-9.])(1\.\d{1,2}(?:\.\d{1,2})?)(?:[^0-9.]|$)/);
  return match ? match[1] : '';
}

function neoForgeBuildToMcVersion(build: string): string {
  // NeoForge uses e.g. 21.1.72 -> MC 1.21.1, 21.0.143 -> MC 1.21, 20.4.237 -> MC 1.20.4
  const m = build.trim().match(/^(\d{2})\.(\d+)\.\d+/);
  if (!m) return '';
  const major = m[1];
  const minor = m[2];
  return minor === '0' ? `1.${major}` : `1.${major}.${minor}`;
}

function detectLoaderFromText(text: string): ServerLoaderId {
  const lower = text.toLowerCase();
  if (/\bneoforge\b|\bneoforged\b/.test(lower)) return 'neoforge';
  if (/\bforge\b|\bminecraftforge\b/.test(lower)) return 'forge';
  if (/\bquilt\b/.test(lower)) return 'quilt';
  if (/\bfabric\b/.test(lower)) return 'fabric';
  if (/\bfolia\b/.test(lower)) return 'folia';
  if (/\bpurpur\b/.test(lower)) return 'purpur';
  if (/\bpaper\b|\bpapermc\b/.test(lower)) return 'paper';
  if (/\bpufferfish\b/.test(lower)) return 'paper';
  if (/\bspigot\b/.test(lower)) return 'spigot';
  if (/\bcraftbukkit\b|\bbukkit\b/.test(lower)) return 'bukkit';
  if (/\bvelocity\b/.test(lower)) return 'velocity';
  if (/\bwaterfall\b/.test(lower)) return 'waterfall';
  if (/\bbungeecord\b|\bbungee\b/.test(lower)) return 'bungeecord';
  return 'unknown';
}

export function getLoaderKind(loader: ServerLoaderId): 'plugin' | 'mod' | 'unknown' {
  if (MOD_LOADERS.has(loader)) return 'mod';
  if (PLUGIN_LOADERS.has(loader)) return 'plugin';
  return 'unknown';
}

export function getCompatibleLoaders(
  loader: ServerLoaderId | string,
  mode: 'plugins' | 'mods'
): string[] {
  const id = String(loader).toLowerCase() as ServerLoaderId;
  if (mode === 'plugins') {
    switch (id) {
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
  } else {
    switch (id) {
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
}

export async function detectServerEnvironment(server: PterodactylServer): Promise<DetectedServerEnv> {
  const sources: string[] = [];
  let loader: ServerLoaderId = 'unknown';
  let mcVersion = '';

  const [startupRes, rootFilesRes, versionHistoryRes, versionJsonRes] = await Promise.allSettled([
    panelApi.getServerStartup(server.id),
    panelApi.listFiles(server.id, '/'),
    panelApi.getFileContents(server.id, '/version_history.json'),
    panelApi.getFileContents(server.id, '/version.json'),
  ]);

  const startup: ServerStartupData | null =
    startupRes.status === 'fulfilled' ? startupRes.value : null;
  const rootFiles: FileEntry[] =
    rootFilesRes.status === 'fulfilled' ? rootFilesRes.value : [];

  // 1. Inspect version_history.json (Paper / Purpur / Folia / Spigot)
  if (versionHistoryRes.status === 'fulfilled' && versionHistoryRes.value) {
    try {
      const parsed = JSON.parse(versionHistoryRes.value);
      const current = String(parsed?.currentVersion || parsed?.current_version || '');
      if (current) {
        const detected = detectLoaderFromText(current);
        if (detected !== 'unknown') {
          loader = detected;
        }
        const mcMatch = current.match(/\(MC:\s*(1\.\d{1,2}(?:\.\d{1,2})?)\)/i) || [];
        const v = mcMatch[1] || extractMcVersion(current);
        if (v) {
          mcVersion = v;
        }
        if (detected !== 'unknown' || v) {
          sources.push('version_history.json');
        }
      }
    } catch {
      // ignore invalid JSON
    }
  }

  // 2. Inspect version.json (Vanilla / Fabric / Paper unpacked)
  if (!mcVersion && versionJsonRes.status === 'fulfilled' && versionJsonRes.value) {
    try {
      const parsed = JSON.parse(versionJsonRes.value);
      const v = extractMcVersion(parsed?.id || parsed?.name || parsed?.release_target);
      if (v) {
        mcVersion = v;
        sources.push('version.json');
      }
    } catch {
      // ignore
    }
  }

  // 3. Inspect Pterodactyl startup variables & command
  if (startup) {
    const varMap = new Map<string, string>();
    for (const v of startup.variables) {
      varMap.set(v.envVariable.toUpperCase(), String(v.serverValue || v.defaultValue || '').trim());
    }

    const versionKeys = [
      'MINECRAFT_VERSION',
      'MC_VERSION',
      'PAPER_VERSION',
      'PURPUR_VERSION',
      'FABRIC_VERSION',
      'FORGE_VERSION',
      'NEOFORGE_VERSION',
      'QUILT_VERSION',
      'VELOCITY_VERSION',
      'BUNGEE_VERSION',
      'VANILLA_VERSION',
      'SERVER_VERSION',
      'VERSION',
    ];

    for (const key of versionKeys) {
      const val = varMap.get(key);
      if (!val) continue;
      if (loader === 'unknown') {
        if (key.startsWith('NEOFORGE')) loader = 'neoforge';
        else if (key.startsWith('FORGE')) loader = 'forge';
        else if (key.startsWith('FABRIC')) loader = 'fabric';
        else if (key.startsWith('QUILT')) loader = 'quilt';
        else if (key.startsWith('PAPER')) loader = 'paper';
        else if (key.startsWith('PURPUR')) loader = 'purpur';
        else if (key.startsWith('VELOCITY')) loader = 'velocity';
        else if (key.startsWith('BUNGEE')) loader = 'bungeecord';
      }
      if (!mcVersion) {
        const extracted =
          key.startsWith('NEOFORGE') && !val.startsWith('1.')
            ? neoForgeBuildToMcVersion(val)
            : extractMcVersion(val);
        if (extracted) {
          mcVersion = extracted;
          sources.push(`Startup (${key})`);
        }
      }
    }

    const jarfile = varMap.get('SERVER_JARFILE') || '';
    const project = varMap.get('PROJECT') || '';
    const combinedStartupText = `${project} ${jarfile} ${startup.startupCommand} ${server.startupCommand} ${server.egg} ${server.dockerImage}`;

    if (loader === 'unknown') {
      const fromStartup = detectLoaderFromText(combinedStartupText);
      if (fromStartup !== 'unknown') {
        loader = fromStartup;
        sources.push('Startup / Egg');
      }
    }
    if (!mcVersion && jarfile) {
      const fromJar = extractMcVersion(jarfile);
      if (fromJar) {
        mcVersion = fromJar;
        sources.push('SERVER_JARFILE');
      }
    }
  } else {
    const fallbackLoader = detectLoaderFromText(
      `${server.egg} ${server.startupCommand} ${server.dockerImage} ${server.name}`
    );
    if (loader === 'unknown' && fallbackLoader !== 'unknown') {
      loader = fallbackLoader;
      sources.push('Egg metadata');
    }
  }

  // 4. Inspect root directory files & markers
  const names = rootFiles.map((f) => f.name);
  const lowerNames = new Set(names.map((n) => n.toLowerCase()));

  if (loader === 'unknown') {
    if (lowerNames.has('purpur.yml')) loader = 'purpur';
    else if (lowerNames.has('paper.yml')) loader = 'paper';
    else if (lowerNames.has('velocity.toml')) loader = 'velocity';
    else if (lowerNames.has('waterfall.yml')) loader = 'waterfall';
    else if (lowerNames.has('.fabric')) loader = 'fabric';
    else if (lowerNames.has('.quilt') || lowerNames.has('quilt-server-launch.jar')) loader = 'quilt';
    else if (lowerNames.has('spigot.yml')) loader = 'spigot';
    else if (lowerNames.has('bukkit.yml')) loader = 'bukkit';
    if (loader !== 'unknown') sources.push('Server config files');
  }

  // Check jar filenames in root directory for loader + version
  for (const fname of names) {
    if (!fname.toLowerCase().endsWith('.jar')) continue;
    const jarLoader = detectLoaderFromText(fname);
    if (loader === 'unknown' && jarLoader !== 'unknown') {
      loader = jarLoader;
      sources.push(fname);
    }
    if (!mcVersion) {
      const jarVer = extractMcVersion(fname);
      if (jarVer) {
        mcVersion = jarVer;
        if (!sources.includes(fname)) sources.push(fname);
      }
    }
  }

  // Check NeoForge / Forge / Fabric directories inside /libraries or /config if still missing info
  if ((loader === 'unknown' || !mcVersion) && lowerNames.has('libraries')) {
    const [neoRes, forgeRes, fabricRes] = await Promise.allSettled([
      panelApi.listFiles(server.id, '/libraries/net/neoforged/neoforge'),
      panelApi.listFiles(server.id, '/libraries/net/minecraftforge/forge'),
      panelApi.listFiles(server.id, '/libraries/net/fabricmc/fabric-loader'),
    ]);

    if (neoRes.status === 'fulfilled' && neoRes.value.length > 0) {
      if (loader === 'unknown' || loader === 'forge') loader = 'neoforge';
      if (!mcVersion) {
        const dirName = neoRes.value.find((d) => d.isDirectory)?.name || '';
        const v = neoForgeBuildToMcVersion(dirName) || extractMcVersion(dirName);
        if (v) mcVersion = v;
      }
      sources.push('libraries/net/neoforged');
    } else if (forgeRes.status === 'fulfilled' && forgeRes.value.length > 0) {
      if (loader === 'unknown') loader = 'forge';
      if (!mcVersion) {
        const dirName = forgeRes.value.find((d) => d.isDirectory)?.name || '';
        const v = extractMcVersion(dirName);
        if (v) mcVersion = v;
      }
      sources.push('libraries/net/minecraftforge');
    } else if (fabricRes.status === 'fulfilled' && fabricRes.value.length > 0) {
      if (loader === 'unknown') loader = 'fabric';
      sources.push('libraries/net/fabricmc');
    }
  }

  // Check /config for paper-global.yml (Paper 1.19+)
  if (loader === 'unknown' && lowerNames.has('config')) {
    try {
      const cfgFiles = await panelApi.listFiles(server.id, '/config');
      const cfgNames = new Set(cfgFiles.map((f) => f.name.toLowerCase()));
      if (cfgNames.has('paper-global.yml')) {
        loader = 'paper';
        sources.push('config/paper-global.yml');
      }
    } catch {
      // ignore
    }
  }

  // 5. Fallback: check /logs/latest.log for exact version and loader banner
  if ((loader === 'unknown' || !mcVersion) && lowerNames.has('logs')) {
    try {
      const logText = await panelApi.getFileContents(server.id, '/logs/latest.log');
      const head = logText.slice(0, 6000);
      if (loader === 'unknown') {
        const logLoader = detectLoaderFromText(head);
        if (logLoader !== 'unknown') {
          loader = logLoader;
          sources.push('logs/latest.log');
        }
      }
      if (!mcVersion) {
        const mcMatches =
          head.match(/Starting minecraft server version\s+(1\.\d{1,2}(?:\.\d{1,2})?)/i) ||
          head.match(/\(MC:\s*(1\.\d{1,2}(?:\.\d{1,2})?)\)/i) ||
          head.match(/Loading Minecraft\s+(1\.\d{1,2}(?:\.\d{1,2})?)/i) ||
          head.match(/for Minecraft\s+(1\.\d{1,2}(?:\.\d{1,2})?)/i);
        if (mcMatches?.[1]) {
          mcVersion = mcMatches[1];
          if (!sources.includes('logs/latest.log')) sources.push('logs/latest.log');
        }
      }
    } catch {
      // ignore missing/unreadable latest.log
    }
  }

  const confidence: DetectedServerEnv['confidence'] =
    loader !== 'unknown' && mcVersion
      ? 'high'
      : loader !== 'unknown' || mcVersion
        ? 'medium'
        : 'low';

  return {
    loader,
    loaderLabel: LOADER_LABELS[loader] || 'Unknown',
    kind: getLoaderKind(loader),
    mcVersion,
    confidence,
    sources,
  };
}

export interface VersionSelectionResult {
  version: ModrinthVersionCandidate | null;
  matchType: 'exact' | 'compatible-loader' | 'patch-fallback' | 'incompatible';
  matchedLoader: string | null;
  reason: string;
}

export function selectBestModrinthVersion(
  versions: ModrinthVersionCandidate[],
  opts: {
    loader: string;
    mcVersion: string;
    mode: 'plugins' | 'mods';
  }
): VersionSelectionResult {
  const validVersions = (versions || []).filter((v) =>
    v.files?.some((f) => f.url && f.filename.toLowerCase().endsWith('.jar'))
  );

  if (validVersions.length === 0) {
    return {
      version: null,
      matchType: 'incompatible',
      matchedLoader: null,
      reason: 'No downloadable .jar releases exist for this project on Modrinth.',
    };
  }

  const targetLoader = opts.loader && opts.loader !== 'all' && opts.loader !== 'unknown' ? opts.loader.toLowerCase() : '';
  const compatibleLoaders = targetLoader ? getCompatibleLoaders(targetLoader, opts.mode) : [];
  const targetMc = opts.mcVersion.trim();
  const targetMajorMinor = targetMc.match(/^(1\.\d{1,2})/)?.[1] || '';

  const releaseRank = (t?: string) => (t === 'release' ? 3 : t === 'beta' ? 2 : 1);

  type Scored = {
    v: ModrinthVersionCandidate;
    loaderRank: number;
    matchedLoader: string | null;
    mcRank: number; // 2 = exact MC, 1 = same 1.x minor (plugins only), 0 = none
    score: number;
  };

  const scored: Scored[] = validVersions.map((v) => {
    const vLoaders = (v.loaders || []).map((l) => l.toLowerCase());
    const vMc = v.game_versions || [];

    let loaderRank = 0;
    let matchedLoader: string | null = vLoaders[0] || null;
    if (compatibleLoaders.length > 0) {
      const idx = compatibleLoaders.findIndex((cl) => vLoaders.includes(cl));
      if (idx !== -1) {
        // Primary loader scores higher than fallback (e.g. forge/paper > spigot > bukkit)
        loaderRank = compatibleLoaders.length - idx;
        matchedLoader = compatibleLoaders[idx];
      }
    } else {
      loaderRank = 1; // no loader filter active
    }

    let mcRank = 0;
    if (!targetMc) {
      mcRank = 2;
    } else if (vMc.includes(targetMc)) {
      mcRank = 2;
    } else if (
      opts.mode === 'plugins' &&
      targetMajorMinor &&
      vMc.some((gv) => gv === targetMajorMinor || gv.startsWith(`${targetMajorMinor}.`))
    ) {
      // Spigot/Paper plugins often support the whole 1.21.x line even if only 1.21 is tagged
      mcRank = 1;
    }

    const timeScore = v.date_published ? Math.floor(new Date(v.date_published).getTime() / 1_000_000_000) : 0;
    const score =
      (loaderRank > 0 ? 1_000_000 : 0) +
      loaderRank * 50_000 +
      mcRank * 100_000 +
      releaseRank(v.version_type) * 1_000 +
      timeScore;

    return { v, loaderRank, matchedLoader, mcRank, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const exactMatch = scored.find((s) => s.loaderRank > 0 && s.mcRank === 2);
  if (exactMatch) {
    const primaryLoader = compatibleLoaders[0];
    const isExactPrimary = !primaryLoader || exactMatch.matchedLoader === primaryLoader;
    return {
      version: exactMatch.v,
      matchType: isExactPrimary ? 'exact' : 'compatible-loader',
      matchedLoader: exactMatch.matchedLoader,
      reason: `Matched ${exactMatch.matchedLoader || 'server'} · ${targetMc || 'latest MC'}`,
    };
  }

  // For plugins, allow same 1.x minor patch fallback (e.g., plugin tagged 1.21 on Paper 1.21.1)
  if (opts.mode === 'plugins') {
    const patchMatch = scored.find((s) => s.loaderRank > 0 && s.mcRank === 1);
    if (patchMatch) {
      return {
        version: patchMatch.v,
        matchType: 'patch-fallback',
        matchedLoader: patchMatch.matchedLoader,
        reason: `Closest ${patchMatch.matchedLoader || 'plugin'} build (${patchMatch.v.game_versions.slice(-2).join(', ')}) for MC ${targetMc}`,
      };
    }
  }

  // No compatible build found for requested loader + MC version
  const availLoaders = Array.from(new Set(validVersions.flatMap((v) => v.loaders))).slice(0, 4).join(', ');
  const availMc = Array.from(new Set(validVersions.flatMap((v) => v.game_versions))).slice(-5).join(', ');
  return {
    version: null,
    matchType: 'incompatible',
    matchedLoader: null,
    reason: `No compatible release found for ${targetLoader || 'this server'}${targetMc ? ` ${targetMc}` : ''}. Available: [${availLoaders}] (${availMc})`,
  };
}
