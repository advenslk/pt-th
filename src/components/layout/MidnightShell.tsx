import React, { useMemo, useState } from 'react';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Database,
  Folder,
  FolderOpen,
  Globe,
  Home,
  LifeBuoy,
  Menu,
  Moon,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Server,
  Settings,
  Shield,
  Sun,
  TerminalSquare,
  User,
  X,
} from 'lucide-react';
import { usePanel, type MainRoute } from '../../context/PanelContext';
import { StatusText } from '../ui/StatusText';

function MidnightStarLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white drop-shadow" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="4.2" y1="7.5" x2="19.8" y2="16.5" />
      <line x1="19.8" y1="7.5" x2="4.2" y2="16.5" />
    </svg>
  );
}

interface RailItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
}

export function MidnightShell({ children }: { children: React.ReactNode }) {
  const {
    theme,
    toggleTheme,
    route,
    navigate,
    servers,
    activeServer,
    user,
    toasts,
    dismissToast,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
  } = usePanel();

  const [treeSearch, setTreeSearch] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Game Servers': true,
    Applications: true,
    Infrastructure: true,
  });

  const targetServerId = activeServer?.id || servers[0]?.id || '';

  const railItems: RailItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      isActive: route.page === 'dashboard',
      onClick: () => navigate({ page: 'dashboard' }),
    },
    {
      id: 'servers',
      label: 'Servers',
      icon: Server,
      isActive: route.page === 'servers',
      onClick: () => navigate({ page: 'servers' }),
    },
    {
      id: 'console',
      label: 'Console',
      icon: TerminalSquare,
      isActive: route.page === 'server-console',
      onClick: () =>
        targetServerId
          ? navigate({ page: 'server-console', serverId: targetServerId })
          : navigate({ page: 'servers' }),
    },
    {
      id: 'files',
      label: 'File Manager',
      icon: FolderOpen,
      isActive: route.page === 'server-files',
      onClick: () =>
        targetServerId
          ? navigate({ page: 'server-files', serverId: targetServerId })
          : navigate({ page: 'servers' }),
    },
    {
      id: 'backups',
      label: 'Backups',
      icon: Archive,
      isActive: route.page === 'server-backups',
      onClick: () =>
        targetServerId
          ? navigate({ page: 'server-backups', serverId: targetServerId })
          : navigate({ page: 'servers' }),
    },
    {
      id: 'databases',
      label: 'Databases',
      icon: Database,
      isActive: route.page === 'server-databases',
      onClick: () =>
        targetServerId
          ? navigate({ page: 'server-databases', serverId: targetServerId })
          : navigate({ page: 'servers' }),
    },
    {
      id: 'network',
      label: 'Network',
      icon: Globe,
      isActive: route.page === 'server-network',
      onClick: () =>
        targetServerId
          ? navigate({ page: 'server-network', serverId: targetServerId })
          : navigate({ page: 'servers' }),
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: CreditCard,
      isActive: route.page === 'billing',
      onClick: () => navigate({ page: 'billing' }),
    },
    {
      id: 'support',
      label: 'Support',
      icon: LifeBuoy,
      isActive: route.page === 'support',
      onClick: () => navigate({ page: 'support' }),
    },
  ];

  const onlineCount = servers.filter((s) => s.status === 'running').length;

  const groupedTree = useMemo(() => {
    const q = treeSearch.trim().toLowerCase();
    const filtered = q
      ? servers.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.identifier.toLowerCase().includes(q) ||
            s.egg.toLowerCase().includes(q)
        )
      : servers;

    return {
      'Game Servers': filtered.filter((s) => s.category === 'Game Servers'),
      Applications: filtered.filter((s) => s.category === 'Applications'),
      Infrastructure: filtered.filter((s) => s.category === 'Databases' || s.category === 'Proxies'),
    };
  }, [servers, treeSearch]);

  const breadcrumb = useMemo(() => {
    switch (route.page) {
      case 'dashboard':
        return ['MidnightX', 'Dashboard'];
      case 'servers':
        return ['MidnightX', 'Servers'];
      case 'server-console':
        return ['Servers', activeServer?.name || route.serverId, 'Console'];
      case 'server-files':
        return ['Servers', activeServer?.name || route.serverId, 'File Manager'];
      case 'server-backups':
        return ['Servers', activeServer?.name || route.serverId, 'Backups'];
      case 'server-databases':
        return ['Servers', activeServer?.name || route.serverId, 'Databases'];
      case 'server-network':
        return ['Servers', activeServer?.name || route.serverId, 'Network'];
      case 'account':
        return ['MidnightX', 'Account Security'];
      case 'billing':
        return ['MidnightX', 'Billing'];
      case 'support':
        return ['MidnightX', 'Support'];
      case 'admin':
        return ['Administration', (route.section || 'Overview').replace(/^\w/, (c) => c.toUpperCase())];
    }
  }, [route, activeServer]);

  const NavRow = ({
    label,
    icon: Icon,
    active,
    count,
    onClick,
  }: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    count?: number | string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer whitespace-nowrap ${
        active
          ? 'mx-nav-active text-[#171717] dark:text-white'
          : 'text-[#525252] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-zinc-100 hover:bg-black/[0.045] dark:hover:bg-white/[0.045]'
      }`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${
            active
              ? 'text-[#8B5CF6]'
              : 'text-[#6E6E6E] dark:text-zinc-500 group-hover:text-[#171717] dark:group-hover:text-zinc-200'
          }`}
        />
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined && (
        <span
          className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded-full ${
            active
              ? 'mx-well-3d text-[#171717] dark:text-zinc-100'
              : 'bg-black/[0.045] dark:bg-white/[0.05] text-[#777777] dark:text-zinc-500'
          }`}
        >
          {count}
        </span>
      )}
      {active && (
        <span
          className="hidden sm:block absolute -right-2.5 top-1/2 -translate-y-1/2 w-[4px] h-5 rounded-full bg-gradient-to-b from-[#A78BFA] to-[#7C3AED] shadow-[0_2px_6px_rgba(139,92,246,0.55)]"
          aria-hidden="true"
        />
      )}
    </button>
  );

  const userDisplayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.username
    : 'Pterodactyl Account';

  const drawerContent = (
    <div className="flex flex-col h-full select-none">
      {/* Subtle Desktop Window Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-[#CFA09A] dark:bg-zinc-700 shadow-inner" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#D7C497] dark:bg-zinc-700 shadow-inner" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#9CC0A7] dark:bg-zinc-700 shadow-inner" />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            title="Collapse Navigation Drawer"
            className="mx-btn-3d hidden lg:inline-flex p-1.5 rounded-lg cursor-pointer"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
            className="mx-btn-3d md:hidden p-1.5 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* User Profile Block */}
      <div className="relative px-4 pt-2 pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <button
          type="button"
          onClick={() => setAccountMenuOpen((o) => !o)}
          className="w-full flex items-center gap-3 text-left group cursor-pointer rounded-xl p-1.5 -m-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#171717] dark:ring-white/25 bg-[#242424] shrink-0 flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.28)]">
            <img
              src="/src/assets/images/avatar_midnightx_user_1795748243919.jpg"
              alt={userDisplayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[13px] font-semibold text-[#171717] dark:text-zinc-100 truncate">
              <span className="truncate">{userDisplayName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#777777] shrink-0" />
            </div>
            <div className="text-[11px] text-[#777777] dark:text-zinc-400 truncate">
              {user?.email || 'Panel session disconnected'}
            </div>
          </div>
        </button>

        {accountMenuOpen && (
          <div className="mt-2.5 p-1.5 rounded-xl mx-card-3d space-y-1">
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                navigate({ page: 'account' });
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#171717] dark:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-[#8B5CF6]" />
              Account & 2FA
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                navigate({ page: 'admin', section: 'overview' });
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#171717] dark:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-[#06B6D4]" />
              Administration
            </button>
          </div>
        )}
      </div>

      {/* Scrollable Navigation Sections + Explorer Tree */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-5">
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-medium text-[#777777] dark:text-zinc-500">
            Workspace
          </div>
          <div className="space-y-1">
            <NavRow
              label="Dashboard"
              icon={Home}
              active={route.page === 'dashboard'}
              count={onlineCount}
              onClick={() => navigate({ page: 'dashboard' })}
            />
            <NavRow
              label="Servers"
              icon={Server}
              active={route.page === 'servers'}
              count={servers.length}
              onClick={() => navigate({ page: 'servers' })}
            />
            <NavRow
              label="Console"
              icon={TerminalSquare}
              active={route.page === 'server-console'}
              onClick={() =>
                targetServerId
                  ? navigate({ page: 'server-console', serverId: targetServerId })
                  : navigate({ page: 'servers' })
              }
            />
            <NavRow
              label="File Manager"
              icon={FolderOpen}
              active={route.page === 'server-files'}
              onClick={() =>
                targetServerId
                  ? navigate({ page: 'server-files', serverId: targetServerId })
                  : navigate({ page: 'servers' })
              }
            />
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="px-2 mb-1.5 text-[11px] font-medium text-[#777777] dark:text-zinc-500">
            Resources
          </div>
          <div className="space-y-1">
            <NavRow
              label="Backups"
              icon={Archive}
              active={route.page === 'server-backups'}
              onClick={() =>
                targetServerId
                  ? navigate({ page: 'server-backups', serverId: targetServerId })
                  : navigate({ page: 'servers' })
              }
            />
            <NavRow
              label="Databases"
              icon={Database}
              active={route.page === 'server-databases'}
              onClick={() =>
                targetServerId
                  ? navigate({ page: 'server-databases', serverId: targetServerId })
                  : navigate({ page: 'servers' })
              }
            />
            <NavRow
              label="Network"
              icon={Network}
              active={route.page === 'server-network'}
              onClick={() =>
                targetServerId
                  ? navigate({ page: 'server-network', serverId: targetServerId })
                  : navigate({ page: 'servers' })
              }
            />
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="px-2 mb-1.5 text-[11px] font-medium text-[#777777] dark:text-zinc-500">
            Platform
          </div>
          <div className="space-y-1">
            <NavRow
              label="Billing"
              icon={CreditCard}
              active={route.page === 'billing'}
              onClick={() => navigate({ page: 'billing' })}
            />
            <NavRow
              label="Support"
              icon={LifeBuoy}
              active={route.page === 'support'}
              onClick={() => navigate({ page: 'support' })}
            />
            <NavRow
              label="Settings"
              icon={Settings}
              active={route.page === 'account'}
              onClick={() => navigate({ page: 'account' })}
            />
            {(!user || user.role === 'admin') && (
              <NavRow
                label="Admin Panel"
                icon={Shield}
                active={route.page === 'admin'}
                onClick={() => navigate({ page: 'admin', section: 'overview' })}
              />
            )}
          </div>
        </div>

        {/* Bottom Explorer Tree */}
        <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[11px] font-medium text-[#777777] dark:text-zinc-500">
              Server Explorer
            </span>
            <button
              type="button"
              onClick={() => navigate({ page: 'admin', section: 'servers' })}
              title="Manage Servers"
              className="mx-btn-3d w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 text-[#777777] dark:text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              placeholder="Search servers"
              className="mx-input-3d w-full pl-8 pr-3 py-1.5 text-xs rounded-xl text-[#171717] dark:text-zinc-100 placeholder:text-[#777777] dark:placeholder:text-zinc-500"
            />
          </div>

          <div className="mx-well-3d rounded-xl p-2 space-y-1">
            {servers.length === 0 ? (
              <div className="py-3 px-2 text-[11px] text-[#777777] dark:text-zinc-500 text-center">
                No connected servers
              </div>
            ) : (
              Object.entries(groupedTree).map(([groupName, items]) => {
                const isExpanded = expandedGroups[groupName] ?? true;
                return (
                  <div key={groupName}>
                    <button
                      type="button"
                      onClick={() => setExpandedGroups((prev) => ({ ...prev, [groupName]: !isExpanded }))}
                      className="w-full flex items-center justify-between px-1.5 py-1 rounded-md text-xs font-medium text-[#3B3B3B] dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-[#777777] shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-[#777777] shrink-0" />
                        )}
                        <Folder className="w-3.5 h-3.5 text-[#777777] shrink-0" />
                        <span className="truncate">{groupName}</span>
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-[#777777] dark:text-zinc-500">
                        {items.length}
                      </span>
                    </button>

                    {isExpanded && items.length > 0 && (
                      <div className="ml-3 pl-2.5 border-l border-black/[0.1] dark:border-white/[0.1] mt-0.5 space-y-0.5">
                        {items.map((srv) => {
                          const isSelected = activeServer?.id === srv.id && route.page.startsWith('server-');
                          return (
                            <button
                              key={srv.id}
                              type="button"
                              onClick={() => navigate({ page: 'server-console', serverId: srv.id })}
                              className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'mx-nav-active text-[#171717] dark:text-white font-medium'
                                  : 'text-[#5C5C5C] dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-[#171717] dark:hover:text-zinc-200'
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    srv.status === 'running'
                                      ? 'bg-emerald-500'
                                      : srv.status === 'starting'
                                        ? 'bg-cyan-500'
                                        : 'bg-zinc-400'
                                  }`}
                                />
                                <span className="truncate">{srv.name}</span>
                              </span>
                              <span className="font-mono text-[10px] tabular-nums text-[#777777] dark:text-zinc-500 shrink-0">
                                :{srv.allocations[0]?.port || '—'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#E8E8E8] dark:bg-[#101014] text-[#171717] dark:text-zinc-100 p-2 sm:p-3.5 lg:p-4 flex gap-3 overflow-x-hidden transition-colors duration-200">
      {/* LEFT NARROW VERTICAL 3D ICON RAIL */}
      <aside
        aria-label="Primary icon rail"
        className="hidden md:flex flex-col items-center justify-between w-[66px] shrink-0 rounded-[24px] mx-shell-3d p-1.5 h-[calc(100vh-1.75rem)] lg:h-[calc(100vh-2rem)] sticky top-3.5 lg:top-4"
      >
        {/* Top Dark Vertical 3D Track */}
        <div className="w-full rounded-[18px] mx-rail-track py-2.5 px-1.5 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate({ page: 'dashboard' })}
            title="MidnightX Dashboard"
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/[0.08] active:translate-y-[1px] transition-all cursor-pointer mb-1"
          >
            <MidnightStarLogo />
          </button>

          {railItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="relative group w-full flex justify-center">
                <button
                  type="button"
                  onClick={item.onClick}
                  aria-label={item.label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer active:translate-y-[1px] ${
                    item.isActive
                      ? 'mx-rail-active text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </button>
                <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-14 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#171717] dark:bg-[#24242B] text-white text-xs font-medium whitespace-nowrap shadow-xl border border-white/15">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Engraved Vertical Label */}
        <div className="hidden xl:flex items-center justify-center py-2 overflow-hidden">
          <span
            className="text-[9px] font-semibold tracking-[0.26em] text-[#848484] dark:text-zinc-600 uppercase whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            MIDNIGHTX NAV
          </span>
        </div>

        {/* Bottom Detached 3D Control Module */}
        <div className="w-full rounded-[18px] mx-rail-track p-1.5 flex flex-col items-center gap-1.5">
          {(!user || user.role === 'admin') && (
            <div className="relative group w-full flex justify-center">
              <button
                type="button"
                onClick={() => navigate({ page: 'admin', section: 'overview' })}
                aria-label="Admin Panel"
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:translate-y-[1px] cursor-pointer ${
                  route.page === 'admin'
                    ? 'mx-rail-active text-[#06B6D4]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                <Shield className="w-[18px] h-[18px]" />
              </button>
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-14 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#171717] dark:bg-[#24242B] text-white text-xs font-medium whitespace-nowrap shadow-xl border border-white/15">
                Admin Panel
              </span>
            </div>
          )}

          <div className="relative group w-full flex justify-center">
            <button
              type="button"
              onClick={() => navigate({ page: 'account' })}
              aria-label="Profile & Settings"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:translate-y-[1px] cursor-pointer ${
                route.page === 'account'
                  ? 'mx-rail-active text-[#8B5CF6]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>
            <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-14 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#171717] dark:bg-[#24242B] text-white text-xs font-medium whitespace-nowrap shadow-xl border border-white/15">
              Account Settings
            </span>
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-[280px] max-w-[84vw] h-full mx-shell-3d z-10">
            {drawerContent}
          </div>
        </div>
      )}

      {/* MAIN 3D DESKTOP APPLICATION WINDOW */}
      <div className="flex-1 min-w-0 flex rounded-[26px] mx-shell-3d min-h-[calc(100vh-1rem)] sm:min-h-[calc(100vh-1.75rem)] lg:min-h-[calc(100vh-2rem)]">
        {!sidebarCollapsed && (
          <aside className="hidden md:flex flex-col w-[248px] lg:w-[264px] shrink-0 border-r border-black/[0.06] dark:border-white/[0.06]">
            {drawerContent}
          </aside>
        )}

        {/* MAIN CONTENT VIEWPORT */}
        <div className="flex-1 min-w-0 flex flex-col mx-viewport-3d m-1.5 sm:m-2 rounded-[20px] overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/40 dark:bg-black/15">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                className="mx-btn-3d md:hidden p-2 -ml-1 rounded-lg cursor-pointer"
              >
                <Menu className="w-4 h-4" />
              </button>

              {sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  title="Expand Navigation Drawer"
                  className="mx-btn-3d hidden md:inline-flex p-1.5 rounded-lg cursor-pointer"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}

              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-[13px] min-w-0">
                {breadcrumb.map((part, idx) => {
                  const isLast = idx === breadcrumb.length - 1;
                  return (
                    <React.Fragment key={`${part}-${idx}`}>
                      {idx > 0 && <span className="text-[#999999] dark:text-zinc-600">/</span>}
                      <span
                        className={`truncate ${
                          isLast
                            ? 'font-semibold text-[#171717] dark:text-zinc-100'
                            : 'text-[#777777] dark:text-zinc-400'
                        }`}
                      >
                        {part}
                      </span>
                    </React.Fragment>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {route.page.startsWith('server-') && activeServer && (
                <div className="hidden sm:flex items-center gap-3">
                  <StatusText status={activeServer.status} />
                  <select
                    aria-label="Switch active server"
                    value={activeServer.id}
                    onChange={(e) => {
                      navigate({ page: route.page as any, serverId: e.target.value } as MainRoute);
                    }}
                    className="mx-input-3d text-xs font-medium px-2.5 py-1.5 rounded-xl cursor-pointer max-w-[180px]"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id} className="bg-white dark:bg-[#19191F]">
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate({ page: 'servers' })}
                className="mx-btn-3d-dark dark:hidden px-3.5 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
              >
                All Servers
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'servers' })}
                className="mx-btn-3d-primary hidden dark:inline-flex px-3.5 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
              >
                All Servers
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
            <div className="max-w-[1360px] mx-auto">{children}</div>
          </main>
        </div>
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl mx-rail-track text-white shadow-2xl"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      toast.type === 'error'
                        ? 'bg-rose-400'
                        : toast.type === 'success'
                          ? 'bg-emerald-400'
                          : 'bg-[#06B6D4]'
                    }`}
                  />
                  <span>{toast.title}</span>
                </div>
                {toast.description && (
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
