import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  HardDrive,
  MapPin,
  Network,
  Play,
  Server,
  ShieldAlert,
  Skull,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { AdminLocation, AdminNode, AdminUser, PterodactylServer } from '../types/panel';
import { formatMb } from '../utils/format';
import { StatusText } from '../components/ui/StatusText';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'servers', label: 'Servers', icon: Server },
  { id: 'nodes', label: 'Nodes', icon: HardDrive },
  { id: 'locations', label: 'Locations', icon: MapPin },
];

export function AdminPanelPage({ initialSection = 'overview' }: { initialSection?: string }) {
  const {
    navigate,
    refreshData,
    notify,
    panelConnected,
    connectionError,
    globalServerLock,
    forceStopBusy,
    forceStopAllServers,
    resumeAllServers,
  } = usePanel();
  const [tab, setTab] = useState(initialSection);
  const [stats, setStats] = useState({ totalUsers: 0, totalServers: 0, totalNodes: 0, totalAllocations: 0 });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [servers, setServers] = useState<PterodactylServer[]>([]);
  const [nodes, setNodes] = useState<AdminNode[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [adminError, setAdminError] = useState<string | null>(null);

  const [newUserForm, setNewUserForm] = useState({ username: '', email: '', firstName: '', lastName: '', role: 'user' });
  const [newLocForm, setNewLocForm] = useState({ shortCode: '', description: '' });
  const [lockReason, setLockReason] = useState(
    'All servers force-stopped by administration. Starting servers is temporarily unavailable until an admin resumes them.'
  );
  const [stopSignal, setStopSignal] = useState<'kill' | 'stop'>('kill');
  const [confirmForceStop, setConfirmForceStop] = useState(false);

  useEffect(() => {
    setTab(initialSection || 'overview');
  }, [initialSection]);

  const loadAdmin = useCallback(async () => {
    if (!panelConnected) return;
    try {
      const res = await panelApi.getAdminOverview();
      setStats(res.stats);
      setUsers(res.users);
      setServers(res.servers);
      setNodes(res.nodes);
      setLocations(res.locations);
      setAdminError(null);
    } catch (err: any) {
      setAdminError(err?.message || 'Application API requires PTERODACTYL_APP_API_KEY or root admin permissions.');
    }
  }, [panelConnected]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  const switchTab = (next: string) => {
    setTab(next);
    navigate({ page: 'admin', section: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-white">
          Administration
        </h1>
        <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
          Manage Pterodactyl Application API users, servers, nodes, and locations
        </p>
      </div>

      <div className="mx-well-3d inline-flex items-center gap-1.5 p-1.5 rounded-2xl overflow-x-auto max-w-full">
        {ADMIN_TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                active ? 'mx-btn-3d-primary' : 'text-[#525252] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {adminError && (
        <div className="mx-card-3d p-5 rounded-2xl text-xs text-amber-700 dark:text-amber-400">
          {adminError}
        </div>
      )}

      {(tab === 'overview' || tab === 'servers') && (
        <div className="mx-card-3d p-5 rounded-2xl space-y-4 border border-rose-500/30">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
                    Global Cluster Force Stop & Start Lock
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      globalServerLock?.locked
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {globalServerLock?.locked ? 'Locked for Users' : 'Unlocked'}
                  </span>
                </div>
                <p className="text-xs text-[#777777] dark:text-zinc-400 mt-0.5">
                  Stops every server across all nodes and blocks Start & Restart buttons for normal users until an admin resumes or starts servers again.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {globalServerLock?.locked && (
                <>
                  <button
                    type="button"
                    disabled={forceStopBusy}
                    onClick={async () => {
                      await resumeAllServers(true);
                      loadAdmin();
                    }}
                    className="mx-btn-3d-success inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {forceStopBusy ? 'Starting...' : 'Unlock & Start All'}
                  </button>
                  <button
                    type="button"
                    disabled={forceStopBusy}
                    onClick={async () => {
                      await resumeAllServers(false);
                      loadAdmin();
                    }}
                    className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium disabled:opacity-50 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Unlock Users Only
                  </button>
                </>
              )}

              {!confirmForceStop ? (
                <button
                  type="button"
                  disabled={forceStopBusy}
                  onClick={() => setConfirmForceStop(true)}
                  className="mx-btn-3d-danger inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  <Skull className="w-3.5 h-3.5" />
                  Force Stop All Servers
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={forceStopBusy}
                    onClick={() => setConfirmForceStop(false)}
                    className="mx-btn-3d px-3 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={forceStopBusy}
                    onClick={async () => {
                      await forceStopAllServers(lockReason, stopSignal);
                      setConfirmForceStop(false);
                      loadAdmin();
                    }}
                    className="mx-btn-3d-danger inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    <Skull className="w-3.5 h-3.5" />
                    {forceStopBusy ? 'Stopping Nodes...' : 'Confirm Stop All Nodes'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <select
              aria-label="Stop signal mode"
              value={stopSignal}
              onChange={(e) => setStopSignal(e.target.value as 'kill' | 'stop')}
              className="mx-input-3d px-3 py-2 rounded-xl text-xs cursor-pointer"
            >
              <option value="kill">Force Kill (All Nodes)</option>
              <option value="stop">Graceful Stop (All Nodes)</option>
            </select>
            <input
              type="text"
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              placeholder="Lock notice displayed to users..."
              className="mx-input-3d sm:col-span-3 px-3 py-2 rounded-xl text-xs"
            />
          </div>
        </div>
      )}

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, accent: 'mx-stat-3d' },
              { label: 'Total Servers', value: stats.totalServers, icon: Server, accent: 'mx-stat-3d-violet' },
              { label: 'Registered Nodes', value: stats.totalNodes, icon: HardDrive, accent: 'mx-stat-3d-cyan' },
              { label: 'Total Allocations', value: stats.totalAllocations, icon: Network, accent: 'mx-stat-3d' },
            ].map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className="mx-card-3d p-4 rounded-2xl">
                <div className="flex items-center justify-between gap-2">
                  <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">{label}</div>
                  <Icon className="w-4 h-4 shrink-0 text-[#8B5CF6] dark:text-violet-400" />
                </div>
                <div className={`mt-1.5 text-2xl font-bold ${accent}`}>{value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="mx-card-3d p-5 rounded-2xl space-y-3">
            <h2 className="mx-heading-3d text-sm font-bold">Node Capacity</h2>
            {nodes.length === 0 ? (
              <div className="text-xs text-[#777777] dark:text-zinc-400">No nodes returned from Application API.</div>
            ) : (
              nodes.map((n) => {
                const memPct = n.memoryTotal > 0 ? Math.round((n.memoryAllocated / n.memoryTotal) * 100) : 0;
                return (
                  <div key={n.id} className="mx-well-3d p-3 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{n.name} ({n.fqdn})</span>
                      <span className={n.status === 'online' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}>
                        {n.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-400">
                      <span>RAM {formatMb(n.memoryAllocated)} / {formatMb(n.memoryTotal)}</span>
                      <span className="font-display font-bold">{memPct}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="mx-heading-3d text-sm font-bold">Users</h2>
            <span className="text-[11px] text-[#777777] dark:text-zinc-400">{users.length} total</span>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await panelApi.createAdminUser(newUserForm);
                setNewUserForm({ username: '', email: '', firstName: '', lastName: '', role: 'user' });
                loadAdmin();
                notify('User created', undefined, 'success');
              } catch (err: any) {
                notify('User creation failed', err.message, 'error');
              }
            }}
            className="mx-card-3d p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-5 gap-3"
          >
            <input
              type="text"
              placeholder="Username"
              required
              value={newUserForm.username}
              onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
              className="mx-input-3d px-3 py-2 text-xs rounded-xl"
            />
            <input
              type="email"
              placeholder="Email"
              required
              value={newUserForm.email}
              onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
              className="mx-input-3d px-3 py-2 text-xs rounded-xl"
            />
            <input
              type="text"
              placeholder="First Name"
              value={newUserForm.firstName}
              onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
              className="mx-input-3d px-3 py-2 text-xs rounded-xl"
            />
            <select
              value={newUserForm.role}
              onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
              className="mx-input-3d px-3 py-2 text-xs rounded-xl"
            >
              <option value="user">Standard User</option>
              <option value="admin">Administrator</option>
            </select>
            <button type="submit" className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
              Add User
            </button>
          </form>

          <div className="mx-card-3d rounded-2xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] text-[#777777] dark:text-zinc-400">
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">2FA</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-xs text-[#777777] dark:text-zinc-400">
                      No users returned from Application API.
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-4 font-medium">{u.username}</td>
                    <td className="py-3 px-3 text-[#777777] dark:text-zinc-400">{u.email}</td>
                    <td className="py-3 px-3 capitalize">{u.role}</td>
                    <td className="py-3 px-3">{u.twoFactorEnabled ? 'Enabled' : 'Disabled'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await panelApi.deleteAdminUser(u.id);
                            loadAdmin();
                          } catch (err: any) {
                            notify('Delete failed', err.message, 'error');
                          }
                        }}
                        aria-label={`Delete user ${u.username}`}
                        className="mx-btn-3d p-1.5 rounded-lg text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'servers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="mx-heading-3d text-sm font-bold">Servers</h2>
            <span className="text-[11px] text-[#777777] dark:text-zinc-400">{servers.length} total</span>
          </div>
          <div className="mx-card-3d rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] text-[#777777] dark:text-zinc-400">
                <th className="py-3 px-4">Server</th>
                <th className="py-3 px-3">Identifier</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Limits</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {servers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 px-4 text-center text-xs text-[#777777] dark:text-zinc-400">
                    No servers returned from Application API.
                  </td>
                </tr>
              )}
              {servers.map((s) => (
                <tr key={s.id}>
                  <td className="py-3 px-4 font-medium">{s.name}</td>
                  <td className="py-3 px-3 font-mono text-[11px] text-[#777777] dark:text-zinc-400">{s.identifier}</td>
                  <td className="py-3 px-3"><StatusText status={s.status} /></td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {formatMb(s.limits.memory)} · {s.limits.cpu}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await panelApi.deleteAdminServer(s.id);
                          await Promise.all([loadAdmin(), refreshData()]);
                          notify('Server deleted', s.name, 'success');
                        } catch (err: any) {
                          notify('Delete failed', err.message, 'error');
                        }
                      }}
                      aria-label={`Delete server ${s.name}`}
                      className="mx-btn-3d p-1.5 rounded-lg text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === 'nodes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="mx-heading-3d text-sm font-bold">Nodes</h2>
            <span className="text-[11px] text-[#777777] dark:text-zinc-400">{nodes.length} total</span>
          </div>
          {nodes.length === 0 && (
            <div className="mx-card-3d p-8 rounded-2xl text-center text-xs text-[#777777] dark:text-zinc-400">
              No nodes returned from Application API.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((n) => (
            <div key={n.id} className="mx-card-3d p-5 rounded-2xl space-y-3 text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{n.name}</div>
                  <div className="font-mono text-[11px] text-[#777777] dark:text-zinc-400">{n.fqdn}</div>
                </div>
                <span className={n.maintenanceMode ? 'text-amber-500 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                  {n.maintenanceMode ? 'Maintenance' : 'Online'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-[#777777] dark:text-zinc-400">
                <div>RAM: {formatMb(n.memoryAllocated)} / {formatMb(n.memoryTotal)}</div>
                <div>Disk: {formatMb(n.diskTotal)}</div>
                <div>Daemon: :{n.daemonListen}</div>
                <div>SFTP: :{n.daemonSftp}</div>
              </div>
              <div className="mx-well-3d h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                  style={{ width: `${n.memoryTotal > 0 ? Math.min(100, Math.round((n.memoryAllocated / n.memoryTotal) * 100)) : 0}%` }}
                />
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {tab === 'locations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="mx-heading-3d text-sm font-bold">Locations</h2>
            <span className="text-[11px] text-[#777777] dark:text-zinc-400">{locations.length} total</span>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await panelApi.createAdminLocation(newLocForm);
                setNewLocForm({ shortCode: '', description: '' });
                loadAdmin();
                notify('Location created', undefined, 'success');
              } catch (err: any) {
                notify('Failed to create location', err.message, 'error');
              }
            }}
            className="mx-card-3d p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <input
              type="text"
              placeholder="Short code (e.g. eu-fra)"
              required
              value={newLocForm.shortCode}
              onChange={(e) => setNewLocForm({ ...newLocForm, shortCode: e.target.value })}
              className="mx-input-3d px-3 py-2 text-xs font-mono rounded-xl"
            />
            <input
              type="text"
              placeholder="Datacenter description"
              required
              value={newLocForm.description}
              onChange={(e) => setNewLocForm({ ...newLocForm, description: e.target.value })}
              className="mx-input-3d px-3 py-2 text-xs rounded-xl"
            />
            <button type="submit" className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
              Add Location
            </button>
          </form>
          {locations.length === 0 && (
            <div className="mx-card-3d p-8 rounded-2xl text-center text-xs text-[#777777] dark:text-zinc-400">
              No locations returned from Application API.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {locations.map((l) => (
              <div key={l.id} className="mx-card-3d p-5 rounded-2xl">
                <div className="font-mono text-sm font-semibold text-[#8B5CF6] dark:text-violet-400">{l.shortCode}</div>
                <div className="text-xs text-[#777777] dark:text-zinc-400 mt-1">{l.description}</div>
                <div className="mt-3 text-[11px] font-mono text-[#777777] dark:text-zinc-400">
                  {l.nodesCount} {l.nodesCount === 1 ? 'node' : 'nodes'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
