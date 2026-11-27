import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  ShieldAlert,
  Skull,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { StatusText } from '../components/ui/StatusText';
import { TelemetryChart } from '../components/ui/TelemetryChart';
import { usePanel } from '../context/PanelContext';
import type { ConsoleLine, PowerSignal, ServerResources, ServerStatus, TelemetryPoint } from '../types/panel';
import { AnsiText, stripAllAnsi } from '../utils/ansi';
import { formatBytes, formatMb, formatUptime } from '../utils/format';

const EULA_TRIGGER_REGEX =
  /you need to agree to the eula|go to eula\.txt for more info|failed to load eula\.txt|agree to the eula in order to run/i;

function classifyLine(plain: string, eventName: string): ConsoleLine['level'] {
  if (eventName === 'daemon message') return 'daemon';
  if (eventName === 'daemon error') return 'error';
  if (eventName === 'install output') return 'install';
  if (/\b(error|fatal|exception|critical|panic)\b/i.test(plain)) return 'error';
  if (/\b(warn|warning)\b/i.test(plain)) return 'warn';
  return 'info';
}

export function ServerConsolePage({ serverId }: { serverId: string }) {
  const { servers, sendPower, refreshData, notify, navigate, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [liveStatus, setLiveStatus] = useState<ServerStatus>(server?.status || 'offline');
  const [liveResources, setLiveResources] = useState<ServerResources | null>(server?.resources || null);
  const [logs, setLogs] = useState<ConsoleLine[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [reconnectTick, setReconnectTick] = useState(0);

  const [command, setCommand] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [expanded, setExpanded] = useState(false);
  const [logSearchOpen, setLogSearchOpen] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [networkKbps, setNetworkKbps] = useState(0);
  const [copiedAddr, setCopiedAddr] = useState(false);

  const [eulaDetected, setEulaDetected] = useState(false);
  const [eulaModalOpen, setEulaModalOpen] = useState(false);
  const [eulaDismissed, setEulaDismissed] = useState(false);
  const [acceptingEula, setAcceptingEula] = useState(false);
  const [isInstalling, setIsInstalling] = useState(Boolean(server?.isInstalling));

  const wsRef = useRef<WebSocket | null>(null);
  const lastNetTotalRef = useRef<number>(0);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const eulaDismissedRef = useRef(false);

  useEffect(() => {
    eulaDismissedRef.current = eulaDismissed;
  }, [eulaDismissed]);

  useEffect(() => {
    setIsInstalling(Boolean(server?.isInstalling));
  }, [server?.isInstalling]);

  const appendConsoleLines = useCallback((rawChunk: string, eventName: string) => {
    const parts = rawChunk.split(/\r?\n/);
    const now = new Date().toISOString();
    const newEntries: ConsoleLine[] = [];

    for (const part of parts) {
      const plain = stripAllAnsi(part);
      if (plain.length === 0 && parts.length > 1) continue;

      if (EULA_TRIGGER_REGEX.test(plain)) {
        setEulaDetected(true);
        if (!eulaDismissedRef.current) {
          setEulaModalOpen(true);
        }
      }

      newEntries.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: now,
        level: classifyLine(plain, eventName),
        text: plain,
        rawText: part,
      });
    }

    if (newEntries.length > 0) {
      setLogs((prev) => [...prev.slice(-(1000 - newEntries.length)), ...newEntries]);
    }
  }, []);

  useEffect(() => {
    if (!server || !panelConnected) return;
    let cancelled = false;
    setLiveStatus(server.status);
    setLiveResources(server.resources);
    setLogs([]);
    setTelemetry([]);
    setEulaDetected(false);
    setEulaModalOpen(false);
    setEulaDismissed(false);
    setWsError(null);
    retryCountRef.current = 0;
    lastNetTotalRef.current = server.resources.networkRxBytes + server.resources.networkTxBytes;

    const connectWings = async () => {
      if (cancelled) return;
      try {
        const { token, socket } = await panelApi.getWebsocketAuth(server.id);
        if (cancelled) return;

        const ws = new WebSocket(socket);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsError(null);
          setWsReconnecting(false);
          retryCountRef.current = 0;
          ws.send(JSON.stringify({ event: 'auth', args: [token] }));
        };

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            const eventName: string = msg.event;
            const args: string[] = Array.isArray(msg.args) ? msg.args : [];

            if (eventName === 'auth success') {
              setWsConnected(true);
              setWsReconnecting(false);
              ws.send(JSON.stringify({ event: 'send logs', args: [null] }));
              ws.send(JSON.stringify({ event: 'send stats', args: [null] }));
            } else if (eventName === 'token expiring' || eventName === 'token expired') {
              panelApi
                .getWebsocketAuth(server.id)
                .then((fresh) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ event: 'auth', args: [fresh.token] }));
                  }
                })
                .catch(() => {});
            } else if (
              eventName === 'console output' ||
              eventName === 'daemon message' ||
              eventName === 'daemon error' ||
              eventName === 'install output' ||
              eventName === 'transfer logs'
            ) {
              const chunk = String(args[0] ?? '');
              appendConsoleLines(chunk, eventName);
              if (eventName === 'daemon error' && chunk.trim()) {
                notify('Daemon error', stripAllAnsi(chunk), 'error');
              }
            } else if (eventName === 'install started') {
              setIsInstalling(true);
              appendConsoleLines('[HelzerX]: Server installation started.', 'daemon message');
            } else if (eventName === 'install completed') {
              setIsInstalling(false);
              appendConsoleLines('[HelzerX]: Server installation completed.', 'daemon message');
              refreshData();
            } else if (eventName === 'backup completed') {
              notify('Backup completed', 'Archive finished on Wings daemon', 'success');
            } else if (eventName === 'status') {
              const nextStatus = args[0] as ServerStatus;
              if (nextStatus) setLiveStatus(nextStatus);
            } else if (eventName === 'stats') {
              const parsed = JSON.parse(args[0] || '{}');
              const netTotal = Number(parsed.network?.rx_bytes || 0) + Number(parsed.network?.tx_bytes || 0);
              const deltaBytes = Math.max(0, netTotal - (lastNetTotalRef.current || netTotal));
              lastNetTotalRef.current = netTotal;
              const kbps = Number((deltaBytes / 1024).toFixed(1));
              setNetworkKbps(kbps);

              const nextRes: ServerResources = {
                cpuPercent: Number(parsed.cpu_absolute || 0),
                memoryBytes: Number(parsed.memory_bytes || 0),
                diskBytes: Number(parsed.disk_bytes || 0),
                networkRxBytes: Number(parsed.network?.rx_bytes || 0),
                networkTxBytes: Number(parsed.network?.tx_bytes || 0),
                uptimeMs: Number(parsed.uptime || 0),
              };
              setLiveResources(nextRes);
              if (parsed.state) setLiveStatus(parsed.state);

              const memPct =
                server.limits.memory > 0 ? (nextRes.memoryBytes / (server.limits.memory * 1024 * 1024)) * 100 : 0;

              setTelemetry((prev) => [
                ...prev.slice(-23),
                {
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  cpu: Number(nextRes.cpuPercent.toFixed(1)),
                  memoryPercent: Number(memPct.toFixed(1)),
                  networkKbps: kbps,
                },
              ]);
            }
          } catch {
            // ignore non-json frames
          }
        };

        ws.onerror = () => {
          setWsError('Wings WebSocket connection interrupted.');
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (!cancelled) {
            setWsReconnecting(true);
            const delay = Math.min(15000, 1500 * Math.pow(1.6, retryCountRef.current));
            retryCountRef.current += 1;
            reconnectTimerRef.current = window.setTimeout(connectWings, delay);
          }
        };
      } catch (err: any) {
        setWsConnected(false);
        setWsError(err.message);
        appendConsoleLines(`[HelzerX]: Unable to establish Wings WebSocket (${err.message}).`, 'daemon error');
        if (!cancelled) {
          setWsReconnecting(true);
          const delay = Math.min(15000, 2500 * Math.pow(1.5, retryCountRef.current));
          retryCountRef.current += 1;
          reconnectTimerRef.current = window.setTimeout(connectWings, delay);
        }
      }
    };

    connectWings();
    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [server?.id, panelConnected, reconnectTick, appendConsoleLines, notify, refreshData]);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const visibleLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => l.text.toLowerCase().includes(q));
  }, [logs, logSearch]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) {
    return (
      <div className="mx-card-3d p-8 rounded-2xl text-center text-sm text-[#777777] dark:text-zinc-400">
        No server found for this identifier.
      </div>
    );
  }

  const dispatchPower = async (signal: PowerSignal) => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'set state', args: [signal] }));
        notify(`Power signal "${signal}" sent`, server.name, 'success');
      } else {
        await sendPower(server.id, signal);
      }
    } catch (err: any) {
      notify('Power action failed', err.message, 'error');
    }
  };

  const handleAcceptEula = async (shouldStart = true) => {
    setAcceptingEula(true);
    try {
      let nextContent = '# Accepted via HelzerX Panel\neula=true\n';
      try {
        const existing = await panelApi.getFileContents(server.id, '/eula.txt');
        if (existing) {
          nextContent = /eula\s*=/i.test(existing)
            ? existing.replace(/eula\s*=\s*false/gi, 'eula=true')
            : `${existing.trimEnd()}\neula=true\n`;
        }
      } catch {
        // eula.txt may not exist yet; create it cleanly
      }

      await panelApi.writeFile(server.id, '/eula.txt', nextContent);
      setEulaModalOpen(false);
      setEulaDetected(false);
      setEulaDismissed(false);
      appendConsoleLines('[HelzerX]: Updated /eula.txt (eula=true).', 'daemon message');
      notify('Minecraft EULA accepted', 'Saved eula=true to /eula.txt', 'success');

      if (shouldStart) {
        await dispatchPower(liveStatus === 'offline' ? 'start' : 'restart');
      }
    } catch (err: any) {
      notify('Could not write /eula.txt', err.message, 'error');
    } finally {
      setAcceptingEula(false);
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = command.trim();
    if (!trimmed) return;
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'send command', args: [trimmed] }));
      } else {
        await panelApi.sendConsoleCommand(server.id, trimmed);
      }
      setLogs((prev) => [
        ...prev.slice(-999),
        {
          id: `${Date.now()}-cmd`,
          timestamp: new Date().toISOString(),
          level: 'cmd',
          text: `> ${trimmed}`,
        },
      ]);
      setCmdHistory((prev) => [trimmed, ...prev.slice(0, 29)]);
      setHistoryIdx(-1);
      setCommand('');
      setAutoScroll(true);
    } catch (err: any) {
      notify('Command failed', err.message, 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const nextIdx = Math.min(cmdHistory.length - 1, historyIdx + 1);
        setHistoryIdx(nextIdx);
        setCommand(cmdHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setCommand(cmdHistory[nextIdx]);
      } else {
        setHistoryIdx(-1);
        setCommand('');
      }
    }
  };

  const handleTerminalScroll = () => {
    const el = terminalRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distanceFromBottom < 36);
  };

  const copyLogs = () => {
    navigator.clipboard?.writeText(logs.map((l) => l.text).join('\n'));
    notify('Console buffer copied', `${logs.length} lines`, 'success');
  };

  const downloadLogs = () => {
    const blob = new Blob([logs.map((l) => l.text).join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${server.identifier}-console.log`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const primaryAlloc = server.allocations.find((a) => a.isDefault) || server.allocations[0];
  const connectionAddr = primaryAlloc
    ? `${primaryAlloc.alias || primaryAlloc.ip}:${primaryAlloc.port}`
    : 'No allocation';

  const copyAddress = () => {
    if (!primaryAlloc) return;
    navigator.clipboard?.writeText(connectionAddr);
    setCopiedAddr(true);
    notify('Server address copied', connectionAddr, 'success');
    setTimeout(() => setCopiedAddr(false), 1800);
  };

  const resources = liveResources || server.resources;
  const cpuPct =
    server.limits.cpu > 0 ? Math.min(100, (resources.cpuPercent / server.limits.cpu) * 100) : Math.min(100, resources.cpuPercent);
  const memPct =
    server.limits.memory > 0 ? Math.min(100, (resources.memoryBytes / (server.limits.memory * 1024 * 1024)) * 100) : 0;
  const diskPct =
    server.limits.disk > 0 ? Math.min(100, (resources.diskBytes / (server.limits.disk * 1024 * 1024)) * 100) : 0;

  const terminalTextClass =
    fontSize === 'sm' ? 'text-[11px] leading-[1.45]' : fontSize === 'lg' ? 'text-[13.5px] leading-[1.6]' : 'text-[12.5px] leading-[1.55]';

  return (
    <div className="space-y-5">
      {/* Server Header & 3D Power Controls */}
      <div className="mx-card-3d p-4 sm:p-5 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white truncate">
              {server.name}
            </h1>
            <StatusText status={liveStatus} />
            <button
              type="button"
              onClick={copyAddress}
              title="Copy server connection address"
              className="mx-well-3d inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold tabular-nums text-[#171717] dark:text-zinc-200 hover:text-[#8B5CF6] cursor-pointer"
            >
              <span>{connectionAddr}</span>
              {copiedAddr ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-[#777777]" />}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#777777] dark:text-zinc-400">
            <span>{server.egg}</span>
            <span aria-hidden="true">·</span>
            <span>Node: {server.node}</span>
            <span aria-hidden="true">·</span>
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                wsConnected
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : wsReconnecting
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  wsConnected ? 'bg-emerald-500' : wsReconnecting ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              {wsConnected ? 'Wings WebSocket Live' : wsReconnecting ? 'Reconnecting to Wings...' : 'Disconnected'}
            </span>
            {!wsConnected && (
              <button
                type="button"
                onClick={() => setReconnectTick((t) => t + 1)}
                className="inline-flex items-center gap-1 text-[#8B5CF6] hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Reconnect
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={liveStatus === 'running' || liveStatus === 'starting' || Boolean(server.isSuspended) || isInstalling}
            onClick={() => dispatchPower('start')}
            className="mx-btn-3d-success inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Start
          </button>
          <button
            type="button"
            disabled={liveStatus === 'offline' || Boolean(server.isSuspended) || isInstalling}
            onClick={() => dispatchPower('restart')}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Restart
          </button>
          <button
            type="button"
            disabled={liveStatus === 'offline' || liveStatus === 'stopping'}
            onClick={() => dispatchPower('stop')}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
          <button
            type="button"
            disabled={liveStatus === 'offline'}
            onClick={() => dispatchPower('kill')}
            className="mx-btn-3d-danger inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Skull className="w-3.5 h-3.5" />
            Kill
          </button>
        </div>
      </div>

      {/* Lifecycle Notices (Suspended / Installing / Transferring) */}
      {(server.isSuspended || isInstalling || server.isTransferring) && (
        <div className="mx-card-3d p-4 rounded-2xl border border-amber-500/35 flex items-center gap-3 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="text-[#171717] dark:text-zinc-100">
            {server.isSuspended
              ? 'This server is currently suspended. Contact your administrator to unsuspend it before starting.'
              : isInstalling
                ? 'This server is currently running its installation script. Live installer output will stream in the console below.'
                : 'This server is currently transferring to another node.'}
          </div>
        </div>
      )}

      {/* EULA Quick Banner (when detected and modal minimized) */}
      {eulaDetected && !eulaModalOpen && (
        <div className="mx-card-3d p-4 rounded-2xl border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-[#171717] dark:text-white">
                Minecraft EULA Acceptance Required
              </div>
              <p className="text-xs text-[#777777] dark:text-zinc-400 mt-0.5">
                Your server stopped because <span className="font-mono">/eula.txt</span> is not accepted yet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={acceptingEula}
              onClick={() => handleAcceptEula(true)}
              className="mx-btn-3d-success inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {acceptingEula ? 'Applying...' : 'Accept EULA & Start'}
            </button>
          </div>
        </div>
      )}

      {/* EULA Modal Dialog */}
      {eulaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="mx-card-3d max-w-md w-full p-6 rounded-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                    Accept Minecraft EULA
                  </h2>
                  <p className="text-[11px] text-[#777777] dark:text-zinc-400">
                    Required to start {server.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEulaModalOpen(false);
                  setEulaDismissed(true);
                }}
                className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[#525252] dark:text-zinc-300 leading-relaxed">
              By pressing <strong>I Accept</strong> below, you indicate your agreement to the{' '}
              <a
                href="https://www.minecraft.net/en-us/eula"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#8B5CF6] hover:underline inline-flex items-center gap-1"
              >
                Minecraft EULA
                <ExternalLink className="w-3 h-3" />
              </a>
              . HelzerX will automatically update <span className="font-mono">/eula.txt</span> to{' '}
              <span className="font-mono">eula=true</span> and start your server.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={acceptingEula}
                onClick={() => {
                  setEulaModalOpen(false);
                  setEulaDismissed(true);
                }}
                className="mx-btn-3d px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={acceptingEula}
                onClick={() => handleAcceptEula(true)}
                className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 cursor-pointer"
              >
                {acceptingEula ? 'Writing eula.txt...' : 'I Accept & Start'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Telemetry Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">CPU Load</div>
          <div className="mt-1 text-xl font-bold mx-stat-3d-violet">{resources.cpuPercent.toFixed(1)}%</div>
          <div className="mt-2 h-1.5 rounded-full mx-well-3d overflow-hidden">
            <div className="h-full rounded-full mx-meter-violet transition-all duration-300" style={{ width: `${cpuPct}%` }} />
          </div>
          <div className="mt-1 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
            Limit: {server.limits.cpu ? `${server.limits.cpu}%` : 'Unlimited'}
          </div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">Memory Usage</div>
          <div className="mt-1 text-xl font-bold mx-stat-3d-cyan">{formatBytes(resources.memoryBytes)}</div>
          <div className="mt-2 h-1.5 rounded-full mx-well-3d overflow-hidden">
            <div className="h-full rounded-full mx-meter-cyan transition-all duration-300" style={{ width: `${memPct}%` }} />
          </div>
          <div className="mt-1 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
            {memPct.toFixed(1)}% of {server.limits.memory ? formatMb(server.limits.memory) : 'Unlimited'}
          </div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">Disk Storage</div>
          <div className="mt-1 text-xl font-bold mx-stat-3d text-[#171717] dark:text-white">
            {formatBytes(resources.diskBytes)}
          </div>
          <div className="mt-2 h-1.5 rounded-full mx-well-3d overflow-hidden">
            <div className="h-full rounded-full mx-meter-neutral transition-all duration-300" style={{ width: `${diskPct}%` }} />
          </div>
          <div className="mt-1 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
            {diskPct.toFixed(1)}% of {server.limits.disk ? formatMb(server.limits.disk) : 'Unlimited'}
          </div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">Network & Uptime</div>
          <div className="mt-1 text-xl font-bold mx-stat-3d text-[#171717] dark:text-white">
            {formatUptime(resources.uptimeMs)}
          </div>
          <div className="mt-2 text-[11px] font-semibold tabular-nums text-[#0891B2] dark:text-[#22D3EE]">
            {networkKbps.toFixed(1)} KB/s
          </div>
          <div className="mt-0.5 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
            RX {formatBytes(resources.networkRxBytes)} · TX {formatBytes(resources.networkTxBytes)}
          </div>
        </div>
      </div>

      {/* 3D Dark Terminal Interface */}
      <section className="mx-rail-track rounded-2xl overflow-hidden relative">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#14161E] border-b border-white/[0.08]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <span className="text-xs font-mono text-zinc-300 truncate">
              console@{server.identifier}
            </span>
            <span className="hidden sm:inline text-[11px] text-zinc-500 tabular-nums">
              {logs.length} lines
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {server.category === 'Game Servers' && (
              <button
                type="button"
                onClick={() => setEulaModalOpen(true)}
                title="Accept Minecraft eula.txt"
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 cursor-pointer"
              >
                EULA
              </button>
            )}

            <button
              type="button"
              onClick={() => setLogSearchOpen((o) => !o)}
              title="Search console output"
              className={`p-1.5 rounded-lg cursor-pointer ${
                logSearchOpen ? 'bg-[#8B5CF6]/25 text-[#C4B5FD]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowTimestamps((t) => !t)}
              title="Toggle local timestamps"
              className={`p-1.5 rounded-lg cursor-pointer ${
                showTimestamps ? 'bg-[#8B5CF6]/25 text-[#C4B5FD]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
            </button>

            <div className="hidden sm:inline-flex items-center rounded-lg bg-black/30 p-0.5 text-[10px] font-semibold">
              {(['sm', 'md', 'lg'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                    fontSize === sz ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={copyLogs}
              title="Copy console output"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={downloadLogs}
              title="Download console log"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLogs([])}
              title="Clear local view"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              title={expanded ? 'Restore console height' : 'Expand console height'}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {logSearchOpen && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#101219] border-b border-white/[0.06]">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Filter console lines..."
              autoFocus
              className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
            {logSearch && (
              <button
                type="button"
                onClick={() => setLogSearch('')}
                className="text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        )}

        <div
          ref={terminalRef}
          onScroll={handleTerminalScroll}
          className={`${
            expanded ? 'h-[72vh]' : 'h-[440px] sm:h-[500px]'
          } overflow-y-auto px-4 py-3.5 font-mono ${terminalTextClass} space-y-0.5 text-zinc-200 bg-[#090A0F] selection:bg-[#8B5CF6]/40`}
        >
          {visibleLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-zinc-500">
              <div className="text-xs">
                {wsError
                  ? `Wings connection issue: ${wsError}`
                  : logs.length === 0
                    ? 'Connected terminal ready — awaiting output from Wings daemon...'
                    : 'No console lines match your search filter.'}
              </div>
              {liveStatus === 'offline' && logs.length === 0 && (
                <button
                  type="button"
                  onClick={() => dispatchPower('start')}
                  className="mx-btn-3d-success inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-sans font-medium cursor-pointer mt-1"
                >
                  <Play className="w-3 h-3" />
                  Start Server
                </button>
              )}
            </div>
          ) : (
            visibleLogs.map((line) => {
              const fallbackColor =
                line.level === 'daemon'
                  ? 'text-[#22D3EE]'
                  : line.level === 'install'
                    ? 'text-violet-300'
                    : line.level === 'warn'
                      ? 'text-amber-300'
                      : line.level === 'error'
                        ? 'text-rose-400'
                        : line.level === 'cmd'
                          ? 'text-[#A78BFA] font-semibold'
                          : 'text-zinc-200';

              return (
                <div
                  key={line.id}
                  className="flex items-start gap-2.5 px-1.5 py-0.5 rounded hover:bg-white/[0.03] whitespace-pre-wrap break-words"
                >
                  {showTimestamps && (
                    <span className="text-zinc-600 select-none shrink-0 tabular-nums text-[11px] pt-[1px]">
                      {new Date(line.timestamp).toLocaleTimeString([], { hour12: false })}
                    </span>
                  )}
                  <span className={`min-w-0 flex-1 ${fallbackColor}`}>
                    {line.rawText ? (
                      <AnsiText text={line.rawText} fallbackClass={fallbackColor} />
                    ) : (
                      line.text
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {!autoScroll && logs.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setAutoScroll(true);
              if (terminalRef.current) {
                terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
              }
            }}
            className="mx-btn-3d-primary absolute bottom-16 right-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer shadow-lg"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            Latest Logs
          </button>
        )}

        <form
          onSubmit={handleSendCommand}
          className="flex items-center gap-2.5 px-4 py-3 bg-[#11131A] border-t border-white/[0.08]"
        >
          <span className="font-mono text-xs text-[#8B5CF6] font-bold select-none">&gt;_</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={liveStatus === 'offline'}
            placeholder={
              liveStatus !== 'offline'
                ? 'Type a server command (↑/↓ for history)...'
                : 'Start server to send console commands'
            }
            className="flex-1 bg-transparent font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={liveStatus === 'offline' || !command.trim()}
            className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            Send
          </button>
        </form>
      </section>

      {/* Live Instance Telemetry Graph */}
      <section className="mx-card-3d p-5 sm:p-6 rounded-2xl">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
            Real-Time Instance Resource Stream
          </h2>
          <button
            type="button"
            onClick={() => navigate({ page: 'server-files', serverId: server.id })}
            className="mx-btn-3d px-3 py-1 rounded-xl text-xs font-medium cursor-pointer"
          >
            Browse Files
          </button>
        </div>
        <TelemetryChart data={telemetry} height={175} />
      </section>
    </div>
  );
}
