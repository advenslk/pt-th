import type { MainRoute } from '../context/PanelContext';
import type { ActivityLogEntry, ApiKeyEntry, PterodactylServer, SshKeyEntry, UserProfile } from '../types/panel';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type FontScale = 'compact' | 'default' | 'large';
export type DashboardWidgetId = 'stats' | 'telemetry' | 'servers' | 'security';

export interface AccessibilityPrefs {
  fontScale: FontScale;
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface DashboardPrefs {
  customGreeting: string;
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
  showQuickBar: boolean;
}

export interface SavedPageRef {
  id: string;
  label: string;
  route: MainRoute;
  visitedAt?: string;
}

const KEYS = {
  themeMode: 'midnightx_theme_mode',
  legacyTheme: 'midnightx_theme',
  a11y: 'midnightx_accessibility_prefs',
  dashboard: 'midnightx_dashboard_prefs',
  favorites: 'midnightx_favorite_pages',
  recent: 'midnightx_recent_pages',
};

export const DEFAULT_ACCESSIBILITY_PREFS: AccessibilityPrefs = {
  fontScale: 'default',
  reducedMotion: false,
  highContrast: false,
};

export const DEFAULT_DASHBOARD_PREFS: DashboardPrefs = {
  customGreeting: '',
  widgetOrder: ['stats', 'telemetry', 'servers', 'security'],
  hiddenWidgets: ['security'],
  showQuickBar: false,
};

export function loadThemeMode(): ThemeMode {
  try {
    const mode = localStorage.getItem(KEYS.themeMode);
    if (mode === 'light' || mode === 'dark' || mode === 'auto') return mode;
    const legacy = localStorage.getItem(KEYS.legacyTheme);
    return legacy === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEYS.themeMode, mode);
  } catch {
    // ignore storage errors
  }
}

export function loadAccessibilityPrefs(): AccessibilityPrefs {
  try {
    const raw = localStorage.getItem(KEYS.a11y);
    if (!raw) return DEFAULT_ACCESSIBILITY_PREFS;
    const parsed = JSON.parse(raw);
    return {
      fontScale: parsed.fontScale === 'compact' || parsed.fontScale === 'large' ? parsed.fontScale : 'default',
      reducedMotion: Boolean(parsed.reducedMotion),
      highContrast: Boolean(parsed.highContrast),
    };
  } catch {
    return DEFAULT_ACCESSIBILITY_PREFS;
  }
}

