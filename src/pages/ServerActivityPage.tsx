import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Search } from 'lucide-react';
import { panelApi } from '../api/client';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { usePanel } from '../context/PanelContext';
import type { ActivityLogEntry } from '../types/panel';
import { formatDate, formatRelativeTime } from '../utils/format';

export function ServerActivityPage({ serverId }: { serverId: string }) {
  const { servers, notify, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const loadActivity = useCallback(async () => {
    if (!server || !panelConnected) return;
    setLoading(true);
    try {
      const list = await panelApi.getServerActivity(server.id);
      setLogs(list);
    } catch (err: any) {
      notify('Failed to load server activity', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [server?.id, panelConnected, notify]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.event.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q) ||
        l.ip.toLowerCase().includes(q)
    );
  }, [logs, query]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
            Server Activity Log
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            {server.name} · Audit trail of user actions, power transitions, file edits, and settings updates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter event, actor, or IP..."
              className="mx-input-3d pl-8 pr-3 py-2 text-xs rounded-xl w-52 sm:w-64"
            />
          </div>
          <button
            type="button"
            onClick={loadActivity}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <div className="mx-card-3d p-8 rounded-2xl text-center text-xs text-[#777777]">Loading audit logs...</div>
      ) : filtered.length === 0 ? (
        <div className="mx-card-3d p-12 rounded-2xl text-center">
          <Activity className="w-8 h-8 text-[#777777] mx-auto mb-2" />
          <p className="text-sm font-medium text-[#171717] dark:text-white">No activity events found</p>
          <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">
            Server activity events recorded by Pterodactyl will appear here.
          </p>
        </div>
      ) : (
        <div className="mx-card-3d rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] font-medium text-[#777777] dark:text-zinc-400">
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-3">Event</th>
                <th className="py-3 px-3">Target</th>
                <th className="py-3 px-3">IP Address</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05] text-xs">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-medium text-[#171717] dark:text-zinc-100">{item.actor}</td>
                  <td className="py-3 px-3">
                    <span className="mx-well-3d px-2 py-0.5 rounded-lg font-mono text-[11px] text-[#8B5CF6]">
                      {item.event}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#525252] dark:text-zinc-300 max-w-[280px] truncate font-mono text-[11px]">
                    {item.target}
                  </td>
                  <td className="py-3 px-3 font-medium tabular-nums text-[#777777] dark:text-zinc-400">
                    {item.ip || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-medium tabular-nums text-[#777777] dark:text-zinc-400">
                    {formatDate(item.timestamp)} · {formatRelativeTime(item.timestamp)}
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
