import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  FileCode2,
  Gauge,
  HardDrive,
  History,
  Layers,
  Play,
  RefreshCw,
  RotateCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { StatusText } from '../components/ui/StatusText';
import { usePanel } from '../context/PanelContext';
import { formatBytes, formatRelativeTime } from '../utils/format';
import {
  auditServer,
  DEFAULT_MANUAL_OPTIONS,
  optimizeServer,
  type ManualOptimizeOptions,
  type OptimizePreset,
  type ServerAuditReport,
} from '../utils/serverOptimizer';

type OptimizerTab = 'single' | 'fleet' | 'auto' | 'history';

const PRESET_CARDS: Array<{
  id: OptimizePreset;
  title: string;
  badge: string;
  desc: string;
}> = [
  {
    id: 'balanced',
    title: 'Balanced (Recommended)',
    badge: 'Safe',
    desc: 'Tunes view-distance (8), simulation (6), Paper/Spigot mob limits, Aikar flags & log cleanup without changing gameplay feel.',
  },
  {
    id: 'performance',
    title: 'Max Performance / High TPS',
    badge: 'Aggressive',
    desc: 'Maximizes tick rate under heavy player load: tighter activation ranges, hopper throttling, treasure-map lag fix & full GC.',
  },
  {
    id: 'eco',
    title: 'Low RAM / Eco Mode',
    badge: 'Memory Saver',
    desc: 'Minimizes RAM & CPU footprint (view 6, sim 4, strict spawn caps & heap tuning) for tight container limits.',
  },
];

function scoreTone(score: number) {
  if (score >= 85) return 'text-emerald-500';
  if (score >= 65) return 'text-[#06B6D4]';
  if (score >= 45) return 'text-amber-500';
  return 'text-rose-500';
}

