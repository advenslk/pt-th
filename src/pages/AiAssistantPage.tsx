import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  FileCode2,
  FolderOpen,
  History,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { helzerxApi } from '../api/helzerx';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { usePanel } from '../context/PanelContext';
import type {
  AiActionTrace,
  AiCreditPlan,
  AiPlanId,
  AiStateResponse,
} from '../types/helzerx';
import type { FileEntry } from '../types/panel';
import { formatRelativeTime } from '../utils/format';
import { detectServerEnvironment, type DetectedServerEnv } from '../utils/serverCompatibility';

type AiTab = 'assistant' | 'plans' | 'history';

function renderFormattedReply(text: string): React.ReactNode {
  const segments = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed text-[#171717] dark:text-zinc-200">
      {segments.map((seg, idx) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const inner = seg.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, '').trimEnd();
          return (
            <pre
              key={idx}
              className="mx-well-3d rounded-xl p-3 text-[11px] font-mono overflow-x-auto text-[#171717] dark:text-zinc-200 whitespace-pre"
            >
              <code>{inner}</code>
            </pre>
          );
        }

        const lines = seg.split('\n');
        return (
          <div key={idx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1">
                    <span className="mt-2 w-1 h-1 rounded-full bg-[#777777] dark:bg-zinc-400 shrink-0" />
                    <span className="flex-1 break-words">{trimmed.slice(2)}</span>
                  </div>
                );
              }
              if (/^#{1,3}\s+/.test(trimmed)) {
                return (
                  <div key={lIdx} className="font-semibold text-[#171717] dark:text-white pt-1">
                    {trimmed.replace(/^#{1,3}\s+/, '')}
                  </div>
                );
              }
              return (
                <p key={lIdx} className="break-words whitespace-pre-wrap">
                  {line}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ActionTraceList({ actions }: { actions: AiActionTrace[] }) {
  const [open, setOpen] = useState(false);
  if (!actions || actions.length === 0) return null;

  const successCount = actions.filter((a) => a.status === 'success').length;
  return (
    <div className="mt-2.5 pt-2.5 border-t border-black/[0.06] dark:border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#525252] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-white cursor-pointer"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Wrench className="w-3 h-3 text-[#8B5CF6]" />
        <span className="tabular-nums">
          {successCount}/{actions.length} server action{actions.length === 1 ? '' : 's'} executed
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {actions.map((act, idx) => (
            <div
              key={`${act.tool}-${idx}`}
              className="mx-well-3d px-2.5 py-2 rounded-xl flex items-start justify-between gap-2 text-[11px]"
            >
              <div className="flex items-start gap-2 min-w-0">
                {act.status === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-[#171717] dark:text-zinc-100 truncate">
                    {act.tool}
                    {act.target ? (
                      <span className="font-normal text-[#777777] dark:text-zinc-400 ml-1.5">
                        ({act.target})
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[#525252] dark:text-zinc-400 break-words mt-0.5">
                    {act.summary}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AiAssistantPage({ serverId }: { serverId?: string }) {
  const {
    servers,
    activeServer,
    user,
    navigate,
    notify,
    panelConnected,
    connectionError,
  } = usePanel();

  const [tab, setTab] = useState<AiTab>('assistant');
  const [selectedServerId, setSelectedServerId] = useState<string>(
    () => serverId || activeServer?.id || servers[0]?.id || ''
  );

  useEffect(() => {
    if (serverId) {
      setSelectedServerId(serverId);
    } else if (!selectedServerId && (activeServer?.id || servers[0]?.id)) {
      setSelectedServerId(activeServer?.id || servers[0]?.id || '');
    }
  }, [serverId, activeServer?.id, servers, selectedServerId]);

  const targetServer = useMemo(
    () =>
      servers.find((s) => s.id === selectedServerId || s.identifier === selectedServerId) ||
      activeServer ||
      servers[0] ||
      null,
    [servers, selectedServerId, activeServer]
  );

  const [aiState, setAiState] = useState<AiStateResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [subscribingPlanId, setSubscribingPlanId] = useState<AiPlanId | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [prompt, setPrompt] = useState('');

  // Server context inspector state
  const [detectingEnv, setDetectingEnv] = useState(false);
  const [detectedEnv, setDetectedEnv] = useState<DetectedServerEnv | null>(null);
  const [installedEntries, setInstalledEntries] = useState<FileEntry[]>([]);
  const [configEntries, setConfigEntries] = useState<FileEntry[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadAiState = useCallback(async () => {
    setLoadingAi(true);
    try {
      const state = await helzerxApi.getAiState();
      setAiState(state);
    } catch (err: any) {
      notify('Could not load AI Studio state', err?.message || 'Try refreshing the page.', 'error');
    } finally {
      setLoadingAi(false);
    }
  }, [notify]);

  useEffect(() => {
    loadAiState();
  }, [loadAiState]);

  const inspectTargetServer = useCallback(async () => {
    if (!targetServer || !panelConnected) return;
    setDetectingEnv(true);
    setLoadingContext(true);
    try {
      const env = await detectServerEnvironment(targetServer);
      setDetectedEnv(env);

      const folder = env.kind === 'mod' ? '/mods' : '/plugins';
      const [rootRes, extRes] = await Promise.allSettled([
        panelApi.listFiles(targetServer.id, '/'),
        panelApi.listFiles(targetServer.id, folder),
      ]);

      const rootList = rootRes.status === 'fulfilled' ? rootRes.value : [];
      const extList = extRes.status === 'fulfilled' ? extRes.value : [];

      setInstalledEntries(
        extList.filter(
          (f) => !f.isDirectory && (f.name.endsWith('.jar') || f.name.endsWith('.jar.disabled'))
        )
      );

      const editableRoot = rootList.filter(
        (f) =>
          !f.isDirectory &&
          /^(server\.properties|bukkit\.yml|spigot\.yml|purpur\.yml|velocity\.toml|eula\.txt)$/i.test(
            f.name
          )
      );
      const pluginDirs = extList.filter((f) => f.isDirectory);
      setConfigEntries([...editableRoot, ...pluginDirs].slice(0, 14));
    } catch {
      setInstalledEntries([]);
      setConfigEntries([]);
    } finally {
      setDetectingEnv(false);
      setLoadingContext(false);
    }
  }, [targetServer, panelConnected]);

  useEffect(() => {
    inspectTargetServer();
  }, [inspectTargetServer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiState?.messages?.length, sending]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  const account = aiState?.account;
  const plans = aiState?.plans || [];
  const messages = aiState?.messages || [];
  const history = aiState?.history || [];
  const walletBalance = aiState?.walletBalance ?? 0;
  const geminiConfigured = aiState?.geminiConfigured ?? true;

  const creditPercentRemaining = account
    ? Math.max(0, Math.min(100, account.remainingPercentOfPlan))
    : 0;

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : prompt).trim();
    if (!text) return;
    if (!targetServer) {
      notify('Select a server first', 'Assign or select a server to run AI actions.', 'error');
      return;
    }
    if (account && account.creditsRemaining < 2) {
      notify(
        'Insufficient AI credits',
        'Switch to a higher credit plan under Plans & Credits to continue.',
        'error'
      );
      setTab('plans');
      return;
    }

    setSending(true);
    try {
      const res = await helzerxApi.sendAiChat({
        serverId: targetServer.id,
        message: text,
      });
      setPrompt('');
      setAiState((prev) =>
        prev
          ? {
              ...prev,
              account: res.account,
              messages: [...prev.messages, res.userMessage, res.assistantMessage].slice(-40),
              history: [res.usageEntry, ...prev.history].slice(0, 60),
            }
          : prev
      );
      // Refresh inspector if any file/plugin changes occurred
      if ((res.assistantMessage.actions || []).length > 0) {
        inspectTargetServer();
      }
    } catch (err: any) {
      notify('AI request could not be completed', err?.message || 'Please try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    setClearing(true);
    try {
      await helzerxApi.clearAiChat();
      setAiState((prev) => (prev ? { ...prev, messages: [] } : prev));
      notify('Conversation cleared', undefined, 'info');
    } catch (err: any) {
      notify('Could not clear chat', err?.message || 'Error', 'error');
    } finally {
      setClearing(false);
    }
  };

  const handleSubscribe = async (plan: AiCreditPlan, adminOverride = false) => {
    setSubscribingPlanId(plan.id);
    try {
      const res = await helzerxApi.subscribeAiPlan(plan.id, adminOverride);
      setAiState((prev) =>
        prev
          ? {
              ...prev,
              account: res.account,
              walletBalance: res.walletBalance,
            }
          : prev
      );
      notify(
        `Activated ${plan.name} (${plan.creditPercent}%)`,
        `${plan.monthlyCredits.toLocaleString()} monthly AI credits ready.`,
        'success'
      );
    } catch (err: any) {
      notify('Plan update failed', err?.message || 'Check wallet balance.', 'error');
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const handleAdminManage = async (payload: { bonusCredits?: number; resetCycle?: boolean }) => {
    setAdminBusy(true);
    try {
      const res = await helzerxApi.adminManageAiCredits(payload);
      setAiState((prev) => (prev ? { ...prev, account: res.account } : prev));
      notify('AI credits updated', undefined, 'success');
    } catch (err: any) {
      notify('Admin credit action failed', err?.message || 'Error', 'error');
    } finally {
      setAdminBusy(false);
    }
  };

  const promptStarters = [
    {
      title: 'Install compatible plugins',
      desc: 'Install EssentialsX, LuckPerms & Vault matched to this server version',
      text: 'Inspect this server software and version, then install EssentialsX, LuckPerms, and Vault matched cleanly to the server.',
    },
    {
      title: 'Customize plugin configs',
      desc: 'Tune messages, spawn behavior, kits, and permissions cleanly',
      text: 'List my installed plugins and inspect their configuration files, then recommend and apply clean improvements for player experience.',
    },
    {
      title: 'Optimize TPS & lag settings',
      desc: 'Review bukkit.yml, spigot.yml, and paper configs safely',
      text: 'Inspect server.properties, bukkit.yml, spigot.yml, and Paper config files and apply balanced performance optimizations without breaking gameplay.',
    },
    {
      title: 'Diagnose latest console log',
      desc: 'Check /logs/latest.log for startup errors or dependency issues',
      text: 'Read /logs/latest.log and identify any plugin/mod startup warnings, missing dependencies, or config syntax issues.',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mx-well-3d w-11 h-11 rounded-2xl flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <div>
            <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
              Server AI Studio
            </h1>
            <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
              Install compatible plugins or mods, customize YAML/JSON configs, and manage server files naturally
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {servers.length > 0 && (
            <select
              aria-label="Target server for AI assistant"
              value={targetServer?.id || ''}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedServerId(nextId);
                if (serverId) {
                  navigate({ page: 'server-ai', serverId: nextId });
                }
              }}
              className="mx-input-3d px-3 py-2 rounded-xl text-xs font-medium cursor-pointer max-w-[220px]"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-[#19191F]">
                  {s.name} ({s.identifier})
                </option>
              ))}
            </select>
          )}

          <div className="mx-well-3d inline-flex items-center p-1 rounded-xl gap-1">
            {(
              [
                { id: 'assistant', label: 'Assistant', icon: Bot },
                { id: 'plans', label: 'Plans & Credits', icon: Coins },
                { id: 'history', label: 'Action History', icon: History },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'mx-btn-3d-primary'
                      : 'text-[#525252] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Smooth Matte Credit Meter Strip */}
      {account && (
        <div className="mx-card-3d p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#171717] dark:text-white">
                  {account.planName} Plan
                </span>
                <span className="text-[#777777] dark:text-zinc-400">·</span>
                <span className="font-mono tabular-nums text-[#525252] dark:text-zinc-300">
                  {account.creditPercentCapacity}% Tier Capacity
                </span>
              </div>
              <div className="font-mono tabular-nums text-xs text-[#171717] dark:text-zinc-200">
                <span className="font-semibold">{account.creditsRemaining.toLocaleString()}</span>
                <span className="text-[#777777] dark:text-zinc-400">
                  {' '}
                  / {account.monthlyCreditLimit.toLocaleString()} credits remaining ({creditPercentRemaining}%)
                </span>
              </div>
            </div>
            <div className="mx-well-3d h-2 rounded-full overflow-hidden">
              <div
                className="mx-meter-violet h-full rounded-full transition-all duration-300"
                style={{ width: `${creditPercentRemaining}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTab('plans')}
              className="mx-btn-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5 text-[#8B5CF6]" />
              {account.planId === 'enterprise' ? 'View Plan' : 'Upgrade Plan'}
            </button>
          </div>
        </div>
      )}

      {!geminiConfigured && (
        <div className="mx-card-3d px-4 py-3 rounded-2xl flex items-center gap-3 text-xs border border-amber-500/30 bg-amber-500/[0.06]">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-[#171717] dark:text-zinc-200">
            Server AI requires <span className="font-mono font-semibold">GEMINI_API_KEY</span> to be
            set in your server environment secrets before sending prompts.
          </span>
        </div>
      )}

      {/* TAB 1: ASSISTANT */}
      {tab === 'assistant' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Chat Workspace (8 cols) */}
          <div className="lg:col-span-8 mx-card-3d rounded-2xl flex flex-col overflow-hidden min-h-[540px] max-h-[76vh]">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
              <div className="flex items-center gap-2 min-w-0 text-xs">
                <span className="font-semibold text-[#171717] dark:text-white truncate">
                  {targetServer ? targetServer.name : 'No server selected'}
                </span>
                {detectedEnv && detectedEnv.loader !== 'unknown' && (
                  <span className="text-[#777777] dark:text-zinc-400 font-mono truncate">
                    · {detectedEnv.loaderLabel}
                    {detectedEnv.mcVersion ? ` ${detectedEnv.mcVersion}` : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {messages.length > 0 && (
                  <button
                    type="button"
                    disabled={clearing || sending}
                    onClick={handleClearChat}
                    className="mx-btn-3d inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {loadingAi ? (
                <div className="py-16 flex items-center justify-center gap-2 text-xs text-[#777777]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading conversation...
                </div>
              ) : messages.length === 0 ? (
                <div className="py-6 space-y-5">
                  <div className="max-w-lg mx-auto text-center space-y-1.5">
                    <div className="mx-well-3d w-10 h-10 rounded-xl inline-flex items-center justify-center mb-1">
                      <Bot className="w-5 h-5 text-[#8B5CF6]" />
                    </div>
                    <h2 className="text-sm font-semibold text-[#171717] dark:text-white">
                      Ready to configure {targetServer?.name || 'your server'}
                    </h2>
                    <p className="text-xs text-[#777777] dark:text-zinc-400">
                      Describe plugins or mods to install, YAML/JSON settings to customize, or log errors to inspect.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {promptStarters.map((starter) => (
                      <button
                        key={starter.title}
                        type="button"
                        disabled={!targetServer || sending}
                        onClick={() => handleSend(starter.text)}
                        className="mx-well-3d text-left p-3.5 rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <div className="text-xs font-semibold text-[#171717] dark:text-white">
                          {starter.title}
                        </div>
                        <div className="text-[11px] text-[#777777] dark:text-zinc-400 mt-1 line-clamp-2">
                          {starter.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[90%] sm:max-w-[82%] rounded-2xl px-4 py-3 ${
                          isUser
                            ? 'mx-well-3d text-[#171717] dark:text-zinc-100'
                            : 'mx-card-3d'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1.5 text-[11px] text-[#777777] dark:text-zinc-400">
                          <span className="font-medium">
                            {isUser ? user?.username || 'You' : 'Server AI'}
                            {msg.serverName ? ` · ${msg.serverName}` : ''}
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatRelativeTime(msg.createdAt)}
                          </span>
                        </div>

                        {isUser ? (
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>
                        ) : (
                          renderFormattedReply(msg.text)
                        )}

                        {!isUser && msg.actions && msg.actions.length > 0 && (
                          <ActionTraceList actions={msg.actions} />
                        )}

                        {!isUser && typeof msg.creditsUsed === 'number' && (
                          <div className="mt-2 pt-1.5 border-t border-black/[0.05] dark:border-white/[0.05] flex items-center justify-end text-[10px] font-mono tabular-nums text-[#777777] dark:text-zinc-500">
                            -{msg.creditsUsed} credits
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {sending && (
                <div className="flex items-start">
                  <div className="mx-card-3d rounded-2xl px-4 py-3 inline-flex items-center gap-2.5 text-xs text-[#525252] dark:text-zinc-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B5CF6]" />
                    <span>Inspecting server files and running AI tools...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="p-3.5 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2">
              <div className="flex items-end gap-2.5">
                <textarea
                  rows={2}
                  value={prompt}
                  disabled={sending || !targetServer}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    targetServer
                      ? `Ask AI to install plugins/mods or customize configs on ${targetServer.name}...`
                      : 'Select a server first...'
                  }
                  className="mx-input-3d flex-1 px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] resize-none"
                />
                <button
                  type="button"
                  disabled={
                    sending ||
                    !prompt.trim() ||
                    !targetServer ||
                    (account ? account.creditsRemaining < 2 : false)
                  }
                  onClick={() => handleSend()}
                  className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold shrink-0 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                >
                  {sending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{sending ? 'Running' : 'Send'}</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#777777] dark:text-zinc-500">
                <span>
                  Base cost: <span className="font-mono tabular-nums">2 credits</span> +{' '}
                  <span className="font-mono tabular-nums">2</span> per server modification (max 16)
                </span>
                {account && account.creditsRemaining < 2 && (
                  <button
                    type="button"
                    onClick={() => setTab('plans')}
                    className="text-[#8B5CF6] font-medium hover:underline cursor-pointer"
                  >
                    Credits exhausted — Upgrade plan
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Context Inspector (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="mx-card-3d p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#171717] dark:text-white">
                  <Cpu className="w-4 h-4 text-[#8B5CF6]" />
                  <span>Target Server Context</span>
                </div>
                <button
                  type="button"
                  disabled={detectingEnv || loadingContext}
                  onClick={inspectTargetServer}
                  className="mx-btn-3d p-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                  title="Refresh server inspection"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${detectingEnv || loadingContext ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>

              {targetServer ? (
                <div className="space-y-2.5 text-xs">
                  <div className="mx-well-3d p-3 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#777777] dark:text-zinc-400">Software</span>
                      <span className="font-semibold text-[#171717] dark:text-white">
                        {detectingEnv ? 'Detecting...' : detectedEnv?.loaderLabel || targetServer.egg}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#777777] dark:text-zinc-400">MC Version</span>
                      <span className="font-mono tabular-nums text-[#171717] dark:text-zinc-100">
                        {detectedEnv?.mcVersion || 'Auto'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#777777] dark:text-zinc-400">Status</span>
                      <span className="capitalize font-medium text-[#171717] dark:text-zinc-100">
                        {targetServer.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#777777] dark:text-zinc-400">RAM / CPU</span>
                      <span className="font-mono tabular-nums text-[#171717] dark:text-zinc-100">
                        {targetServer.limits.memory} MB · {targetServer.limits.cpu}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#777777]">No active server found.</p>
              )}
            </div>

            {/* Quick Click Configs / Plugins */}
            <div className="mx-card-3d p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#171717] dark:text-white inline-flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-[#06B6D4]" />
                  Quick Config &amp; Plugin Targets
                </span>
                <span className="font-mono tabular-nums text-[11px] text-[#777777]">
                  {installedEntries.length} jars
                </span>
              </div>

              {loadingContext ? (
                <div className="py-4 text-center text-xs text-[#777777]">Scanning files...</div>
              ) : (
                <>
                  {configEntries.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                        Click a file or folder to pre-fill a customization prompt:
                      </div>
                      <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
                        {configEntries.map((entry) => (
                          <button
                            key={entry.path}
                            type="button"
                            onClick={() =>
                              setPrompt(
                                entry.isDirectory
                                  ? `Inspect files inside ${entry.path} and customize its configuration for better balance and UX.`
                                  : `Read ${entry.path} and suggest or apply helpful configuration customizations.`
                              )
                            }
                            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left text-[11px] hover:bg-black/[0.045] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {entry.isDirectory ? (
                                <FolderOpen className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                              ) : (
                                <FileCode2 className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
                              )}
                              <span className="font-mono truncate text-[#171717] dark:text-zinc-200">
                                {entry.path}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {installedEntries.length > 0 && (
                    <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] space-y-1">
                      <div className="text-[11px] text-[#777777] dark:text-zinc-400 inline-flex items-center gap-1.5">
                        <Package className="w-3 h-3" />
                        Installed ({installedEntries.length})
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {installedEntries.slice(0, 12).map((jar) => (
                          <button
                            key={jar.path}
                            type="button"
                            onClick={() =>
                              setPrompt(
                                `Review ${jar.name} on this server and check or customize its plugin/mod config files.`
                              )
                            }
                            className="w-full text-left px-2.5 py-1 rounded-lg text-[11px] font-mono truncate text-[#525252] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.04] cursor-pointer"
                          >
                            {jar.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLANS & CREDITS (10% Free + 4 Paid Tiers up to 100%) */}
      {tab === 'plans' && (
        <div className="space-y-5">
          {account && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="mx-card-3d p-4 rounded-2xl">
                <div className="text-[11px] text-[#777777] dark:text-zinc-400">Active AI Plan</div>
                <div className="text-lg font-bold text-[#171717] dark:text-white mt-1">
                  {account.planName}
                </div>
              </div>
              <div className="mx-card-3d p-4 rounded-2xl">
                <div className="text-[11px] text-[#777777] dark:text-zinc-400">Monthly Tier Share</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#8B5CF6] mt-1">
                  {account.creditPercentCapacity}% of 100%
                </div>
              </div>
              <div className="mx-card-3d p-4 rounded-2xl">
                <div className="text-[11px] text-[#777777] dark:text-zinc-400">Credits Remaining</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#171717] dark:text-white mt-1">
                  {account.creditsRemaining.toLocaleString()} / {account.monthlyCreditLimit.toLocaleString()}
                </div>
              </div>
              <div className="mx-card-3d p-4 rounded-2xl">
                <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                  Wallet · Cycle Reset
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#171717] dark:text-white mt-1">
                  ${walletBalance.toFixed(2)}
                </div>
                <div className="text-[11px] text-[#777777] dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Resets {new Date(account.resetAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}

          {/* 5 Plan Cards: Free 10% + 4 Paid (25%, 50%, 75%, 100%) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {plans.map((plan) => {
              const isCurrent = account?.planId === plan.id;
              const isBusy = subscribingPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-4 ${
                    isCurrent
                      ? 'border-[#8B5CF6]/45'
                      : plan.popular
                        ? 'border-[#8B5CF6]/25'
                        : ''
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#171717] dark:text-white">
                          {plan.name}
                        </h3>
                        <p className="text-[11px] text-[#777777] dark:text-zinc-400">
                          {plan.audience}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums text-xs font-semibold text-[#8B5CF6]">
                        {plan.creditPercent}%
                      </span>
                    </div>

                    <div className="pt-1">
                      <div className="flex items-baseline gap-1 font-mono tabular-nums">
                        <span className="text-2xl font-bold text-[#171717] dark:text-white">
                          {plan.priceMonthly === 0 ? '$0' : `$${plan.priceMonthly.toFixed(2)}`}
                        </span>
                        <span className="text-[11px] text-[#777777] dark:text-zinc-400">/mo</span>
                      </div>
                      <div className="text-xs font-mono tabular-nums text-[#525252] dark:text-zinc-300 mt-1">
                        {plan.monthlyCredits.toLocaleString()} credits / cycle
                      </div>
                    </div>

                    <div className="mx-well-3d h-1.5 rounded-full overflow-hidden">
                      <div
                        className="mx-meter-violet h-full rounded-full"
                        style={{ width: `${plan.creditPercent}%` }}
                      />
                    </div>

                    <p className="text-[11px] leading-relaxed text-[#525252] dark:text-zinc-400">
                      {plan.description}
                    </p>

                    <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#171717] dark:text-zinc-200 font-medium">
                        <Layers className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                        <span className="tabular-nums">
                          Up to {plan.maxToolStepsPerTurn} tool steps / turn
                        </span>
                      </div>
                      {plan.capabilities.map((cap) => (
                        <div
                          key={cap}
                          className="flex items-start gap-1.5 text-[11px] text-[#525252] dark:text-zinc-400"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <button
                      type="button"
                      disabled={isCurrent || isBusy}
                      onClick={() => handleSubscribe(plan, false)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                        isCurrent
                          ? 'mx-well-3d text-[#777777] dark:text-zinc-400 cursor-default'
                          : plan.popular
                            ? 'mx-btn-3d-primary cursor-pointer'
                            : 'mx-btn-3d cursor-pointer'
                      } disabled:opacity-60`}
                    >
                      {isBusy
                        ? 'Activating...'
                        : isCurrent
                          ? 'Active Plan'
                          : plan.priceMonthly === 0
                            ? 'Switch to Free (10%)'
                            : `Activate ($${plan.priceMonthly.toFixed(2)})`}
                    </button>

                    {user?.role === 'admin' && !isCurrent && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSubscribe(plan, true)}
                        className="w-full py-1.5 px-3 rounded-xl text-[11px] font-medium mx-btn-3d cursor-pointer disabled:opacity-50"
                      >
                        Admin Grant (No Charge)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {user?.role === 'admin' && (
            <div className="mx-card-3d p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                <div>
                  <div className="font-semibold text-[#171717] dark:text-white">
                    Admin Credit Controls
                  </div>
                  <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                    Grant instant bonus credits or reset the current monthly AI credit cycle.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={adminBusy}
                  onClick={() => handleAdminManage({ bonusCredits: 100 })}
                  className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                  +100 Credits
                </button>
                <button
                  type="button"
                  disabled={adminBusy}
                  onClick={() => handleAdminManage({ bonusCredits: 250 })}
                  className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                  +250 Credits
                </button>
                <button
                  type="button"
                  disabled={adminBusy}
                  onClick={() => handleAdminManage({ resetCycle: true })}
                  className="mx-btn-3d-primary px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                  Reset Cycle
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTION HISTORY */}
      {tab === 'history' && (
        <div className="mx-card-3d rounded-2xl overflow-x-auto">
          {history.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#777777] dark:text-zinc-400">
              No AI actions logged yet. Ask the assistant to inspect plugins or edit a config file to see detailed traces here.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] font-medium text-[#777777] dark:text-zinc-400">
                  <th className="py-3 px-4">When</th>
                  <th className="py-3 px-3">Server</th>
                  <th className="py-3 px-3">Request</th>
                  <th className="py-3 px-3">Executed Actions</th>
                  <th className="py-3 px-4 text-right">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05] text-xs">
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono tabular-nums text-[#777777] dark:text-zinc-400 whitespace-nowrap">
                      {formatRelativeTime(entry.createdAt)}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#171717] dark:text-white whitespace-nowrap">
                      {entry.serverName}
                    </td>
                    <td className="py-3 px-3 text-[#525252] dark:text-zinc-300 max-w-xs truncate">
                      {entry.promptPreview}
                    </td>
                    <td className="py-3 px-3 text-[#777777] dark:text-zinc-400">
                      {entry.actions.length === 0
                        ? 'Read-only advice'
                        : `${entry.actions.length} step(s): ${entry.actions
                            .slice(0, 2)
                            .map((a) => a.tool)
                            .join(', ')}${entry.actions.length > 2 ? '…' : ''}`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#171717] dark:text-zinc-100 whitespace-nowrap">
                      -{entry.creditsUsed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