export function saveAccessibilityPrefs(prefs: AccessibilityPrefs) {
  try {
    localStorage.setItem(KEYS.a11y, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

export function loadDashboardPrefs(): DashboardPrefs {
  try {
    const raw = localStorage.getItem(KEYS.dashboard);
    if (!raw) return DEFAULT_DASHBOARD_PREFS;
    const parsed = JSON.parse(raw);
    const validIds: DashboardWidgetId[] = ['stats', 'telemetry', 'servers', 'security'];
    const order = Array.isArray(parsed.widgetOrder)
      ? (parsed.widgetOrder.filter((x: unknown): x is DashboardWidgetId =>
          validIds.includes(x as DashboardWidgetId)
        ) as DashboardWidgetId[])
      : DEFAULT_DASHBOARD_PREFS.widgetOrder;
    for (const id of validIds) {
      if (!order.includes(id)) order.push(id);
    }
    const hidden = Array.isArray(parsed.hiddenWidgets)
      ? parsed.hiddenWidgets.filter((x: unknown): x is DashboardWidgetId =>
          validIds.includes(x as DashboardWidgetId)
        )
      : DEFAULT_DASHBOARD_PREFS.hiddenWidgets;
    return {
      customGreeting: typeof parsed.customGreeting === 'string' ? parsed.customGreeting : '',
      widgetOrder: order,
      hiddenWidgets: hidden,
      showQuickBar: Boolean(parsed.showQuickBar),
    };
  } catch {
    return DEFAULT_DASHBOARD_PREFS;
  }
}

export function saveDashboardPrefs(prefs: DashboardPrefs) {
  try {
    localStorage.setItem(KEYS.dashboard, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

export function loadFavoritePages(): SavedPageRef[] {
  try {
    const raw = localStorage.getItem(KEYS.favorites);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavoritePages(list: SavedPageRef[]) {
  try {
    localStorage.setItem(KEYS.favorites, JSON.stringify(list.slice(0, 12)));
  } catch {
    // ignore storage errors
  }
}

export function loadRecentPages(): SavedPageRef[] {
  try {
    const raw = localStorage.getItem(KEYS.recent);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentPages(list: SavedPageRef[]) {
  try {
    localStorage.setItem(KEYS.recent, JSON.stringify(list.slice(0, 8)));
  } catch {
    // ignore storage errors
  }
}

export function getRouteMetadata(route: MainRoute, activeServerName?: string): { id: string; label: string } {
  switch (route.page) {
    case 'dashboard':
      return { id: 'dashboard', label: 'Dashboard' };
    case 'servers':
      return { id: 'servers', label: 'All Servers' };
    case 'account':
      return { id: 'account', label: 'Account & Security' };
    case 'billing':
      return { id: 'billing', label: 'Billing & Hosting' };
    case 'support':
      return { id: 'support', label: 'Support Tickets' };
    case 'admin':
      return { id: `admin:${route.section || 'overview'}`, label: `Admin (${route.section || 'overview'})` };
    default: {
      const serverLabel = activeServerName || ('serverId' in route ? route.serverId : 'Server');
      const sub = route.page.replace('server-', '');
      const capSub = sub.charAt(0).toUpperCase() + sub.slice(1);
      return {
        id: `${route.page}:${'serverId' in route ? route.serverId : ''}`,
        label: `${serverLabel} · ${capSub}`,
      };
    }
  }
}

export interface PasswordStrengthResult {
  score: number; // 0..4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  checks: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    number: boolean;
    symbol: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    length: password.length >= 10,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (checks.upper && checks.lower) score += 1;
  if (checks.number) score += 1;
  if (checks.symbol || password.length >= 14) score += 1;

  const labels: PasswordStrengthResult['label'][] = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return {
    score,
    label: password.length === 0 ? 'Very Weak' : labels[Math.min(4, score)],
    checks,
  };
}

export interface SecurityAssessment {
  score: number;
  grade: 'Strong' | 'Moderate' | 'At Risk';
  recommendations: Array<{
    id: string;
    title: string;
    detail: string;
    completed: boolean;
  }>;
}

export function computeSecurityScore(
  user: UserProfile | null,
  apiKeys: ApiKeyEntry[],
  sshKeys: SshKeyEntry[]
): SecurityAssessment {
  const hasEmail = Boolean(user?.email);
  const has2FA = Boolean(user?.twoFactorEnabled);
  const hasSshKeys = sshKeys.length > 0;
  const unrestrictedKeys = apiKeys.filter((k) => !k.allowedIps || k.allowedIps.length === 0);
  const apiKeysScoped = apiKeys.length === 0 || unrestrictedKeys.length === 0;

  let score = 0;
  if (hasEmail) score += 20;
  if (has2FA) score += 45;
  if (hasSshKeys) score += 20;
  if (apiKeysScoped) score += 15;

  const grade: SecurityAssessment['grade'] =
    score >= 80 ? 'Strong' : score >= 50 ? 'Moderate' : 'At Risk';

  return {
    score,
    grade,
    recommendations: [
      {
        id: '2fa',
        title: 'Two-Factor Authentication (TOTP)',
        detail: has2FA
          ? 'Enabled on your Pterodactyl account.'
          : 'Enable authenticator 2FA to protect logins and API changes.',
        completed: has2FA,
      },
      {
        id: 'ssh',
        title: 'SSH Key Authentication for SFTP',
        detail: hasSshKeys
          ? `${sshKeys.length} SSH public key(s) configured.`
          : 'Add an Ed25519/RSA public key for passwordless SFTP access.',
        completed: hasSshKeys,
      },
      {
        id: 'api',
        title: 'IP-Restricted Client API Keys',
        detail: apiKeysScoped
          ? apiKeys.length === 0
            ? 'No exposed unrestricted API keys.'
            : 'All active Client API keys use IP allowlists.'
          : `${unrestrictedKeys.length} API key(s) have no IP allowlist restriction.`,
        completed: apiKeysScoped,
      },
    ],
  };
}

export function exportAccountDataJson(payload: {
  user: UserProfile | null;
  servers: PterodactylServer[];
  apiKeys: ApiKeyEntry[];
  sshKeys: SshKeyEntry[];
  activity: ActivityLogEntry[];
}) {
  const exportObj = {
    exportedAt: new Date().toISOString(),
    panel: 'MidnightX / Pterodactyl 1.15.2',
    account: payload.user
      ? {
          id: payload.user.id,
          uuid: payload.user.uuid,
          username: payload.user.username,
          email: payload.user.email,
          firstName: payload.user.firstName,
          lastName: payload.user.lastName,
          role: payload.user.role,
          twoFactorEnabled: payload.user.twoFactorEnabled,
          language: payload.user.language,
        }
      : null,
    servers: payload.servers.map((s) => ({
      identifier: s.identifier,
      name: s.name,
      node: s.node,
      egg: s.egg,
      status: s.status,
      limits: s.limits,
      featureLimits: s.featureLimits,
      allocations: s.allocations.map((a) => `${a.ip}:${a.port}`),
    })),
    apiKeys: payload.apiKeys.map((k) => ({
      identifier: k.identifier,
      description: k.description,
      allowedIps: k.allowedIps,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    })),
    sshKeys: payload.sshKeys.map((k) => ({
      name: k.name,
      fingerprint: k.fingerprint,
      createdAt: k.createdAt,
    })),
    recentActivity: payload.activity,
  };

  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pterodactyl-account-${payload.user?.username || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
