import { panelApi } from '../api/client';
import type { FileEntry, PterodactylServer, ServerSchedule, ServerStartupData } from '../types/panel';

export type OptimizePreset = 'balanced' | 'performance' | 'eco';

export interface ManualOptimizeOptions {
  preset: OptimizePreset;
  tuneConfigs: boolean;
  tuneStartupFlags: boolean;
  cleanLogsAndCrash: boolean;
  flushConsole: boolean;
  ensureSchedule: boolean;
  restartAfter: boolean;
}

export interface AutoOptimizeSettings {
  enabled: boolean;
  preset: OptimizePreset;
  intervalSeconds: number;
  cooldownMinutes: number;
  cpuThreshold: number;
  ramThreshold: number;
  diskThreshold: number;
  autoCleanLogs: boolean;
  autoTuneConfigs: boolean;
  autoFlushConsole: boolean;
  autoRestartOnCriticalRam: boolean;
  disabledServerIds: string[];
}

export interface OptimizeIssue {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}

export interface ServerAuditReport {
  serverId: string;
  serverName: string;
  runtimeLabel: string;
  isMinecraft: boolean;
  isNodeApp: boolean;
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  cpuPct: number;
  memPct: number;
  diskPct: number;
  reclaimableBytes: number;
  reclaimableFiles: Array<{ root: string; name: string; size: number }>;
  detectedConfigFiles: string[];
  tunableConfigs: string[];
  startupOptimized: boolean;
  editableFlagVar: string | null;
  hasRestartSchedule: boolean;
  issues: OptimizeIssue[];
  scannedAt: string;
}

export interface OptimizeRunLogEntry {
  id: string;
  serverId: string;
  serverName: string;
  trigger: 'auto' | 'manual' | 'batch';
  preset: OptimizePreset;
  timestamp: string;
  scoreBefore: number;
  scoreAfter: number;
  freedBytes: number;
  actions: string[];
  skipped: string[];
  status: 'optimized' | 'healthy' | 'partial' | 'error';
  errorMessage?: string;
}

const KEYS = {
  autoSettings: 'helzerx_auto_optimize_settings',
  history: 'helzerx_optimize_history',
  lastRunMap: 'helzerx_auto_optimize_last_run',
};

export const DEFAULT_MANUAL_OPTIONS: ManualOptimizeOptions = {
  preset: 'balanced',
  tuneConfigs: true,
  tuneStartupFlags: true,
  cleanLogsAndCrash: true,
  flushConsole: true,
  ensureSchedule: false,
  restartAfter: false,
};

export const DEFAULT_AUTO_OPTIMIZE_SETTINGS: AutoOptimizeSettings = {
  enabled: false,
  preset: 'balanced',
  intervalSeconds: 60,
  cooldownMinutes: 15,
  cpuThreshold: 85,
  ramThreshold: 88,
  diskThreshold: 85,
  autoCleanLogs: true,
  autoTuneConfigs: true,
  autoFlushConsole: true,
  autoRestartOnCriticalRam: false,
  disabledServerIds: [],
};

export function loadAutoOptimizeSettings(): AutoOptimizeSettings {
  try {
    const raw = localStorage.getItem(KEYS.autoSettings);
    if (!raw) return DEFAULT_AUTO_OPTIMIZE_SETTINGS;
    const p = JSON.parse(raw);
    return {
      enabled: Boolean(p.enabled),
      preset: p.preset === 'performance' || p.preset === 'eco' ? p.preset : 'balanced',
      intervalSeconds: [30, 60, 180, 300].includes(Number(p.intervalSeconds)) ? Number(p.intervalSeconds) : 60,
      cooldownMinutes: Math.min(180, Math.max(5, Number(p.cooldownMinutes) || 15)),
      cpuThreshold: Math.min(99, Math.max(40, Number(p.cpuThreshold) || 85)),
      ramThreshold: Math.min(99, Math.max(40, Number(p.ramThreshold) || 88)),
      diskThreshold: Math.min(99, Math.max(50, Number(p.diskThreshold) || 85)),
      autoCleanLogs: p.autoCleanLogs !== false,
      autoTuneConfigs: p.autoTuneConfigs !== false,
      autoFlushConsole: p.autoFlushConsole !== false,
      autoRestartOnCriticalRam: Boolean(p.autoRestartOnCriticalRam),
      disabledServerIds: Array.isArray(p.disabledServerIds) ? p.disabledServerIds.map(String) : [],
    };
  } catch {
    return DEFAULT_AUTO_OPTIMIZE_SETTINGS;
  }
}

