import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { PanelApiError, panelApi, toggleLocalFavorite } from '../api/client';
import { helzerxApi } from '../api/helzerx';
import { getLanguageOption, translate, type TranslationKey } from '../i18n/translations';
import type { HelzerxBootstrapResponse } from '../types/helzerx';
import type { ActivityLogEntry, PowerSignal, PterodactylServer, UserProfile } from '../types/panel';
import {
  getRouteMetadata,
  loadAccessibilityPrefs,
  loadDashboardPrefs,
  loadFavoritePages,
  loadRecentPages,
  loadThemeMode,
  saveAccessibilityPrefs,
  saveDashboardPrefs,
  saveFavoritePages,
  saveRecentPages,
  saveThemeMode,
  type AccessibilityPrefs,
  type DashboardPrefs,
  type SavedPageRef,
  type ThemeMode,
} from '../utils/userPreferences';

export type MainRoute =
  | { page: 'dashboard' }
  | { page: 'servers' }
  | { page: 'server-console'; serverId: string }
  | { page: 'server-files'; serverId: string }
  | { page: 'server-backups'; serverId: string }
  | { page: 'server-databases'; serverId: string }
  | { page: 'server-network'; serverId: string }
  | { page: 'server-schedules'; serverId: string }
  | { page: 'server-users'; serverId: string }
  | { page: 'server-startup'; serverId: string }
  | { page: 'server-settings'; serverId: string }
  | { page: 'server-activity'; serverId: string }
  | { page: 'account' }
  | { page: 'billing' }
  | { page: 'support' }
  | { page: 'rewards' }
  | { page: 'community' }
  | { page: 'updates' }
  | { page: 'admin'; section?: string };

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'info' | 'success' | 'error';
}

interface PanelContextValue {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  language: string;
  setLanguage: (code: string) => void;
  t: (key: TranslationKey) => string;
  route: MainRoute;
  navigate: (next: MainRoute) => void;
  servers: PterodactylServer[];
  activeServer: PterodactylServer | null;
  user: UserProfile | null;
  activityLogs: ActivityLogEntry[];
  panelConnected: boolean;
  hasAdminApi: boolean;
  billingConfigured: boolean;
  loading: boolean;
  connectionError: string | null;
  refreshData: () => Promise<void>;
  sendPower: (serverId: string, signal: PowerSignal) => Promise<void>;
  toggleFavorite: (serverId: string) => void;
  toasts: ToastMessage[];
  notify: (title: string, description?: string, type?: 'info' | 'success' | 'error') => void;
  dismissToast: (id: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileNavOpen: boolean;
  setMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
  accessibilityPrefs: AccessibilityPrefs;
  setAccessibilityPrefs: React.Dispatch<React.SetStateAction<AccessibilityPrefs>>;
  dashboardPrefs: DashboardPrefs;
  setDashboardPrefs: React.Dispatch<React.SetStateAction<DashboardPrefs>>;
  favoritePages: SavedPageRef[];
  toggleFavoritePage: (route: MainRoute, label?: string) => void;
  recentPages: SavedPageRef[];
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  helzerxData: HelzerxBootstrapResponse | null;
  refreshHelzerx: () => Promise<void>;
  dismissedAnnouncements: string[];
  dismissAnnouncement: (id: string) => void;
}

const PanelContext = createContext<PanelContextValue | null>(null);

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // ignore audio errors
  }
}

function parsePathname(pathname: string): MainRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/dashboard') return { page: 'dashboard' };
  if (clean === '/servers') return { page: 'servers' };
  if (clean === '/account' || clean.startsWith('/account/')) return { page: 'account' };
  if (clean === '/billing') return { page: 'billing' };
  if (clean === '/support') return { page: 'support' };
  if (clean === '/rewards') return { page: 'rewards' };
  if (clean === '/community') return { page: 'community' };
  if (clean === '/updates') return { page: 'updates' };
  if (clean.startsWith('/admin')) {
    const parts = clean.split('/').filter(Boolean);
    return { page: 'admin', section: parts[1] || 'overview' };
  }
  const serverMatch = clean.match(/^\/server\/([^/]+)(?:\/([^/]+))?$/);
  if (serverMatch) {
    const serverId = decodeURIComponent(serverMatch[1]);
    const sub = serverMatch[2] || 'console';
    if (sub === 'files') return { page: 'server-files', serverId };
    if (sub === 'backups') return { page: 'server-backups', serverId };
    if (sub === 'databases') return { page: 'server-databases', serverId };
    if (sub === 'network') return { page: 'server-network', serverId };
    if (sub === 'schedules') return { page: 'server-schedules', serverId };
    if (sub === 'users') return { page: 'server-users', serverId };
    if (sub === 'startup') return { page: 'server-startup', serverId };
    if (sub === 'settings') return { page: 'server-settings', serverId };
    if (sub === 'activity') return { page: 'server-activity', serverId };
    return { page: 'server-console', serverId };
  }
  return { page: 'dashboard' };
}

