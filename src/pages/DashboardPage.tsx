import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Award,
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  FolderOpen,
  History,
  LifeBuoy,
  Megaphone,
  Plus,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TerminalSquare,
  Wallet,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { ApiKeyEntry, SshKeyEntry, TelemetryPoint } from '../types/panel';
import {
  computeSecurityScore,
  DEFAULT_DASHBOARD_PREFS,
  type DashboardBgPreset,
  type DashboardWidgetId,
} from '../utils/userPreferences';
import { formatBytes, formatMb, formatRelativeTime, formatUptime } from '../utils/format';
import { ServerCategoryIcon } from '../components/ui/ServerIcon';
import { StatusText } from '../components/ui/StatusText';
import { TelemetryChart } from '../components/ui/TelemetryChart';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import defaultAvatar from '../assets/images/avatar_midnightx_user_1795748243919.jpg';

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  stats: 'Infrastructure Statistics',
  telemetry: 'Cluster Telemetry & Activity',
  servers: 'Server Overview Cards',
  security: 'Account Security Health',
  announcements: 'Announcements Feed',
  status: 'Service Status & Incidents',
  wallet: 'Wallet & Recent Payments',
  rewards: 'Rewards, XP & Streak',
  notifications: 'Unread Notifications Overview',
  quickSupport: 'Quick Support & Community Shortcuts',
};

const BG_PRESETS: Array<{ id: DashboardBgPreset; label: string }> = [
  { id: 'default', label: 'HelzerX Default' },
  { id: 'aurora', label: 'Aurora Violet' },
  { id: 'cosmos', label: 'Deep Cosmos' },
  { id: 'obsidian', label: 'Obsidian Slate' },
];

