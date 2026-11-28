import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Crown,
  Gamepad2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Skull,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Wifi,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { StatusText } from '../components/ui/StatusText';
import { usePanel } from '../context/PanelContext';
import { formatRelativeTime } from '../utils/format';

interface OpEntry {
  uuid: string;
  name: string;
  level?: number;
  bypassesPlayerLimit?: boolean;
}

interface WhitelistEntry {
  uuid: string;
  name: string;
}

interface BannedPlayerEntry {
  uuid?: string;
  name: string;
  created?: string;
  source?: string;
  expires?: string;
  reason?: string;
}

interface BannedIpEntry {
  ip: string;
  created?: string;
  source?: string;
  expires?: string;
  reason?: string;
}

interface UserCacheEntry {
  name: string;
  uuid: string;
  expiresOn?: string;
}

type PlayersTab = 'online' | 'ops' | 'whitelist' | 'banned' | 'known';

export function PlayersManagerPage({ serverId }: { serverId: string }) {
  const { servers, notify, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [tab, setTab] = useState<PlayersTab>('online');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Live online players via Wings console `list`
  const [onlinePlayers, setOnlinePlayers] = useState<string[]>([]);
  const [maxPlayers, setMaxPlayers] = useState<number>(20);
  const [queryingOnline, setQueryingOnline] = useState(false);

  // File-backed player lists
  const [ops, setOps] = useState<OpEntry[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [bannedPlayers, setBannedPlayers] = useState<BannedPlayerEntry[]>([]);
  const [bannedIps, setBannedIps] = useState<BannedIpEntry[]>([]);
  const [knownPlayers, setKnownPlayers] = useState<UserCacheEntry[]>([]);
  const [whitelistEnabled, setWhitelistEnabled] = useState<boolean | null>(null);

  // Quick action form
  const [actionPlayer, setActionPlayer] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [selectedGamemode, setSelectedGamemode] = useState('survival');
  const [busyCmd, setBusyCmd] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const loadJsonFile = useCallback(
    async <T,>(path: string): Promise<T[]> => {
      if (!server) return [];
      try {
        const text = await panelApi.getFileContents(server.id, path);
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    [server]
  );

  const loadPlayerData = useCallback(async () => {
    if (!server || !panelConnected) return;
    setLoading(true);
    try {
      const [opsData, wlData, banData, banIpData, cacheData, propsText] = await Promise.all([
        loadJsonFile<OpEntry>('/ops.json'),
        loadJsonFile<WhitelistEntry>('/whitelist.json'),
        loadJsonFile<BannedPlayerEntry>('/banned-players.json'),
        loadJsonFile<BannedIpEntry>('/banned-ips.json'),
        loadJsonFile<UserCacheEntry>('/usercache.json'),
        panelApi.getFileContents(server.id, '/server.properties').catch(() => ''),
      ]);

      setOps(opsData);
      setWhitelist(wlData);
      setBannedPlayers(banData);
      setBannedIps(banIpData);
      setKnownPlayers(cacheData);

      if (propsText) {
        const wlMatch = propsText.match(/^white-list\s*=\s*(true|false)/m);
        if (wlMatch) setWhitelistEnabled(wlMatch[1] === 'true');
        const maxMatch = propsText.match(/^max-players\s*=\s*(\d+)/m);
        if (maxMatch) setMaxPlayers(Number(maxMatch[1]) || 20);
      }
    } finally {
      setLoading(false);
    }
  }, [server, panelConnected, loadJsonFile]);

  const queryLivePlayers = useCallback(async () => {
    if (!server || !panelConnected || server.status !== 'running') {
      setOnlinePlayers([]);
      return;
    }
    setQueryingOnline(true);
    try {
      const { token, socket } = await panelApi.getWebsocketAuth(server.id);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
      const ws = new WebSocket(socket);
      wsRef.current = ws;

      const timeout = setTimeout(() => {
        setQueryingOnline(false);
        try {
          ws.close();
        } catch {
          // ignore
        }
      }, 4500);

      ws.onopen = () => {
        ws.send(JSON.stringify({ event: 'auth', args: [token] }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.event === 'auth success') {
            ws.send(JSON.stringify({ event: 'send command', args: ['list'] }));
          } else if (msg.event === 'console output' && Array.isArray(msg.args)) {
            const raw = String(msg.args.join(' ')).replace(/\x1B\[[0-9;]*m/g, '');
            const match = raw.match(/There are (\d+) of a max(?:imum)? of (\d+) players online:(.*)/i);
            if (match) {
              const max = Number(match[2]) || 20;
              const listStr = (match[3] || '').trim();
              const names = listStr
                ? listStr
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [];
              setMaxPlayers(max);
              setOnlinePlayers(names);
              clearTimeout(timeout);
              setQueryingOnline(false);
              ws.close();
            }
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        setQueryingOnline(false);
      };
    } catch {
      setQueryingOnline(false);
    }
  }, [server, panelConnected]);

  useEffect(() => {
    loadPlayerData();
    queryLivePlayers();
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [loadPlayerData, queryLivePlayers]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  const runCommand = async (cmd: string, successLabel: string) => {
    if (server.status !== 'running') {
      notify('Server is offline', 'Start the server to execute live player console commands.', 'error');
      return;
    }
    setBusyCmd(true);
    try {
      await panelApi.sendConsoleCommand(server.id, cmd);
      notify(successLabel, cmd, 'success');
      setTimeout(() => {
        loadPlayerData();
        queryLivePlayers();
      }, 900);
    } catch (err: any) {
      notify('Command failed', err.message, 'error');
    } finally {
      setBusyCmd(false);
    }
  };

  const handleToggleWhitelist = async () => {
    const next = !whitelistEnabled;
    if (server.status === 'running') {
      await runCommand(`whitelist ${next ? 'on' : 'off'}`, `Whitelist ${next ? 'enabled' : 'disabled'}`);
      setWhitelistEnabled(next);
    } else {
      try {
        const raw = await panelApi.getFileContents(server.id, '/server.properties');
        const updated = /^white-list\s*=/m.test(raw)
          ? raw.replace(/^white-list\s*=.*$/m, `white-list=${next}`)
          : `${raw.trimEnd()}\nwhite-list=${next}\n`;
        await panelApi.writeFile(server.id, '/server.properties', updated);
        setWhitelistEnabled(next);
        notify(`Whitelist ${next ? 'enabled' : 'disabled'} in server.properties`, undefined, 'success');
      } catch (err: any) {
        notify('Could not update server.properties', err.message, 'error');
      }
    }
  };

  const handleQuickAction = async (
    kind: 'kick' | 'ban' | 'pardon' | 'op' | 'deop' | 'wl-add' | 'wl-remove' | 'gm' | 'msg' | 'kill',
    targetName?: string
  ) => {
    const player = (targetName || actionPlayer).trim();
    if (!player) {
      notify('Enter a player username first', undefined, 'error');
      return;
    }
    const reason = actionReason.trim();
    switch (kind) {
      case 'kick':
        await runCommand(`kick ${player}${reason ? ` ${reason}` : ''}`, `Kicked ${player}`);
        break;
      case 'ban':
        await runCommand(`ban ${player}${reason ? ` ${reason}` : ''}`, `Banned ${player}`);
        break;
      case 'pardon':
        await runCommand(`pardon ${player}`, `Unbanned ${player}`);
        break;
      case 'op':
        await runCommand(`op ${player}`, `Granted Operator to ${player}`);
        break;
      case 'deop':
        await runCommand(`deop ${player}`, `Removed Operator from ${player}`);
        break;
      case 'wl-add':
        await runCommand(`whitelist add ${player}`, `Whitelisted ${player}`);
        break;
      case 'wl-remove':
        await runCommand(`whitelist remove ${player}`, `Removed ${player} from whitelist`);
        break;
      case 'gm':
        await runCommand(`gamemode ${selectedGamemode} ${player}`, `Updated gamemode for ${player}`);
        break;
      case 'msg':
        if (!reason) {
          notify('Type a message in the reason/message box first', undefined, 'error');
          return;
        }
        await runCommand(`msg ${player} ${reason}`, `Sent message to ${player}`);
        break;
      case 'kill':
        await runCommand(`kill ${player}`, `Executed /kill on ${player}`);
        break;
    }
  };

  const q = search.trim().toLowerCase();
  const filteredOnline = onlinePlayers.filter((n) => !q || n.toLowerCase().includes(q));
  const filteredOps = ops.filter((o) => !q || o.name.toLowerCase().includes(q));
  const filteredWhitelist = whitelist.filter((w) => !q || w.name.toLowerCase().includes(q));
  const filteredBanned = bannedPlayers.filter((b) => !q || b.name.toLowerCase().includes(q));
  const filteredBannedIps = bannedIps.filter((b) => !q || b.ip.toLowerCase().includes(q));
  const filteredKnown = knownPlayers.filter((k) => !q || k.name.toLowerCase().includes(q));

  const renderAvatar = (name: string) => (
    <img
      src={`https://mc-heads.net/avatar/${encodeURIComponent(name)}/48`}
      alt={name}
      className="w-8 h-8 rounded-lg bg-black/20 object-cover shrink-0"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mx-well-3d w-11 h-11 rounded-2xl flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
                Players Manager
              </h1>
              <StatusText status={server.status} />
            </div>
            <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
              {server.name} · Manage live online players, Operators, Whitelist, Bans &amp; player commands
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {whitelistEnabled !== null && (
            <button
              type="button"
              onClick={handleToggleWhitelist}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                whitelistEnabled ? 'mx-btn-3d-primary' : 'mx-btn-3d'
              }`}
            >
              Whitelist: {whitelistEnabled ? 'ON' : 'OFF'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              loadPlayerData();
              queryLivePlayers();
            }}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || queryingOnline ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="text-[11px] text-[#777777] dark:text-zinc-400">Online Now</div>
          <div className="text-xl font-bold font-display text-emerald-500 mt-1 tabular-nums">
            {onlinePlayers.length} / {maxPlayers}
          </div>
        </div>
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="text-[11px] text-[#777777] dark:text-zinc-400">Operators</div>
          <div className="text-xl font-bold font-display text-[#8B5CF6] mt-1 tabular-nums">
            {ops.length}
          </div>
        </div>
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="text-[11px] text-[#777777] dark:text-zinc-400">Whitelisted</div>
          <div className="text-xl font-bold font-display text-[#06B6D4] mt-1 tabular-nums">
            {whitelist.length}
          </div>
        </div>
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="text-[11px] text-[#777777] dark:text-zinc-400">Banned Players</div>
          <div className="text-xl font-bold font-display text-rose-500 mt-1 tabular-nums">
            {bannedPlayers.length}
          </div>
        </div>
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="text-[11px] text-[#777777] dark:text-zinc-400">Known Players</div>
          <div className="text-xl font-bold font-display mt-1 tabular-nums">
            {knownPlayers.length}
          </div>
        </div>
      </div>

      {/* Quick Player Command Bar */}
      <div className="mx-card-3d p-4 sm:p-5 rounded-2xl space-y-3">
        <div className="text-xs font-bold text-[#171717] dark:text-white">
          Quick Player Actions
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <input
            type="text"
            value={actionPlayer}
            onChange={(e) => setActionPlayer(e.target.value)}
            placeholder="Player username (e.g. Notch)"
            className="mx-input-3d px-3 py-2 text-xs rounded-xl"
          />
          <input
            type="text"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder="Reason or whisper message (optional)"
            className="mx-input-3d px-3 py-2 text-xs rounded-xl"
          />
          <div className="flex items-center gap-2">
            <select
              value={selectedGamemode}
              onChange={(e) => setSelectedGamemode(e.target.value)}
              className="mx-input-3d flex-1 px-3 py-2 text-xs rounded-xl cursor-pointer"
            >
              <option value="survival">Survival</option>
              <option value="creative">Creative</option>
              <option value="adventure">Adventure</option>
              <option value="spectator">Spectator</option>
            </select>
            <button
              type="button"
              disabled={busyCmd}
              onClick={() => handleQuickAction('gm')}
              className="mx-btn-3d inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-[#8B5CF6]" />
              Set GM
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busyCmd}
            onClick={() => handleQuickAction('op')}
            className="mx-btn-3d inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            Op
          </button>
          <button
            type="button"
            disabled={busyCmd}
            onClick={() => handleQuickAction('deop')}
            className="mx-btn-3d inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            <UserMinus className="w-3.5 h-3.5" />
            Deop
          </button>
          <button
            type="button"
            disabled={busyCmd}
            onClick={() => handleQuickAction('wl-add')}
            className="mx-btn-3d inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-500" />
            Whitelist Add
          </button>
          <button
            type="button"
            disabled={busyCmd}
            onClick={() => handleQuickAction('wl-remove')}
            className="mx-btn-3d inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            Whitelist Remove
          </button>
          <button
            type="button"
            disabled={busyCmd}
            onClick={() => handleQuickAction('msg')}
            className="mx-btn-3d inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#06B6D4]" />
            Whisper
          </button>
          <button
            type="button"
            disabled={busyCmd}
            onClick={() => handleQuickAction('kick')}
            className="mx-btn-3d inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-amber-600 dark:text-amber-400 cursor-pointer disabled:opacity-50"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Kick
          </button>
          <button
            type="button"
            disabled={busyCmd}
            onClick={() => handleQuickAction('ban')}
            className="mx-btn-3d-danger inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            <Ban className="w-3.5 h-3.5" />
            Ban
          </button>
          <button
            type="button"
            disabled={busyCmd}
            onClick={() => handleQuickAction('pardon')}
            className="mx-btn-3d-success inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Unban
          </button>
          <button
            type="button"
            disabled={busyCmd}
            onClick={() => handleQuickAction('kill')}
            className="mx-btn-3d inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-rose-500 cursor-pointer disabled:opacity-50"
          >
            <Skull className="w-3.5 h-3.5" />
            Kill
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="mx-well-3d inline-flex items-center gap-1.5 p-1.5 rounded-2xl overflow-x-auto max-w-full">
          {(
            [
              { id: 'online', label: `Online (${onlinePlayers.length})`, icon: Wifi },
              { id: 'ops', label: `Operators (${ops.length})`, icon: Crown },
              { id: 'whitelist', label: `Whitelist (${whitelist.length})`, icon: ShieldCheck },
              { id: 'banned', label: `Banned (${bannedPlayers.length + bannedIps.length})`, icon: Ban },
              { id: 'known', label: `Known (${knownPlayers.length})`, icon: UserCheck },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === t.id ? 'mx-btn-3d-primary' : 'text-[#525252] dark:text-zinc-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player or IP..."
            className="mx-input-3d w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
          />
        </div>
      </div>

      {/* TAB CONTENT */}
      {tab === 'online' && (
        <div className="mx-card-3d p-5 rounded-2xl space-y-3">
          {server.status !== 'running' ? (
            <div className="py-8 text-center text-xs text-[#777777]">
              Server is offline. Start the server to see live online players, or browse Operators, Whitelist, Banned, and Known Players tabs.
            </div>
          ) : queryingOnline && onlinePlayers.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#777777]">
              Querying live player list from console...
            </div>
          ) : filteredOnline.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#777777]">
              No players currently online.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredOnline.map((name) => {
                const isOp = ops.some((o) => o.name.toLowerCase() === name.toLowerCase());
                return (
                  <div
                    key={name}
                    className="mx-well-3d p-3.5 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {renderAvatar(name)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">{name}</span>
                          {isOp && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-emerald-500 font-semibold">Online</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActionPlayer(name)}
                        className="mx-btn-3d px-2 py-1 rounded-lg text-[11px] cursor-pointer"
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAction('kick', name)}
                        className="mx-btn-3d px-2 py-1 rounded-lg text-[11px] text-amber-500 cursor-pointer"
                      >
                        Kick
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAction('ban', name)}
                        className="mx-btn-3d-danger px-2 py-1 rounded-lg text-[11px] cursor-pointer"
                      >
                        Ban
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'ops' && (
        <div className="mx-card-3d p-5 rounded-2xl space-y-3">
          {filteredOps.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#777777]">No operators listed in /ops.json.</div>
          ) : (
            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {filteredOps.map((op) => (
                <div key={op.uuid || op.name} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {renderAvatar(op.name)}
                    <div className="min-w-0">
                      <div className="text-xs font-bold">{op.name}</div>
                      <div className="text-[11px] font-mono text-[#777777] truncate">
                        Level {op.level ?? 4} · {op.uuid}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickAction('deop', op.name)}
                    className="mx-btn-3d-danger px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    Deop
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'whitelist' && (
        <div className="mx-card-3d p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-xs font-semibold">Whitelisted Accounts (/whitelist.json)</span>
            <button
              type="button"
              onClick={() => handleQuickAction('wl-add')}
              className="mx-btn-3d-primary inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Player Above
            </button>
          </div>
          {filteredWhitelist.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#777777]">Whitelist is empty.</div>
          ) : (
            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {filteredWhitelist.map((wl) => (
                <div key={wl.uuid || wl.name} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {renderAvatar(wl.name)}
                    <div className="min-w-0">
                      <div className="text-xs font-bold">{wl.name}</div>
                      <div className="text-[11px] font-mono text-[#777777] truncate">{wl.uuid}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickAction('wl-remove', wl.name)}
                    className="mx-btn-3d-danger px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'banned' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="mx-card-3d p-5 rounded-2xl space-y-3">
            <h2 className="text-xs font-bold">Banned Players (/banned-players.json)</h2>
            {filteredBanned.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#777777]">No banned players.</div>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {filteredBanned.map((b) => (
                  <div key={b.uuid || b.name} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold">{b.name}</div>
                      <div className="text-[11px] text-[#777777] truncate">
                        Reason: {b.reason || 'Banned by operator'} · By {b.source || 'Console'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickAction('pardon', b.name)}
                      className="mx-btn-3d-success px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                    >
                      Unban
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mx-card-3d p-5 rounded-2xl space-y-3">
            <h2 className="text-xs font-bold">Banned IPs (/banned-ips.json)</h2>
            {filteredBannedIps.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#777777]">No banned IPs.</div>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {filteredBannedIps.map((b) => (
                  <div key={b.ip} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-bold">{b.ip}</div>
                      <div className="text-[11px] text-[#777777] truncate">
                        Reason: {b.reason || 'Banned by operator'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => runCommand(`pardon-ip ${b.ip}`, `Unbanned IP ${b.ip}`)}
                      className="mx-btn-3d-success px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                    >
                      Pardon IP
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'known' && (
        <div className="mx-card-3d p-5 rounded-2xl space-y-3">
          {filteredKnown.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#777777]">No cached player entries in /usercache.json.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredKnown.slice(0, 60).map((kp) => (
                <div
                  key={kp.uuid || kp.name}
                  className="mx-well-3d p-3.5 rounded-xl flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {renderAvatar(kp.name)}
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{kp.name}</div>
                      <div className="text-[10px] font-mono text-[#777777] truncate">
                        {kp.expiresOn ? `Seen ${formatRelativeTime(kp.expiresOn)}` : kp.uuid}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActionPlayer(kp.name);
                        notify(`Selected ${kp.name}`, 'Use Quick Player Actions above.', 'info');
                      }}
                      className="mx-btn-3d px-2 py-1 rounded-lg text-[11px] cursor-pointer"
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAction('op', kp.name)}
                      className="mx-btn-3d px-2 py-1 rounded-lg text-[11px] cursor-pointer"
                    >
                      Op
                    </button>
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