export function saveAutoOptimizeSettings(settings: AutoOptimizeSettings) {
  try {
    localStorage.setItem(KEYS.autoSettings, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function loadOptimizeHistory(): OptimizeRunLogEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.history);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 60) : [];
  } catch {
    return [];
  }
}

export function saveOptimizeHistory(list: OptimizeRunLogEntry[]) {
  try {
    localStorage.setItem(KEYS.history, JSON.stringify(list.slice(0, 60)));
  } catch {
    // ignore storage errors
  }
}

export function loadLastAutoRunMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEYS.lastRunMap);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLastAutoRunMap(map: Record<string, number>) {
  try {
    localStorage.setItem(KEYS.lastRunMap, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function detectRuntime(server: PterodactylServer, rootFiles: FileEntry[]): {
  label: string;
  isMinecraft: boolean;
  isNodeApp: boolean;
} {
  const names = new Set(rootFiles.map((f) => f.name.toLowerCase()));
  const hint = `${server.egg} ${server.startupCommand} ${server.dockerImage}`.toLowerCase();

  if (names.has('purpur.yml') || hint.includes('purpur')) {
    return { label: 'PurpurMC', isMinecraft: true, isNodeApp: false };
  }
  if (names.has('paper.yml') || names.has('config') && hint.includes('paper') || hint.includes('paper')) {
    return { label: 'PaperMC', isMinecraft: true, isNodeApp: false };
  }
  if (names.has('velocity.toml') || hint.includes('velocity')) {
    return { label: 'Velocity Proxy', isMinecraft: false, isNodeApp: false };
  }
  if (names.has('spigot.yml') || names.has('bukkit.yml') || names.has('server.properties') || hint.includes('spigot') || hint.includes('forge') || hint.includes('fabric') || hint.includes('minecraft')) {
    return { label: 'Minecraft Java', isMinecraft: true, isNodeApp: false };
  }
  if (names.has('package.json') || hint.includes('node') || hint.includes('npm')) {
    return { label: 'Node.js Runtime', isMinecraft: false, isNodeApp: true };
  }
  if (names.has('requirements.txt') || hint.includes('python')) {
    return { label: 'Python Runtime', isMinecraft: false, isNodeApp: false };
  }
  return { label: server.egg || 'Container', isMinecraft: false, isNodeApp: false };
}

function buildAikarFlags(memoryMb: number): string {
  const heapMb = Math.max(512, memoryMb > 1024 ? Math.round(memoryMb * 0.85) : memoryMb);
  const largeHeap = memoryMb >= 12288;
  return [
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:+AlwaysPreTouch',
    `-XX:G1NewSizePercent=${largeHeap ? 40 : 30}`,
    `-XX:G1MaxNewSizePercent=${largeHeap ? 50 : 40}`,
    `-XX:G1HeapRegionSize=${largeHeap ? '16M' : '8M'}`,
    `-XX:G1ReservePercent=${largeHeap ? 15 : 20}`,
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    `-XX:InitiatingHeapOccupancyPercent=${largeHeap ? 20 : 15}`,
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1',
    `-Dusing.aikars.flags=https://mcflags.emc.gs`,
    `-Daikars.new.flags=true`,
    `-Xms${Math.min(heapMb, 1024)}M`,
  ].join(' ');
}

function findEditableFlagVariable(startup: ServerStartupData | null): {
  envVariable: string;
  currentValue: string;
} | null {
  if (!startup) return null;
  const preferredNames = [
    'JVM_ARGS',
    'JAVA_ARGS',
    'FLAGS',
    'EXTRA_FLAGS',
    'ADDITIONAL_ARGS',
    'STARTUP_FLAGS',
    'JVM_FLAGS',
    'NODE_OPTIONS',
    'NODE_ARGS',
  ];
  for (const key of preferredNames) {
    const found = startup.variables.find((v) => v.isEditable && v.envVariable.toUpperCase() === key);
    if (found) return { envVariable: found.envVariable, currentValue: found.serverValue || found.defaultValue || '' };
  }
  const fuzzy = startup.variables.find(
    (v) =>
      v.isEditable &&
      /(jvm|java|flag|arg|node_opt)/i.test(`${v.envVariable} ${v.name}`)
  );
  return fuzzy ? { envVariable: fuzzy.envVariable, currentValue: fuzzy.serverValue || fuzzy.defaultValue || '' } : null;
}

export function updatePropertiesContent(
  raw: string,
  updates: Record<string, string>
): { content: string; changedKeys: string[] } {
  const lines = raw.split(/\r?\n/);
  const seen = new Set<string>();
  const changedKeys: string[] = [];

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) return line;
    const key = line.slice(0, eqIdx).trim();
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      seen.add(key);
      const nextVal = updates[key];
      const curVal = line.slice(eqIdx + 1).trim();
      if (curVal !== nextVal) {
        changedKeys.push(`${key}: ${curVal || '(empty)'} -> ${nextVal}`);
        return `${key}=${nextVal}`;
      }
    }
    return line;
  });

  for (const [key, val] of Object.entries(updates)) {
    if (!seen.has(key)) {
      changedKeys.push(`${key}: (added) -> ${val}`);
      updatedLines.push(`${key}=${val}`);
    }
  }

  return {
    content: updatedLines.join('\n'),
    changedKeys,
  };
}

