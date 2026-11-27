import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowUpRight,
  FolderOpen,
  Plus,
  Server,
  TerminalSquare,
} from 'lucide-react';
import { usePanel } from '../context/PanelContext';
import type { TelemetryPoint } from '../types/panel';
import { formatBytes, formatMb, formatRelativeTime, formatUptime } from '../utils/format';
import { ServerCategoryIcon } from '../components/ui/ServerIcon';
import { StatusText } from '../components/ui/StatusText';
import { TelemetryChart } from '../components/ui/TelemetryChart';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';

export function DashboardPage() {
  const { servers, user, activityLogs, navigate, loading, panelConnected, connectionError } = usePanel();
  const [history, setHistory] = useState<TelemetryPoint[]>([]);

  const stats = useMemo(() => {
    const total = servers.length;
    const online = servers.filter((s) => s.status === 'running').length;
    const offline = servers.filter((s) => s.status === 'offline').length;

    const totalCpuLimit = servers.reduce((acc, s) => acc + s.limits.cpu, 0) || 1;
    const usedCpu = servers.reduce((acc, s) => acc + (s.status === 'running' ? s.resources.cpuPercent : 0), 0);
    const avgCpuPercent = servers.length > 0 ? Math.min(100, (usedCpu / totalCpuLimit) * 100) : 0;

    const totalMemBytes = servers.reduce((acc, s) => acc + s.limits.memory * 1024 * 1024, 0) || 1;
    const usedMemBytes = servers.reduce((acc, s) => acc + s.resources.memoryBytes, 0);
    const memPercent = servers.length > 0 ? Math.min(100, (usedMemBytes / totalMemBytes) * 100) : 0;

    const totalDiskBytes = servers.reduce((acc, s) => acc + s.limits.disk * 1024 * 1024, 0) || 1;
    const usedDiskBytes = servers.reduce((acc, s) => acc + s.resources.diskBytes, 0);
    const diskPercent = servers.length > 0 ? Math.min(100, (usedDiskBytes / totalDiskBytes) * 100) : 0;

    return {
      total,
      online,
      offline,
      usedCpu,
      avgCpuPercent,
      usedMemBytes,
      totalMemBytes,
      memPercent,
      usedDiskBytes,
      totalDiskBytes,
      diskPercent,
    };
  }, [servers]);

  // Append only real readings from Pterodactyl resources API
  useEffect(() => {
    if (!panelConnected || servers.length === 0) {
      setHistory([]);
      return;
    }
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistory((prev) => [
      ...prev.slice(-23),
      {
        time: timeStr,
        cpu: Number(stats.avgCpuPercent.toFixed(1)),
        memoryPercent: Number(stats.memPercent.toFixed(1)),
        networkKbps: 0,
      },
    ]);
  }, [panelConnected, servers, stats.avgCpuPercent, stats.memPercent]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  const primaryServer = servers[0];
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() || user.username : 'User';

  return (
    <div className="space-y-7">
      {/* Header & Quick Actions Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-[#171717] dark:ring-white/20 bg-[#171717] shrink-0 shadow-[0_6px_14px_rgba(0,0,0,0.22)]">
            <img
              src="/src/assets/images/avatar_midnightx_user_1795748243919.jpg"
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-white truncate">
              Welcome back, {displayName}
            </h1>
            <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 flex flex-wrap items-center gap-2 mt-0.5">
              <span>{user?.email}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{user?.role || 'user'}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => navigate({ page: 'account' })}
                className="text-[#8B5CF6] hover:underline cursor-pointer"
              >
                Account settings
              </button>
            </p>
          </div>
        </div>

        {/* 3D Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => navigate({ page: 'admin', section: 'servers' })}
              className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Server
            </button>
          )}
          {primaryServer && (
            <>
              <button
                type="button"
                onClick={() => navigate({ page: 'server-console', serverId: primaryServer.id })}
                className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <TerminalSquare className="w-3.5 h-3.5 text-[#8B5CF6]" />
                Open Console
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'server-backups', serverId: primaryServer.id })}
                className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-[#06B6D4]" />
                Manage Backups
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'server-files', serverId: primaryServer.id })}
                className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#777777] dark:text-zinc-400" />
                View Files
              </button>
            </>
          )}
        </div>
      </div>

      {/* 6 Core Statistics */}
      <section aria-label="Infrastructure summary">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <div className="mx-card-3d p-4 rounded-2xl">
            <div className="text-xs text-[#777777] dark:text-zinc-400">Total Servers</div>
            <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#171717] dark:text-white">
              {stats.total}
            </div>
            <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500">Assigned instances</div>
          </div>

          <div className="mx-card-3d p-4 rounded-2xl">
            <div className="text-xs text-[#777777] dark:text-zinc-400">Online Servers</div>
            <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              {stats.online}
            </div>
            <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500">Running containers</div>
          </div>

          <div className="mx-card-3d p-4 rounded-2xl">
            <div className="text-xs text-[#777777] dark:text-zinc-400">Offline Servers</div>
            <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#171717] dark:text-zinc-200">
              {stats.offline}
            </div>
            <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500">Stopped containers</div>
          </div>

          <div className="mx-card-3d p-4 rounded-2xl">
            <div className="text-xs text-[#777777] dark:text-zinc-400">CPU Usage</div>
            <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#8B5CF6]">
              {stats.avgCpuPercent.toFixed(1)}%
            </div>
            <div className="mt-1 text-[11px] font-mono tabular-nums text-[#777777] dark:text-zinc-500">
              {stats.usedCpu.toFixed(1)}% aggregate
            </div>
          </div>

          <div className="mx-card-3d p-4 rounded-2xl">
            <div className="text-xs text-[#777777] dark:text-zinc-400">RAM Usage</div>
            <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#06B6D4]">
              {stats.memPercent.toFixed(1)}%
            </div>
            <div className="mt-1 text-[11px] font-mono tabular-nums text-[#777777] dark:text-zinc-500">
              {formatBytes(stats.usedMemBytes)} / {servers.length > 0 ? formatBytes(stats.totalMemBytes, 0) : '0 B'}
            </div>
          </div>

          <div className="mx-card-3d p-4 rounded-2xl">
            <div className="text-xs text-[#777777] dark:text-zinc-400">Disk Usage</div>
            <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#171717] dark:text-white">
              {stats.diskPercent.toFixed(1)}%
            </div>
            <div className="mt-1 text-[11px] font-mono tabular-nums text-[#777777] dark:text-zinc-500">
              {formatBytes(stats.usedDiskBytes)} / {servers.length > 0 ? formatBytes(stats.totalDiskBytes, 0) : '0 B'}
            </div>
          </div>
        </div>
      </section>

      {/* Main Resource Graph + Recent Activity Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <section className="xl:col-span-8 mx-card-3d p-5 sm:p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#171717] dark:text-white">
                Cluster Resource Telemetry
              </h2>
              <p className="text-xs text-[#777777] dark:text-zinc-400 mt-0.5">
                Live CPU & memory readings polled from Pterodactyl Wings
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ page: 'servers' })}
              className="mx-btn-3d px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
            >
              Inspect Servers
            </button>
          </div>
          <TelemetryChart data={history} height={210} />
        </section>

        <section className="xl:col-span-4 mx-card-3d p-5 sm:p-6 rounded-2xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#171717] dark:text-white">
              Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => navigate({ page: 'account' })}
              className="text-xs text-[#8B5CF6] hover:underline cursor-pointer"
            >
              View security
            </button>
          </div>
          {activityLogs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-[#777777] dark:text-zinc-400 py-8">
              No recent account activity recorded.
            </div>
          ) : (
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06] flex-1">
              {activityLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#171717] dark:text-zinc-200 truncate">
                      {log.event}
                    </div>
                    <div className="text-[11px] text-[#777777] dark:text-zinc-400 truncate mt-0.5">
                      {log.target} · {log.ip}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-[#777777] dark:text-zinc-500 whitespace-nowrap shrink-0">
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Server Overview Cards */}
      <section aria-label="Server Overview">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#171717] dark:text-white">
              Server Overview
            </h2>
            <p className="text-xs text-[#777777] dark:text-zinc-400 mt-0.5">
              Select an instance to open its real-time Wings terminal and file explorer
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'servers' })}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#171717] dark:text-zinc-200 hover:text-[#8B5CF6] transition-colors cursor-pointer"
          >
            All {servers.length} servers
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {servers.length === 0 ? (
          <div className="mx-card-3d p-10 rounded-2xl text-center space-y-2">
            <Server className="w-7 h-7 text-[#777777] mx-auto" />
            <p className="text-sm font-medium text-[#171717] dark:text-white">No servers assigned to this account</p>
            <p className="text-xs text-[#777777] dark:text-zinc-400">
              Servers created in Pterodactyl Admin will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {servers.slice(0, 6).map((srv) => {
              const memPct = srv.limits.memory > 0 ? Math.min(100, (srv.resources.memoryBytes / (srv.limits.memory * 1024 * 1024)) * 100) : 0;
              const diskPct = srv.limits.disk > 0 ? Math.min(100, (srv.resources.diskBytes / (srv.limits.disk * 1024 * 1024)) * 100) : 0;
              const cpuPct = srv.limits.cpu > 0 ? Math.min(100, (srv.resources.cpuPercent / srv.limits.cpu) * 100) : 0;

              return (
                <div
                  key={srv.id}
                  onClick={() => navigate({ page: 'server-console', serverId: srv.id })}
                  className="mx-card-3d mx-card-3d-interactive group p-5 rounded-2xl cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="mx-well-3d w-10 h-10 rounded-xl flex items-center justify-center text-[#171717] dark:text-zinc-200 shrink-0 group-hover:text-[#8B5CF6] transition-colors">
                        <ServerCategoryIcon category={srv.category} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#171717] dark:text-white truncate">
                          {srv.name}
                        </h3>
                        <div className="text-[11px] text-[#777777] dark:text-zinc-400 truncate">
                          {srv.egg} · {srv.node}
                        </div>
                      </div>
                    </div>
                    <StatusText status={srv.status} />
                  </div>

                  <div className="mt-4 pt-4 border-t border-black/[0.05] dark:border-white/[0.06] space-y-2.5">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#777777] dark:text-zinc-400">CPU</span>
                        <span className="font-mono tabular-nums text-[#171717] dark:text-zinc-200">
                          {srv.resources.cpuPercent.toFixed(1)}% / {srv.limits.cpu || '∞'}%
                        </span>
                      </div>
                      <div className="mx-well-3d h-2 rounded-full overflow-hidden p-[1px]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] transition-all duration-300" style={{ width: `${cpuPct}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#777777] dark:text-zinc-400">Memory</span>
                        <span className="font-mono tabular-nums text-[#171717] dark:text-zinc-200">
                          {formatBytes(srv.resources.memoryBytes)} / {formatMb(srv.limits.memory)}
                        </span>
                      </div>
                      <div className="mx-well-3d h-2 rounded-full overflow-hidden p-[1px]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#06B6D4] to-[#22D3EE] transition-all duration-300" style={{ width: `${memPct}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#777777] dark:text-zinc-400">Disk</span>
                        <span className="font-mono tabular-nums text-[#171717] dark:text-zinc-200">
                          {formatBytes(srv.resources.diskBytes)} / {formatMb(srv.limits.disk)}
                        </span>
                      </div>
                      <div className="mx-well-3d h-2 rounded-full overflow-hidden p-[1px]">
                        <div className="h-full rounded-full bg-[#171717] dark:bg-zinc-400 transition-all duration-300" style={{ width: `${diskPct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-[11px] text-[#777777] dark:text-zinc-400">
                    <span className="font-mono tabular-nums">
                      {srv.allocations[0]?.ip || '—'}:{srv.allocations[0]?.port || '—'}
                    </span>
                    <span className="font-mono tabular-nums">{formatUptime(srv.resources.uptimeMs)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