export function DashboardPage() {
  const {
    servers,
    user,
    activityLogs,
    navigate,
    loading,
    panelConnected,
    connectionError,
    t,
    dashboardPrefs,
    setDashboardPrefs,
    favoritePages,
    recentPages,
    helzerxData,
    notify,
  } = usePanel();
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [sshKeys, setSshKeys] = useState<SshKeyEntry[]>([]);

  const showSecurityWidget = !dashboardPrefs.hiddenWidgets.includes('security');

  useEffect(() => {
    if (!panelConnected || !showSecurityWidget) return;
    Promise.all([
      panelApi.getApiKeys().catch(() => []),
      panelApi.getSshKeys().catch(() => []),
    ]).then(([keys, ssh]) => {
      setApiKeys(keys);
      setSshKeys(ssh);
    });
  }, [panelConnected, showSecurityWidget]);

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

  const securityAssessment = useMemo(
    () => computeSecurityScore(user, apiKeys, sshKeys),
    [user, apiKeys, sshKeys]
  );

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
  const displayName =
    helzerxData?.profile?.displayName ||
    (user ? `${user.firstName} ${user.lastName}`.trim() || user.username : 'User');
  const avatarSrc = helzerxData?.profile?.avatarUrl || defaultAvatar;
  const greetingText = dashboardPrefs.customGreeting.trim() || t('dash.welcome');

  const moveWidget = (id: DashboardWidgetId, dir: -1 | 1) => {
    setDashboardPrefs((prev) => {
      const idx = prev.widgetOrder.indexOf(id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.widgetOrder.length) return prev;
      const nextOrder = [...prev.widgetOrder];
      [nextOrder[idx], nextOrder[target]] = [nextOrder[target], nextOrder[idx]];
      return { ...prev, widgetOrder: nextOrder };
    });
  };

  const toggleWidgetVisibility = (id: DashboardWidgetId) => {
    setDashboardPrefs((prev) => {
      const hidden = prev.hiddenWidgets.includes(id)
        ? prev.hiddenWidgets.filter((w) => w !== id)
        : [...prev.hiddenWidgets, id];
      return { ...prev, hiddenWidgets: hidden };
    });
  };

  const renderWidget = (id: DashboardWidgetId) => {
    if (dashboardPrefs.hiddenWidgets.includes(id)) return null;

    if (id === 'stats') {
      return (
        <section key="stats" aria-label="Infrastructure summary">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
            <div className="mx-card-3d p-4 rounded-2xl">
              <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">{t('dash.totalServers')}</div>
              <div className="mt-2 text-2xl font-bold mx-stat-3d text-[#171717] dark:text-white">
                {stats.total}
              </div>
              <div className="mt-1 text-[11px] font-medium text-[#777777] dark:text-zinc-500">Assigned instances</div>
            </div>

            <div className="mx-card-3d p-4 rounded-2xl">
              <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">{t('dash.onlineServers')}</div>
              <div className="mt-2 text-2xl font-bold mx-stat-3d-emerald">
                {stats.online}
              </div>
              <div className="mt-1 text-[11px] font-medium text-[#777777] dark:text-zinc-500">Running containers</div>
            </div>

            <div className="mx-card-3d p-4 rounded-2xl">
              <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">{t('dash.offlineServers')}</div>
              <div className="mt-2 text-2xl font-bold mx-stat-3d text-[#171717] dark:text-zinc-200">
                {stats.offline}
              </div>
              <div className="mt-1 text-[11px] font-medium text-[#777777] dark:text-zinc-500">Stopped containers</div>
            </div>

            <div className="mx-card-3d p-4 rounded-2xl">
              <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">{t('dash.cpuUsage')}</div>
              <div className="mt-2 text-2xl font-bold mx-stat-3d-violet">
                {stats.avgCpuPercent.toFixed(1)}%
              </div>
              <div className="mt-1 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
                {stats.usedCpu.toFixed(1)}% aggregate
              </div>
            </div>

            <div className="mx-card-3d p-4 rounded-2xl">
              <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">{t('dash.ramUsage')}</div>
              <div className="mt-2 text-2xl font-bold mx-stat-3d-cyan">
                {stats.memPercent.toFixed(1)}%
              </div>
              <div className="mt-1 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
                {formatBytes(stats.usedMemBytes)} / {servers.length > 0 ? formatBytes(stats.totalMemBytes, 0) : '0 B'}
              </div>
            </div>

            <div className="mx-card-3d p-4 rounded-2xl">
              <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">{t('dash.diskUsage')}</div>
              <div className="mt-2 text-2xl font-bold mx-stat-3d text-[#171717] dark:text-white">
                {stats.diskPercent.toFixed(1)}%
              </div>
              <div className="mt-1 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
                {formatBytes(stats.usedDiskBytes)} / {servers.length > 0 ? formatBytes(stats.totalDiskBytes, 0) : '0 B'}
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (id === 'telemetry') {
      return (
        <div key="telemetry" className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
          <section className="xl:col-span-8 mx-card-3d p-5 sm:p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                  {t('dash.telemetry')}
                </h2>
                <p className="text-xs text-[#777777] dark:text-zinc-400 mt-0.5">
                  Live CPU &amp; memory readings polled from Pterodactyl Wings
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
              <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                {t('dash.recentActivity')}
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
                    <span className="text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500 whitespace-nowrap shrink-0">
                      {formatRelativeTime(log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      );
    }

    if (id === 'security') {
      return (
        <section key="security" aria-label="Account Security Health" className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="mx-well-3d w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                {securityAssessment.score >= 80 ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                )}
              </div>
              <div>
                <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                  Account Health &amp; Security Score
                </h2>
                <p className="text-xs text-[#777777] dark:text-zinc-400">
                  Live Pterodactyl posture across 2FA, SSH keys, and API tokens
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xl font-bold mx-stat-3d-violet">{securityAssessment.score}%</span>
                <span className="block text-[11px] font-medium text-[#777777] dark:text-zinc-400">
                  {securityAssessment.grade}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate({ page: 'account' })}
                className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
              >
                Manage Security
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {securityAssessment.recommendations.map((rec) => (
              <div key={rec.id} className="mx-well-3d p-3.5 rounded-xl flex items-start gap-2.5">
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    rec.completed ? 'text-emerald-500' : 'text-amber-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#171717] dark:text-zinc-100">{rec.title}</div>
                  <div className="text-[11px] text-[#777777] dark:text-zinc-400 mt-0.5">{rec.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (id === 'announcements') {
      const anns = helzerxData?.activeAnnouncements || [];
      return (
        <section key="announcements" className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="mx-heading-3d text-base font-bold flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#8B5CF6]" />
              Announcements Feed
            </h2>
            <button
              type="button"
              onClick={() => navigate({ page: 'updates' })}
              className="text-xs text-[#8B5CF6] hover:underline cursor-pointer"
            >
              Open Updates Hub
            </button>
          </div>
          {anns.length === 0 ? (
            <div className="text-xs text-[#777777]">No active platform announcements.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {anns.slice(0, 4).map((a) => (
                <div key={a.id} className="mx-well-3d p-3.5 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-[#777777]">
                    <span className="font-semibold text-[#8B5CF6]">{a.category}</span>
                    <span>{formatRelativeTime(a.createdAt)}</span>
                  </div>
                  <div className="text-xs font-bold text-[#171717] dark:text-white">{a.title}</div>
                  <p className="text-[11px] text-[#525252] dark:text-zinc-300 line-clamp-2">{a.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (id === 'status') {
      const incidents = helzerxData?.incidents || [];
      return (
        <section key="status" className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="mx-heading-3d text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Service Status
            </h2>
            <button
              type="button"
              onClick={() => navigate({ page: 'updates' })}
              className="text-xs text-[#8B5CF6] hover:underline cursor-pointer"
            >
              Full status page
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incidents.slice(0, 4).map((inc) => (
              <div key={inc.id} className="mx-well-3d p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{inc.component}</div>
                  <div className="text-[11px] text-[#777777] truncate">{inc.title}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase shrink-0 ${
                    inc.status === 'operational'
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : inc.status === 'outage'
                        ? 'bg-rose-500/15 text-rose-500'
                        : 'bg-amber-500/15 text-amber-500'
                  }`}
                >
                  {inc.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (id === 'wallet') {
      const txs = helzerxData?.recentTransactions || [];
      return (
        <section key="wallet" className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-[#8B5CF6]" />
              <div>
                <h2 className="mx-heading-3d text-base font-bold">Wallet &amp; Recent Payments</h2>
                <div className="text-xs text-[#777777]">
                  Available balance:{' '}
                  <strong className="font-mono text-[#171717] dark:text-white">
                    ${(helzerxData?.walletBalance || 0).toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate({ page: 'billing' })}
              className="mx-btn-3d-primary px-3 py-1.5 rounded-xl text-xs cursor-pointer"
            >
              Manage Billing
            </button>
          </div>
          {txs.length > 0 && (
            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05] text-xs">
              {txs.slice(0, 4).map((tx) => (
                <div key={tx.id} className="py-2 flex items-center justify-between gap-2">
                  <span className="truncate">{tx.note}</span>
                  <span className="font-mono font-semibold shrink-0">
                    {tx.type === 'debit' ? '-' : '+'}${tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (id === 'rewards') {
      const loy = helzerxData?.loyalty;
      return (
        <section key="rewards" className="mx-card-3d p-5 sm:p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="mx-well-3d w-10 h-10 rounded-xl flex items-center justify-center">
              <Award className="w-5 h-5 text-[#06B6D4]" />
            </div>
            <div>
              <h2 className="mx-heading-3d text-base font-bold">
                Rewards &amp; VIP Status ({loy?.tier || 'Standard'})
              </h2>
              <p className="text-xs text-[#777777] dark:text-zinc-400 font-mono">
                Level {loy?.level || 1} · {loy?.xp || 0} XP · {loy?.points || 0} Points · {loy?.streakDays || 0}-Day Streak
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'rewards' })}
            className="mx-btn-3d-primary px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
          >
            Claim Daily Reward
          </button>
        </section>
      );
    }

    if (id === 'notifications') {
      const ntfs = helzerxData?.notifications || [];
      return (
        <section key="notifications" className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="mx-heading-3d text-base font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#06B6D4]" />
              Notifications ({helzerxData?.unreadNotifications || 0} unread)
            </h2>
            <button
              type="button"
              onClick={() => navigate({ page: 'updates' })}
              className="text-xs text-[#8B5CF6] hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          {ntfs.length === 0 ? (
            <div className="text-xs text-[#777777]">You are all caught up.</div>
          ) : (
            <div className="space-y-2">
              {ntfs.slice(0, 4).map((n) => (
                <div key={n.id} className="mx-well-3d p-3 rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{n.title}</div>
                    <div className="text-[11px] text-[#777777] truncate">{n.body}</div>
                  </div>
                  <span className="font-mono text-[10px] text-[#777777] shrink-0">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (id === 'quickSupport') {
      return (
        <section key="quickSupport" className="mx-card-3d p-5 sm:p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="mx-well-3d w-10 h-10 rounded-xl flex items-center justify-center">
              <LifeBuoy className="w-5 h-5 text-[#06B6D4]" />
            </div>
            <div>
              <h2 className="mx-heading-3d text-base font-bold">Need Assistance or Want to Connect?</h2>
              <p className="text-xs text-[#777777] dark:text-zinc-400">
                Open a ticket with engineering, browse Knowledge Base guides, or join Community Discussions
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate({ page: 'support' })}
              className="mx-btn-3d-primary px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
            >
              Open Support Ticket
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'community' })}
              className="mx-btn-3d px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
            >
              Community Forum
            </button>
          </div>
        </section>
      );
    }

    return (
      <section key="servers" aria-label="Server Overview">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
              {t('dash.serverOverview')}
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
                        <h3 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white truncate">
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
                        <span className="mx-label-3d font-medium text-[#777777] dark:text-zinc-400">CPU</span>
                        <span className="font-display font-semibold tabular-nums text-[#171717] dark:text-zinc-200">
                          {srv.resources.cpuPercent.toFixed(1)}% / {srv.limits.cpu || '∞'}%
                        </span>
                      </div>
                      <div className="mx-well-3d h-2.5 rounded-full overflow-hidden p-[1.5px]">
                        <div className="mx-meter-violet h-full rounded-full transition-all duration-300" style={{ width: `${cpuPct}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="mx-label-3d font-medium text-[#777777] dark:text-zinc-400">Memory</span>
                        <span className="font-display font-semibold tabular-nums text-[#171717] dark:text-zinc-200">
                          {formatBytes(srv.resources.memoryBytes)} / {formatMb(srv.limits.memory)}
                        </span>
                      </div>
                      <div className="mx-well-3d h-2.5 rounded-full overflow-hidden p-[1.5px]">
                        <div className="mx-meter-cyan h-full rounded-full transition-all duration-300" style={{ width: `${memPct}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="mx-label-3d font-medium text-[#777777] dark:text-zinc-400">Disk</span>
                        <span className="font-display font-semibold tabular-nums text-[#171717] dark:text-zinc-200">
                          {formatBytes(srv.resources.diskBytes)} / {formatMb(srv.limits.disk)}
                        </span>
                      </div>
                      <div className="mx-well-3d h-2.5 rounded-full overflow-hidden p-[1.5px]">
                        <div className="mx-meter-neutral h-full rounded-full transition-all duration-300" style={{ width: `${diskPct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-[11px] font-medium text-[#777777] dark:text-zinc-400">
                    <span className="tabular-nums">
                      {srv.allocations[0]?.ip || '—'}:{srv.allocations[0]?.port || '—'}
                    </span>
                    <span className="tabular-nums">{formatUptime(srv.resources.uptimeMs)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-7">
      {/* Header & Quick Actions Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-[#171717] dark:ring-white/20 bg-[#171717] shrink-0 shadow-[0_6px_14px_rgba(0,0,0,0.22)]">
            <img
              src={avatarSrc}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white truncate">
              {greetingText}, {displayName}
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
              {t('dash.createServer')}
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
                {t('dash.openConsole')}
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'server-backups', serverId: primaryServer.id })}
                className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-[#06B6D4]" />
                {t('dash.manageBackups')}
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'server-files', serverId: primaryServer.id })}
                className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#777777] dark:text-zinc-400" />
                {t('dash.viewFiles')}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setCustomizerOpen((o) => !o)}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#8B5CF6]" />
            Customize
          </button>
        </div>
      </div>

      {/* Collapsible Dashboard Customizer (zero impact when closed) */}
      {customizerOpen && (
        <section className="mx-card-3d p-5 rounded-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
            <div>
              <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
                Dashboard Layout &amp; Personalization
              </h2>
              <p className="text-xs text-[#777777] dark:text-zinc-400">
                Customize widget order, visibility, quick shortcuts bar, background gradient, and personal greeting
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDashboardPrefs(DEFAULT_DASHBOARD_PREFS);
                notify('Dashboard layout reset to defaults', undefined, 'info');
              }}
              className="mx-btn-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                  Custom Greeting Prefix
                </label>
                <input
                  type="text"
                  value={dashboardPrefs.customGreeting}
                  onChange={(e) =>
                    setDashboardPrefs((prev) => ({ ...prev, customGreeting: e.target.value }))
                  }
                  placeholder={`Default (${t('dash.welcome')})`}
                  className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
                />
              </div>

              <div>
                <div className="text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1.5">
                  Dashboard Background Preset
                </div>
                <div className="flex flex-wrap gap-2">
                  {BG_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDashboardPrefs((prev) => ({ ...prev, bgPreset: preset.id }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                        dashboardPrefs.bgPreset === preset.id ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-1 text-xs text-[#171717] dark:text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dashboardPrefs.showQuickBar}
                  onChange={(e) =>
                    setDashboardPrefs((prev) => ({ ...prev, showQuickBar: e.target.checked }))
                  }
                  className="rounded accent-[#8B5CF6]"
                />
                Show Favorite &amp; Recently Visited Pages bar on Dashboard
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-[#525252] dark:text-zinc-300">
                Widget Order &amp; Visibility
              </div>
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {dashboardPrefs.widgetOrder.map((wid, idx) => {
                  const isHidden = dashboardPrefs.hiddenWidgets.includes(wid);
                  return (
                    <div
                      key={wid}
                      className="mx-well-3d px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <span className={isHidden ? 'text-[#777777] line-through' : 'font-medium'}>
                        {WIDGET_LABELS[wid]}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveWidget(wid, -1)}
                          disabled={idx === 0}
                          aria-label={`Move ${WIDGET_LABELS[wid]} up`}
                          className="mx-btn-3d p-1 rounded-lg disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWidget(wid, 1)}
                          disabled={idx === dashboardPrefs.widgetOrder.length - 1}
                          aria-label={`Move ${WIDGET_LABELS[wid]} down`}
                          className="mx-btn-3d p-1 rounded-lg disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleWidgetVisibility(wid)}
                          aria-label={isHidden ? `Show ${WIDGET_LABELS[wid]}` : `Hide ${WIDGET_LABELS[wid]}`}
                          className="mx-btn-3d p-1 rounded-lg cursor-pointer"
                        >
                          {isHidden ? <EyeOff className="w-3 h-3 text-rose-500" /> : <Eye className="w-3 h-3 text-emerald-500" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Optional Favorite & Recently Visited Pages Quick Bar */}
      {dashboardPrefs.showQuickBar && (favoritePages.length > 0 || recentPages.length > 0) && (
        <section aria-label="Pinned and recent pages" className="mx-card-3d p-4 rounded-2xl flex flex-wrap items-center gap-2">
          {favoritePages.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500 mr-1">
                <Star className="w-3.5 h-3.5 fill-amber-500" />
                Pinned
              </span>
              {favoritePages.slice(0, 5).map((fav) => (
                <button
                  key={fav.id}
                  type="button"
                  onClick={() => navigate(fav.route)}
                  className="mx-btn-3d px-2.5 py-1 rounded-xl text-xs font-medium cursor-pointer"
                >
                  {fav.label}
                </button>
              ))}
            </>
          )}
          {recentPages.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#777777] dark:text-zinc-400 ml-1 mr-1">
                <History className="w-3.5 h-3.5" />
                Recent
              </span>
              {recentPages.slice(0, 4).map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => navigate(rec.route)}
                  className="mx-well-3d px-2.5 py-1 rounded-xl text-xs text-[#525252] dark:text-zinc-300 hover:text-[#8B5CF6] cursor-pointer"
                >
                  {rec.label}
                </button>
              ))}
            </>
          )}
        </section>
      )}

      {/* Customizable Widgets */}
      {dashboardPrefs.widgetOrder.map((wid) => renderWidget(wid))}
    </div>
  );
}