export function ServerOptimizePage({ serverId }: { serverId?: string }) {
  const {
    servers,
    activeServer,
    navigate,
    notify,
    refreshData,
    panelConnected,
    connectionError,
    autoOptimizeSettings,
    setAutoOptimizeSettings,
    toggleAutoOptimize,
    toggleServerAutoOptimize,
    optimizeHistory,
    appendOptimizeLog,
    clearOptimizeHistory,
    isAutoOptimizing,
    serversStartLockedForUser,
  } = usePanel();

  const [tab, setTab] = useState<OptimizerTab>(serverId ? 'single' : 'fleet');
  const [targetId, setTargetId] = useState<string>(
    serverId || activeServer?.id || servers[0]?.id || ''
  );

  useEffect(() => {
    if (serverId) {
      setTargetId(serverId);
      setTab('single');
    } else if (!targetId && (activeServer?.id || servers[0]?.id)) {
      setTargetId(activeServer?.id || servers[0]?.id || '');
    }
  }, [serverId, activeServer?.id, servers, targetId]);

  const targetServer =
    servers.find((s) => s.id === targetId || s.identifier === targetId) || servers[0] || null;

  const [audits, setAudits] = useState<Record<string, ServerAuditReport>>({});
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [manualOpts, setManualOpts] = useState<ManualOptimizeOptions>(DEFAULT_MANUAL_OPTIONS);
  const [runningManual, setRunningManual] = useState(false);
  const [stepMessage, setStepMessage] = useState<string>('');

  // Fleet batch state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fleetScanning, setFleetScanning] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; current: string }>({
    done: 0,
    total: 0,
    current: '',
  });

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.length > 0) return prev.filter((id) => servers.some((s) => s.id === id));
      return servers.map((s) => s.id);
    });
  }, [servers]);

  const runSingleAudit = useCallback(
    async (srv = targetServer) => {
      if (!srv || !panelConnected) return;
      setScanningId(srv.id);
      try {
        const report = await auditServer(srv);
        setAudits((prev) => ({ ...prev, [srv.id]: report }));
      } catch (err: any) {
        notify('Scan failed', err.message, 'error');
      } finally {
        setScanningId(null);
      }
    },
    [targetServer, panelConnected, notify]
  );

  useEffect(() => {
    if (tab === 'single' && targetServer && panelConnected && !audits[targetServer.id]) {
      runSingleAudit(targetServer);
    }
  }, [tab, targetServer, panelConnected, audits, runSingleAudit]);

  const runFleetScan = useCallback(async () => {
    if (!panelConnected || servers.length === 0) return;
    setFleetScanning(true);
    try {
      const results = await Promise.all(
        servers.map((srv) => auditServer(srv).catch(() => null))
      );
      setAudits((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          if (r) next[r.serverId] = r;
        });
        return next;
      });
      notify('Fleet diagnostics complete', `Scanned ${servers.length} server(s).`, 'success');
    } finally {
      setFleetScanning(false);
    }
  }, [panelConnected, servers, notify]);

  useEffect(() => {
    if (tab === 'fleet' && panelConnected && servers.length > 0 && Object.keys(audits).length === 0) {
      runFleetScan();
    }
  }, [tab, panelConnected, servers.length, audits, runFleetScan]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  const currentAudit = targetServer ? audits[targetServer.id] || null : null;
  const enabledAutoCount = servers.filter(
    (s) => !autoOptimizeSettings.disabledServerIds.includes(s.id)
  ).length;

  const handleRunManualOptimize = async (quickPreset?: OptimizePreset) => {
    if (!targetServer) return;
    setRunningManual(true);
    const baseOpts = quickPreset ? { ...manualOpts, preset: quickPreset } : manualOpts;
    const optsToRun = serversStartLockedForUser ? { ...baseOpts, restartAfter: false } : baseOpts;
    try {
      const log = await optimizeServer(targetServer, optsToRun, 'manual', (msg) =>
        setStepMessage(msg)
      );
      appendOptimizeLog(log);
      await runSingleAudit(targetServer);
      await refreshData();
      if (log.status === 'error') {
        notify('Optimization failed', log.errorMessage || 'Check server permissions.', 'error');
      } else if (log.actions.length > 0) {
        notify(
          `Optimized ${targetServer.name}`,
          log.actions.slice(0, 2).join(' · '),
          'success'
        );
      } else {
        notify(`${targetServer.name} is already optimal`, 'No changes needed.', 'info');
      }
    } finally {
      setRunningManual(false);
      setStepMessage('');
    }
  };

  const handleBatchOptimize = async (idsToOptimize: string[]) => {
    const targets = servers.filter((s) => idsToOptimize.includes(s.id));
    if (targets.length === 0) {
      notify('Select at least one server', undefined, 'error');
      return;
    }

    setBatchRunning(true);
    setBatchProgress({ done: 0, total: targets.length, current: targets[0].name });
    let totalFreed = 0;
    let optimizedCount = 0;

    try {
      for (let i = 0; i < targets.length; i++) {
        const srv = targets[i];
        setBatchProgress({ done: i, total: targets.length, current: srv.name });
        const batchOpts = serversStartLockedForUser
          ? { ...manualOpts, restartAfter: false }
          : manualOpts;
        const log = await optimizeServer(srv, batchOpts, 'batch');
        appendOptimizeLog(log);
        totalFreed += log.freedBytes;
        if (log.status === 'optimized') optimizedCount++;
        const updated = await auditServer(srv).catch(() => null);
        if (updated) {
          setAudits((prev) => ({ ...prev, [srv.id]: updated }));
        }
      }
      setBatchProgress({ done: targets.length, total: targets.length, current: 'Complete' });
      await refreshData();
      notify(
        `Batch Optimization Complete`,
        `Optimized ${optimizedCount}/${targets.length} servers${totalFreed > 0 ? ` · Freed ${formatBytes(totalFreed)}` : ''}`,
        'success'
      );
    } finally {
      setBatchRunning(false);
    }
  };

  const toggleSelectServer = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header + Master Auto-Optimize Toggle */}
      <div className="mx-card-3d p-5 sm:p-6 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="mx-well-3d w-11 h-11 rounded-2xl flex items-center justify-center shrink-0">
            <Zap
              className={`w-5 h-5 ${
                autoOptimizeSettings.enabled
                  ? 'text-emerald-500'
                  : 'text-[#8B5CF6]'
              }`}
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
                Server Optimizer
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  autoOptimizeSettings.enabled
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-black/[0.05] dark:bg-white/[0.06] text-[#777777] dark:text-zinc-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    autoOptimizeSettings.enabled
                      ? isAutoOptimizing
                        ? 'bg-cyan-400 animate-ping'
                        : 'bg-emerald-500'
                      : 'bg-zinc-400'
                  }`}
                />
                {autoOptimizeSettings.enabled
                  ? `Auto-Optimize ON · ${enabledAutoCount}/${servers.length} servers`
                  : 'Auto-Optimize OFF'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-1">
              One-click & automated performance tuning for configs, startup flags, log/crash cleanup, and multi-server optimization.
            </p>
          </div>
        </div>

        {/* Master ON / OFF Tactile Switch */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={autoOptimizeSettings.enabled}
            onClick={() => toggleAutoOptimize()}
            className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              autoOptimizeSettings.enabled
                ? 'mx-btn-3d-primary'
                : 'mx-btn-3d'
            }`}
          >
            <span
              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                autoOptimizeSettings.enabled
                  ? 'bg-white/25 justify-end'
                  : 'bg-black/15 dark:bg-white/15 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </span>
            <span>
              Auto-Optimize: {autoOptimizeSettings.enabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleBatchOptimize(servers.map((s) => s.id))}
            disabled={batchRunning || servers.length === 0}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#06B6D4]" />
            {batchRunning
              ? `Optimizing (${batchProgress.done}/${batchProgress.total})...`
              : `Optimize All (${servers.length})`}
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="mx-well-3d inline-flex items-center gap-1.5 p-1.5 rounded-2xl overflow-x-auto max-w-full">
          {(
            [
              { id: 'single', label: 'Manual & Single Server', icon: Gauge },
              { id: 'fleet', label: `Multi-Server Batch (${servers.length})`, icon: Layers },
              { id: 'auto', label: 'Auto-Optimize Rules', icon: Settings2 },
              { id: 'history', label: `History (${optimizeHistory.length})`, icon: History },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  active
                    ? 'mx-btn-3d-primary'
                    : 'text-[#525252] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'single' && servers.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              aria-label="Select server to optimize"
              value={targetServer?.id || ''}
              onChange={(e) => {
                const nextId = e.target.value;
                setTargetId(nextId);
                if (serverId) {
                  navigate({ page: 'server-optimize', serverId: nextId });
                }
              }}
              className="mx-input-3d text-xs font-medium px-3 py-2 rounded-xl cursor-pointer max-w-[220px]"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-[#19191F]">
                  {s.name} ({s.identifier})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => runSingleAudit(targetServer)}
              disabled={Boolean(scanningId)}
              className="mx-btn-3d inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanningId ? 'animate-spin' : ''}`} />
              Scan
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: SINGLE SERVER & MANUAL OPTIMIZER */}
      {tab === 'single' && (
        <>
          {!targetServer ? (
            <div className="mx-card-3d p-10 rounded-2xl text-center text-xs text-[#777777]">
              No servers assigned to this account.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Diagnostic Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="mx-card-3d p-5 rounded-2xl flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-medium text-[#777777] dark:text-zinc-400">
                      Optimization Score
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span
                        className={`text-3xl font-bold font-display tabular-nums ${
                          currentAudit ? scoreTone(currentAudit.score) : 'text-[#8B5CF6]'
                        }`}
                      >
                        {currentAudit ? currentAudit.score : '—'}
                      </span>
                      <span className="text-xs text-[#777777]">/ 100</span>
                    </div>
                    <div className="text-[11px] text-[#777777] dark:text-zinc-400 mt-1">
                      {currentAudit ? `${currentAudit.runtimeLabel} · Grade ${currentAudit.grade}` : 'Scanning...'}
                    </div>
                  </div>
                  <div className="mx-well-3d w-12 h-12 rounded-2xl flex items-center justify-center font-display text-lg font-bold text-[#8B5CF6]">
                    {currentAudit?.grade || '…'}
                  </div>
                </div>

                <div className="mx-card-3d p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#777777] dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      CPU / RAM Load
                    </span>
                    <StatusText status={targetServer.status} />
                  </div>
                  <div className="text-lg font-bold font-display tabular-nums">
                    {(currentAudit?.cpuPct ?? targetServer.resources.cpuPercent).toFixed(0)}% CPU ·{' '}
                    {(currentAudit?.memPct ?? 0).toFixed(0)}% RAM
                  </div>
                  <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                    {formatBytes(targetServer.resources.memoryBytes)} / {targetServer.limits.memory || '∞'} MB
                  </div>
                </div>

                <div className="mx-card-3d p-5 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#777777] dark:text-zinc-400">
                    <HardDrive className="w-3.5 h-3.5 text-[#06B6D4]" />
                    Reclaimable Disk Clutter
                  </div>
                  <div className="text-lg font-bold font-display tabular-nums text-[#06B6D4]">
                    {currentAudit ? formatBytes(currentAudit.reclaimableBytes) : '—'}
                  </div>
                  <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                    {currentAudit
                      ? `${currentAudit.reclaimableFiles.length} rotated log / crash file(s)`
                      : 'Checking logs & crash-reports'}
                  </div>
                </div>

                <div className="mx-card-3d p-5 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#777777] dark:text-zinc-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Auto-Optimize for {targetServer.name}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold">
                      {autoOptimizeSettings.disabledServerIds.includes(targetServer.id)
                        ? 'Excluded from Auto'
                        : 'Included in Auto'}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleServerAutoOptimize(targetServer.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        !autoOptimizeSettings.disabledServerIds.includes(targetServer.id)
                          ? 'mx-btn-3d-primary'
                          : 'mx-btn-3d'
                      }`}
                    >
                      {!autoOptimizeSettings.disabledServerIds.includes(targetServer.id) ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                    {currentAudit?.tunableConfigs.length || 0} tunable config(s) detected
                  </div>
                </div>
              </div>

              {/* Manual Optimize Workbench */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 mx-card-3d p-5 sm:p-6 rounded-2xl space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
                        Manual Optimization Workbench
                      </h2>
                      <p className="text-xs text-[#777777] dark:text-zinc-400 mt-0.5">
                        Choose an optimization profile and fine-tune what gets applied to {targetServer.name}.
                      </p>
                    </div>
                  </div>

                  {/* Preset Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PRESET_CARDS.map((p) => {
                      const active = manualOpts.preset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setManualOpts((prev) => ({ ...prev, preset: p.id }))}
                          className={`p-3.5 rounded-xl text-left transition-all cursor-pointer ${
                            active
                              ? 'mx-nav-active ring-1 ring-[#8B5CF6]/50'
                              : 'mx-well-3d hover:opacity-90'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#171717] dark:text-white">
                              {p.title}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#8B5CF6]/15 text-[#8B5CF6]">
                              {p.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#777777] dark:text-zinc-400 mt-1.5 leading-relaxed">
                            {p.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Granular Checkboxes */}
                  <div className="space-y-2.5">
                    {[
                      {
                        key: 'tuneConfigs' as const,
                        icon: FileCode2,
                        title: 'Tune Server Config Files',
                        desc:
                          currentAudit && currentAudit.tunableConfigs.length > 0
                            ? `Updates ${currentAudit.tunableConfigs.join(', ')} safely`
                            : 'Updates server.properties, bukkit.yml, spigot.yml, paper-world-defaults.yml & purpur.yml when present',
                      },
                      {
                        key: 'tuneStartupFlags' as const,
                        icon: Terminal,
                        title: "Optimize Startup / JVM / Node Flags",
                        desc: currentAudit?.editableFlagVar
                          ? `Writes Aikar G1GC / heap flags to editable variable ${currentAudit.editableFlagVar}`
                          : 'Applies Aikar G1GC or --max-old-space-size if the egg exposes an editable flag variable',
                      },
                      {
                        key: 'cleanLogsAndCrash' as const,
                        icon: Trash2,
                        title: 'Clean Rotated Logs & Crash Reports',
                        desc: currentAudit
                          ? `Removes ${currentAudit.reclaimableFiles.length} rotated .log.gz / crash files (${formatBytes(currentAudit.reclaimableBytes)}), keeping latest.log`
                          : 'Safely removes old .log.gz archives & crash dumps while preserving latest.log',
                      },
                      {
                        key: 'flushConsole' as const,
                        icon: Activity,
                        title: 'Flush Live Console State',
                        desc: 'Sends safe save-all world flush command when the server is online',
                      },
                      {
                        key: 'ensureSchedule' as const,
                        icon: RotateCw,
                        title: 'Ensure Daily Off-Peak Maintenance Schedule',
                        desc: 'Creates a daily 04:00 save-all & graceful restart schedule if missing',
                      },
                      {
                        key: 'restartAfter' as const,
                        icon: Play,
                        title: 'Graceful Restart After Applying',
                        desc: 'Restarts the container after optimization so new config/JVM flags take effect immediately',
                      },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isRestartLocked = opt.key === 'restartAfter' && serversStartLockedForUser;
                      const checked = isRestartLocked ? false : manualOpts[opt.key];
                      return (
                        <label
                          key={opt.key}
                          className={`mx-well-3d flex items-start gap-3 p-3 rounded-xl ${
                            isRestartLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isRestartLocked}
                            checked={checked}
                            onChange={(e) =>
                              setManualOpts((prev) => ({
                                ...prev,
                                [opt.key]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 accent-[#8B5CF6] cursor-pointer disabled:cursor-not-allowed"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#171717] dark:text-zinc-100">
                              <Icon className="w-3.5 h-3.5 text-[#8B5CF6]" />
                              {opt.title}
                              {isRestartLocked && (
                                <span className="text-[10px] font-semibold text-rose-500">
                                  (Locked by Admin)
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#777777] dark:text-zinc-400 mt-0.5">
                              {opt.desc}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <span className="text-[11px] text-[#777777] dark:text-zinc-400 font-mono truncate">
                      {runningManual ? stepMessage || 'Applying optimizations...' : 'Ready to optimize'}
                    </span>
                    <button
                      type="button"
                      disabled={runningManual}
                      onClick={() => handleRunManualOptimize()}
                      className="mx-btn-3d-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {runningManual ? 'Optimizing...' : `Optimize ${targetServer.name}`}
                    </button>
                  </div>
                </div>

                {/* Findings & Recommendations */}
                <div className="lg:col-span-5 mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
                      Diagnostic Findings
                    </h2>
                    {currentAudit && (
                      <span className="text-[11px] text-[#777777] dark:text-zinc-400">
                        Scanned {formatRelativeTime(currentAudit.scannedAt)}
                      </span>
                    )}
                  </div>

                  {!currentAudit ? (
                    <div className="mx-well-3d p-6 rounded-xl text-center text-xs text-[#777777]">
                      Running server diagnostics...
                    </div>
                  ) : currentAudit.issues.length === 0 ? (
                    <div className="mx-well-3d p-6 rounded-xl text-center space-y-2">
                      <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                      <div className="text-xs font-semibold text-[#171717] dark:text-white">
                        Server is in peak condition
                      </div>
                      <p className="text-[11px] text-[#777777] dark:text-zinc-400">
                        No CPU/RAM bottlenecks, clutter, or unoptimized startup flags detected.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {currentAudit.issues.map((issue, idx) => (
                        <div key={idx} className="mx-well-3d p-3.5 rounded-xl space-y-1">
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            <AlertTriangle
                              className={`w-3.5 h-3.5 shrink-0 ${
                                issue.severity === 'high'
                                  ? 'text-rose-500'
                                  : issue.severity === 'medium'
                                    ? 'text-amber-500'
                                    : 'text-[#06B6D4]'
                              }`}
                            />
                            <span>{issue.title}</span>
                          </div>
                          <p className="text-[11px] text-[#777777] dark:text-zinc-400 leading-relaxed pl-5">
                            {issue.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentAudit && currentAudit.detectedConfigFiles.length > 0 && (
                    <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                      <div className="text-[11px] font-medium text-[#777777] dark:text-zinc-400 mb-2">
                        Detected Config Files
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {currentAudit.detectedConfigFiles.map((file) => (
                          <span
                            key={file}
                            className="mx-well-3d px-2 py-0.5 rounded-lg font-mono text-[10px] text-[#171717] dark:text-zinc-200"
                          >
                            {file}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: MULTI-SERVER FLEET BATCH OPTIMIZER */}
      {tab === 'fleet' && (
        <div className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                Multi-Server Batch Optimizer
              </h2>
              <p className="text-xs text-[#777777] dark:text-zinc-400 mt-0.5">
                Scan and optimize many servers at once using your selected preset ({manualOpts.preset}) and manage per-server Auto-Optimize switches.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runFleetScan}
                disabled={fleetScanning || servers.length === 0}
                className="mx-btn-3d inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fleetScanning ? 'animate-spin' : ''}`} />
                {fleetScanning ? 'Scanning Fleet...' : 'Scan All Servers'}
              </button>
              <button
                type="button"
                onClick={() => handleBatchOptimize(selectedIds)}
                disabled={batchRunning || selectedIds.length === 0}
                className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                {batchRunning
                  ? `Optimizing ${batchProgress.done}/${batchProgress.total}...`
                  : `Optimize Selected (${selectedIds.length})`}
              </button>
            </div>
          </div>

          {batchRunning && (
            <div className="mx-well-3d p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>Optimizing: {batchProgress.current}</span>
                <span className="font-mono tabular-nums">
                  {batchProgress.done} / {batchProgress.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] transition-all duration-300"
                  style={{
                    width: `${
                      batchProgress.total > 0
                        ? Math.round((batchProgress.done / batchProgress.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Quick Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(servers.map((s) => s.id))}
                className="mx-btn-3d px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(servers.filter((s) => s.status === 'running').map((s) => s.id))}
                className="mx-btn-3d px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
              >
                Online Only
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(
                    servers
                      .filter((s) => !audits[s.id] || audits[s.id].score < 85)
                      .map((s) => s.id)
                  )
                }
                className="mx-btn-3d px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
              >
                Needs Optimization
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="mx-btn-3d px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#777777] dark:text-zinc-400">Batch Preset:</span>
              <select
                value={manualOpts.preset}
                onChange={(e) =>
                  setManualOpts((prev) => ({
                    ...prev,
                    preset: e.target.value as OptimizePreset,
                  }))
                }
                className="mx-input-3d px-2.5 py-1 rounded-lg text-xs cursor-pointer"
              >
                <option value="balanced">Balanced (Recommended)</option>
                <option value="performance">Max Performance</option>
                <option value="eco">Low RAM / Eco</option>
              </select>
            </div>
          </div>

          {servers.length === 0 ? (
            <div className="mx-well-3d p-8 rounded-xl text-center text-xs text-[#777777]">
              No servers connected.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] text-[#777777] dark:text-zinc-400">
                    <th className="py-2.5 pr-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === servers.length && servers.length > 0}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? servers.map((s) => s.id) : [])
                        }
                        className="accent-[#8B5CF6] cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-2">Server</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-2">CPU / RAM</th>
                    <th className="py-2.5 px-2">Score</th>
                    <th className="py-2.5 px-2">Clutter</th>
                    <th className="py-2.5 px-2">Auto-Optimize</th>
                    <th className="py-2.5 pl-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  {servers.map((srv) => {
                    const audit = audits[srv.id];
                    const isChecked = selectedIds.includes(srv.id);
                    const isAutoOn = !autoOptimizeSettings.disabledServerIds.includes(srv.id);
                    const memPct =
                      srv.limits.memory > 0
                        ? Math.min(
                            100,
                            (srv.resources.memoryBytes / (srv.limits.memory * 1024 * 1024)) * 100
                          )
                        : 0;
                    return (
                      <tr key={srv.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3 pr-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectServer(srv.id)}
                            className="accent-[#8B5CF6] cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetId(srv.id);
                              setTab('single');
                            }}
                            className="font-semibold text-[#171717] dark:text-white hover:text-[#8B5CF6] text-left cursor-pointer"
                          >
                            {srv.name}
                          </button>
                          <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                            {audit?.runtimeLabel || srv.egg} · {srv.node}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <StatusText status={srv.status} />
                        </td>
                        <td className="py-3 px-2 font-mono tabular-nums text-[11px]">
                          {srv.resources.cpuPercent.toFixed(0)}% CPU · {memPct.toFixed(0)}% RAM
                        </td>
                        <td className="py-3 px-2">
                          {audit ? (
                            <span className={`font-bold font-display ${scoreTone(audit.score)}`}>
                              {audit.score}/100 ({audit.grade})
                            </span>
                          ) : (
                            <span className="text-[#777777]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 font-mono text-[11px] text-[#06B6D4]">
                          {audit ? formatBytes(audit.reclaimableBytes) : '—'}
                        </td>
                        <td className="py-3 px-2">
                          <button
                            type="button"
                            onClick={() => toggleServerAutoOptimize(srv.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                              isAutoOn ? 'mx-btn-3d-primary' : 'mx-btn-3d text-[#777777]'
                            }`}
                          >
                            {isAutoOn ? 'ON' : 'OFF'}
                          </button>
                        </td>
                        <td className="py-3 pl-2 text-right">
                          <button
                            type="button"
                            disabled={batchRunning}
                            onClick={() => handleBatchOptimize([srv.id])}
                            className="mx-btn-3d px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer disabled:opacity-50"
                          >
                            Optimize
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUTO-OPTIMIZE RULES & THRESHOLDS */}
      {tab === 'auto' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 mx-card-3d p-5 sm:p-6 rounded-2xl space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                  Auto-Optimize Policy & Triggers
                </h2>
                <p className="text-xs text-[#777777] dark:text-zinc-400 mt-0.5">
                  Automatically scans and optimizes enabled servers when resource thresholds are crossed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleAutoOptimize()}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  autoOptimizeSettings.enabled ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                }`}
              >
                {autoOptimizeSettings.enabled ? 'Enabled (ON)' : 'Disabled (OFF)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                  Auto Optimization Preset
                </label>
                <select
                  value={autoOptimizeSettings.preset}
                  onChange={(e) =>
                    setAutoOptimizeSettings((prev) => ({
                      ...prev,
                      preset: e.target.value as OptimizePreset,
                    }))
                  }
                  className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl cursor-pointer"
                >
                  <option value="balanced">Balanced (Recommended)</option>
                  <option value="performance">Max Performance / High TPS</option>
                  <option value="eco">Low RAM / Eco Mode</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                  Monitor Check Interval
                </label>
                <select
                  value={autoOptimizeSettings.intervalSeconds}
                  onChange={(e) =>
                    setAutoOptimizeSettings((prev) => ({
                      ...prev,
                      intervalSeconds: Number(e.target.value),
                    }))
                  }
                  className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl cursor-pointer"
                >
                  <option value={30}>Every 30 seconds</option>
                  <option value={60}>Every 1 minute</option>
                  <option value={180}>Every 3 minutes</option>
                  <option value={300}>Every 5 minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                  CPU Trigger Threshold ({autoOptimizeSettings.cpuThreshold}%)
                </label>
                <input
                  type="range"
                  min={50}
                  max={98}
                  value={autoOptimizeSettings.cpuThreshold}
                  onChange={(e) =>
                    setAutoOptimizeSettings((prev) => ({
                      ...prev,
                      cpuThreshold: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                  RAM Trigger Threshold ({autoOptimizeSettings.ramThreshold}%)
                </label>
                <input
                  type="range"
                  min={50}
                  max={98}
                  value={autoOptimizeSettings.ramThreshold}
                  onChange={(e) =>
                    setAutoOptimizeSettings((prev) => ({
                      ...prev,
                      ramThreshold: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-[#06B6D4]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                  Disk Cleanup Threshold ({autoOptimizeSettings.diskThreshold}%)
                </label>
                <input
                  type="range"
                  min={50}
                  max={98}
                  value={autoOptimizeSettings.diskThreshold}
                  onChange={(e) =>
                    setAutoOptimizeSettings((prev) => ({
                      ...prev,
                      diskThreshold: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                  Per-Server Cooldown (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={autoOptimizeSettings.cooldownMinutes}
                  onChange={(e) =>
                    setAutoOptimizeSettings((prev) => ({
                      ...prev,
                      cooldownMinutes: Math.max(5, Math.min(180, Number(e.target.value) || 15)),
                    }))
                  }
                  className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              {[
                {
                  key: 'autoCleanLogs' as const,
                  title: 'Auto-Clean Rotated Logs & Crash Reports',
                  desc: 'Deletes .log.gz & crash dumps automatically while keeping latest.log.',
                },
                {
                  key: 'autoTuneConfigs' as const,
                  title: 'Auto-Tune Server Configs',
                  desc: 'Applies preset optimizations to server.properties, bukkit, spigot, paper & purpur configs.',
                },
                {
                  key: 'autoFlushConsole' as const,
                  title: 'Auto-Flush Live Console Buffers',
                  desc: 'Runs safe save-all flush on online Minecraft servers.',
                },
                {
                  key: 'autoRestartOnCriticalRam' as const,
                  title: 'Emergency Restart on Critical Memory (>= 95% RAM)',
                  desc: 'Off by default. Enable only if you want unattended restarts when RAM hits 95%.',
                },
              ].map((rule) => (
                <label
                  key={rule.key}
                  className="mx-well-3d flex items-start gap-3 p-3 rounded-xl cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={autoOptimizeSettings[rule.key]}
                    onChange={(e) =>
                      setAutoOptimizeSettings((prev) => ({
                        ...prev,
                        [rule.key]: e.target.checked,
                      }))
                    }
                    className="mt-0.5 accent-[#8B5CF6] cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-semibold">{rule.title}</div>
                    <p className="text-[11px] text-[#777777] dark:text-zinc-400">{rule.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
                Per-Server Auto-Optimize Control
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setAutoOptimizeSettings((prev) => ({ ...prev, disabledServerIds: [] }))
                  }
                  className="mx-btn-3d px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
                >
                  All ON
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAutoOptimizeSettings((prev) => ({
                      ...prev,
                      disabledServerIds: servers.map((s) => s.id),
                    }))
                  }
                  className="mx-btn-3d px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
                >
                  All OFF
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {servers.map((srv) => {
                const enabled = !autoOptimizeSettings.disabledServerIds.includes(srv.id);
                return (
                  <div
                    key={srv.id}
                    className="mx-well-3d p-3 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{srv.name}</div>
                      <div className="text-[11px] text-[#777777] dark:text-zinc-400 truncate">
                        {srv.egg} · {srv.node}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleServerAutoOptimize(srv.id)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer ${
                        enabled ? 'mx-btn-3d-primary' : 'mx-btn-3d text-[#777777]'
                      }`}
                    >
                      {enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OPTIMIZATION HISTORY */}
      {tab === 'history' && (
        <div className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                Optimization Audit Log
              </h2>
              <p className="text-xs text-[#777777] dark:text-zinc-400">
                Recent Auto, Manual, and Multi-Server Batch optimization runs.
              </p>
            </div>
            {optimizeHistory.length > 0 && (
              <button
                type="button"
                onClick={clearOptimizeHistory}
                className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs cursor-pointer"
              >
                Clear Log
              </button>
            )}
          </div>

          {optimizeHistory.length === 0 ? (
            <div className="mx-well-3d p-8 rounded-xl text-center text-xs text-[#777777]">
              No optimization runs recorded yet. Run Manual Optimize or enable Auto-Optimize above.
            </div>
          ) : (
            <div className="space-y-2.5">
              {optimizeHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="mx-well-3d p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[#171717] dark:text-white">
                        {entry.serverName}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-[#8B5CF6]/15 text-[#8B5CF6]">
                        {entry.trigger}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/[0.05] dark:bg-white/[0.06]">
                        {entry.preset}
                      </span>
                      <span className="text-[11px] text-[#777777] dark:text-zinc-400">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#525252] dark:text-zinc-300">
                      {entry.actions.length > 0
                        ? entry.actions.join(' · ')
                        : entry.errorMessage || 'Server already optimal (no changes needed)'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
                    {entry.freedBytes > 0 && (
                      <span className="text-[#06B6D4] font-semibold">
                        -{formatBytes(entry.freedBytes)}
                      </span>
                    )}
                    <span className="font-semibold text-emerald-500">
                      {entry.scoreBefore} → {entry.scoreAfter}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
