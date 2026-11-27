import { useMemo, useState } from 'react';
import {
  FolderOpen,
  LayoutGrid,
  List,
  Play,
  RotateCw,
  Search,
  Square,
  Star,
  TerminalSquare,
} from 'lucide-react';
import { usePanel } from '../context/PanelContext';
import type { ServerCategory, ServerStatus } from '../types/panel';
import { formatBytes, formatMb, formatUptime } from '../utils/format';
import { ServerCategoryIcon } from '../components/ui/ServerIcon';
import { StatusText } from '../components/ui/StatusText';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';

type SortKey = 'name' | 'cpu' | 'memory' | 'uptime';

export function ServersPage() {
  const { servers, navigate, sendPower, toggleFavorite, panelConnected, connectionError } = usePanel();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ServerStatus | 'favorites'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ServerCategory>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers
      .filter((s) => {
        if (statusFilter === 'favorites' && !s.isFavorite) return false;
        if (statusFilter !== 'all' && statusFilter !== 'favorites' && s.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
        if (q) {
          return (
            s.name.toLowerCase().includes(q) ||
            s.identifier.toLowerCase().includes(q) ||
            s.node.toLowerCase().includes(q) ||
            s.egg.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        if (sortBy === 'cpu') return b.resources.cpuPercent - a.resources.cpuPercent;
        if (sortBy === 'memory') return b.resources.memoryBytes - a.resources.memoryBytes;
        if (sortBy === 'uptime') return b.resources.uptimeMs - a.resources.uptimeMs;
        return a.name.localeCompare(b.name);
      });
  }, [servers, search, statusFilter, categoryFilter, sortBy]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
            Servers
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            Monitor live container allocations, power states, and network endpoints
          </p>
        </div>

        <div className="mx-well-3d inline-flex items-center p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'grid' ? 'mx-btn-3d' : 'text-[#777777] dark:text-zinc-400'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="List view"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'list' ? 'mx-btn-3d' : 'text-[#777777] dark:text-zinc-400'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="mx-card-3d flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, node..."
              className="mx-input-3d w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
            />
          </div>

          <div className="mx-well-3d flex items-center gap-1 p-1 rounded-xl">
            {(['all', 'running', 'offline', 'favorites'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg capitalize transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st
                    ? 'mx-btn-3d'
                    : 'text-[#777777] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-zinc-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="mx-input-3d text-xs px-3 py-1.5 rounded-xl cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="Game Servers">Game Servers</option>
            <option value="Applications">Applications</option>
            <option value="Proxies">Proxies</option>
            <option value="Databases">Databases</option>
          </select>

          <select
            aria-label="Sort servers"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="mx-input-3d text-xs px-3 py-1.5 rounded-xl cursor-pointer"
          >
            <option value="name">Sort: Name</option>
            <option value="cpu">Sort: CPU Usage</option>
            <option value="memory">Sort: Memory Usage</option>
            <option value="uptime">Sort: Uptime</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mx-card-3d p-12 rounded-2xl text-center">
          <p className="text-sm font-medium text-[#171717] dark:text-white">No servers found</p>
          <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">
            {servers.length === 0
              ? 'No servers are currently assigned to this account.'
              : 'Adjust your search query or reset category filters.'}
          </p>
          {servers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setCategoryFilter('all');
              }}
              className="mx-btn-3d-primary mt-4 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((srv) => {
            const memPct = srv.limits.memory > 0 ? Math.min(100, (srv.resources.memoryBytes / (srv.limits.memory * 1024 * 1024)) * 100) : 0;
            const diskPct = srv.limits.disk > 0 ? Math.min(100, (srv.resources.diskBytes / (srv.limits.disk * 1024 * 1024)) * 100) : 0;

            return (
              <div
                key={srv.id}
                className="mx-card-3d mx-card-3d-interactive group p-5 rounded-2xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => navigate({ page: 'server-console', serverId: srv.id })}
                      className="flex items-center gap-3 min-w-0 cursor-pointer"
                    >
                      <div className="mx-well-3d w-10 h-10 rounded-xl flex items-center justify-center text-[#171717] dark:text-zinc-200 shrink-0 group-hover:text-[#8B5CF6] transition-colors">
                        <ServerCategoryIcon category={srv.category} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white truncate">
                          {srv.name}
                        </h3>
                        <div className="text-[11px] font-medium text-[#777777] dark:text-zinc-400 truncate">
                          {srv.identifier} · {srv.node}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(srv.id)}
                        aria-label="Toggle favorite"
                        className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            srv.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-[#777777] dark:text-zinc-500'
                          }`}
                        />
                      </button>
                      <StatusText status={srv.status} />
                    </div>
                  </div>

                  {srv.description && (
                    <p className="mt-3 text-xs text-[#777777] dark:text-zinc-400 line-clamp-2">
                      {srv.description}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                    <div className="mx-well-3d p-2.5 rounded-xl">
                      <div className="mx-label-3d text-[11px] font-medium text-[#777777] dark:text-zinc-400">CPU</div>
                      <div className="text-sm font-bold mx-stat-3d-violet mt-0.5">
                        {srv.resources.cpuPercent.toFixed(1)}%
                      </div>
                    </div>
                    <div className="mx-well-3d p-2.5 rounded-xl">
                      <div className="mx-label-3d text-[11px] font-medium text-[#777777] dark:text-zinc-400">Memory ({memPct.toFixed(0)}%)</div>
                      <div className="text-sm font-bold mx-stat-3d-cyan mt-0.5">
                        {formatBytes(srv.resources.memoryBytes)}
                      </div>
                    </div>
                    <div className="mx-well-3d p-2.5 rounded-xl">
                      <div className="mx-label-3d text-[11px] font-medium text-[#777777] dark:text-zinc-400">Disk ({diskPct.toFixed(0)}%)</div>
                      <div className="text-sm font-bold mx-stat-3d text-[#171717] dark:text-zinc-100 mt-0.5">
                        {formatBytes(srv.resources.diskBytes)}
                      </div>
                    </div>
                    <div className="mx-well-3d p-2.5 rounded-xl">
                      <div className="mx-label-3d text-[11px] font-medium text-[#777777] dark:text-zinc-400">Network I/O</div>
                      <div className="text-sm font-bold mx-stat-3d text-[#171717] dark:text-zinc-100 mt-0.5">
                        {formatBytes(srv.resources.networkRxBytes + srv.resources.networkTxBytes)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-400 truncate">
                    {srv.allocations[0]?.ip || '—'}:{srv.allocations[0]?.port || '—'} · {formatUptime(srv.resources.uptimeMs)}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {srv.status === 'offline' ? (
                      <button
                        type="button"
                        title="Start"
                        onClick={() => sendPower(srv.id, 'start')}
                        className="mx-btn-3d-success p-1.5 rounded-lg cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          title="Restart"
                          onClick={() => sendPower(srv.id, 'restart')}
                          className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Stop"
                          onClick={() => sendPower(srv.id, 'stop')}
                          className="mx-btn-3d-danger p-1.5 rounded-lg cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      title="Open Files"
                      onClick={() => navigate({ page: 'server-files', serverId: srv.id })}
                      className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Open Console"
                      onClick={() => navigate({ page: 'server-console', serverId: srv.id })}
                      className="mx-btn-3d-primary p-1.5 rounded-lg cursor-pointer"
                    >
                      <TerminalSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mx-card-3d rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] font-medium text-[#777777] dark:text-zinc-400">
                <th className="py-3 px-4">Server</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Node</th>
                <th className="py-3 px-3 text-right">CPU</th>
                <th className="py-3 px-3 text-right">Memory</th>
                <th className="py-3 px-3 text-right">Disk</th>
                <th className="py-3 px-3 text-right">Uptime</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05] text-xs">
              {filtered.map((srv) => (
                <tr
                  key={srv.id}
                  className="hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors"
                >
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'server-console', serverId: srv.id })}
                      className="flex items-center gap-2.5 text-left cursor-pointer group"
                    >
                      <ServerCategoryIcon category={srv.category} className="w-4 h-4 text-[#777777] group-hover:text-[#8B5CF6]" />
                      <div>
                        <div className="font-semibold text-[#171717] dark:text-white group-hover:text-[#8B5CF6]">
                          {srv.name}
                        </div>
                        <div className="text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-400">
                          {srv.allocations[0]?.ip || '—'}:{srv.allocations[0]?.port || '—'}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="py-3 px-3">
                    <StatusText status={srv.status} />
                  </td>
                  <td className="py-3 px-3 text-[#777777] dark:text-zinc-400">{srv.node}</td>
                  <td className="py-3 px-3 text-right font-display font-semibold tabular-nums">{srv.resources.cpuPercent.toFixed(1)}%</td>
                  <td className="py-3 px-3 text-right font-display font-semibold tabular-nums">
                    {formatBytes(srv.resources.memoryBytes)} / {formatMb(srv.limits.memory)}
                  </td>
                  <td className="py-3 px-3 text-right font-display font-semibold tabular-nums">{formatBytes(srv.resources.diskBytes)}</td>
                  <td className="py-3 px-3 text-right font-medium tabular-nums text-[#777777] dark:text-zinc-400">
                    {formatUptime(srv.resources.uptimeMs)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(srv.id)}
                        className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
                      >
                        <Star className={`w-3.5 h-3.5 ${srv.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-[#777777]'}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate({ page: 'server-console', serverId: srv.id })}
                        className="mx-btn-3d-primary px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer"
                      >
                        Console
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
