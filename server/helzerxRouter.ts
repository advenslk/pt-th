import crypto from 'crypto';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { runServerAiAssistant } from './aiAssistant';
import type {
  AiAccountState,
  AiChatMessage,
  AiCreditPlan,
  AiPlanId,
  AiUsageLogEntry,
  AnnouncementEntry,
  BadgeDefinition,
  BillingConfig,
  CommunityPost,
  ExtendedProfile,
  GlobalServerLockState,
  HelzerxCoupon,
  HelzerxInvoice,
  HelzerxPlan,
  KnowledgeArticle,
  LeaderboardEntry,
  LoyaltyAccount,
  NotificationChannelPrefs,
  NotificationEntry,
  PaymentMethodEntry,
  PostReportEntry,
  RefundRequestEntry,
  RewardClaimHistory,
  RewardShopItem,
  SecurityEvent,
  SecurityPolicySettings,
  ServiceIncidentEntry,
  SupportAgentProfile,
  SupportResponseTemplate,
  SupportTicketFull,
  TrackedDevice,
  WalletTransaction,
} from '../src/types/helzerx';

interface HelzerxDatabase {
  profiles: Record<string, ExtendedProfile>;
  securityPolicies: Record<string, SecurityPolicySettings>;
  devices: Record<string, TrackedDevice[]>;
  securityEvents: SecurityEvent[];
  wallets: Record<string, number>;
  transactions: WalletTransaction[];
  invoices: HelzerxInvoice[];
  coupons: HelzerxCoupon[];
  couponRedemptions: Record<string, string[]>;
  paymentMethods: PaymentMethodEntry[];
  refunds: RefundRequestEntry[];
  billingConfig: BillingConfig;
  plans: HelzerxPlan[];
  loyalty: Record<string, LoyaltyAccount>;
  rewardClaims: RewardClaimHistory[];
  badgesCatalog: BadgeDefinition[];
  shopItems: RewardShopItem[];
  tickets: SupportTicketFull[];
  agents: SupportAgentProfile[];
  templates: SupportResponseTemplate[];
  knowledgeBase: KnowledgeArticle[];
  posts: CommunityPost[];
  reports: PostReportEntry[];
  announcements: AnnouncementEntry[];
  incidents: ServiceIncidentEntry[];
  notifications: NotificationEntry[];
  notificationPrefs: Record<string, NotificationChannelPrefs>;
  globalServerLock: GlobalServerLockState;
  aiAccounts: Record<string, AiAccountState>;
  aiUsageHistory: AiUsageLogEntry[];
  aiChatMessages: Record<string, AiChatMessage[]>;
}

const AI_MAX_MONTHLY_CREDITS = 1000;

const AI_CREDIT_PLANS: AiCreditPlan[] = [
  {
    id: 'free',
    name: 'Free Starter',
    audience: 'For trying server AI',
    creditPercent: 10,
    monthlyCredits: 100,
    priceMonthly: 0,
    maxToolStepsPerTurn: 4,
    description: '10% monthly AI credit capacity for quick Q&A, log reading, and light config checks.',
    capabilities: [
      '100 monthly AI credits (10% capacity)',
      'Up to 4 automated tool steps per request',
      'Inspect files, plugins, and server logs',
      'Single config edits & compatibility advice',
    ],
  },
  {
    id: 'starter',
    name: 'Builder 25%',
    audience: 'For solo server owners',
    creditPercent: 25,
    monthlyCredits: 250,
    priceMonthly: 3.99,
    maxToolStepsPerTurn: 6,
    description: '25% capacity for installing compatible plugins/mods and customizing plugin configs.',
    capabilities: [
      '250 monthly AI credits (25% capacity)',
      'Up to 6 automated tool steps per request',
      'Auto-install compatible Modrinth plugins & mods',
      'Plugin YAML, JSON & properties customization',
    ],
  },
  {
    id: 'pro',
    name: 'Creator 50%',
    audience: 'For growing SMP servers',
    creditPercent: 50,
    monthlyCredits: 500,
    priceMonthly: 7.99,
    maxToolStepsPerTurn: 8,
    description: '50% capacity for multi-plugin setup, permissions tuning, and log crash repair.',
    capabilities: [
      '500 monthly AI credits (50% capacity)',
      'Up to 8 automated tool steps per request',
      'Multi-plugin config & dependency chains',
      'Startup flags, TPS tuning & crash diagnosis',
    ],
    popular: true,
  },
  {
    id: 'studio',
    name: 'Studio 75%',
    audience: 'For active networks',
    creditPercent: 75,
    monthlyCredits: 750,
    priceMonthly: 14.99,
    maxToolStepsPerTurn: 10,
    description: '75% capacity for automated proxy/backend setup and full plugin suite configuration.',
    capabilities: [
      '750 monthly AI credits (75% capacity)',
      'Up to 10 automated tool steps per request',
      'Full plugin suite configuration & message styling',
      'Live console command automation & batch edits',
    ],
  },
  {
    id: 'enterprise',
    name: 'Full 100%',
    audience: 'For large hosting fleets',
    creditPercent: 100,
    monthlyCredits: 1000,
    priceMonthly: 24.99,
    maxToolStepsPerTurn: 12,
    description: 'Full 100% monthly AI capacity for unlimited multi-step plugin & mod management.',
    capabilities: [
      '1,000 monthly AI credits (100% capacity)',
      'Up to 12 automated tool steps per request',
      'Deep multi-file plugin & modpack customization',
      'Full lifecycle control across your servers',
    ],
  },
];

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'helzerx-db.json');

function uid(prefix = 'hx'): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateBackupCodes(): string[] {
  return Array.from({ length: 6 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-')
  );
}

function createInitialDb(): HelzerxDatabase {
  const now = nowIso();
  return {
    profiles: {},
    securityPolicies: {},
    devices: {},
    securityEvents: [],
    wallets: {},
    transactions: [],
    invoices: [],
    coupons: [
      {
        id: 'cpn_welcome10',
        code: 'WELCOME10',
        discountPercent: 10,
        creditBonus: 5,
        maxUses: 500,
        usedCount: 0,
        expiresAt: null,
        active: true,
        description: 'New member $5.00 wallet credit + 10% plan discount',
      },
      {
        id: 'cpn_helzer20',
        code: 'HELZER20',
        discountPercent: 20,
        creditBonus: 0,
        maxUses: 200,
        usedCount: 0,
        expiresAt: null,
        active: true,
        description: '20% promotional discount on hosting upgrades',
      },
    ],
    couponRedemptions: {},
    paymentMethods: [],
    refunds: [],
    billingConfig: {
      taxRatePercent: 0,
      currency: 'USD',
      enabledGateways: ['Stripe', 'PayPal', 'PayHere', 'Manual Bank Transfer'],
      manualPaymentInstructions:
        'Transfer to HelzerX Hosting Ltd, reference your username, and submit the transaction ID below for admin verification.',
    },
    plans: [
      {
        id: 'plan_starter',
        name: 'Starter Node',
        tagline: 'Ideal for small PaperMC or Discord bot instances',
        category: 'Game Servers',
        priceMonthly: 4.99,
        cpuLimit: 100,
        memoryMb: 2048,
        diskMb: 15360,
        backupsLimit: 2,
        databasesLimit: 1,
        egg: 'PaperMC',
      },
      {
        id: 'plan_pro',
        name: 'Ryzen Boost 4G',
        tagline: 'Balanced NVMe compute for active multiplayer communities',
        category: 'Game Servers',
        priceMonthly: 9.99,
        cpuLimit: 200,
        memoryMb: 4096,
        diskMb: 35840,
        backupsLimit: 5,
        databasesLimit: 3,
        egg: 'PaperMC / Fabric',
        popular: true,
      },
      {
        id: 'plan_app',
        name: 'Runtime Container',
        tagline: 'Dedicated Node.js, Python, or Go automation hosting',
        category: 'Applications',
        priceMonthly: 6.5,
        cpuLimit: 150,
        memoryMb: 2048,
        diskMb: 20480,
        backupsLimit: 3,
        databasesLimit: 2,
        egg: 'Node.js / Python',
      },
      {
        id: 'plan_proxy',
        name: 'Velocity Edge',
        tagline: 'Low-latency network routing with DDoS protection',
        category: 'Proxies',
        priceMonthly: 7.99,
        cpuLimit: 150,
        memoryMb: 2048,
        diskMb: 10240,
        backupsLimit: 3,
        databasesLimit: 1,
        egg: 'Velocity',
      },
    ],
    loyalty: {},
    rewardClaims: [],
    badgesCatalog: [
      {
        id: 'badge_pioneer',
        name: 'HelzerX Pioneer',
        description: 'Joined the HelzerX Control Panel platform',
        category: 'Loyalty',
        xpReward: 50,
        rarity: 'common',
      },
      {
        id: 'badge_streak_7',
        name: '7-Day Streak',
        description: 'Claimed daily check-in rewards 7 days in a row',
        category: 'Loyalty',
        xpReward: 150,
        rarity: 'rare',
      },
      {
        id: 'badge_guardian',
        name: 'Security Guardian',
        description: 'Configured recovery email and security questions',
        category: 'Security',
        xpReward: 100,
        rarity: 'rare',
      },
      {
        id: 'badge_community',
        name: 'Community Contributor',
        description: 'Published discussions or guides in the Community Forum',
        category: 'Community',
        xpReward: 120,
        rarity: 'epic',
      },
      {
        id: 'badge_patron',
        name: 'Cloud Patron',
        description: 'Completed a wallet top-up or plan purchase',
        category: 'Billing',
        xpReward: 200,
        rarity: 'legendary',
      },
    ],
    shopItems: [
      {
        id: 'shop_credit_2',
        name: '$2.00 Wallet Credit',
        description: 'Convert 200 Loyalty Points directly into spendable wallet balance.',
        costPoints: 200,
        type: 'wallet_credit',
        value: 2,
        stock: 999,
      },
      {
        id: 'shop_credit_5',
        name: '$5.00 Wallet Credit',
        description: 'Convert 450 Loyalty Points into $5.00 hosting wallet credit.',
        costPoints: 450,
        type: 'wallet_credit',
        value: 5,
        stock: 999,
      },
      {
        id: 'shop_vip_30',
        name: '30 Days VIP Membership',
        description: 'Unlock priority ticket routing, VIP badge, and 1.5x daily streak XP.',
        costPoints: 600,
        type: 'vip_days',
        value: 30,
        stock: 100,
      },
      {
        id: 'shop_xp_boost',
        name: '+300 Bonus XP Pack',
        description: 'Instant XP boost to advance your rank on the global leaderboard.',
        costPoints: 150,
        type: 'xp_boost',
        value: 300,
        stock: 999,
      },
    ],
    tickets: [],
    agents: [
      {
        id: 'agent_nethum',
        name: 'Nethum',
        role: 'Lead Infrastructure Engineer',
        department: 'Node Infrastructure',
        online: true,
        resolvedCount: 142,
        avgRating: 4.9,
      },
      {
        id: 'agent_kavindu',
        name: 'Kavindu',
        role: 'Senior Support Specialist',
        department: 'Technical Support',
        online: true,
        resolvedCount: 98,
        avgRating: 4.8,
      },
      {
        id: 'agent_billing',
        name: 'HelzerX Billing Desk',
        role: 'Accounts & Verification',
        department: 'Billing & Renewals',
        online: true,
        resolvedCount: 76,
        avgRating: 4.9,
      },
    ],
    templates: [
      {
        id: 'tpl_investigating',
        title: 'Investigating Node Diagnostics',
        department: 'Technical Support',
        body: 'Thanks for reaching out. Our engineering team is checking your Wings daemon logs and node allocation metrics right now and will update you shortly.',
      },
      {
        id: 'tpl_payment_verified',
        title: 'Manual Payment Approved',
        department: 'Billing & Renewals',
        body: 'We have verified your payment reference and credited your HelzerX wallet. Your updated receipt is now available under Billing > Invoices.',
      },
      {
        id: 'tpl_resolved',
        title: 'Issue Resolved Confirmation',
        department: 'Technical Support',
        body: 'Glad we could help get this sorted! Feel free to rate this ticket or reopen it anytime if anything else comes up.',
      },
    ],
    knowledgeBase: [
      {
        id: 'kb_sftp',
        title: 'Connecting via SFTP & SSH Keys',
        category: 'Getting Started',
        summary: 'How to connect FileZilla or WinSCP using your SSH public key and server SFTP port.',
        content:
          'Open Account Settings -> SSH Keys to add your Ed25519 public key. Then open your server Settings page to copy the SFTP host and port (default 2022) and sign in with your panel username.',
        helpfulCount: 18,
        views: 124,
        updatedAt: now,
      },
      {
        id: 'kb_2fa',
        title: 'Securing Your Account with 2FA & Backup Codes',
        category: 'Security',
        summary: 'Best practices for TOTP authenticator apps, backup recovery codes, and API IP allowlists.',
        content:
          'Enable Two-Factor Authentication under Account Settings. Always store your backup recovery codes offline and restrict every Client API key to specific trusted IP addresses.',
        helpfulCount: 25,
        views: 192,
        updatedAt: now,
      },
      {
        id: 'kb_eula',
        title: 'Fixing Minecraft EULA & Startup Flags',
        category: 'Troubleshooting',
        summary: 'Why Minecraft servers stop on first boot and how to accept /eula.txt in one click.',
        content:
          'PaperMC and Vanilla servers require eula=true inside /eula.txt before starting. HelzerX automatically detects the EULA prompt in your console and lets you accept and boot immediately.',
        helpfulCount: 31,
        views: 260,
        updatedAt: now,
      },
      {
        id: 'kb_wallet',
        title: 'Using Wallet Credits, Coupons & Invoices',
        category: 'Billing',
        summary: 'How to top up your HelzerX wallet, apply promo codes, and download receipts.',
        content:
          'Visit Billing -> Overview & Wallet to top up funds or redeem a coupon code like WELCOME10. All completed transactions automatically generate tax-itemized invoices you can print or export.',
        helpfulCount: 14,
        views: 95,
        updatedAt: now,
      },
    ],
    posts: [
      {
        id: 'post_welcome',
        userId: 'system',
        authorUsername: 'helzerx',
        authorDisplayName: 'HelzerX Team',
        authorAvatar: '',
        authorTier: 'VIP',
        category: 'General',
        title: 'Welcome to the HelzerX Community Hub',
        body: 'Share server setups, #optimization guides, plugin recommendations, and feature requests with fellow creators. Use #hashtags and @mentions in any discussion!',
        hashtags: ['helzerx', 'optimization'],
        mentions: [],
        pinned: true,
        likes: ['1'],
        dislikes: [],
        reactions: { '🚀': ['1'], '🔥': ['1'] },
        bookmarks: [],
        views: 42,
        createdAt: now,
        comments: [],
      },
    ],
    reports: [],
    announcements: [
      {
        id: 'ann_platform_launch',
        title: 'HelzerX Platform Hub Now Live',
        category: 'Release',
        priority: 'high',
        targetAudience: 'all',
        displayMode: 'banner',
        pinned: true,
        archived: false,
        publishAt: now,
        expiresAt: null,
        body: 'HelzerX now includes customizable dashboards, Wallet & Invoices, Rewards & Leaderboards, Support Attachments, Community Discussions, and real-time Notifications — with zero changes to server management speed.',
        author: 'HelzerX Team',
        readBy: [],
        reactions: { '🎉': [] },
        comments: [],
        createdAt: now,
      },
    ],
    incidents: [
      {
        id: 'inc_core',
        title: 'All Core Services Operational',
        component: 'Control Panel & Wings API',
        status: 'operational',
        message: 'Panel API, WebSocket console relays, billing bridge, and notification workers are healthy.',
        createdAt: now,
        resolvedAt: now,
      },
    ],
    notifications: [],
    notificationPrefs: {},
    globalServerLock: {
      locked: false,
      reason: '',
      lockedBy: '',
      lockedAt: null,
      stoppedCount: 0,
      stoppedIdentifiers: [],
    },
    aiAccounts: {},
    aiUsageHistory: [],
    aiChatMessages: {},
  };
}

let dbCache: HelzerxDatabase | null = null;

function loadDb(): HelzerxDatabase {
  if (dbCache) return dbCache;
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      const base = createInitialDb();
      dbCache = { ...base, ...parsed };
      return dbCache!;
    }
  } catch (err) {
    console.error('[HelzerX Store] Failed reading DB, initializing fresh:', err);
  }
  dbCache = createInitialDb();
  saveDb(dbCache);
  return dbCache;
}