function routeToPath(route: MainRoute): string {
  switch (route.page) {
    case 'dashboard':
      return '/';
    case 'servers':
      return '/servers';
    case 'server-console':
      return `/server/${encodeURIComponent(route.serverId)}/console`;
    case 'server-files':
      return `/server/${encodeURIComponent(route.serverId)}/files`;
    case 'server-backups':
      return `/server/${encodeURIComponent(route.serverId)}/backups`;
    case 'server-databases':
      return `/server/${encodeURIComponent(route.serverId)}/databases`;
    case 'server-network':
      return `/server/${encodeURIComponent(route.serverId)}/network`;
    case 'server-schedules':
      return `/server/${encodeURIComponent(route.serverId)}/schedules`;
    case 'server-users':
      return `/server/${encodeURIComponent(route.serverId)}/users`;
    case 'server-startup':
      return `/server/${encodeURIComponent(route.serverId)}/startup`;
    case 'server-settings':
      return `/server/${encodeURIComponent(route.serverId)}/settings`;
    case 'server-activity':
      return `/server/${encodeURIComponent(route.serverId)}/activity`;
    case 'account':
      return '/account';
    case 'billing':
      return '/billing';
    case 'support':
      return '/support';
    case 'rewards':
      return '/rewards';
    case 'community':
      return '/community';
    case 'updates':
      return '/updates';
    case 'admin':
      return route.section && route.section !== 'overview' ? `/admin/${route.section}` : '/admin';
  }
}

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => loadThemeMode());
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  const theme: 'light' | 'dark' =
    themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : themeMode;

  const [language, setLanguageState] = useState<string>(() => {
    try {
      return localStorage.getItem('midnightx_language') || 'en';
    } catch {
      return 'en';
    }
  });

  const [route, setRoute] = useState<MainRoute>(() => parsePathname(window.location.pathname));
  const [servers, setServers] = useState<PterodactylServer[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [panelConnected, setPanelConnected] = useState(false);
  const [hasAdminApi, setHasAdminApi] = useState(false);
  const [billingConfigured, setBillingConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accessibilityPrefs, setAccessibilityPrefs] = useState<AccessibilityPrefs>(() => loadAccessibilityPrefs());
  const [dashboardPrefs, setDashboardPrefs] = useState<DashboardPrefs>(() => loadDashboardPrefs());
  const [favoritePages, setFavoritePages] = useState<SavedPageRef[]>(() => loadFavoritePages());
  const [recentPages, setRecentPages] = useState<SavedPageRef[]>(() => loadRecentPages());
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [helzerxData, setHelzerxData] = useState<HelzerxBootstrapResponse | null>(null);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('helzerx_dismissed_anns');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const prevUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('midnightx_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    saveThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    saveAccessibilityPrefs(accessibilityPrefs);
    const root = document.documentElement;
    if (accessibilityPrefs.fontScale === 'default') {
      root.removeAttribute('data-font-scale');
    } else {
      root.setAttribute('data-font-scale', accessibilityPrefs.fontScale);
    }
    if (accessibilityPrefs.reducedMotion) {
      root.setAttribute('data-reduced-motion', 'true');
    } else {
      root.removeAttribute('data-reduced-motion');
    }
    if (accessibilityPrefs.highContrast) {
      root.setAttribute('data-high-contrast', 'true');
    } else {
      root.removeAttribute('data-high-contrast');
    }
  }, [accessibilityPrefs]);

  useEffect(() => {
    saveDashboardPrefs(dashboardPrefs);
    const root = document.documentElement;
    if (!dashboardPrefs.bgPreset || dashboardPrefs.bgPreset === 'default') {
      root.removeAttribute('data-bg-preset');
    } else {
      root.setAttribute('data-bg-preset', dashboardPrefs.bgPreset);
    }
  }, [dashboardPrefs]);

  useEffect(() => {
    const opt = getLanguageOption(language);
    document.documentElement.lang = opt.code;
    document.documentElement.dir = opt.rtl ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('midnightx_language', opt.code);
    } catch {
      // ignore storage errors
    }
  }, [language]);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
  }, []);

  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);

  useEffect(() => {
    const onPopState = () => setRoute(parsePathname(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (title: string, description?: string, type: 'info' | 'success' | 'error' = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, type }]);
      setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast]
  );

  const navigate = useCallback(
    (next: MainRoute) => {
      const targetPath = routeToPath(next);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
      setRoute(next);
      setMobileNavOpen(false);
      const matchedSrv =
        'serverId' in next
          ? servers.find((s) => s.id === next.serverId || s.identifier === next.serverId)?.name
          : undefined;
      const meta = getRouteMetadata(next, matchedSrv);
      setRecentPages((prev) => {
        const updated: SavedPageRef[] = [
          { id: meta.id, label: meta.label, route: next, visitedAt: new Date().toISOString() },
          ...prev.filter((item) => item.id !== meta.id),
        ].slice(0, 8);
        saveRecentPages(updated);
        return updated;
      });
    },
    [servers]
  );

  const toggleFavoritePage = useCallback(
    (targetRoute: MainRoute, customLabel?: string) => {
      const matchedSrv =
        'serverId' in targetRoute
          ? servers.find((s) => s.id === targetRoute.serverId || s.identifier === targetRoute.serverId)?.name
          : undefined;
      const meta = getRouteMetadata(targetRoute, matchedSrv);
      setFavoritePages((prev) => {
        const exists = prev.some((p) => p.id === meta.id);
        const nextList = exists
          ? prev.filter((p) => p.id !== meta.id)
          : [{ id: meta.id, label: customLabel || meta.label, route: targetRoute }, ...prev].slice(0, 12);
        saveFavoritePages(nextList);
        return nextList;
      });
    },
    [servers]
  );

  const dismissAnnouncement = useCallback((id: string) => {
    setDismissedAnnouncements((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id].slice(-30);
      try {
        localStorage.setItem('helzerx_dismissed_anns', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
    helzerxApi.markAnnouncementRead(id).catch(() => {});
  }, []);

  const refreshHelzerx = useCallback(async () => {
    try {
      const data = await helzerxApi.getBootstrap();
      setHelzerxData(data);
      if (
        prevUnreadRef.current !== null &&
        data.unreadNotifications > prevUnreadRef.current
      ) {
        if (data.notificationPrefs?.soundEnabled) playNotificationChime();
        const latest = data.notifications[0];
        if (
          latest &&
          data.notificationPrefs?.browserEnabled &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          new Notification(latest.title, { body: latest.body });
        }
      }
      prevUnreadRef.current = data.unreadNotifications;
    } catch {
      // Keep UI responsive even if backend route is upgrading
    }
  }, []);

  const refreshData = useCallback(async () => {
    refreshHelzerx();
    try {
      const health = await panelApi.getHealth().catch(() => null);
      if (health) {
        setHasAdminApi(health.hasAdminApi);
        setBillingConfigured(health.billingConfigured);
      }

      const [serverList, account, activity] = await Promise.all([
        panelApi.getClientServers(),
        panelApi.getAccount(),
        panelApi.getAccountActivity().catch(() => []),
      ]);
      setServers(serverList);
      setUser(account);
      setActivityLogs(activity);
      setPanelConnected(true);
      setConnectionError(null);
    } catch (err: any) {
      setPanelConnected(false);
      setServers([]);
      setUser(null);
      setActivityLogs([]);
      if (err instanceof PanelApiError && (err.code === 'PTERODACTYL_NOT_CONFIGURED' || err.status === 503 || err.status === 401)) {
        setConnectionError(err.message);
      } else {
        setConnectionError(err?.message || 'Unable to authenticate with Pterodactyl Panel API.');
      }
    } finally {
      setLoading(false);
    }
  }, [refreshHelzerx]);

  useEffect(() => {
    refreshData();
    const timer = setInterval(refreshData, 10000);
    return () => clearInterval(timer);
  }, [refreshData]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      const resolved = prev === 'auto' ? (systemDark ? 'dark' : 'light') : prev;
      return resolved === 'light' ? 'dark' : 'light';
    });
  }, [systemDark]);

  const sendPower = useCallback(
    async (serverId: string, signal: PowerSignal) => {
      try {
        await panelApi.sendPowerSignal(serverId, signal);
        notify(`Power signal "${signal}" sent`, undefined, 'success');
        setTimeout(refreshData, 1200);
      } catch (err: any) {
        notify('Power action failed', err.message, 'error');
      }
    },
    [notify, refreshData]
  );

  const toggleFavorite = useCallback((serverId: string) => {
    const isFav = toggleLocalFavorite(serverId);
    setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, isFavorite: isFav } : s)));
  }, []);

  const activeServerId =
    route.page.startsWith('server-') && 'serverId' in route ? route.serverId : null;

  const activeServer = activeServerId
    ? servers.find((s) => s.id === activeServerId || s.identifier === activeServerId) || servers[0] || null
    : servers[0] || null;

  return (
    <PanelContext.Provider
      value={{
        theme,
        themeMode,
        setThemeMode,
        toggleTheme,
        language,
        setLanguage,
        t,
        route,
        navigate,
        servers,
        activeServer,
        user,
        activityLogs,
        panelConnected,
        hasAdminApi,
        billingConfigured,
        loading,
        connectionError,
        refreshData,
        sendPower,
        toggleFavorite,
        toasts,
        notify,
        dismissToast,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileNavOpen,
        setMobileNavOpen,
        accessibilityPrefs,
        setAccessibilityPrefs,
        dashboardPrefs,
        setDashboardPrefs,
        favoritePages,
        toggleFavoritePage,
        recentPages,
        commandPaletteOpen,
        setCommandPaletteOpen,
        helzerxData,
        refreshHelzerx,
        dismissedAnnouncements,
        dismissAnnouncement,
      }}
    >
      {children}
    </PanelContext.Provider>
  );
}

export function usePanel() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('usePanel must be used inside PanelProvider');
  return ctx;
}
