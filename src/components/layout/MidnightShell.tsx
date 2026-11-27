import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Archive,
  Award,
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Database,
  Folder,
  FolderOpen,
  Home,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  Network,
  Play,
  Plus,
  Search,
  Server,
  Settings,
  Shield,
  SlidersHorizontal,
  Star,
  Sun,
  TerminalSquare,
  User,
  Users,
  X,
} from 'lucide-react';
import { helzerxApi } from '../../api/helzerx';
import { panelApi } from '../../api/client';
import { usePanel, type MainRoute } from '../../context/PanelContext';
import { getRouteMetadata } from '../../utils/userPreferences';
import { CommandPalette } from '../ui/CommandPalette';
import { LanguageSelector } from '../ui/LanguageSelector';
import { StatusText } from '../ui/StatusText';
import defaultAvatar from '../../assets/images/avatar_midnightx_user_1795748243919.jpg';

function HelzerXLogo({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}assets/aistudio/IMG_20261011_201132-removebg-preview_9b5f47c8.png`}
      alt="HelzerX"
      className={`${className} object-contain brightness-0 invert select-none pointer-events-none`}
    />
  );
}

export function MidnightShell({ children }: { children: React.ReactNode }) {
  const {
    theme,
    toggleTheme,
    t,
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
    favoritePages,
    toggleFavoritePage,
    setCommandPaletteOpen,
    notify,
    helzerxData,
    refreshHelzerx,
    dismissedAnnouncements,
    dismissAnnouncement,
  } = usePanel();

  const [treeSearch, setTreeSearch] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Game Servers': true,
    Applications: true,
    Infrastructure: true,
  });

  const isManagingServer = route.page.startsWith('server-');
  const targetServerId =
    isManagingServer && 'serverId' in route
      ? route.serverId
      : activeServer?.id || servers[0]?.id || '';

  const onlineCount = servers.filter((s) => s.status === 'running').length;
  const currentPageMeta = useMemo(
    () => getRouteMetadata(route, activeServer?.name),
    [route, activeServer?.name]
  );
  const isCurrentPinned = favoritePages.some((p) => p.id === currentPageMeta.id);

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
        return ['HelzerX', 'Dashboard'];
      case 'servers':
        return ['HelzerX', 'Servers'];
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
      case 'server-schedules':
        return ['Servers', activeServer?.name || route.serverId, 'Schedules'];
      case 'server-users':
        return ['Servers', activeServer?.name || route.serverId, 'Sub-Users'];
      case 'server-startup':
        return ['Servers', activeServer?.name || route.serverId, 'Startup'];
      case 'server-settings':
        return ['Servers', activeServer?.name || route.serverId, 'Settings'];
      case 'server-activity':
        return ['Servers', activeServer?.name || route.serverId, 'Activity'];
      case 'account':
        return ['HelzerX', 'Account Security'];
      case 'billing':
        return ['HelzerX', 'Billing'];
      case 'support':
        return ['HelzerX', 'Support'];
      case 'rewards':
        return ['HelzerX', 'Rewards & VIP'];
      case 'community':
        return ['HelzerX', 'Community'];
      case 'updates':
        return ['HelzerX', 'Updates & Status'];
      case 'admin':
        return ['Administration', (route.section || 'Overview').replace(/^\w/, (c) => c.toUpperCase())];
    }
  }, [route, activeServer]);

  const bannerAnnouncements = useMemo(
    () =>
      (helzerxData?.activeAnnouncements || []).filter(
        (a) => a.displayMode === 'banner' && !dismissedAnnouncements.includes(a.id)
      ),
    [helzerxData?.activeAnnouncements, dismissedAnnouncements]
  );

  const popupAnnouncement = useMemo(
    () =>
      (helzerxData?.activeAnnouncements || []).find(
        (a) => a.displayMode === 'popup' && !dismissedAnnouncements.includes(a.id)
      ) || null,
    [helzerxData?.activeAnnouncements, dismissedAnnouncements]
  );

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
          className={`font-display font-semibold text-[11px] tabular-nums px-2 py-0.5 rounded-full ${
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
        <button
          type="button"
          onClick={() => navigate({ page: 'dashboard' })}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <span className="w-7 h-6 p-1 rounded-lg mx-rail-track text-white flex items-center justify-center shadow-sm">
            <HelzerXLogo />
          </span>
          <span className="font-display text-sm font-bold tracking-tight text-[#171717] dark:text-white">
            HelzerX
          </span>
        </button>
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
            onClick={() => setSidebarCollapsed(true)}
            title="Hide Sidebar"
            aria-label="Hide Sidebar"
            className="mx-btn-3d hidden md:inline-flex p-1.5 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
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
              src={defaultAvatar}
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
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen(false);
                  window.open('/admin', '_blank', 'noopener,noreferrer');
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#171717] dark:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-[#06B6D4]" />
                Administration
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                panelApi.logout().catch(() => {}).finally(() => {
                  window.location.href = '/auth/login';
                });
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('nav.logout')}
            </button>
          </div>
        )}
      </div>

      {/* Scrollable Navigation Sections + Explorer Tree */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-5">
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-medium text-[#777777] dark:text-zinc-500">
            {t('nav.workspace')}
          </div>
          <div className="space-y-1">
            <NavRow
              label={t('nav.dashboard')}
              icon={Home}
              active={route.page === 'dashboard'}
              count={onlineCount}
              onClick={() => navigate({ page: 'dashboard' })}
            />
            <NavRow
              label={t('nav.servers')}
              icon={Server}
              active={route.page === 'servers'}
              count={servers.length}
              onClick={() => navigate({ page: 'servers' })}
            />
            {isManagingServer && targetServerId && (
              <>
                <NavRow
                  label={t('nav.console')}
                  icon={TerminalSquare}
                  active={route.page === 'server-console'}
                  onClick={() => navigate({ page: 'server-console', serverId: targetServerId })}
                />
                <NavRow
                  label={t('nav.files')}
                  icon={FolderOpen}
                  active={route.page === 'server-files'}
                  onClick={() => navigate({ page: 'server-files', serverId: targetServerId })}
                />
              </>
            )}
          </div>
        </div>

        {isManagingServer && targetServerId && (
          <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <div className="px-2 mb-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-[#777777] dark:text-zinc-500">
              <span>{t('nav.resources')}</span>
              {activeServer && (
                <span className="truncate max-w-[120px] text-[10px] text-[#8B5CF6] dark:text-violet-400 font-semibold">
                  {activeServer.name}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <NavRow
                label={t('nav.backups')}
                icon={Archive}
                active={route.page === 'server-backups'}
                onClick={() => navigate({ page: 'server-backups', serverId: targetServerId })}
              />
              <NavRow
                label={t('nav.databases')}
                icon={Database}
                active={route.page === 'server-databases'}
                onClick={() => navigate({ page: 'server-databases', serverId: targetServerId })}
              />
              <NavRow
                label={t('nav.network')}
                icon={Network}
                active={route.page === 'server-network'}
                onClick={() => navigate({ page: 'server-network', serverId: targetServerId })}
              />
              <NavRow
                label={t('nav.schedules')}
                icon={CalendarClock}
                active={route.page === 'server-schedules'}
                onClick={() => navigate({ page: 'server-schedules', serverId: targetServerId })}
              />
              <NavRow
                label={t('nav.users')}
                icon={Users}
                active={route.page === 'server-users'}
                onClick={() => navigate({ page: 'server-users', serverId: targetServerId })}
              />
              <NavRow
                label={t('nav.startup')}
                icon={Play}
                active={route.page === 'server-startup'}
                onClick={() => navigate({ page: 'server-startup', serverId: targetServerId })}
              />
              <NavRow
                label={t('nav.serverSettings')}
                icon={SlidersHorizontal}
                active={route.page === 'server-settings'}
                onClick={() => navigate({ page: 'server-settings', serverId: targetServerId })}
              />
              <NavRow
                label={t('nav.activity')}
                icon={Activity}
                active={route.page === 'server-activity'}
                onClick={() => navigate({ page: 'server-activity', serverId: targetServerId })}
              />
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="px-2 mb-1.5 text-[11px] font-medium text-[#777777] dark:text-zinc-500">
            {t('nav.platform')}
          </div>
          <div className="space-y-1">
            <NavRow
              label={t('nav.billing')}
              icon={CreditCard}
              active={route.page === 'billing'}
              onClick={() => navigate({ page: 'billing' })}
            />
            <NavRow
              label={t('nav.support')}
              icon={LifeBuoy}
              active={route.page === 'support'}
              onClick={() => navigate({ page: 'support' })}
            />
            <NavRow
              label={t('nav.rewards')}
              icon={Award}
              active={route.page === 'rewards'}
              onClick={() => navigate({ page: 'rewards' })}
            />
            <NavRow
              label={t('nav.community')}
              icon={MessageSquare}
              active={route.page === 'community'}
              onClick={() => navigate({ page: 'community' })}
            />
            <NavRow
              label={t('nav.updates')}
              icon={Bell}
              active={route.page === 'updates'}
              count={helzerxData?.unreadNotifications ? helzerxData.unreadNotifications : undefined}
              onClick={() => navigate({ page: 'updates' })}
            />
            <NavRow
              label={t('nav.settings')}
              icon={Settings}
              active={route.page === 'account'}
              onClick={() => navigate({ page: 'account' })}
            />
            {user?.role === 'admin' && (
              <NavRow
                label={t('nav.adminPanel')}
                icon={Shield}
                active={route.page === 'admin'}
                onClick={() => window.open('/admin', '_blank', 'noopener,noreferrer')}
              />
            )}
          </div>
        </div>

        {/* Bottom Explorer Tree */}
        <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[11px] font-medium text-[#777777] dark:text-zinc-500">
              {t('nav.serverExplorer')}
            </span>
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => navigate({ page: 'admin', section: 'servers' })}
                title="Manage Servers"
                className="mx-btn-3d w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 text-[#777777] dark:text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              placeholder={t('nav.searchServers')}
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
                      <span className="font-display font-semibold text-[10px] tabular-nums text-[#777777] dark:text-zinc-500">
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
                              <span className="font-display font-medium text-[10px] tabular-nums text-[#777777] dark:text-zinc-500 shrink-0">
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
    <div className="mx-rgb-bg min-h-screen w-full text-[#171717] dark:text-zinc-100 p-2 sm:p-3.5 lg:p-4 flex overflow-x-hidden transition-colors duration-200">
      {/* Subtle Slow RGB Ambient Glow Layer */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
        <div
          className="mx-rgb-orb-a absolute -top-28 -left-24 w-[34rem] h-[34rem] rounded-full blur-[120px] bg-violet-500/20 dark:bg-[#7C3AED]/30"
        />
        <div
          className="mx-rgb-orb-b absolute -bottom-28 -right-24 w-[36rem] h-[36rem] rounded-full blur-[130px] bg-cyan-500/15 dark:bg-[#06B6D4]/22"
        />
        <div
          className="mx-rgb-orb-a absolute top-1/3 left-1/2 -translate-x-1/2 w-[30rem] h-[22rem] rounded-full blur-[140px] bg-slate-400/15 dark:bg-[#5B21B6]/22"
          style={{ animationDelay: '-11s' }}
        />
      </div>

      {/* MOBILE DRAWER OVERLAY */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.div
              initial={{ x: -290 }}
              animate={{ x: 0 }}
              exit={{ x: -290 }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="relative w-[280px] max-w-[84vw] h-full mx-shell-3d z-10"
            >
              {drawerContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAIN 3D DESKTOP APPLICATION WINDOW */}
      <div className="relative z-10 flex-1 min-w-0 flex rounded-[26px] mx-shell-3d min-h-[calc(100vh-1rem)] sm:min-h-[calc(100vh-1.75rem)] lg:min-h-[calc(100vh-2rem)] overflow-hidden">
        <aside
          aria-hidden={sidebarCollapsed}
          className={`hidden md:flex flex-col shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out ${
            sidebarCollapsed
              ? 'w-0 opacity-0 pointer-events-none border-r-0'
              : 'w-[252px] lg:w-[264px] opacity-100 border-r border-black/[0.06] dark:border-white/[0.06]'
          }`}
        >
          <div className="w-[252px] lg:w-[264px] h-full flex flex-col">
            {drawerContent}
          </div>
        </aside>

        {/* MAIN CONTENT VIEWPORT */}
        <div className="flex-1 min-w-0 flex flex-col mx-viewport-3d m-1.5 sm:m-2 rounded-[20px] overflow-hidden">
          <header className="relative z-30 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/40 dark:bg-black/15">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Unified 3-lines sidebar toggle (mobile + desktop) */}
              <button
                type="button"
                onClick={() => setMobileNavOpen((o) => !o)}
                aria-label="Toggle navigation menu"
                title="Open / Close Sidebar"
                className="mx-btn-3d md:hidden w-8 h-8 rounded-xl inline-flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Menu className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                aria-label={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
                aria-expanded={!sidebarCollapsed}
                title={sidebarCollapsed ? 'Open Sidebar' : 'Close Sidebar'}
                className="mx-btn-3d hidden md:inline-flex w-8 h-8 rounded-xl items-center justify-center shrink-0 cursor-pointer"
              >
                <Menu className="w-4 h-4" />
              </button>

              {sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => navigate({ page: 'dashboard' })}
                  className="hidden md:flex items-center gap-1.5 pr-1.5 cursor-pointer shrink-0"
                >
                  <span className="w-7 h-6 p-1 rounded-lg mx-rail-track text-white flex items-center justify-center shadow-sm">
                    <HelzerXLogo />
                  </span>
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
                onClick={() => setCommandPaletteOpen(true)}
                title="Quick Jump (Ctrl+K)"
                aria-label="Open Quick Navigation (Ctrl+K)"
                className="mx-btn-3d inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer shrink-0"
              >
                <Search className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span className="hidden lg:inline text-[11px] text-[#777777] dark:text-zinc-400 font-mono">
                  ⌘K
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleFavoritePage(route, currentPageMeta.label);
                  notify(
                    isCurrentPinned ? 'Removed from favorites' : 'Pinned to favorites',
                    currentPageMeta.label,
                    'success'
                  );
                }}
                title={isCurrentPinned ? 'Unpin Favorite Page' : 'Pin Page to Favorites'}
                aria-label={isCurrentPinned ? 'Unpin Favorite Page' : 'Pin Page to Favorites'}
                className="mx-btn-3d hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-xl cursor-pointer shrink-0"
              >
                <Star
                  className={`w-3.5 h-3.5 ${
                    isCurrentPinned
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-[#777777] dark:text-zinc-400'
                  }`}
                />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifMenuOpen((o) => !o)}
                  title="Notifications"
                  aria-label="Notifications"
                  className="mx-btn-3d relative inline-flex items-center justify-center w-8 h-8 rounded-xl cursor-pointer shrink-0"
                >
                  <Bell className="w-3.5 h-3.5 text-[#06B6D4]" />
                  {(helzerxData?.unreadNotifications || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#8B5CF6] text-white text-[10px] font-bold flex items-center justify-center">
                      {helzerxData!.unreadNotifications > 9 ? '9+' : helzerxData!.unreadNotifications}
                    </span>
                  )}
                </button>

                {notifMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[90vw] mx-card-3d rounded-2xl p-3 space-y-2.5 shadow-2xl z-50">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                      <span className="font-bold">Notifications</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await helzerxApi.readAllNotifications();
                            await refreshHelzerx();
                          }}
                          className="text-[11px] text-[#8B5CF6] hover:underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifMenuOpen(false);
                            navigate({ page: 'updates' });
                          }}
                          className="text-[11px] text-[#06B6D4] hover:underline cursor-pointer"
                        >
                          Open Hub
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {(helzerxData?.notifications || []).length === 0 ? (
                        <div className="py-4 text-center text-xs text-[#777777]">No notifications yet.</div>
                      ) : (
                        (helzerxData?.notifications || []).slice(0, 6).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={async () => {
                              setNotifMenuOpen(false);
                              if (!n.read) {
                                await helzerxApi.readNotification(n.id).catch(() => {});
                                refreshHelzerx();
                              }
                              navigate({ page: n.linkPage || 'updates' });
                            }}
                            className={`w-full text-left p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                              n.read ? 'opacity-70 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]' : 'mx-well-3d'
                            }`}
                          >
                            <div className="font-semibold truncate">{n.title}</div>
                            <div className="text-[11px] text-[#777777] dark:text-zinc-400 truncate">{n.body}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <LanguageSelector />

              <button
                type="button"
                onClick={() => navigate({ page: 'servers' })}
                className="mx-btn-3d-dark dark:hidden px-3.5 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('nav.allServers')}
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'servers' })}
                className="mx-btn-3d-primary hidden dark:inline-flex px-3.5 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('nav.allServers')}
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
            <div className="max-w-[1360px] mx-auto space-y-5">
              {bannerAnnouncements.length > 0 && (
                <div className="mx-card-3d px-4 py-3 rounded-2xl flex items-center justify-between gap-3 border border-[#8B5CF6]/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <Megaphone className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                    <div className="min-w-0 text-xs">
                      <span className="font-bold text-[#171717] dark:text-white mr-2">
                        {bannerAnnouncements[0].title}:
                      </span>
                      <span className="text-[#525252] dark:text-zinc-300">
                        {bannerAnnouncements[0].body}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'updates' })}
                      className="mx-btn-3d px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissAnnouncement(bannerAnnouncements[0].id)}
                      aria-label="Dismiss announcement"
                      className="mx-btn-3d p-1 rounded-lg cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              {children}
            </div>
          </main>
        </div>
      </div>

      {popupAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          onClick={() => dismissAnnouncement(popupAnnouncement.id)}
        >
          <div
            className="mx-card-3d w-full max-w-md p-6 rounded-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-[#8B5CF6]">
                <Megaphone className="w-4 h-4" />
                {popupAnnouncement.category} Announcement
              </span>
              <button
                type="button"
                onClick={() => dismissAnnouncement(popupAnnouncement.id)}
                className="mx-btn-3d p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h3 className="mx-heading-3d text-base font-bold">{popupAnnouncement.title}</h3>
            <p className="text-xs text-[#525252] dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {popupAnnouncement.body}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  dismissAnnouncement(popupAnnouncement.id);
                  navigate({ page: 'updates' });
                }}
                className="mx-btn-3d px-3.5 py-2 rounded-xl text-xs cursor-pointer"
              >
                Read Updates
              </button>
              <button
                type="button"
                onClick={() => dismissAnnouncement(popupAnnouncement.id)}
                className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

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
      <CommandPalette />
    </div>
  );
}