function saveDb(db: HelzerxDatabase) {
  dbCache = db;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('[HelzerX Store] Failed writing DB:', err);
  }
}

interface ResolvedUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
}

const accountCache = new Map<string, { expiresAt: number; user: ResolvedUser }>();

async function resolveUser(req: Request): Promise<ResolvedUser> {
  const pteroUrl = (process.env.PTERODACTYL_URL || '').replace(/\/$/, '');
  const pteroClientKey = process.env.PTERODACTYL_CLIENT_API_KEY || '';
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie;

  const cacheKey = `${authHeader || ''}|${cookieHeader || ''}`;
  const cached = accountCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  if (pteroUrl && (authHeader || cookieHeader || pteroClientKey)) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (authHeader) headers['Authorization'] = authHeader;
      else if (pteroClientKey) headers['Authorization'] = `Bearer ${pteroClientKey}`;
      if (cookieHeader) headers['Cookie'] = cookieHeader;

      const res = await fetch(`${pteroUrl}/api/client/account`, { headers });
      if (res.ok) {
        const json: any = await res.json();
        const a = json?.attributes || {};
        const user: ResolvedUser = {
          id: String(a.id || a.uuid || '1'),
          username: String(a.username || 'user'),
          displayName: `${a.first_name || ''} ${a.last_name || ''}`.trim() || String(a.username || 'User'),
          email: String(a.email || ''),
          isAdmin: Boolean(a.admin),
        };
        accountCache.set(cacheKey, { expiresAt: Date.now() + 30_000, user });
        return user;
      }
    } catch {
      // Fall through cleanly if Pterodactyl is unreachable in dev preview
    }
  }

  // Dev-only identity headers must never be trusted on a deployed panel.
  if (process.env.NODE_ENV === 'production') {
    return { id: '', username: '', displayName: '', email: '', isAdmin: false };
  }

  const hdrId = String(req.headers['x-helzerx-user-id'] || '1');
  const hdrName = String(req.headers['x-helzerx-username'] || 'admin');
  const hdrRole = String(req.headers['x-helzerx-role'] || 'admin');
  return {
    id: hdrId,
    username: hdrName,
    displayName: hdrName === 'admin' ? 'HelzerX Owner' : hdrName,
    email: 'owner@helzerx.local',
    isAdmin: hdrRole === 'admin',
  };
}

export async function resolveHelzerxUser(req: Request): Promise<ResolvedUser> {
  return resolveUser(req);
}

export function isGlobalServerLocked(): boolean {
  const db = loadDb();
  return Boolean(db.globalServerLock?.locked);
}

async function collectAllPanelServerIdentifiers(req: Request): Promise<string[]> {
  const pteroUrl = (process.env.PTERODACTYL_URL || '').replace(/\/$/, '');
  if (!pteroUrl) return [];

  const appKey = process.env.PTERODACTYL_APP_API_KEY || '';
  const clientKey = process.env.PTERODACTYL_CLIENT_API_KEY || '';
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie;

  const clientHeaders: Record<string, string> = { Accept: 'application/json' };
  if (authHeader) clientHeaders['Authorization'] = authHeader;
  else if (clientKey) clientHeaders['Authorization'] = `Bearer ${clientKey}`;
  if (cookieHeader) clientHeaders['Cookie'] = cookieHeader;

  const identifiers = new Set<string>();

  // 1. Fetch all servers across all nodes via Application API if configured
  if (appKey) {
    try {
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages && page <= 10) {
        const res = await fetch(`${pteroUrl}/api/application/servers?per_page=100&page=${page}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${appKey}` },
        });
        if (!res.ok) break;
        const json: any = await res.json();
        for (const item of json?.data || []) {
          const id = item?.attributes?.identifier || item?.identifier;
          if (id) identifiers.add(String(id));
        }
        totalPages = Number(json?.meta?.pagination?.total_pages || 1);
        page += 1;
      }
    } catch {
      // ignore and fall through to Client API
    }
  }

  // 2. Fetch via Client API (admin-all, admin, and assigned)
  const clientEndpoints = [
    `${pteroUrl}/api/client?type=admin-all&per_page=100`,
    `${pteroUrl}/api/client?type=admin&per_page=100`,
    `${pteroUrl}/api/client?per_page=100`,
  ];

  for (const endpoint of clientEndpoints) {
    try {
      const res = await fetch(endpoint, { headers: clientHeaders });
      if (!res.ok) continue;
      const json: any = await res.json();
      for (const item of json?.data || []) {
        const id = item?.attributes?.identifier || item?.identifier;
        if (id) identifiers.add(String(id));
      }
    } catch {
      // continue
    }
  }

  return Array.from(identifiers);
}

async function sendPanelServerPower(
  req: Request,
  identifier: string,
  signal: 'kill' | 'stop' | 'start'
): Promise<boolean> {
  const pteroUrl = (process.env.PTERODACTYL_URL || '').replace(/\/$/, '');
  if (!pteroUrl) return false;

  const clientKey = process.env.PTERODACTYL_CLIENT_API_KEY || '';
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;
  else if (clientKey) headers['Authorization'] = `Bearer ${clientKey}`;
  if (cookieHeader) headers['Cookie'] = cookieHeader;
  if (req.headers['x-xsrf-token']) headers['X-XSRF-TOKEN'] = String(req.headers['x-xsrf-token']);

  try {
    const res = await fetch(
      `${pteroUrl}/api/client/servers/${encodeURIComponent(identifier)}/power`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ signal }),
      }
    );
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

