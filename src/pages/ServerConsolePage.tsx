import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Play,
  RotateCw,
  Send,
  Skull,
  Square,
  Trash2,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { ConsoleLine, PowerSignal, ServerResources, ServerStatus, TelemetryPoint } from '../types/panel';
import { formatBytes, formatMb, formatUptime } from '../utils/format';
import { StatusText } from '../components/ui/StatusText';
import { TelemetryChart } from '../components/ui/TelemetryChart';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';

function stripAnsi(str: string): string {
  // Strip ANSI CSI escape codes cleanly for readable console output
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

export function ServerConsolePage({ serverId }: { serverId: string }) {
  const { servers, sendPower, notify, navigate, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [liveStatus, setLiveStatus] = useState<ServerStatus>(server?.status || 'offline');
  const [liveResources, setLiveResources] = useState<ServerResources | null>(server?.resources || null);
  const [logs, setLogs] = useState<ConsoleLine[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [command, setCommand] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [networkKbps, setNetworkKbps] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const lastNetTotalRef = useRef<number>(0);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!server || !panelConnected) return;
    let cancelled = false;
    setLiveStatus(server.status);
    setLiveResources(server.resources);
    setLogs([]);
    setTelemetry([]);
    lastNetTotalRef.current = server.resources.networkRxBytes + server.resources.networkTxBytes;

    const connectWings = async () => {
      try {
        const { token, socket } = await panelApi.getWebsocketAuth(server.id);
        if (cancelled) return;
        const ws = new WebSocket(socket);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ event: 'auth', args: [token] }));
        };

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            const eventName = msg.event;
            const args: string[] = msg.args || [];

            if (eventName === 'auth success') {
              setWsConnected(true);
              ws.send(JSON.stringify({ event: 'send logs', args: [null] }));
              ws.send(JSON.stringify({ event: 'send stats', args: [null] }));
            } else if (eventName === 'token expiring') {
              panelApi.getWebsocketAuth(server.id).then((fresh) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ event: 'auth', args: [fresh.token] }));
                }
              });
            } else if (eventName === 'console output' || eventName === 'daemon message') {
              const rawText = stripAnsi(String(args[0] || ''));
              const level: ConsoleLine['level'] =
                eventName === 'daemon message'
                  ? 'daemon'
                  : rawText.includes('ERROR')
                    ? 'error'
                    : rawText.includes('WARN')
                      ? 'warn'
                      : 'info';
              setLogs((prev) => [
                ...prev.slice(-300),
                {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  timestamp: new Date().toISOString(),
                  level,
                  text: rawText,
                },
              ]);
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

        ws.onclose = () => {
          setWsConnected(false);
        };
      } catch (err: any) {
        setWsConnected(false);
        setLogs([
          {
            id: 'ws-err',
            timestamp: new Date().toISOString(),
            level: 'warn',
            text: `[MidnightX]: Unable to establish Wings WebSocket (${err.message}).`,
          },
        ]);
      }
    };

    connectWings();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [server?.id, panelConnected]);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'set state', args: [signal] }));
      notify(`Power signal "${signal}" sent`, server.name, 'success');
    } else {
      await sendPower(server.id, signal);
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
      setCmdHistory((prev) => [trimmed, ...prev.slice(0, 29)]);
      setHistoryIdx(-1);
      setCommand('');
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

  const copyLogs = () => {
    navigator.clipboard?.writeText(logs.map((l) => l.text).join('\n'));
    notify('Console buffer copied', `${logs.length} lines`, 'success');
  };

  const resources = liveResources || server.resources;
  const memPct = server.limits.memory > 0 ? Math.min(100, (resources.memoryBytes / (server.limits.memory * 1024 * 1024)) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Server Header & 3D Power Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
              {server.name}
            </h1>
            <StatusText status={liveStatus} />
          </div>
          <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1 flex flex-wrap items-center gap-2">
            <span className="font-medium tabular-nums">{server.allocations[0]?.ip || '—'}:{server.allocations[0]?.port || '—'}</span>
            <span aria-hidden="true">·</span>
            <span>{server.egg}</span>
            <span aria-hidden="true">·</span>
            <span>{server.node}</span>
            <span aria-hidden="true">·</span>
            <span className={wsConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#777777]'}>
              {wsConnected ? 'Wings WebSocket Connected' : 'WebSocket Disconnected'}
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => navigate({ page: 'server-files', serverId: server.id })}
              className="text-[#8B5CF6] hover:underline cursor-pointer"
            >
              Open Files
            </button>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={liveStatus === 'running' || liveStatus === 'starting'}
            onClick={() => dispatchPower('start')}
            className="mx-btn-3d-success inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Start
          </button>
          <button
            type="button"
            disabled={liveStatus === 'offline'}
            onClick={() => dispatchPower('restart')}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Restart
          </button>
          <button
            type="button"
            disabled={liveStatus === 'offline'}
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

      {/* Live Telemetry Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">Live CPU Usage</div>
          <div className="mt-1.5 text-xl font-bold mx-stat-3d-violet">
            {resources.cpuPercent.toFixed(1)}%
          </div>
          <div className="mt-0.5 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
            Limit: {server.limits.cpu || '∞'}%
          </div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">Live RAM Usage</div>
          <div className="mt-1.5 text-xl font-bold mx-stat-3d-cyan">
            {formatBytes(resources.memoryBytes)}
          </div>
          <div className="mt-0.5 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
            {memPct.toFixed(1)}% of {formatMb(server.limits.memory)}
          </div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">Network Traffic</div>
          <div className="mt-1.5 text-xl font-bold mx-stat-3d text-[#171717] dark:text-white">
            {networkKbps.toFixed(1)} KB/s
          </div>
          <div className="mt-0.5 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
            RX {formatBytes(resources.networkRxBytes)} · TX {formatBytes(resources.networkTxBytes)}
          </div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">Uptime</div>
          <div className="mt-1.5 text-xl font-bold mx-stat-3d text-[#171717] dark:text-white">
            {formatUptime(resources.uptimeMs)}
          </div>
          <div className="mt-0.5 text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500">
            Disk: {formatBytes(resources.diskBytes)}
          </div>
        </div>
      </div>

      {/* 3D Dark Terminal Interface */}
      <section className="mx-rail-track rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#161820] border-b border-white/[0.08]">
          <span className="text-xs font-mono text-zinc-300">
            wings-tty · {server.identifier}
          </span>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-[#8B5CF6]"
              />
              Auto-scroll
            </label>
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
              onClick={() => setLogs([])}
              title="Clear local view"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          ref={terminalRef}
          className="h-[360px] overflow-y-auto p-4 font-mono text-xs leading-relaxed space-y-1 text-zinc-200 bg-[#0B0C10]"
        >
          {logs.length === 0 ? (
            <div className="text-zinc-500">Awaiting stdout frames from Wings daemon...</div>
          ) : (
            logs.map((line) => (
              <div key={line.id} className="flex items-start gap-3 break-words">
                <span className="text-zinc-600 select-none shrink-0 tabular-nums">
                  {new Date(line.timestamp).toLocaleTimeString([], { hour12: false })}
                </span>
                <span
                  className={
                    line.level === 'daemon'
                      ? 'text-[#06B6D4]'
                      : line.level === 'warn'
                        ? 'text-amber-400'
                        : line.level === 'error'
                          ? 'text-rose-400'
                          : line.level === 'cmd'
                            ? 'text-[#8B5CF6] font-medium'
                            : 'text-zinc-200'
                  }
                >
                  {line.text}
                </span>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSendCommand} className="flex items-center gap-2 px-4 py-3 bg-[#13141A] border-t border-white/[0.08]">
          <span className="font-mono text-xs text-[#8B5CF6] font-semibold select-none">&gt;</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={liveStatus !== 'running'}
            placeholder={
              liveStatus === 'running'
                ? 'Type a server command...'
                : 'Start server to send commands'
            }
            className="flex-1 bg-transparent font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={liveStatus !== 'running' || !command.trim()}
            className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            Send
          </button>
        </form>
      </section>

      {/* Live Instance Telemetry Graph */}
      <section className="mx-card-3d p-5 sm:p-6 rounded-2xl">
        <h2 className="text-sm font-semibold text-[#171717] dark:text-white mb-3">
          Real-Time Instance Resource Stream
        </h2>
        <TelemetryChart data={telemetry} height={175} />
      </section>
    </div>
  );
}
