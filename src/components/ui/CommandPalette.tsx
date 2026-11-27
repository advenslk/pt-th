import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Award,
  Bell,
  CalendarClock,
  Command,
  CreditCard,
  Database,
  FolderOpen,
  History,
  Home,
  LifeBuoy,
  MessageSquare,
  MonitorCog,
  Network,
  PanelLeft,
  Play,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  SlidersHorizontal,
  Star,
  SunMoon,
  TerminalSquare,
  Users,
  X,
} from 'lucide-react';
import { usePanel, type MainRoute } from '../../context/PanelContext';
import { getRouteMetadata } from '../../utils/userPreferences';

interface PaletteItem {
  id: string;
  group: 'Favorites' | 'Recent' | 'Pages' | 'Servers' | 'Actions';
  label: string;
  subtitle: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    navigate,
    route,
    servers,
    activeServer,
    user,
    favoritePages,
    toggleFavoritePage,
    recentPages,
    theme,
    setThemeMode,
    toggleTheme,
    setSidebarCollapsed,
    refreshData,
    notify,
  } = usePanel();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      } else if (e.key === 'Escape' && commandPaletteOpen) {
        e.preventDefault();
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [commandPaletteOpen]);

  const currentMeta = useMemo(
    () => getRouteMetadata(route, activeServer?.name),
    [route, activeServer?.name]
  );
  const isCurrentPinned = favoritePages.some((p) => p.id === currentMeta.id);

  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];
    const go = (next: MainRoute) => {
      navigate(next);
      setCommandPaletteOpen(false);
    };

    favoritePages.forEach((fav) => {
      items.push({
        id: `fav:${fav.id}`,
        group: 'Favorites',
        label: fav.label,
        subtitle: 'Pinned favorite page',
        keywords: `favorite pinned ${fav.label}`,
        icon: Star,
        onSelect: () => go(fav.route),
      });
    });

    recentPages.slice(0, 4).forEach((rec) => {
      if (favoritePages.some((f) => f.id === rec.id)) return;
      items.push({
        id: `rec:${rec.id}`,
        group: 'Recent',
        label: rec.label,
        subtitle: 'Recently visited page',
        keywords: `recent history ${rec.label}`,
        icon: History,
        onSelect: () => go(rec.route),
      });
    });

    items.push(
      {
        id: 'page:dashboard',
        group: 'Pages',
        label: 'Dashboard',
        subtitle: 'Overview, telemetry & quick launch',
        keywords: 'home overview telemetry dashboard',
        icon: Home,
        onSelect: () => go({ page: 'dashboard' }),
      },
      {
        id: 'page:servers',
        group: 'Pages',
        label: 'All Servers',
        subtitle: `Browse ${servers.length} assigned server(s)`,
        keywords: 'servers instances list fleet',
        icon: Server,
        onSelect: () => go({ page: 'servers' }),
      },
      {
        id: 'page:account',
        group: 'Pages',
        label: 'Account & Security',
        subtitle: '2FA, API keys, SSH keys, accessibility & audit logs',
        keywords: 'account profile security password 2fa ssh api keys export',
        icon: Settings,
        onSelect: () => go({ page: 'account' }),
      },
      {
        id: 'page:billing',
        group: 'Pages',
        label: 'Billing & Hosting',
        subtitle: 'Invoices, plans & balance',
        keywords: 'billing wallet invoices plans payment',
        icon: CreditCard,
        onSelect: () => go({ page: 'billing' }),
      },
      {
        id: 'page:support',
        group: 'Pages',
        label: 'Support Tickets',
        subtitle: 'Helpdesk, attachments & Knowledge Base',
        keywords: 'support help tickets kb knowledge base',
        icon: LifeBuoy,
        onSelect: () => go({ page: 'support' }),
      },
      {
        id: 'page:rewards',
        group: 'Pages',
        label: 'Rewards & VIP',
        subtitle: 'Daily streaks, XP leaderboard, badges & reward shop',
        keywords: 'rewards loyalty vip xp badges shop leaderboard referral',
        icon: Award,
        onSelect: () => go({ page: 'rewards' }),
      },
      {
        id: 'page:community',
        group: 'Pages',
        label: 'Community Forum',
        subtitle: 'Discussions, tutorials, reactions & trending hashtags',
        keywords: 'community forum posts comments hashtags follow',
        icon: MessageSquare,
        onSelect: () => go({ page: 'community' }),
      },
      {
        id: 'page:updates',
        group: 'Pages',
        label: 'Updates, Status & Notifications',
        subtitle: 'Announcements, service incidents & alert channels',
        keywords: 'updates announcements status incidents notifications webhook discord telegram',
        icon: Bell,
        onSelect: () => go({ page: 'updates' }),
      }
    );

    if (!user || user.role === 'admin') {
      items.push({
        id: 'page:admin',
        group: 'Pages',
        label: 'Admin Panel',
        subtitle: 'Open Pterodactyl Administration (/admin)',
        keywords: 'admin nodes locations users nests eggs',
        icon: Shield,
        onSelect: () => {
          setCommandPaletteOpen(false);
          window.open('/admin', '_blank', 'noopener,noreferrer');
        },
      });
    }

    servers.forEach((srv) => {
      const addr = `${srv.allocations[0]?.ip || ''}:${srv.allocations[0]?.port || ''}`;
      items.push({
        id: `srv:console:${srv.id}`,
        group: 'Servers',
        label: `${srv.name} · Console`,
        subtitle: `${srv.egg} · ${srv.node} ${addr ? `(${addr})` : ''}`,
        keywords: `${srv.name} ${srv.identifier} ${srv.egg} ${srv.node} console terminal`,
        icon: TerminalSquare,
        onSelect: () => go({ page: 'server-console', serverId: srv.id }),
      });

      const subRoutes: Array<{
        page: MainRoute['page'];
        title: string;
        icon: React.ComponentType<{ className?: string }>;
      }> = [
        { page: 'server-files', title: 'File Manager', icon: FolderOpen },
        { page: 'server-backups', title: 'Backups', icon: Archive },
        { page: 'server-databases', title: 'Databases', icon: Database },
        { page: 'server-network', title: 'Network', icon: Network },
        { page: 'server-schedules', title: 'Schedules', icon: CalendarClock },
        { page: 'server-users', title: 'Sub-Users', icon: Users },
        { page: 'server-startup', title: 'Startup', icon: Play },
        { page: 'server-settings', title: 'Settings', icon: SlidersHorizontal },
      ];

      subRoutes.forEach((sub) => {
        items.push({
          id: `${sub.page}:${srv.id}`,
          group: 'Servers',
          label: `${srv.name} · ${sub.title}`,
          subtitle: `Manage ${sub.title.toLowerCase()} for ${srv.identifier}`,
          keywords: `${srv.name} ${srv.identifier} ${sub.title.toLowerCase()}`,
          icon: sub.icon,
          onSelect: () => go({ page: sub.page, serverId: srv.id } as MainRoute),
        });
      });
    });

    items.push(
      {
        id: 'act:pin',
        group: 'Actions',
        label: isCurrentPinned ? `Unpin "${currentMeta.label}"` : `Pin "${currentMeta.label}" to Favorites`,
        subtitle: 'Save quick shortcut on your dashboard',
        keywords: 'pin favorite star bookmark shortcut',
        icon: Star,
        onSelect: () => {
          toggleFavoritePage(route, currentMeta.label);
          notify(
            isCurrentPinned ? 'Removed from favorite pages' : 'Pinned to favorite pages',
            currentMeta.label,
            'success'
          );
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'act:theme-toggle',
        group: 'Actions',
        label: `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`,
        subtitle: 'Toggle HelzerX appearance',
        keywords: 'theme dark light appearance mode',
        icon: SunMoon,
        onSelect: () => {
          toggleTheme();
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'act:theme-auto',
        group: 'Actions',
        label: 'Use System Auto Theme',
        subtitle: 'Sync light/dark mode automatically with OS preference',
        keywords: 'auto system theme dark light',
        icon: MonitorCog,
        onSelect: () => {
          setThemeMode('auto');
          notify('Auto theme enabled', 'Synced with system appearance.', 'info');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'act:sidebar',
        group: 'Actions',
        label: 'Toggle Navigation Sidebar',
        subtitle: 'Expand or collapse the desktop rail',
        keywords: 'sidebar menu toggle drawer',
        icon: PanelLeft,
        onSelect: () => {
          setSidebarCollapsed((c) => !c);
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'act:refresh',
        group: 'Actions',
        label: 'Refresh Live Panel Data',
        subtitle: 'Re-fetch servers, telemetry & account activity',
        keywords: 'refresh reload sync telemetry',
        icon: RefreshCw,
        onSelect: () => {
          refreshData();
          notify('Panel data refreshed', undefined, 'info');
          setCommandPaletteOpen(false);
        },
      }
    );

    return items;
  }, [
    favoritePages,
    recentPages,
    servers,
    user,
    isCurrentPinned,
    currentMeta.label,
    theme,
    route,
    navigate,
    setCommandPaletteOpen,
    toggleFavoritePage,
    notify,
    toggleTheme,
    setThemeMode,
    setSidebarCollapsed,
    refreshData,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Keep default list compact & focused: Favorites, Recent, Pages, first 5 servers, Actions
      const core = allItems.filter(
        (item) => item.group !== 'Servers' || item.id.startsWith('srv:console:')
      );
      return core.slice(0, 18);
    }
    const tokens = q.split(/\s+/);
    return allItems
      .filter((item) => {
        const hay = `${item.label} ${item.subtitle} ${item.keywords}`.toLowerCase();
        return tokens.every((tk) => hay.includes(tk));
      })
      .slice(0, 24);
  }, [allItems, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!commandPaletteOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
      );
    } else if (e.key === 'Enter' && filteredItems[activeIndex]) {
      e.preventDefault();
      filteredItems[activeIndex].onSelect();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-3 sm:px-6 bg-black/50 backdrop-blur-xs"
      onClick={() => setCommandPaletteOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Quick command palette"
    >
      <div
        className="w-full max-w-xl mx-card-3d rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <Search className="w-4 h-4 text-[#8B5CF6] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to servers, console, files, settings, or actions..."
            className="flex-1 bg-transparent text-sm text-[#171717] dark:text-zinc-100 placeholder:text-[#777777] dark:placeholder:text-zinc-500 focus:outline-none"
          />
          <span className="hidden sm:inline-flex items-center gap-1 mx-well-3d px-2 py-0.5 rounded-lg text-[10px] font-mono text-[#777777] dark:text-zinc-400">
            ESC
          </span>
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(false)}
            aria-label="Close quick jump"
            className="mx-btn-3d p-1 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#777777] dark:text-zinc-400">
              No matching servers, pages, or commands for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.onSelect}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'mx-nav-active text-[#171717] dark:text-white'
                      : 'text-[#3B3B3B] dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="mx-well-3d w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                      <Icon
                        className={`w-4 h-4 ${
                          item.group === 'Favorites'
                            ? 'text-amber-500'
                            : isSelected
                              ? 'text-[#8B5CF6]'
                              : 'text-[#777777] dark:text-zinc-400'
                        }`}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold truncate">{item.label}</span>
                      <span className="block text-[11px] text-[#777777] dark:text-zinc-400 truncate">
                        {item.subtitle}
                      </span>
                    </span>
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/[0.045] dark:bg-white/[0.05] text-[#777777] dark:text-zinc-400 shrink-0">
                    {item.group}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] text-[#777777] dark:text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Command className="w-3 h-3" />
            Quick Navigation
          </span>
          <span>Use ↑ ↓ and Enter to open</span>
        </div>
      </div>
    </div>
  );
}