function ensureUserRecords(db: HelzerxDatabase, u: ResolvedUser, req?: Request) {
  let dirty = false;

  if (!db.profiles[u.id]) {
    db.profiles[u.id] = {
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      bio: '',
      avatarUrl: '',
      bannerUrl: '',
      socialLinks: { discord: '', github: '', website: '', twitter: '' },
      isPublic: true,
      emailVerified: true,
      phoneNumber: '',
      phoneVerified: false,
      recoveryEmail: u.email,
      lockdownMode: false,
      deactivationStatus: 'active',
      following: [],
      followers: [],
      updatedAt: nowIso(),
    };
    dirty = true;
  } else {
    if (db.profiles[u.id].username !== u.username) {
      db.profiles[u.id].username = u.username;
      dirty = true;
    }
  }

  if (!db.securityPolicies[u.id]) {
    db.securityPolicies[u.id] = {
      loginOtpEnabled: false,
      emailLoginAlerts: true,
      newDeviceAlerts: true,
      ipLoginAlerts: false,
      suspiciousLoginProtection: true,
      loginAttemptLimit: 5,
      sessionTimeoutMinutes: 120,
      passwordExpiryDays: 0,
      captchaOnLogin: false,
      antiBotEnabled: true,
      securityQuestions: [],
      backupCodes: generateBackupCodes(),
    };
    dirty = true;
  }

  if (!db.devices[u.id] || db.devices[u.id].length === 0) {
    const ua = String(req?.headers['user-agent'] || 'Web Browser');
    const ip = String(req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
    db.devices[u.id] = [
      {
        id: uid('dev'),
        label: 'Current Browser Session',
        browser: ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Browser',
        os: ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : 'Linux',
        ip,
        trusted: true,
        current: true,
        lastSeenAt: nowIso(),
      },
    ];
    dirty = true;
  }

  if (db.wallets[u.id] === undefined) {
    db.wallets[u.id] = 0;
    dirty = true;
  }

  if (!db.loyalty[u.id]) {
    const refCode = `HX-${u.username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'USER'}${u.id.slice(-2)}`;
    db.loyalty[u.id] = {
      userId: u.id,
      username: u.username,
      displayName: db.profiles[u.id].displayName,
      xp: 50,
      weeklyXp: 50,
      monthlyXp: 50,
      level: 1,
      points: 50,
      streakDays: 0,
      longestStreak: 0,
      lastDailyClaimAt: null,
      lastWeeklyClaimAt: null,
      lastMonthlyClaimAt: null,
      lastEventClaimAt: null,
      tier: 'Standard',
      tierExpiresAt: null,
      birthdayMonthDay: '',
      referralCode: refCode,
      referredBy: null,
      referralCount: 0,
      referralEarnings: 0,
      badges: ['badge_pioneer'],
    };
    dirty = true;
  }

  if (!db.notificationPrefs[u.id]) {
    db.notificationPrefs[u.id] = {
      browserEnabled: false,
      emailEnabled: true,
      soundEnabled: false,
      discordWebhookUrl: '',
      telegramBotToken: '',
      telegramChatId: '',
      quietHoursStart: '',
      quietHoursEnd: '',
      categories: {
        security: true,
        billing: true,
        support: true,
        community: true,
        announcement: true,
        reward: true,
      },
    };
    dirty = true;
  }

  if (dirty) saveDb(db);
}

function getAiPlanById(planId: string): AiCreditPlan {
  return AI_CREDIT_PLANS.find((p) => p.id === planId) || AI_CREDIT_PLANS[0];
}

function syncAiPercentages(acc: AiAccountState): AiAccountState {
  const limit = Math.max(1, acc.monthlyCreditLimit);
  acc.creditsRemaining = Math.max(0, Math.min(limit, Math.round(acc.creditsRemaining)));
  acc.creditsUsed = Math.max(0, Math.round(acc.creditsUsed));
  acc.remainingPercentOfPlan = Math.max(
    0,
    Math.min(100, Math.round((acc.creditsRemaining / limit) * 100))
  );
  acc.remainingPercentOfMax = Math.max(
    0,
    Math.min(100, Number(((acc.creditsRemaining / AI_MAX_MONTHLY_CREDITS) * 100).toFixed(1)))
  );
  return acc;
}

function ensureAiAccount(db: HelzerxDatabase, userId: string): AiAccountState {
  if (!db.aiAccounts) db.aiAccounts = {};
  if (!db.aiUsageHistory) db.aiUsageHistory = [];
  if (!db.aiChatMessages) db.aiChatMessages = {};

  let acc = db.aiAccounts[userId];
  const nowMs = Date.now();
  const nextResetIso = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();

  if (!acc) {
    const freePlan = AI_CREDIT_PLANS[0];
    acc = syncAiPercentages({
      userId,
      planId: freePlan.id,
      planName: freePlan.name,
      creditPercentCapacity: freePlan.creditPercent,
      monthlyCreditLimit: freePlan.monthlyCredits,
      creditsRemaining: freePlan.monthlyCredits,
      creditsUsed: 0,
      remainingPercentOfPlan: 100,
      remainingPercentOfMax: freePlan.creditPercent,
      resetAt: nextResetIso,
      updatedAt: nowIso(),
    });
    db.aiAccounts[userId] = acc;
    saveDb(db);
    return acc;
  }

  // Monthly cycle renewal
  if (acc.resetAt && nowMs > new Date(acc.resetAt).getTime()) {
    const plan = getAiPlanById(acc.planId);
    acc.monthlyCreditLimit = plan.monthlyCredits;
    acc.creditPercentCapacity = plan.creditPercent;
    acc.creditsRemaining = plan.monthlyCredits;
    acc.creditsUsed = 0;
    acc.resetAt = nextResetIso;
    acc.updatedAt = nowIso();
    syncAiPercentages(acc);
    saveDb(db);
  } else {
    syncAiPercentages(acc);
  }

  return acc;
}

function awardXpAndBadge(db: HelzerxDatabase, userId: string, xpGain: number, pointsGain: number, badgeId?: string) {
  const loy = db.loyalty[userId];
  if (!loy) return;
  const multiplier = loy.tier === 'VIP' ? 1.5 : loy.tier === 'Premium' ? 1.25 : 1;
  const finalXp = Math.round(xpGain * multiplier);
  loy.xp += finalXp;
  loy.weeklyXp += finalXp;
  loy.monthlyXp += finalXp;
  loy.points += pointsGain;
  loy.level = Math.max(1, Math.floor(loy.xp / 250) + 1);

  if (badgeId && !loy.badges.includes(badgeId)) {
    loy.badges.push(badgeId);
    const b = db.badgesCatalog.find((x) => x.id === badgeId);
    if (b) {
      loy.xp += b.xpReward;
      loy.level = Math.max(1, Math.floor(loy.xp / 250) + 1);
      pushNotification(db, userId, {
        category: 'reward',
        priority: 'normal',
        title: `Badge Unlocked: ${b.name}`,
        body: `${b.description} (+${b.xpReward} XP)`,
        linkPage: 'rewards',
      });
    }
  }
}

function isValidDiscordWebhook(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      (host === 'discord.com' ||
        host === 'ptb.discord.com' ||
        host === 'canary.discord.com' ||
        host === 'discordapp.com') &&
      parsed.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

async function dispatchWebhooksIfConfigured(prefs: NotificationChannelPrefs | undefined, title: string, body: string) {
  if (!prefs) return;
  if (prefs.discordWebhookUrl && isValidDiscordWebhook(prefs.discordWebhookUrl)) {
    fetch(prefs.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'HelzerX Panel',
        embeds: [{ title, description: body, color: 0x8b5cf6, timestamp: nowIso() }],
      }),
    }).catch(() => {});
  }
  if (prefs.telegramBotToken && prefs.telegramChatId) {
    fetch(`https://api.telegram.org/bot${encodeURIComponent(prefs.telegramBotToken)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: prefs.telegramChatId,
        text: `*${title}*\n${body}`,
        parse_mode: 'Markdown',
      }),
    }).catch(() => {});
  }
}

function pushNotification(
  db: HelzerxDatabase,
  userId: string,
  payload: Omit<NotificationEntry, 'id' | 'userId' | 'read' | 'createdAt'>
) {
  const prefs = db.notificationPrefs[userId];
  if (prefs && prefs.categories[payload.category] === false) return;
  const entry: NotificationEntry = {
    id: uid('ntf'),
    userId,
    read: false,
    createdAt: nowIso(),
    ...payload,
  };
  db.notifications.unshift(entry);
  if (db.notifications.length > 500) db.notifications = db.notifications.slice(0, 500);
  dispatchWebhooksIfConfigured(prefs, payload.title, payload.body);
}

function logSecurityEvent(db: HelzerxDatabase, userId: string, req: Request, type: string, status: SecurityEvent['status'] = 'allowed') {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
  const device = String(req.headers['user-agent'] || 'Browser').slice(0, 60);
  db.securityEvents.unshift({
    id: uid('sec'),
    userId,
    type,
    ip,
    device,
    status,
    createdAt: nowIso(),
  });
  if (db.securityEvents.length > 300) db.securityEvents = db.securityEvents.slice(0, 300);
}

export function createHelzerxRouter() {
  const router = express.Router();

  // Bootstrap everything needed by shell + dashboard in 1 request
  router.get('/bootstrap', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);

    const userNotifications = db.notifications.filter((n) => n.userId === user.id || n.userId === 'all').slice(0, 40);
    const nowMs = Date.now();
    const activeAnnouncements = db.announcements.filter((a) => {
      if (a.archived) return false;
      if (a.targetAudience === 'admins' && !user.isAdmin) return false;
      if (a.targetAudience === 'vip' && db.loyalty[user.id]?.tier !== 'VIP' && !user.isAdmin) return false;
      if (a.publishAt && Date.parse(a.publishAt) > nowMs) return false;
      if (a.expiresAt && Date.parse(a.expiresAt) < nowMs) return false;
      return true;
    });

    res.json({
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      profile: db.profiles[user.id],
      securityPolicy: db.securityPolicies[user.id],
      devices: db.devices[user.id] || [],
      securityEvents: db.securityEvents.filter((e) => e.userId === user.id).slice(0, 30),
      walletBalance: Number((db.wallets[user.id] || 0).toFixed(2)),
      loyalty: db.loyalty[user.id],
      unreadNotifications: userNotifications.filter((n) => !n.read).length,
      notifications: userNotifications,
      notificationPrefs: db.notificationPrefs[user.id],
      activeAnnouncements,
      incidents: db.incidents.slice(0, 20),
      recentTransactions: db.transactions.filter((t) => t.userId === user.id).slice(0, 5),
      globalServerLock: db.globalServerLock,
    });
  });

  // --- EXTENDED PROFILE ---
  router.put('/profile', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const p = db.profiles[user.id];
    const b = req.body || {};

    p.displayName = typeof b.displayName === 'string' ? b.displayName.slice(0, 64) : p.displayName;
    p.bio = typeof b.bio === 'string' ? b.bio.slice(0, 500) : p.bio;
    p.avatarUrl = typeof b.avatarUrl === 'string' ? b.avatarUrl.slice(0, 400) : p.avatarUrl;
    p.bannerUrl = typeof b.bannerUrl === 'string' ? b.bannerUrl.slice(0, 400) : p.bannerUrl;
    if (b.socialLinks && typeof b.socialLinks === 'object') {
      p.socialLinks = {
        discord: String(b.socialLinks.discord || '').slice(0, 80),
        github: String(b.socialLinks.github || '').slice(0, 80),
        website: String(b.socialLinks.website || '').slice(0, 160),
        twitter: String(b.socialLinks.twitter || '').slice(0, 80),
      };
    }
    if (typeof b.isPublic === 'boolean') p.isPublic = b.isPublic;
    if (typeof b.phoneNumber === 'string') {
      if (b.phoneNumber !== p.phoneNumber) p.phoneVerified = false;
      p.phoneNumber = b.phoneNumber.slice(0, 30);
    }
    if (typeof b.recoveryEmail === 'string') p.recoveryEmail = b.recoveryEmail.slice(0, 120);
    p.updatedAt = nowIso();
    if (db.loyalty[user.id]) db.loyalty[user.id].displayName = p.displayName || user.username;
    saveDb(db);
    res.json({ profile: p });
  });

  router.post('/profile/verify-contact', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const { channel } = req.body || {};
    const p = db.profiles[user.id];
    if (channel === 'phone') {
      if (!p.phoneNumber.trim()) return res.status(400).json({ error: 'Add a phone number first.' });
      p.phoneVerified = true;
    } else {
      p.emailVerified = true;
    }
    p.updatedAt = nowIso();
    logSecurityEvent(db, user.id, req, `contact.verified:${channel === 'phone' ? 'phone' : 'email'}`);
    saveDb(db);
    res.json({ profile: p });
  });

  router.post('/profile/deactivation', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const action = req.body?.action;
    if (!['active', 'deactivated', 'deletion_requested'].includes(action)) {
      return res.status(400).json({ error: 'Invalid deactivation status.' });
    }
    db.profiles[user.id].deactivationStatus = action;
    db.profiles[user.id].updatedAt = nowIso();
    logSecurityEvent(db, user.id, req, `account.status:${action}`, action === 'active' ? 'allowed' : 'flagged');
    saveDb(db);
    res.json({ profile: db.profiles[user.id] });
  });

  router.get('/profile/:username', async (req: Request, res: Response) => {
    const viewer = await resolveUser(req);
    const db = loadDb();
    const targetUsername = decodeURIComponent(String(req.params.username || '')).toLowerCase();
    const targetProfile = Object.values(db.profiles).find(
      (pr) => pr.username.toLowerCase() === targetUsername
    );
    if (!targetProfile) return res.status(404).json({ error: 'User profile not found.' });
    if (!targetProfile.isPublic && targetProfile.userId !== viewer.id && !viewer.isAdmin) {
      return res.status(403).json({ error: 'This user has set their profile to Private Mode.' });
    }
    const loy = db.loyalty[targetProfile.userId] || {
      level: 1,
      xp: 0,
      tier: 'Standard',
      badges: ['badge_pioneer'],
      streakDays: 0,
    };
    const recentPosts = db.posts
      .filter((po) => po.authorUsername.toLowerCase() === targetUsername)
      .slice(0, 8)
      .map((po) => ({ id: po.id, title: po.title, category: po.category, createdAt: po.createdAt }));
    res.json({ profile: targetProfile, loyalty: loy, recentPosts });
  });

  // --- SECURITY POLICY, DEVICES, LOCKDOWN ---
  router.put('/security/settings', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const cur = db.securityPolicies[user.id];
    const b = req.body || {};

    cur.loginOtpEnabled = typeof b.loginOtpEnabled === 'boolean' ? b.loginOtpEnabled : cur.loginOtpEnabled;
    cur.emailLoginAlerts = typeof b.emailLoginAlerts === 'boolean' ? b.emailLoginAlerts : cur.emailLoginAlerts;
    cur.newDeviceAlerts = typeof b.newDeviceAlerts === 'boolean' ? b.newDeviceAlerts : cur.newDeviceAlerts;
    cur.ipLoginAlerts = typeof b.ipLoginAlerts === 'boolean' ? b.ipLoginAlerts : cur.ipLoginAlerts;
    cur.suspiciousLoginProtection =
      typeof b.suspiciousLoginProtection === 'boolean' ? b.suspiciousLoginProtection : cur.suspiciousLoginProtection;
    cur.captchaOnLogin = typeof b.captchaOnLogin === 'boolean' ? b.captchaOnLogin : cur.captchaOnLogin;
    cur.antiBotEnabled = typeof b.antiBotEnabled === 'boolean' ? b.antiBotEnabled : cur.antiBotEnabled;
    if (typeof b.loginAttemptLimit === 'number') cur.loginAttemptLimit = Math.min(20, Math.max(3, b.loginAttemptLimit));
    if (typeof b.sessionTimeoutMinutes === 'number') cur.sessionTimeoutMinutes = Math.min(1440, Math.max(15, b.sessionTimeoutMinutes));
    if (typeof b.passwordExpiryDays === 'number') cur.passwordExpiryDays = Math.min(365, Math.max(0, b.passwordExpiryDays));

    if (Array.isArray(b.securityQuestions)) {
      cur.securityQuestions = b.securityQuestions
        .filter((q: any) => q?.question && q?.answerHint)
        .slice(0, 3)
        .map((q: any) => ({
          id: q.id || uid('sq'),
          question: String(q.question).slice(0, 140),
          answerHint: String(q.answerHint).slice(0, 60),
        }));
      if (cur.securityQuestions.length > 0) {
        awardXpAndBadge(db, user.id, 30, 20, 'badge_guardian');
      }
    }

    logSecurityEvent(db, user.id, req, 'security.policy.updated');
    saveDb(db);
    res.json({ securityPolicy: cur });
  });

  router.post('/security/backup-codes/regenerate', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    db.securityPolicies[user.id].backupCodes = generateBackupCodes();
    logSecurityEvent(db, user.id, req, 'security.backup_codes.regenerated');
    saveDb(db);
    res.json({ backupCodes: db.securityPolicies[user.id].backupCodes });
  });

  router.post('/security/devices/:id/trust', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const list = db.devices[user.id] || [];
    const target = list.find((d) => d.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'Device not found' });
    target.trusted = !target.trusted;
    logSecurityEvent(db, user.id, req, `device.${target.trusted ? 'trusted' : 'untrusted'}`);
    saveDb(db);
    res.json({ devices: list });
  });

  router.delete('/security/devices/:id', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    db.devices[user.id] = (db.devices[user.id] || []).filter((d) => d.id !== req.params.id);
    logSecurityEvent(db, user.id, req, 'device.revoked');
    saveDb(db);
    res.json({ devices: db.devices[user.id] });
  });

  router.post('/security/sessions/force-logout', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    db.devices[user.id] = (db.devices[user.id] || []).filter((d) => d.current);
    logSecurityEvent(db, user.id, req, 'sessions.force_logout_all', 'flagged');
    pushNotification(db, user.id, {
      category: 'security',
      priority: 'high',
      title: 'All Other Devices Logged Out',
      body: 'All external active sessions were revoked from your Account Security console.',
      linkPage: 'account',
    });
    saveDb(db);
    res.json({ devices: db.devices[user.id] });
  });

  router.put('/security/lockdown', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const enabled = Boolean(req.body?.enabled);
    db.profiles[user.id].lockdownMode = enabled;
    logSecurityEvent(db, user.id, req, `security.lockdown.${enabled ? 'enabled' : 'disabled'}`, enabled ? 'flagged' : 'allowed');
    pushNotification(db, user.id, {
      category: 'security',
      priority: 'high',
      title: enabled ? 'Account Lockdown Activated' : 'Account Lockdown Lifted',
      body: enabled
        ? 'Sensitive billing transfers and destructive account actions are locked.'
        : 'Normal account access has been restored.',
      linkPage: 'account',
    });
    saveDb(db);
    res.json({ lockdownMode: enabled });
  });

  // --- BILLING, WALLET, COUPONS, INVOICES, REFUNDS ---
  router.get('/billing', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);

    const loy = db.loyalty[user.id];
    res.json({
      walletBalance: Number((db.wallets[user.id] || 0).toFixed(2)),
      loyaltyPoints: loy.points,
      referralCode: loy.referralCode,
      referralCount: loy.referralCount,
      referralEarnings: loy.referralEarnings,
      config: db.billingConfig,
      plans: db.plans,
      transactions: db.transactions.filter((t) => t.userId === user.id),
      invoices: db.invoices.filter((i) => i.userId === user.id || user.isAdmin),
      coupons: user.isAdmin ? db.coupons : db.coupons.filter((c) => c.active),
      paymentMethods: db.paymentMethods.filter((m) => m.userId === user.id),
      refunds: user.isAdmin ? db.refunds : db.refunds.filter((r) => r.userId === user.id),
      pendingManualPayments: user.isAdmin
        ? db.transactions.filter((t) => t.status === 'pending')
        : db.transactions.filter((t) => t.userId === user.id && t.status === 'pending'),
    });
  });

  router.post('/billing/add-funds', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    if (db.profiles[user.id].lockdownMode) {
      return res.status(423).json({ error: 'Account is in Lockdown Mode. Disable lockdown to process payments.' });
    }
    const amount = Number(req.body?.amount || 0);
    const method = String(req.body?.method || 'Stripe');
    const reference = String(req.body?.reference || '').trim() || `TX-${Date.now().toString().slice(-6)}`;
    if (!Number.isFinite(amount) || amount < 1 || amount > 5000) {
      return res.status(400).json({ error: 'Amount must be between $1.00 and $5,000.00.' });
    }

    const isManual = method.toLowerCase().includes('manual') || method.toLowerCase().includes('bank');
    const taxRate = db.billingConfig.taxRatePercent || 0;
    const taxAmount = Number(((amount * taxRate) / 100).toFixed(2));
    const totalCharged = Number((amount + taxAmount).toFixed(2));

    const tx: WalletTransaction = {
      id: uid('tx'),
      userId: user.id,
      type: 'credit',
      amount,
      taxAmount,
      method,
      status: isManual ? 'pending' : 'completed',
      reference,
      note: isManual ? 'Manual payment verification pending' : `Wallet top-up via ${method}`,
      createdAt: nowIso(),
    };
    db.transactions.unshift(tx);

    const inv: HelzerxInvoice = {
      id: uid('inv'),
      userId: user.id,
      username: user.username,
      number: `INV-${new Date().getFullYear()}-${String(db.invoices.length + 1001)}`,
      description: `Wallet Credit Top-Up ($${amount.toFixed(2)})`,
      subtotal: amount,
      taxRate,
      taxAmount,
      discountAmount: 0,
      total: totalCharged,
      status: isManual ? 'pending' : 'paid',
      method,
      issuedAt: nowIso(),
      paidAt: isManual ? null : nowIso(),
    };
    db.invoices.unshift(inv);

    if (!isManual) {
      db.wallets[user.id] = Number(((db.wallets[user.id] || 0) + amount).toFixed(2));
      awardXpAndBadge(db, user.id, Math.round(amount * 5), Math.round(amount * 2), 'badge_patron');
      pushNotification(db, user.id, {
        category: 'billing',
        priority: 'normal',
        title: `Wallet Credited +$${amount.toFixed(2)}`,
        body: `Invoice ${inv.number} paid via ${method}.`,
        linkPage: 'billing',
      });
    } else {
      pushNotification(db, user.id, {
        category: 'billing',
        priority: 'normal',
        title: `Manual Top-Up Submitted ($${amount.toFixed(2)})`,
        body: `Ref ${reference} queued for admin approval.`,
        linkPage: 'billing',
      });
    }

    saveDb(db);
    res.json({ transaction: tx, invoice: inv, walletBalance: db.wallets[user.id] });
  });

  router.post('/billing/verify-payment', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const { transactionId, approve } = req.body || {};
    const tx = db.transactions.find((t) => t.id === transactionId);
    if (!tx || tx.status !== 'pending') return res.status(404).json({ error: 'Pending transaction not found.' });

    tx.status = approve ? 'completed' : 'rejected';
    tx.note = approve ? `Verified & approved by ${user.username}` : `Rejected by ${user.username}`;
    const matchingInv = db.invoices.find(
      (i) => i.userId === tx.userId && i.status === 'pending' && Math.abs(i.subtotal - tx.amount) < 0.01
    );
    if (approve) {
      db.wallets[tx.userId] = Number(((db.wallets[tx.userId] || 0) + tx.amount).toFixed(2));
      if (matchingInv) {
        matchingInv.status = 'paid';
        matchingInv.paidAt = nowIso();
      }
      awardXpAndBadge(db, tx.userId, Math.round(tx.amount * 5), Math.round(tx.amount * 2), 'badge_patron');
      pushNotification(db, tx.userId, {
        category: 'billing',
        priority: 'high',
        title: `Payment Approved (+$${tx.amount.toFixed(2)})`,
        body: `Reference ${tx.reference} has been credited to your wallet.`,
        linkPage: 'billing',
      });
    } else {
      if (matchingInv) matchingInv.status = 'overdue';
      pushNotification(db, tx.userId, {
        category: 'billing',
        priority: 'high',
        title: 'Manual Payment Rejected',
        body: `Reference ${tx.reference} was not approved. Please contact Billing Support.`,
        linkPage: 'billing',
      });
    }
    saveDb(db);
    res.json({ transaction: tx });
  });

  router.post('/billing/plans/:id/purchase', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    if (db.profiles[user.id].lockdownMode) {
      return res.status(423).json({ error: 'Account is in Lockdown Mode.' });
    }
    const plan = db.plans.find((p) => p.id === req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });

    const couponCode = String(req.body?.couponCode || '').trim().toUpperCase();
    let discountAmount = 0;
    if (couponCode) {
      const cpn = db.coupons.find((c) => c.code.toUpperCase() === couponCode && c.active);
      if (!cpn) return res.status(400).json({ error: 'Invalid or inactive coupon code.' });
      if (cpn.usedCount >= cpn.maxUses) return res.status(400).json({ error: 'Coupon usage limit reached.' });
      discountAmount = Number(((plan.priceMonthly * cpn.discountPercent) / 100).toFixed(2));
      cpn.usedCount += 1;
    }

    const subtotal = Math.max(0, Number((plan.priceMonthly - discountAmount).toFixed(2)));
    const taxRate = db.billingConfig.taxRatePercent || 0;
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const total = Number((subtotal + taxAmount).toFixed(2));

    const currentBalance = db.wallets[user.id] || 0;
    if (currentBalance < total) {
      return res.status(400).json({
        error: `Insufficient wallet balance ($${currentBalance.toFixed(2)}). Required: $${total.toFixed(2)}.`,
      });
    }

    db.wallets[user.id] = Number((currentBalance - total).toFixed(2));
    const tx: WalletTransaction = {
      id: uid('tx'),
      userId: user.id,
      type: 'debit',
      amount: total,
      taxAmount,
      method: 'HelzerX Wallet',
      status: 'completed',
      reference: `PLAN-${plan.id.toUpperCase()}`,
      note: `Purchased ${plan.name}${couponCode ? ` (Coupon: ${couponCode})` : ''}`,
      createdAt: nowIso(),
    };
    db.transactions.unshift(tx);

    const inv: HelzerxInvoice = {
      id: uid('inv'),
      userId: user.id,
      username: user.username,
      number: `INV-${new Date().getFullYear()}-${String(db.invoices.length + 1001)}`,
      description: `${plan.name} — Monthly Hosting Plan`,
      subtotal: plan.priceMonthly,
      taxRate,
      taxAmount,
      discountAmount,
      total,
      status: 'paid',
      method: 'HelzerX Wallet',
      issuedAt: nowIso(),
      paidAt: nowIso(),
    };
    db.invoices.unshift(inv);

    awardXpAndBadge(db, user.id, 75, 40, 'badge_patron');
    pushNotification(db, user.id, {
      category: 'billing',
      priority: 'normal',
      title: `Order Confirmed: ${plan.name}`,
      body: `Invoice ${inv.number} paid ($${total.toFixed(2)}).`,
      linkPage: 'billing',
    });
    saveDb(db);
    res.json({ invoice: inv, walletBalance: db.wallets[user.id] });
  });

  router.post('/billing/coupons/redeem', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const code = String(req.body?.code || '').trim().toUpperCase();
    const cpn = db.coupons.find((c) => c.code.toUpperCase() === code && c.active);
    if (!cpn) return res.status(404).json({ error: 'Promo code not found or expired.' });
    if (cpn.usedCount >= cpn.maxUses) return res.status(400).json({ error: 'Promo code redemption limit reached.' });

    const redeemed = db.couponRedemptions[user.id] || [];
    if (redeemed.includes(cpn.id)) return res.status(400).json({ error: 'You already redeemed this promo code.' });
    if (cpn.creditBonus <= 0) {
      return res.json({
        message: `${cpn.discountPercent}% discount code "${cpn.code}" is valid! Enter it at plan checkout.`,
        coupon: cpn,
        walletBalance: db.wallets[user.id],
      });
    }

    redeemed.push(cpn.id);
    db.couponRedemptions[user.id] = redeemed;
    cpn.usedCount += 1;
    db.wallets[user.id] = Number(((db.wallets[user.id] || 0) + cpn.creditBonus).toFixed(2));
    db.transactions.unshift({
      id: uid('tx'),
      userId: user.id,
      type: 'reward',
      amount: cpn.creditBonus,
      taxAmount: 0,
      method: `Promo (${cpn.code})`,
      status: 'completed',
      reference: cpn.code,
      note: cpn.description,
      createdAt: nowIso(),
    });
    saveDb(db);
    res.json({
      message: `Credited +$${cpn.creditBonus.toFixed(2)} to your wallet!`,
      coupon: cpn,
      walletBalance: db.wallets[user.id],
    });
  });

  router.post('/billing/coupons', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const b = req.body || {};
    const code = String(b.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Coupon code is required.' });
    const cpn: HelzerxCoupon = {
      id: uid('cpn'),
      code,
      discountPercent: Math.min(90, Math.max(0, Number(b.discountPercent || 0))),
      creditBonus: Math.min(500, Math.max(0, Number(b.creditBonus || 0))),
      maxUses: Math.max(1, Number(b.maxUses || 100)),
      usedCount: 0,
      expiresAt: b.expiresAt || null,
      active: true,
      description: String(b.description || 'Promotional coupon').slice(0, 140),
    };
    db.coupons.unshift(cpn);
    saveDb(db);
    res.json({ coupon: cpn });
  });

  router.delete('/billing/coupons/:id', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    db.coupons = db.coupons.filter((c) => c.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });

  router.post('/billing/methods', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const b = req.body || {};
    const method: PaymentMethodEntry = {
      id: uid('pm'),
      userId: user.id,
      provider: b.provider || 'Stripe',
      label: String(b.label || 'Saved Card').slice(0, 60),
      last4: String(b.last4 || '4242').replace(/\D/g, '').slice(-4) || '0000',
      isDefault: db.paymentMethods.filter((m) => m.userId === user.id).length === 0,
      createdAt: nowIso(),
    };
    db.paymentMethods.unshift(method);
    saveDb(db);
    res.json({ method });
  });

  router.delete('/billing/methods/:id', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    db.paymentMethods = db.paymentMethods.filter((m) => !(m.id === req.params.id && m.userId === user.id));
    saveDb(db);
    res.json({ ok: true });
  });

  router.post('/billing/refunds', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const { invoiceId, reason } = req.body || {};
    const inv = db.invoices.find((i) => i.id === invoiceId && i.userId === user.id);
    if (!inv || inv.status !== 'paid') return res.status(400).json({ error: 'Only paid invoices can be refunded.' });

    const refund: RefundRequestEntry = {
      id: uid('ref'),
      userId: user.id,
      username: user.username,
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      amount: inv.total,
      reason: String(reason || 'Requested refund').slice(0, 300),
      status: 'pending',
      adminNote: '',
      createdAt: nowIso(),
    };
    db.refunds.unshift(refund);
    saveDb(db);
    res.json({ refund });
  });

  router.post('/billing/refunds/:id/resolve', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const { approve, adminNote } = req.body || {};
    const ref = db.refunds.find((r) => r.id === req.params.id);
    if (!ref || ref.status !== 'pending') return res.status(404).json({ error: 'Pending refund not found.' });

    ref.status = approve ? 'approved' : 'rejected';
    ref.adminNote = String(adminNote || '');
    if (approve) {
      const inv = db.invoices.find((i) => i.id === ref.invoiceId);
      if (inv) inv.status = 'refunded';
      db.wallets[ref.userId] = Number(((db.wallets[ref.userId] || 0) + ref.amount).toFixed(2));
      db.transactions.unshift({
        id: uid('tx'),
        userId: ref.userId,
        type: 'refund',
        amount: ref.amount,
        taxAmount: 0,
        method: 'Wallet Refund',
        status: 'completed',
        reference: ref.invoiceNumber,
        note: `Refund approved for ${ref.invoiceNumber}`,
        createdAt: nowIso(),
      });
    }
    pushNotification(db, ref.userId, {
      category: 'billing',
      priority: 'high',
      title: `Refund ${approve ? 'Approved' : 'Declined'}: ${ref.invoiceNumber}`,
      body: approve ? `+$${ref.amount.toFixed(2)} returned to wallet.` : ref.adminNote || 'Request declined.',
      linkPage: 'billing',
    });
    saveDb(db);
    res.json({ refund: ref });
  });

  router.put('/billing/config', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const b = req.body || {};
    if (typeof b.taxRatePercent === 'number') {
      db.billingConfig.taxRatePercent = Math.min(50, Math.max(0, b.taxRatePercent));
    }
    if (typeof b.manualPaymentInstructions === 'string') {
      db.billingConfig.manualPaymentInstructions = b.manualPaymentInstructions.slice(0, 400);
    }
    if (Array.isArray(b.enabledGateways)) {
      db.billingConfig.enabledGateways = b.enabledGateways.map(String);
    }
    saveDb(db);
    res.json({ config: db.billingConfig });
  });

  // --- REWARDS, STREAKS, SHOP, TIERS, LEADERBOARDS ---
  router.get('/rewards', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);

    const allRows: LeaderboardEntry[] = Object.values(db.loyalty).map((l) => ({
      userId: l.userId,
      username: l.username,
      displayName: l.displayName,
      level: l.level,
      xp: l.xp,
      weeklyXp: l.weeklyXp,
      monthlyXp: l.monthlyXp,
      points: l.points,
      streakDays: l.streakDays,
      tier: l.tier,
      referralCount: l.referralCount,
    }));

    res.json({
      account: db.loyalty[user.id],
      badgesCatalog: db.badgesCatalog,
      shopItems: db.shopItems,
      claims: db.rewardClaims.filter((c) => c.userId === user.id).slice(0, 30),
      leaderboards: {
        global: [...allRows].sort((a, b) => b.xp - a.xp).slice(0, 20),
        weekly: [...allRows].sort((a, b) => b.weeklyXp - a.weeklyXp).slice(0, 20),
        monthly: [...allRows].sort((a, b) => b.monthlyXp - a.monthlyXp).slice(0, 20),
        referrals: [...allRows].sort((a, b) => b.referralCount - a.referralCount).slice(0, 20),
      },
    });
  });

  router.post('/rewards/claim', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const loy = db.loyalty[user.id];
    const kind = String(req.body?.type || 'daily') as 'daily' | 'weekly' | 'monthly' | 'birthday' | 'event';
    const now = Date.now();
    const hourMs = 3600_000;

    let xp = 0;
    let pts = 0;
    let wallet = 0;
    let title = '';

    if (kind === 'daily') {
      if (loy.lastDailyClaimAt && now - Date.parse(loy.lastDailyClaimAt) < 20 * hourMs) {
        return res.status(400).json({ error: 'Daily reward already claimed. Come back tomorrow!' });
      }
      const withinStreakWindow = !loy.lastDailyClaimAt || now - Date.parse(loy.lastDailyClaimAt) < 48 * hourMs;
      loy.streakDays = withinStreakWindow ? loy.streakDays + 1 : 1;
      loy.longestStreak = Math.max(loy.longestStreak, loy.streakDays);
      loy.lastDailyClaimAt = nowIso();
      xp = 35 + Math.min(70, loy.streakDays * 5);
      pts = 20 + Math.min(50, loy.streakDays * 3);
      title = `Daily Check-in (Streak Day ${loy.streakDays})`;
      awardXpAndBadge(db, user.id, xp, pts, loy.streakDays >= 7 ? 'badge_streak_7' : undefined);
    } else if (kind === 'weekly') {
      if (loy.lastWeeklyClaimAt && now - Date.parse(loy.lastWeeklyClaimAt) < 7 * 24 * hourMs) {
        return res.status(400).json({ error: 'Weekly reward already claimed this week.' });
      }
      loy.lastWeeklyClaimAt = nowIso();
      xp = 120;
      pts = 80;
      title = 'Weekly Loyalty Bonus';
      awardXpAndBadge(db, user.id, xp, pts);
    } else if (kind === 'monthly') {
      if (loy.lastMonthlyClaimAt && now - Date.parse(loy.lastMonthlyClaimAt) < 28 * 24 * hourMs) {
        return res.status(400).json({ error: 'Monthly reward already claimed this month.' });
      }
      loy.lastMonthlyClaimAt = nowIso();
      xp = 300;
      pts = 200;
      wallet = loy.tier === 'VIP' ? 2 : loy.tier === 'Premium' ? 1 : 0;
      if (wallet > 0) db.wallets[user.id] = Number(((db.wallets[user.id] || 0) + wallet).toFixed(2));
      title = `Monthly Reward (${loy.tier})`;
      awardXpAndBadge(db, user.id, xp, pts);
    } else if (kind === 'birthday') {
      const mmdd = String(req.body?.birthdayMonthDay || loy.birthdayMonthDay || '').trim();
      if (!mmdd) return res.status(400).json({ error: 'Set your birthday (MM-DD) first.' });
      loy.birthdayMonthDay = mmdd.slice(0, 10);
      const todayMmDd = new Date().toISOString().slice(5, 10);
      if (loy.birthdayMonthDay !== todayMmDd) {
        saveDb(db);
        return res.json({ message: 'Birthday saved! Return on your birthday to claim your gift.', account: loy });
      }
      xp = 250;
      pts = 150;
      wallet = 1;
      db.wallets[user.id] = Number(((db.wallets[user.id] || 0) + wallet).toFixed(2));
      title = 'Birthday Gift Pack';
      awardXpAndBadge(db, user.id, xp, pts);
    } else {
      if (loy.lastEventClaimAt && now - Date.parse(loy.lastEventClaimAt) < 24 * hourMs) {
        return res.status(400).json({ error: 'Special event reward already claimed today.' });
      }
      loy.lastEventClaimAt = nowIso();
      xp = 80;
      pts = 45;
      title = 'HelzerX Community Event Bonus';
      awardXpAndBadge(db, user.id, xp, pts);
    }

    const claim: RewardClaimHistory = {
      id: uid('clm'),
      userId: user.id,
      type: kind,
      title,
      xpDelta: xp,
      pointsDelta: pts,
      walletDelta: wallet,
      createdAt: nowIso(),
    };
    db.rewardClaims.unshift(claim);
    saveDb(db);
    res.json({ claim, account: loy, walletBalance: db.wallets[user.id] });
  });

  router.post('/rewards/shop/:id/redeem', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const loy = db.loyalty[user.id];
    const item = db.shopItems.find((s) => s.id === req.params.id);
    if (!item || item.stock <= 0) return res.status(404).json({ error: 'Reward item unavailable.' });
    if (loy.points < item.costPoints) {
      return res.status(400).json({ error: `Need ${item.costPoints} points (you have ${loy.points}).` });
    }

    loy.points -= item.costPoints;
    item.stock = Math.max(0, item.stock - 1);
    let walletDelta = 0;
    let xpDelta = 0;

    if (item.type === 'wallet_credit') {
      walletDelta = item.value;
      db.wallets[user.id] = Number(((db.wallets[user.id] || 0) + item.value).toFixed(2));
      db.transactions.unshift({
        id: uid('tx'),
        userId: user.id,
        type: 'reward',
        amount: item.value,
        taxAmount: 0,
        method: 'Loyalty Points Shop',
        status: 'completed',
        reference: item.id,
        note: `Redeemed ${item.name}`,
        createdAt: nowIso(),
      });
    } else if (item.type === 'vip_days') {
      loy.tier = 'VIP';
      loy.tierExpiresAt = new Date(Date.now() + item.value * 86_400_000).toISOString();
    } else if (item.type === 'xp_boost') {
      xpDelta = item.value;
      awardXpAndBadge(db, user.id, item.value, 0);
    }

    const claim: RewardClaimHistory = {
      id: uid('clm'),
      userId: user.id,
      type: 'shop',
      title: `Redeemed: ${item.name}`,
      xpDelta,
      pointsDelta: -item.costPoints,
      walletDelta,
      createdAt: nowIso(),
    };
    db.rewardClaims.unshift(claim);
    saveDb(db);
    res.json({ claim, account: loy, walletBalance: db.wallets[user.id] });
  });

  router.post('/rewards/tier/upgrade', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const tier = req.body?.tier as 'Premium' | 'VIP';
    const price = tier === 'VIP' ? 9.99 : tier === 'Premium' ? 4.99 : 0;
    if (!price) return res.status(400).json({ error: 'Select Premium or VIP tier.' });

    const bal = db.wallets[user.id] || 0;
    if (bal < price) {
      return res.status(400).json({ error: `Insufficient wallet balance ($${bal.toFixed(2)}). Need $${price.toFixed(2)}.` });
    }
    db.wallets[user.id] = Number((bal - price).toFixed(2));
    db.loyalty[user.id].tier = tier;
    db.loyalty[user.id].tierExpiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    db.transactions.unshift({
      id: uid('tx'),
      userId: user.id,
      type: 'debit',
      amount: price,
      taxAmount: 0,
      method: 'HelzerX Wallet',
      status: 'completed',
      reference: `TIER-${tier.toUpperCase()}`,
      note: `30-day ${tier} Membership upgrade`,
      createdAt: nowIso(),
    });
    saveDb(db);
    res.json({ account: db.loyalty[user.id], walletBalance: db.wallets[user.id] });
  });

  router.post('/rewards/referral/apply', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const loy = db.loyalty[user.id];
    if (loy.referredBy) return res.status(400).json({ error: 'Referral code already applied to your account.' });

    const code = String(req.body?.code || '').trim().toUpperCase();
    const referrer = Object.values(db.loyalty).find((l) => l.referralCode.toUpperCase() === code && l.userId !== user.id);
    if (!referrer) return res.status(404).json({ error: 'Referral code not found.' });

    loy.referredBy = referrer.referralCode;
    referrer.referralCount += 1;
    referrer.referralEarnings = Number((referrer.referralEarnings + 2.5).toFixed(2));
    db.wallets[referrer.userId] = Number(((db.wallets[referrer.userId] || 0) + 2.5).toFixed(2));
    db.wallets[user.id] = Number(((db.wallets[user.id] || 0) + 1.5).toFixed(2));
    loy.points += 50;
    saveDb(db);
    res.json({ account: loy, walletBalance: db.wallets[user.id], bonus: 1.5 });
  });

  // --- SUPPORT TICKETS & KNOWLEDGE BASE ---
  router.get('/support', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);

    const visibleTickets = (user.isAdmin
      ? db.tickets
      : db.tickets.filter((t) => t.userId === user.id)
    ).map((t) => ({
      ...t,
      messages: user.isAdmin ? t.messages : t.messages.filter((m) => !m.internalNote),
    }));

    const rated = visibleTickets.filter((t) => t.rating !== null);
    const avgRating = rated.length
      ? Number((rated.reduce((s, t) => s + (t.rating || 0), 0) / rated.length).toFixed(1))
      : 4.9;

    res.json({
      tickets: visibleTickets,
      agents: db.agents,
      templates: db.templates,
      knowledgeBase: db.knowledgeBase,
      stats: {
        total: visibleTickets.length,
        open: visibleTickets.filter((t) => t.status === 'open' || t.status === 'answered').length,
        escalated: visibleTickets.filter((t) => t.status === 'escalated').length,
        closed: visibleTickets.filter((t) => t.status === 'closed').length,
        avgRating,
      },
    });
  });

  router.post('/support/tickets', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const b = req.body || {};
    if (!String(b.subject || '').trim() || !String(b.message || '').trim()) {
      return res.status(400).json({ error: 'Subject and description are required.' });
    }
    const department = b.department || 'Technical Support';
    const defaultAgent = db.agents.find((a) => a.department === department) || db.agents[0] || null;
    const ticket: SupportTicketFull = {
      id: `TKT-${String(db.tickets.length + 101)}`,
      userId: user.id,
      username: user.username,
      subject: String(b.subject).slice(0, 140),
      category: b.category || 'Technical',
      department,
      priority: b.priority || 'medium',
      status: 'open',
      assignedAgentId: defaultAgent?.id || null,
      assignedAgentName: defaultAgent?.name || null,
      rating: null,
      ratingComment: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      messages: [
        {
          id: uid('msg'),
          author: user.displayName || user.username,
          role: 'customer',
          body: String(b.message).slice(0, 4000),
          attachments: Array.isArray(b.attachments) ? b.attachments.slice(0, 3) : [],
          createdAt: nowIso(),
        },
      ],
    };
    db.tickets.unshift(ticket);
    pushNotification(db, user.id, {
      category: 'support',
      priority: ticket.priority === 'urgent' ? 'high' : 'normal',
      title: `Ticket Opened: ${ticket.id}`,
      body: `${ticket.subject} (${ticket.department})`,
      linkPage: 'support',
    });
    saveDb(db);
    res.json({ ticket });
  });

  router.post('/support/tickets/:id/reply', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const t = db.tickets.find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Ticket not found.' });
    if (t.userId !== user.id && !user.isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const bodyText = String(req.body?.message || '').trim();
    if (!bodyText) return res.status(400).json({ error: 'Reply cannot be empty.' });

    const isInternal = Boolean(req.body?.internalNote && user.isAdmin);
    t.messages.push({
      id: uid('msg'),
      author: user.displayName || user.username,
      role: user.isAdmin && t.userId !== user.id ? 'staff' : 'customer',
      internalNote: isInternal,
      body: bodyText.slice(0, 4000),
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 3) : [],
      createdAt: nowIso(),
    });
    if (!isInternal) {
      t.status = user.isAdmin && t.userId !== user.id ? 'answered' : 'open';
      if (user.isAdmin && t.userId !== user.id) {
        pushNotification(db, t.userId, {
          category: 'support',
          priority: 'high',
          title: `New Reply on ${t.id}`,
          body: `${user.username}: ${bodyText.slice(0, 90)}`,
          linkPage: 'support',
        });
      }
    }
    t.updatedAt = nowIso();
    saveDb(db);
    res.json({ ticket: t });
  });

  router.patch('/support/tickets/:id/status', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const t = db.tickets.find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Ticket not found.' });
    if (t.userId !== user.id && !user.isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const nextStatus = req.body?.status;
    if (!['open', 'answered', 'escalated', 'closed'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    t.status = nextStatus;
    t.updatedAt = nowIso();
    saveDb(db);
    res.json({ ticket: t });
  });

  router.post('/support/tickets/:id/assign', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const t = db.tickets.find((x) => x.id === req.params.id);
    const agent = db.agents.find((a) => a.id === req.body?.agentId);
    if (!t || !agent) return res.status(404).json({ error: 'Ticket or agent not found.' });
    t.assignedAgentId = agent.id;
    t.assignedAgentName = agent.name;
    t.updatedAt = nowIso();
    saveDb(db);
    res.json({ ticket: t });
  });

  router.post('/support/tickets/:id/rate', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const t = db.tickets.find((x) => x.id === req.params.id && x.userId === user.id);
    if (!t) return res.status(404).json({ error: 'Ticket not found.' });
    t.rating = Math.min(5, Math.max(1, Number(req.body?.rating || 5)));
    t.ratingComment = String(req.body?.comment || '').slice(0, 300);
    t.updatedAt = nowIso();
    saveDb(db);
    res.json({ ticket: t });
  });

  router.post('/support/templates', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const tpl: SupportResponseTemplate = {
      id: uid('tpl'),
      title: String(req.body?.title || 'Template').slice(0, 80),
      department: String(req.body?.department || 'Technical Support'),
      body: String(req.body?.body || '').slice(0, 2000),
    };
    db.templates.unshift(tpl);
    saveDb(db);
    res.json({ template: tpl });
  });

  router.post('/support/kb', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const art: KnowledgeArticle = {
      id: uid('kb'),
      title: String(req.body?.title || 'Guide').slice(0, 140),
      category: req.body?.category || 'Getting Started',
      summary: String(req.body?.summary || '').slice(0, 240),
      content: String(req.body?.content || '').slice(0, 6000),
      helpfulCount: 0,
      views: 0,
      updatedAt: nowIso(),
    };
    db.knowledgeBase.unshift(art);
    saveDb(db);
    res.json({ article: art });
  });

  router.post('/support/kb/:id/helpful', async (req: Request, res: Response) => {
    const db = loadDb();
    const art = db.knowledgeBase.find((k) => k.id === req.params.id);
    if (!art) return res.status(404).json({ error: 'Article not found.' });
    art.helpfulCount += 1;
    art.views += 1;
    saveDb(db);
    res.json({ article: art });
  });

  // --- COMMUNITY FORUM & MODERATION ---
  router.get('/community', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    res.json({
      posts: db.posts,
      reports: user.isAdmin ? db.reports : [],
      following: db.profiles[user.id]?.following || [],
    });
  });

  router.post('/community/posts', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!title || !body) return res.status(400).json({ error: 'Title and content are required.' });

    const hashtags = Array.from(new Set((body.match(/#[a-zA-Z0-9_-]+/g) || []).map((t) => t.slice(1).toLowerCase())));
    const mentions = Array.from(new Set((body.match(/@[a-zA-Z0-9_.-]+/g) || []).map((m) => m.slice(1).toLowerCase())));
    const prof = db.profiles[user.id];
    const loy = db.loyalty[user.id];

    const post: CommunityPost = {
      id: uid('post'),
      userId: user.id,
      authorUsername: user.username,
      authorDisplayName: prof.displayName || user.username,
      authorAvatar: prof.avatarUrl,
      authorTier: loy.tier,
      category: req.body?.category || 'General',
      title: title.slice(0, 140),
      body: body.slice(0, 4000),
      hashtags,
      mentions,
      pinned: Boolean(req.body?.pinned && user.isAdmin),
      likes: [],
      dislikes: [],
      reactions: {},
      bookmarks: [],
      views: 1,
      createdAt: nowIso(),
      comments: [],
    };
    db.posts.unshift(post);
    awardXpAndBadge(db, user.id, 30, 15, 'badge_community');
    saveDb(db);
    res.json({ post });
  });

  router.post('/community/posts/:id/react', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const { type, emoji } = req.body || {};
    if (type === 'like') {
      post.dislikes = post.dislikes.filter((u) => u !== user.id);
      post.likes = post.likes.includes(user.id)
        ? post.likes.filter((u) => u !== user.id)
        : [...post.likes, user.id];
    } else if (type === 'dislike') {
      post.likes = post.likes.filter((u) => u !== user.id);
      post.dislikes = post.dislikes.includes(user.id)
        ? post.dislikes.filter((u) => u !== user.id)
        : [...post.dislikes, user.id];
    } else if (emoji) {
      const list = post.reactions[emoji] || [];
      post.reactions[emoji] = list.includes(user.id) ? list.filter((u) => u !== user.id) : [...list, user.id];
    }
    saveDb(db);
    res.json({ post });
  });

  router.post('/community/posts/:id/bookmark', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    post.bookmarks = post.bookmarks.includes(user.id)
      ? post.bookmarks.filter((u) => u !== user.id)
      : [...post.bookmarks, user.id];
    saveDb(db);
    res.json({ post });
  });

  router.post('/community/posts/:id/comment', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Comment cannot be empty.' });

    post.comments.push({
      id: uid('cmt'),
      userId: user.id,
      authorUsername: user.username,
      authorDisplayName: db.profiles[user.id].displayName || user.username,
      body: body.slice(0, 1200),
      createdAt: nowIso(),
    });
    awardXpAndBadge(db, user.id, 10, 5);
    if (post.userId !== user.id && post.userId !== 'system') {
      pushNotification(db, post.userId, {
        category: 'community',
        priority: 'normal',
        title: `${user.username} commented on your post`,
        body: post.title,
        linkPage: 'community',
      });
    }
    saveDb(db);
    res.json({ post });
  });

  router.post('/community/posts/:id/report', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const report: PostReportEntry = {
      id: uid('rep'),
      postId: post.id,
      postTitle: post.title,
      reporterUsername: user.username,
      reason: String(req.body?.reason || 'Inappropriate content').slice(0, 240),
      status: 'open',
      createdAt: nowIso(),
    };
    db.reports.unshift(report);
    saveDb(db);
    res.json({ report });
  });

  router.post('/community/follow/:username', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const target = String(req.params.username || '');
    const prof = db.profiles[user.id];
    const following = prof.following.includes(target)
      ? prof.following.filter((u) => u !== target)
      : [...prof.following, target];
    prof.following = following;
    saveDb(db);
    res.json({ following });
  });

  router.delete('/community/posts/:id', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    if (post.userId !== user.id && !user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    db.posts = db.posts.filter((p) => p.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });

  router.post('/community/reports/:id/resolve', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const rep = db.reports.find((r) => r.id === req.params.id);
    if (!rep) return res.status(404).json({ error: 'Report not found.' });
    const action = req.body?.action;
    rep.status = action === 'dismiss' ? 'dismissed' : 'resolved';
    if (action === 'remove_post') {
      db.posts = db.posts.filter((p) => p.id !== rep.postId);
    }
    saveDb(db);
    res.json({ report: rep });
  });

  // --- ANNOUNCEMENTS, SERVICE INCIDENTS & NOTIFICATIONS ---
  router.get('/updates', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    res.json({
      announcements: db.announcements,
      incidents: db.incidents,
      notifications: db.notifications.filter((n) => n.userId === user.id || n.userId === 'all'),
      notificationPrefs: db.notificationPrefs[user.id],
    });
  });

  router.post('/updates/announcements', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const b = req.body || {};
    if (!String(b.title || '').trim() || !String(b.body || '').trim()) {
      return res.status(400).json({ error: 'Title and message are required.' });
    }
    const ann: AnnouncementEntry = {
      id: uid('ann'),
      title: String(b.title).slice(0, 140),
      category: b.category || 'General',
      priority: b.priority || 'normal',
      targetAudience: b.targetAudience || 'all',
      displayMode: b.displayMode || 'feed',
      pinned: Boolean(b.pinned),
      archived: false,
      publishAt: b.publishAt || nowIso(),
      expiresAt: b.expiresAt || null,
      body: String(b.body).slice(0, 4000),
      author: user.displayName || user.username,
      readBy: [],
      reactions: {},
      comments: [],
      createdAt: nowIso(),
    };
    db.announcements.unshift(ann);
    pushNotification(db, user.id, {
      category: 'announcement',
      priority: ann.priority === 'critical' ? 'high' : 'normal',
      title: `Announcement: ${ann.title}`,
      body: ann.body.slice(0, 110),
      linkPage: 'updates',
    });
    saveDb(db);
    res.json({ announcement: ann });
  });

  router.patch('/updates/announcements/:id', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const ann = db.announcements.find((a) => a.id === req.params.id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found.' });
    if (typeof req.body?.pinned === 'boolean') ann.pinned = req.body.pinned;
    if (typeof req.body?.archived === 'boolean') ann.archived = req.body.archived;
    saveDb(db);
    res.json({ announcement: ann });
  });

  router.delete('/updates/announcements/:id', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    db.announcements = db.announcements.filter((a) => a.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });

  router.post('/updates/announcements/:id/read', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const ann = db.announcements.find((a) => a.id === req.params.id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found.' });
    if (!ann.readBy.includes(user.id)) ann.readBy.push(user.id);
    saveDb(db);
    res.json({ announcement: ann });
  });

  router.post('/updates/announcements/:id/react', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const ann = db.announcements.find((a) => a.id === req.params.id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found.' });
    const emoji = String(req.body?.emoji || '👍');
    const list = ann.reactions[emoji] || [];
    ann.reactions[emoji] = list.includes(user.id) ? list.filter((u) => u !== user.id) : [...list, user.id];
    saveDb(db);
    res.json({ announcement: ann });
  });

  router.post('/updates/announcements/:id/comment', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const ann = db.announcements.find((a) => a.id === req.params.id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found.' });
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Comment required.' });
    ann.comments.push({ id: uid('ac'), author: user.username, body: body.slice(0, 600), createdAt: nowIso() });
    saveDb(db);
    res.json({ announcement: ann });
  });

  router.post('/updates/incidents', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const inc: ServiceIncidentEntry = {
      id: uid('inc'),
      title: String(req.body?.title || 'Service Update').slice(0, 120),
      component: String(req.body?.component || 'Panel API').slice(0, 80),
      status: req.body?.status || 'maintenance',
      message: String(req.body?.message || '').slice(0, 800),
      createdAt: nowIso(),
      resolvedAt: req.body?.status === 'operational' ? nowIso() : null,
    };
    db.incidents.unshift(inc);
    saveDb(db);
    res.json({ incident: inc });
  });

  router.patch('/updates/incidents/:id', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin permission required.' });
    const db = loadDb();
    const inc = db.incidents.find((i) => i.id === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found.' });
    inc.status = req.body?.status || 'operational';
    if (inc.status === 'operational') inc.resolvedAt = nowIso();
    saveDb(db);
    res.json({ incident: inc });
  });

  router.post('/notifications/read-all', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    db.notifications.forEach((n) => {
      if (n.userId === user.id || n.userId === 'all') n.read = true;
    });
    saveDb(db);
    res.json({ ok: true });
  });

  router.post('/notifications/:id/read', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    const n = db.notifications.find((x) => x.id === req.params.id && (x.userId === user.id || x.userId === 'all'));
    if (n) n.read = true;
    saveDb(db);
    res.json({ ok: true });
  });

  router.put('/notifications/preferences', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const cur = db.notificationPrefs[user.id];
    const b = req.body || {};
    db.notificationPrefs[user.id] = {
      ...cur,
      browserEnabled: typeof b.browserEnabled === 'boolean' ? b.browserEnabled : cur.browserEnabled,
      emailEnabled: typeof b.emailEnabled === 'boolean' ? b.emailEnabled : cur.emailEnabled,
      soundEnabled: typeof b.soundEnabled === 'boolean' ? b.soundEnabled : cur.soundEnabled,
      discordWebhookUrl: typeof b.discordWebhookUrl === 'string' ? b.discordWebhookUrl.trim() : cur.discordWebhookUrl,
      telegramBotToken: typeof b.telegramBotToken === 'string' ? b.telegramBotToken.trim() : cur.telegramBotToken,
      telegramChatId: typeof b.telegramChatId === 'string' ? b.telegramChatId.trim() : cur.telegramChatId,
      quietHoursStart: typeof b.quietHoursStart === 'string' ? b.quietHoursStart : cur.quietHoursStart,
      quietHoursEnd: typeof b.quietHoursEnd === 'string' ? b.quietHoursEnd : cur.quietHoursEnd,
      categories: b.categories && typeof b.categories === 'object' ? { ...cur.categories, ...b.categories } : cur.categories,
    };
    saveDb(db);
    res.json({ notificationPrefs: db.notificationPrefs[user.id] });
  });

  router.post('/notifications/test-webhook', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const prefs = db.notificationPrefs[user.id];
    if (!prefs.discordWebhookUrl && (!prefs.telegramBotToken || !prefs.telegramChatId)) {
      return res.status(400).json({ error: 'Configure a Discord Webhook URL or Telegram Bot Token + Chat ID first.' });
    }
    await dispatchWebhooksIfConfigured(
      prefs,
      'HelzerX Notification Test',
      `Test alert triggered by ${user.username} at ${new Date().toLocaleString()}`
    );
    res.json({ ok: true });
  });

  // --- ADMIN GLOBAL FORCE STOP & START LOCK ---
  router.post('/admin/force-stop-all', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Administrator permission required.' });
    }

    const db = loadDb();
    const signal: 'kill' | 'stop' = req.body?.signal === 'stop' ? 'stop' : 'kill';
    const reason = String(
      req.body?.reason || 'Emergency force-stop triggered by Administration.'
    ).slice(0, 240);

    const identifiers = await collectAllPanelServerIdentifiers(req);
    let stoppedCount = 0;
    let failedCount = 0;
    const stoppedIdentifiers: string[] = [];

    for (let i = 0; i < identifiers.length; i += 6) {
      const batch = identifiers.slice(i, i + 6);
      const results = await Promise.all(
        batch.map(async (id) => {
          const ok = await sendPanelServerPower(req, id, signal);
          if (!ok && signal === 'kill') {
            return { id, ok: await sendPanelServerPower(req, id, 'stop') };
          }
          return { id, ok };
        })
      );
      for (const r of results) {
        if (r.ok) {
          stoppedCount += 1;
          stoppedIdentifiers.push(r.id);
        } else {
          failedCount += 1;
        }
      }
    }

    db.globalServerLock = {
      locked: true,
      reason,
      lockedBy: user.username,
      lockedAt: nowIso(),
      stoppedCount,
      stoppedIdentifiers,
    };
    saveDb(db);

    res.json({
      globalServerLock: db.globalServerLock,
      totalTargeted: identifiers.length,
      stoppedCount,
      failedCount,
    });
  });

  router.post('/admin/resume-all', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Administrator permission required.' });
    }

    const db = loadDb();
    const startServers = Boolean(req.body?.startServers);
    const prevIdentifiers = db.globalServerLock?.stoppedIdentifiers || [];

    let startedCount = 0;
    let failedCount = 0;

    if (startServers) {
      const requestedIds: string[] = Array.isArray(req.body?.targetIdentifiers) && req.body.targetIdentifiers.length > 0
        ? req.body.targetIdentifiers.map(String)
        : prevIdentifiers.length > 0
          ? prevIdentifiers
          : await collectAllPanelServerIdentifiers(req);

      for (let i = 0; i < requestedIds.length; i += 6) {
        const batch = requestedIds.slice(i, i + 6);
        const results = await Promise.all(
          batch.map(async (id) => ({ id, ok: await sendPanelServerPower(req, id, 'start') }))
        );
        for (const r of results) {
          if (r.ok) startedCount += 1;
          else failedCount += 1;
        }
      }
    }

    db.globalServerLock = {
      locked: false,
      reason: '',
      lockedBy: '',
      lockedAt: null,
      stoppedCount: 0,
      stoppedIdentifiers: [],
    };
    saveDb(db);

    res.json({
      globalServerLock: db.globalServerLock,
      startedCount,
      failedCount,
    });
  });

  // --- GEMINI AI SERVER ASSISTANT & CREDITS ---
  router.get('/ai', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.id) return res.status(401).json({ error: 'Pterodactyl session required.' });
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const account = ensureAiAccount(db, user.id);
    const history = (db.aiUsageHistory || []).filter((h) => h.userId === user.id).slice(0, 60);
    const messages = (db.aiChatMessages?.[user.id] || []).slice(-60);

    res.json({
      account,
      plans: AI_CREDIT_PLANS,
      walletBalance: db.wallets[user.id] || 0,
      history,
      messages,
      geminiConfigured: Boolean((process.env.GEMINI_API_KEY || '').trim()),
    });
  });

  router.post('/ai/chat', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.id) return res.status(401).json({ error: 'Pterodactyl session required.' });
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const account = ensureAiAccount(db, user.id);

    const serverId = String(req.body?.serverId || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!serverId) {
      return res.status(400).json({ error: 'Select a target server first.' });
    }
    if (!message) {
      return res.status(400).json({ error: 'Enter a message for the AI assistant.' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: 'Message exceeds 4000 character limit.' });
    }

    if (account.creditsRemaining < 2) {
      return res.status(402).json({
        error: 'AI_CREDITS_EXHAUSTED',
        message: 'Your AI credits are exhausted for this cycle. Upgrade your AI plan to continue.',
      });
    }

    const plan = getAiPlanById(account.planId);
    const recentMessages = db.aiChatMessages?.[user.id] || [];

    try {
      const result = await runServerAiAssistant({
        req,
        serverId,
        message,
        recentMessages,
        maxSteps: plan.maxToolStepsPerTurn,
        isAdmin: user.isAdmin,
        isGlobalLocked: Boolean(db.globalServerLock?.locked),
      });

      const creditsUsed = Math.min(
        account.creditsRemaining,
        Math.min(16, 2 + result.mutatingActionCount * 2)
      );

      account.creditsRemaining = Math.max(0, account.creditsRemaining - creditsUsed);
      account.creditsUsed += creditsUsed;
      account.updatedAt = nowIso();
      syncAiPercentages(account);

      const userMsg: AiChatMessage = {
        id: uid('aim'),
        role: 'user',
        text: message,
        serverId,
        serverName: result.serverName,
        createdAt: nowIso(),
      };
      const assistantMsg: AiChatMessage = {
        id: uid('aim'),
        role: 'assistant',
        text: result.reply,
        serverId,
        serverName: result.serverName,
        actions: result.actions,
        creditsUsed,
        createdAt: nowIso(),
      };

      if (!db.aiChatMessages[user.id]) db.aiChatMessages[user.id] = [];
      db.aiChatMessages[user.id].push(userMsg, assistantMsg);
      if (db.aiChatMessages[user.id].length > 80) {
        db.aiChatMessages[user.id] = db.aiChatMessages[user.id].slice(-80);
      }

      const usageEntry: AiUsageLogEntry = {
        id: uid('aiu'),
        userId: user.id,
        serverId,
        serverName: result.serverName,
        promptPreview: message.slice(0, 140),
        actions: result.actions,
        creditsUsed,
        createdAt: nowIso(),
      };
      db.aiUsageHistory.unshift(usageEntry);
      if (db.aiUsageHistory.length > 300) {
        db.aiUsageHistory = db.aiUsageHistory.slice(0, 300);
      }

      saveDb(db);

      res.json({
        account,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        usageEntry,
      });
    } catch (err: any) {
      const msg = err?.message || 'AI assistant failed to complete the request.';
      const statusCode =
        msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('GEMINI_API_KEY')
          ? 503
          : msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')
            ? 429
            : 500;
      res.status(statusCode).json({ error: msg });
    }
  });

  router.delete('/ai/chat', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.id) return res.status(401).json({ error: 'Pterodactyl session required.' });
    const db = loadDb();
    ensureUserRecords(db, user, req);
    if (!db.aiChatMessages) db.aiChatMessages = {};
    db.aiChatMessages[user.id] = [];
    saveDb(db);
    res.json({ ok: true });
  });

  router.post('/ai/plans/:planId/subscribe', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.id) return res.status(401).json({ error: 'Pterodactyl session required.' });
    const db = loadDb();
    ensureUserRecords(db, user, req);
    const account = ensureAiAccount(db, user.id);

    const plan = AI_CREDIT_PLANS.find((p) => p.id === (req.params.planId as AiPlanId));
    if (!plan) {
      return res.status(404).json({ error: 'AI credit plan not found.' });
    }

    const adminOverride = Boolean(req.body?.adminOverride && user.isAdmin);

    if (plan.priceMonthly > 0 && !adminOverride) {
      const balance = db.wallets[user.id] || 0;
      if (balance < plan.priceMonthly) {
        return res.status(402).json({
          error: `Insufficient wallet balance ($${balance.toFixed(2)}). ${plan.name} costs $${plan.priceMonthly.toFixed(2)}/mo.`,
        });
      }

      db.wallets[user.id] = Number((balance - plan.priceMonthly).toFixed(2));
      db.transactions.unshift({
        id: uid('tx'),
        userId: user.id,
        type: 'debit',
        amount: plan.priceMonthly,
        taxAmount: 0,
        method: 'HelzerX Wallet',
        status: 'completed',
        reference: `AI-${plan.id.toUpperCase()}`,
        note: `AI Credits Plan: ${plan.name} (${plan.creditPercent}% / ${plan.monthlyCredits} credits)`,
        createdAt: nowIso(),
      });

      db.invoices.unshift({
        id: uid('inv'),
        userId: user.id,
        username: user.username,
        number: `INV-${new Date().getFullYear()}-${String(db.invoices.length + 1001)}`,
        description: `HelzerX AI — ${plan.name} (${plan.creditPercent}% Credits)`,
        subtotal: plan.priceMonthly,
        taxRate: 0,
        taxAmount: 0,
        discountAmount: 0,
        total: plan.priceMonthly,
        status: 'paid',
        method: 'HelzerX Wallet',
        issuedAt: nowIso(),
        paidAt: nowIso(),
      });
    }

    account.planId = plan.id;
    account.planName = plan.name;
    account.creditPercentCapacity = plan.creditPercent;
    account.monthlyCreditLimit = plan.monthlyCredits;
    account.creditsRemaining = plan.monthlyCredits;
    account.creditsUsed = 0;
    account.resetAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    account.updatedAt = nowIso();
    syncAiPercentages(account);

    pushNotification(db, user.id, {
      category: 'billing',
      priority: 'normal',
      title: `AI Plan Active: ${plan.name}`,
      body: `${plan.creditPercent}% capacity (${plan.monthlyCredits} credits) ready for use.`,
      linkPage: 'dashboard',
    });

    saveDb(db);
    res.json({
      account,
      walletBalance: db.wallets[user.id] || 0,
    });
  });

  router.post('/ai/admin/manage', async (req: Request, res: Response) => {
    const user = await resolveUser(req);
    if (!user.id) return res.status(401).json({ error: 'Pterodactyl session required.' });
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Administrator permission required.' });
    }

    const db = loadDb();
    ensureUserRecords(db, user, req);
    const targetUserId = String(req.body?.userId || user.id);
    const account = ensureAiAccount(db, targetUserId);

    if (req.body?.planId) {
      const plan = AI_CREDIT_PLANS.find((p) => p.id === req.body.planId);
      if (!plan) return res.status(404).json({ error: 'AI credit plan not found.' });
      account.planId = plan.id;
      account.planName = plan.name;
      account.creditPercentCapacity = plan.creditPercent;
      account.monthlyCreditLimit = plan.monthlyCredits;
      account.creditsRemaining = plan.monthlyCredits;
      account.creditsUsed = 0;
    }

    if (typeof req.body?.bonusCredits === 'number' && req.body.bonusCredits > 0) {
      account.creditsRemaining = Math.min(
        account.monthlyCreditLimit,
        account.creditsRemaining + Math.round(req.body.bonusCredits)
      );
    }

    if (req.body?.resetCycle) {
      account.creditsRemaining = account.monthlyCreditLimit;
      account.creditsUsed = 0;
    }

    account.updatedAt = nowIso();
    syncAiPercentages(account);
    saveDb(db);

    res.json({ account });
  });

  return router;
}