/**
 * Safely updates scalar YAML keys (either top-level or nested under a section path like "spawn-limits.monsters")
 * only when the target key already exists in the file, preserving comments and formatting.
 */
export function updateYamlKeysSafe(
  raw: string,
  updates: Array<{ path: string[]; value: string }>
): { content: string; changedKeys: string[] } {
  const lines = raw.split(/\r?\n/);
  const stack: Array<{ indent: number; key: string }> = [];
  const changedKeys: string[] = [];

  const out = lines.map((line) => {
    const commentStripped = line.replace(/#.*$/, '');
    const match = commentStripped.match(/^(\s*)([a-zA-Z0-9_.-]+)\s*:\s*(.*)$/);
    if (!match) return line;

    const indent = match[1].length;
    const key = match[2];
    const rest = match[3].trim();

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const currentPath = [...stack.map((s) => s.key), key];

    if (rest === '') {
      stack.push({ indent, key });
      return line;
    }

    const matchedUpdate = updates.find(
      (u) => u.path.length === currentPath.length && u.path.every((seg, i) => seg === currentPath[i])
    );
    if (matchedUpdate) {
      const cleanCur = rest.replace(/^['"]|['"]$/g, '');
      if (cleanCur !== matchedUpdate.value) {
        const inlineCommentMatch = line.match(/(\s+#.*)$/);
        const suffix = inlineCommentMatch ? inlineCommentMatch[1] : '';
        changedKeys.push(`${currentPath.join('.')}: ${cleanCur} -> ${matchedUpdate.value}`);
        return `${match[1]}${key}: ${matchedUpdate.value}${suffix}`;
      }
    }
    return line;
  });

  return { content: out.join('\n'), changedKeys };
}

function getPresetConfigPlan(preset: OptimizePreset) {
  if (preset === 'performance') {
    return {
      serverProperties: {
        'view-distance': '7',
        'simulation-distance': '5',
        'network-compression-threshold': '256',
        'entity-broadcast-range-percentage': '70',
        'sync-chunk-writes': 'false',
      },
      bukkit: [
        { path: ['spawn-limits', 'monsters'], value: '45' },
        { path: ['spawn-limits', 'animals'], value: '7' },
        { path: ['spawn-limits', 'water-animals'], value: '3' },
        { path: ['spawn-limits', 'water-ambient'], value: '2' },
        { path: ['spawn-limits', 'ambient'], value: '1' },
        { path: ['ticks-per', 'monster-spawns'], value: '4' },
        { path: ['ticks-per', 'animal-spawns'], value: '400' },
        { path: ['ticks-per', 'autosave'], value: '6000' },
      ],
      spigot: [
        { path: ['world-settings', 'default', 'mob-spawn-range'], value: '5' },
        { path: ['world-settings', 'default', 'entity-activation-range', 'animals'], value: '14' },
        { path: ['world-settings', 'default', 'entity-activation-range', 'monsters'], value: '22' },
        { path: ['world-settings', 'default', 'entity-activation-range', 'raiders'], value: '40' },
        { path: ['world-settings', 'default', 'entity-activation-range', 'misc'], value: '6' },
        { path: ['world-settings', 'default', 'merge-radius', 'item'], value: '3.5' },
        { path: ['world-settings', 'default', 'merge-radius', 'exp'], value: '4.5' },
        { path: ['world-settings', 'default', 'ticks-per', 'hopper-transfer'], value: '8' },
        { path: ['world-settings', 'default', 'ticks-per', 'hopper-check'], value: '3' },
      ],
      paperWorld: [
        { path: ['entities', 'spawning', 'per-player-mob-spawns'], value: 'true' },
        { path: ['environment', 'optimize-explosions'], value: 'true' },
        { path: ['chunks', 'prevent-moving-into-unloaded-chunks'], value: 'true' },
        { path: ['environment', 'treasure-maps', 'enabled'], value: 'false' },
        { path: ['hopper', 'disable-move-event'], value: 'true' },
      ],
      purpur: [
        { path: ['settings', 'use-alternate-keepalive'], value: 'true' },
        { path: ['settings', 'lagging-threshold'], value: '19.0' },
        { path: ['world-settings', 'default', 'mobs', 'villager', 'lobotomize', 'enabled'], value: 'true' },
      ],
    };
  }

  if (preset === 'eco') {
    return {
      serverProperties: {
        'view-distance': '6',
        'simulation-distance': '4',
        'network-compression-threshold': '512',
        'entity-broadcast-range-percentage': '60',
        'sync-chunk-writes': 'false',
      },
      bukkit: [
        { path: ['spawn-limits', 'monsters'], value: '35' },
        { path: ['spawn-limits', 'animals'], value: '6' },
        { path: ['spawn-limits', 'water-animals'], value: '2' },
        { path: ['spawn-limits', 'ambient'], value: '1' },
        { path: ['ticks-per', 'autosave'], value: '6000' },
      ],
      spigot: [
        { path: ['world-settings', 'default', 'mob-spawn-range'], value: '4' },
        { path: ['world-settings', 'default', 'entity-activation-range', 'animals'], value: '12' },
        { path: ['world-settings', 'default', 'entity-activation-range', 'monsters'], value: '18' },
        { path: ['world-settings', 'default', 'merge-radius', 'item'], value: '4.0' },
        { path: ['world-settings', 'default', 'merge-radius', 'exp'], value: '5.0' },
      ],
      paperWorld: [
        { path: ['entities', 'spawning', 'per-player-mob-spawns'], value: 'true' },
        { path: ['environment', 'optimize-explosions'], value: 'true' },
        { path: ['chunks', 'prevent-moving-into-unloaded-chunks'], value: 'true' },
        { path: ['hopper', 'disable-move-event'], value: 'true' },
      ],
      purpur: [
        { path: ['settings', 'use-alternate-keepalive'], value: 'true' },
      ],
    };
  }

  // balanced
  return {
    serverProperties: {
      'view-distance': '8',
      'simulation-distance': '6',
      'network-compression-threshold': '256',
      'entity-broadcast-range-percentage': '80',
      'sync-chunk-writes': 'false',
    },
    bukkit: [
      { path: ['spawn-limits', 'monsters'], value: '50' },
      { path: ['spawn-limits', 'animals'], value: '8' },
      { path: ['spawn-limits', 'water-animals'], value: '3' },
      { path: ['spawn-limits', 'water-ambient'], value: '2' },
      { path: ['spawn-limits', 'ambient'], value: '1' },
      { path: ['ticks-per', 'monster-spawns'], value: '3' },
      { path: ['ticks-per', 'animal-spawns'], value: '400' },
      { path: ['ticks-per', 'autosave'], value: '6000' },
    ],
    spigot: [
      { path: ['world-settings', 'default', 'mob-spawn-range'], value: '6' },
      { path: ['world-settings', 'default', 'entity-activation-range', 'animals'], value: '16' },
      { path: ['world-settings', 'default', 'entity-activation-range', 'monsters'], value: '24' },
      { path: ['world-settings', 'default', 'entity-activation-range', 'raiders'], value: '48' },
      { path: ['world-settings', 'default', 'entity-activation-range', 'misc'], value: '8' },
      { path: ['world-settings', 'default', 'merge-radius', 'item'], value: '3.0' },
      { path: ['world-settings', 'default', 'merge-radius', 'exp'], value: '3.5' },
    ],
    paperWorld: [
      { path: ['entities', 'spawning', 'per-player-mob-spawns'], value: 'true' },
      { path: ['environment', 'optimize-explosions'], value: 'true' },
      { path: ['chunks', 'prevent-moving-into-unloaded-chunks'], value: 'true' },
    ],
    purpur: [
      { path: ['settings', 'use-alternate-keepalive'], value: 'true' },
    ],
  };
}

export async function auditServer(server: PterodactylServer): Promise<ServerAuditReport> {
  const [rootFiles, logFiles, crashFiles, configFiles, startup, schedules] = await Promise.all([
    panelApi.listFiles(server.id, '/').catch(() => [] as FileEntry[]),
    panelApi.listFiles(server.id, '/logs').catch(() => [] as FileEntry[]),
    panelApi.listFiles(server.id, '/crash-reports').catch(() => [] as FileEntry[]),
    panelApi.listFiles(server.id, '/config').catch(() => [] as FileEntry[]),
    panelApi.getServerStartup(server.id).catch(() => null),
    panelApi.listSchedules(server.id).catch(() => [] as ServerSchedule[]),
  ]);

  const runtime = detectRuntime(server, rootFiles);
  const rootNames = new Set(rootFiles.map((f) => f.name));
  const configNames = new Set(configFiles.map((f) => f.name));

  const detectedConfigFiles: string[] = [];
  if (rootNames.has('server.properties')) detectedConfigFiles.push('/server.properties');
  if (rootNames.has('bukkit.yml')) detectedConfigFiles.push('/bukkit.yml');
  if (rootNames.has('spigot.yml')) detectedConfigFiles.push('/spigot.yml');
  if (rootNames.has('paper.yml')) detectedConfigFiles.push('/paper.yml');
  if (configNames.has('paper-world-defaults.yml')) detectedConfigFiles.push('/config/paper-world-defaults.yml');
  if (rootNames.has('purpur.yml')) detectedConfigFiles.push('/purpur.yml');
  if (rootNames.has('velocity.toml')) detectedConfigFiles.push('/velocity.toml');
  if (rootNames.has('package.json')) detectedConfigFiles.push('/package.json');

  const tunableConfigs = detectedConfigFiles.filter((f) =>
    [
      '/server.properties',
      '/bukkit.yml',
      '/spigot.yml',
      '/config/paper-world-defaults.yml',
      '/purpur.yml',
    ].includes(f)
  );

  // Reclaimable files: rotated .log.gz files in /logs (keep latest.log!) + all crash reports + root .tmp/.log dumps
  const reclaimableFiles: Array<{ root: string; name: string; size: number }> = [];
  for (const f of logFiles) {
    if (!f.isDirectory && (f.name.endsWith('.log.gz') || f.name.endsWith('.gz') || (f.name !== 'latest.log' && f.name.endsWith('.log')))) {
      reclaimableFiles.push({ root: '/logs', name: f.name, size: f.size });
    }
  }
  for (const f of crashFiles) {
    if (!f.isDirectory) {
      reclaimableFiles.push({ root: '/crash-reports', name: f.name, size: f.size });
    }
  }
  for (const f of rootFiles) {
    if (!f.isDirectory && (f.name.startsWith('hs_err_pid') || f.name.endsWith('.hprof') || f.name.endsWith('.tmp'))) {
      reclaimableFiles.push({ root: '/', name: f.name, size: f.size });
    }
  }
  const reclaimableBytes = reclaimableFiles.reduce((acc, f) => acc + f.size, 0);

  const flagVar = findEditableFlagVariable(startup);
  const startupCmd = `${startup?.startupCommand || server.startupCommand || ''} ${flagVar?.currentValue || ''}`;
  const startupOptimized =
    runtime.isNodeApp
      ? /--max-old-space-size=/i.test(startupCmd)
      : /UseG1GC|UseZGC|aikars\.flags/i.test(startupCmd);

  const hasRestartSchedule = schedules.some(
    (s) =>
      s.isActive &&
      (s.name.toLowerCase().includes('optimize') ||
        s.name.toLowerCase().includes('restart') ||
        s.tasks.some((t) => t.action === 'power'))
  );

  const cpuPct =
    server.limits.cpu > 0
      ? Math.min(100, (server.resources.cpuPercent / server.limits.cpu) * 100)
      : Math.min(100, server.resources.cpuPercent);
  const memPct =
    server.limits.memory > 0
      ? Math.min(100, (server.resources.memoryBytes / (server.limits.memory * 1024 * 1024)) * 100)
      : 0;
  const diskPct =
    server.limits.disk > 0
      ? Math.min(100, (server.resources.diskBytes / (server.limits.disk * 1024 * 1024)) * 100)
      : 0;

  let score = 100;
  const issues: OptimizeIssue[] = [];

  if (cpuPct > 85) {
    score -= 22;
    issues.push({
      severity: 'high',
      title: `High CPU load (${cpuPct.toFixed(0)}%)`,
      detail: 'Sustained CPU saturation can cause tick lag or delayed requests. Tune entity activation and chunk limits.',
    });
  } else if (cpuPct > 65) {
    score -= 10;
    issues.push({
      severity: 'medium',
      title: `Elevated CPU load (${cpuPct.toFixed(0)}%)`,
      detail: 'Applying Balanced or High-TPS presets will reduce tick overhead.',
    });
  }

  if (memPct > 88) {
    score -= 24;
    issues.push({
      severity: 'high',
      title: `Memory pressure (${memPct.toFixed(0)}%)`,
      detail: 'Heap is close to container limit. Optimize GC flags and lower view/simulation distance.',
    });
  } else if (memPct > 75) {
    score -= 10;
    issues.push({
      severity: 'medium',
      title: `High RAM usage (${memPct.toFixed(0)}%)`,
      detail: 'Tuning GC or reducing mob spawn limits helps preserve memory headroom.',
    });
  }

  if (diskPct > 85) {
    score -= 15;
    issues.push({
      severity: 'high',
      title: `Disk usage critical (${diskPct.toFixed(0)}%)`,
      detail: 'Clean rotated logs, crash reports, and temporary artifacts to free storage.',
    });
  }

  if (reclaimableFiles.length >= 10 || reclaimableBytes > 15 * 1024 * 1024) {
    score -= 10;
    issues.push({
      severity: 'low',
      title: `${reclaimableFiles.length} cleanable log/crash files`,
      detail: `Reclaimable storage from rotated logs and crash reports.`,
    });
  }

  if ((runtime.isMinecraft || runtime.isNodeApp) && !startupOptimized) {
    score -= 12;
    issues.push({
      severity: 'medium',
      title: 'Startup runtime flags unoptimized',
      detail: runtime.isNodeApp
        ? 'Node.js heap limit flag (--max-old-space-size) not detected.'
        : "Aikar's G1GC / low-pause JVM flags not detected in startup command.",
    });
  }

  if (!hasRestartSchedule && server.status === 'running') {
    score -= 6;
    issues.push({
      severity: 'low',
      title: 'No automated maintenance schedule',
      detail: 'Adding a daily off-peak save/restart schedule prevents long-uptime memory drift.',
    });
  }

  score = Math.max(15, Math.min(100, Math.round(score)));
  const grade: ServerAuditReport['grade'] =
    score >= 92 ? 'S' : score >= 82 ? 'A' : score >= 68 ? 'B' : score >= 52 ? 'C' : 'D';

  return {
    serverId: server.id,
    serverName: server.name,
    runtimeLabel: runtime.label,
    isMinecraft: runtime.isMinecraft,
    isNodeApp: runtime.isNodeApp,
    score,
    grade,
    cpuPct,
    memPct,
    diskPct,
    reclaimableBytes,
    reclaimableFiles,
    detectedConfigFiles,
    tunableConfigs,
    startupOptimized,
    editableFlagVar: flagVar?.envVariable || null,
    hasRestartSchedule,
    issues,
    scannedAt: new Date().toISOString(),
  };
}

export async function optimizeServer(
  server: PterodactylServer,
  options: ManualOptimizeOptions,
  trigger: 'auto' | 'manual' | 'batch' = 'manual',
  onStep?: (msg: string) => void
): Promise<OptimizeRunLogEntry> {
  const actions: string[] = [];
  const skipped: string[] = [];
  let freedBytes = 0;
  let scoreBefore = 100;
  let scoreAfter = 100;

  try {
    onStep?.(`Scanning ${server.name}...`);
    const audit = await auditServer(server);
    scoreBefore = audit.score;

    // 1. Clean rotated logs, crash reports & heap dumps
    if (options.cleanLogsAndCrash) {
      if (audit.reclaimableFiles.length > 0) {
        onStep?.(`Cleaning ${audit.reclaimableFiles.length} rotated log/crash files...`);
        const byRoot = new Map<string, string[]>();
        for (const item of audit.reclaimableFiles) {
          const arr = byRoot.get(item.root) || [];
          arr.push(item.name);
          byRoot.set(item.root, arr);
        }
        for (const [root, names] of byRoot.entries()) {
          // Delete in safe batches of 50
          for (let i = 0; i < names.length; i += 50) {
            const batch = names.slice(i, i + 50);
            try {
              await panelApi.deleteFiles(server.id, root, batch);
              const batchBytes = audit.reclaimableFiles
                .filter((x) => x.root === root && batch.includes(x.name))
                .reduce((acc, x) => acc + x.size, 0);
              freedBytes += batchBytes;
            } catch {
              skipped.push(`Failed to delete files in ${root}`);
            }
          }
        }
        if (freedBytes > 0 || audit.reclaimableFiles.length > 0) {
          actions.push(`Cleaned ${audit.reclaimableFiles.length} old logs/crash dumps`);
        }
      } else {
        skipped.push('No old log/crash clutter found');
      }
    }

    // 2. Tune Minecraft server config files (only files that already exist)
    if (options.tuneConfigs) {
      const plan = getPresetConfigPlan(options.preset);
      let tunedAnyConfig = false;

      if (audit.tunableConfigs.includes('/server.properties')) {
        onStep?.('Tuning /server.properties...');
        try {
          const raw = await panelApi.getFileContents(server.id, '/server.properties');
          const { content, changedKeys } = updatePropertiesContent(raw, plan.serverProperties);
          if (changedKeys.length > 0) {
            await panelApi.writeFile(server.id, '/server.properties', content);
            actions.push(`server.properties (${changedKeys.length} keys tuned)`);
            tunedAnyConfig = true;
          }
        } catch {
          skipped.push('Could not update /server.properties');
        }
      }

      if (audit.tunableConfigs.includes('/bukkit.yml')) {
        onStep?.('Tuning /bukkit.yml...');
        try {
          const raw = await panelApi.getFileContents(server.id, '/bukkit.yml');
          const { content, changedKeys } = updateYamlKeysSafe(raw, plan.bukkit);
          if (changedKeys.length > 0) {
            await panelApi.writeFile(server.id, '/bukkit.yml', content);
            actions.push(`bukkit.yml (${changedKeys.length} spawn/tick rules)`);
            tunedAnyConfig = true;
          }
        } catch {
          skipped.push('Could not update /bukkit.yml');
        }
      }

      if (audit.tunableConfigs.includes('/spigot.yml')) {
        onStep?.('Tuning /spigot.yml...');
        try {
          const raw = await panelApi.getFileContents(server.id, '/spigot.yml');
          const { content, changedKeys } = updateYamlKeysSafe(raw, plan.spigot);
          if (changedKeys.length > 0) {
            await panelApi.writeFile(server.id, '/spigot.yml', content);
            actions.push(`spigot.yml (${changedKeys.length} activation/merge rules)`);
            tunedAnyConfig = true;
          }
        } catch {
          skipped.push('Could not update /spigot.yml');
        }
      }

      if (audit.tunableConfigs.includes('/config/paper-world-defaults.yml')) {
        onStep?.('Tuning /config/paper-world-defaults.yml...');
        try {
          const raw = await panelApi.getFileContents(server.id, '/config/paper-world-defaults.yml');
          const { content, changedKeys } = updateYamlKeysSafe(raw, plan.paperWorld);
          if (changedKeys.length > 0) {
            await panelApi.writeFile(server.id, '/config/paper-world-defaults.yml', content);
            actions.push(`paper-world-defaults.yml (${changedKeys.length} flags)`);
            tunedAnyConfig = true;
          }
        } catch {
          skipped.push('Could not update /config/paper-world-defaults.yml');
        }
      }

      if (audit.tunableConfigs.includes('/purpur.yml')) {
        onStep?.('Tuning /purpur.yml...');
        try {
          const raw = await panelApi.getFileContents(server.id, '/purpur.yml');
          const { content, changedKeys } = updateYamlKeysSafe(raw, plan.purpur);
          if (changedKeys.length > 0) {
            await panelApi.writeFile(server.id, '/purpur.yml', content);
            actions.push(`purpur.yml (${changedKeys.length} flags)`);
            tunedAnyConfig = true;
          }
        } catch {
          skipped.push('Could not update /purpur.yml');
        }
      }

      if (!tunedAnyConfig && audit.tunableConfigs.length === 0) {
        skipped.push('No tunable game config files detected');
      }
    }

    // 3. Tune Startup JVM / Node.js Flags
    if (options.tuneStartupFlags) {
      if (audit.editableFlagVar && !audit.startupOptimized) {
        onStep?.(`Optimizing startup variable ${audit.editableFlagVar}...`);
        try {
          if (audit.isNodeApp) {
            const maxOldSpace = Math.max(256, Math.round((server.limits.memory || 1024) * 0.8));
            await panelApi.updateStartupVariable(
              server.id,
              audit.editableFlagVar,
              `--max-old-space-size=${maxOldSpace}`
            );
            actions.push(`Set ${audit.editableFlagVar} (--max-old-space-size=${maxOldSpace})`);
          } else {
            const flags = buildAikarFlags(server.limits.memory || 2048);
            await panelApi.updateStartupVariable(server.id, audit.editableFlagVar, flags);
            actions.push(`Applied Aikar's G1GC flags to ${audit.editableFlagVar}`);
          }
        } catch {
          skipped.push(`Could not write startup variable ${audit.editableFlagVar}`);
        }
      } else if (audit.startupOptimized) {
        skipped.push('Startup runtime flags already optimized');
      } else {
        skipped.push('No editable startup flag variable exposed by egg');
      }
    }

    // 4. Flush live console buffers when online
    if (options.flushConsole && server.status === 'running') {
      if (audit.isMinecraft) {
        onStep?.('Sending save-all flush to live console...');
        try {
          await panelApi.sendConsoleCommand(server.id, 'save-all');
          actions.push('Sent save-all world buffer flush');
        } catch {
          skipped.push('Console flush command rejected');
        }
      }
    }

    // 5. Ensure off-peak maintenance schedule
    if (options.ensureSchedule) {
      if (!audit.hasRestartSchedule) {
        onStep?.('Creating off-peak maintenance schedule...');
        try {
          const created: any = await panelApi.createSchedule(server.id, {
            name: '[HelzerX Auto-Optimize] Daily 04:00 Maintenance',
            minute: '0',
            hour: '4',
            dayOfMonth: '*',
            month: '*',
            dayOfWeek: '*',
            isActive: true,
            onlyWhenOnline: true,
          });
          const scheduleId = created?.attributes?.id || created?.id;
          if (scheduleId) {
            if (audit.isMinecraft) {
              await panelApi.createScheduleTask(server.id, scheduleId, {
                action: 'command',
                payload: 'save-all',
                timeOffset: 0,
                continueOnFailure: true,
              });
            }
            await panelApi.createScheduleTask(server.id, scheduleId, {
              action: 'power',
              payload: 'restart',
              timeOffset: 10,
              continueOnFailure: false,
            });
            actions.push('Created daily 04:00 maintenance restart schedule');
          }
        } catch {
          skipped.push('Could not create maintenance schedule');
        }
      } else {
        skipped.push('Maintenance schedule already present');
      }
    }

    // 6. Optional restart to apply config/startup changes
    if (options.restartAfter && server.status === 'running') {
      onStep?.(`Restarting ${server.name}...`);
      try {
        await panelApi.sendPowerSignal(server.id, 'restart');
        actions.push('Triggered graceful server restart');
      } catch {
        skipped.push('Failed to send restart signal');
      }
    }

    const postAudit = await auditServer(server).catch(() => null);
    scoreAfter = postAudit ? Math.max(scoreBefore, postAudit.score) : Math.min(100, scoreBefore + (actions.length > 0 ? 10 : 0));

    return {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      serverId: server.id,
      serverName: server.name,
      trigger,
      preset: options.preset,
      timestamp: new Date().toISOString(),
      scoreBefore,
      scoreAfter,
      freedBytes,
      actions,
      skipped,
      status: actions.length > 0 ? 'optimized' : 'healthy',
    };
  } catch (err: any) {
    return {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      serverId: server.id,
      serverName: server.name,
      trigger,
      preset: options.preset,
      timestamp: new Date().toISOString(),
      scoreBefore,
      scoreAfter: scoreBefore,
      freedBytes,
      actions,
      skipped,
      status: 'error',
      errorMessage: err?.message || 'Optimization failed',
    };
  }
}
