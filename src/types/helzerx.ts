import type { ServerCategory } from './panel';

export type MembershipTier = 'Standard' | 'Premium' | 'VIP';

export interface ExtendedProfile {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  socialLinks: {
    discord: string;
    github: string;
    website: string;
    twitter: string;
  };
  isPublic: boolean;
  emailVerified: boolean;
  phoneNumber: string;
  phoneVerified: boolean;
  recoveryEmail: string;
  lockdownMode: boolean;
  deactivationStatus: 'active' | 'deactivated' | 'deletion_requested';
  following: string[];
  followers: string[];
  updatedAt: string;
}

export interface SecurityQuestionEntry {
  id: string;
  question: string;
  answerHint: string;
}

export interface SecurityPolicySettings {
  loginOtpEnabled: boolean;
  emailLoginAlerts: boolean;
  newDeviceAlerts: boolean;
  ipLoginAlerts: boolean;
  suspiciousLoginProtection: boolean;
  loginAttemptLimit: number;
  sessionTimeoutMinutes: number;
  passwordExpiryDays: number;
  captchaOnLogin: boolean;
  antiBotEnabled: boolean;
  securityQuestions: SecurityQuestionEntry[];
  backupCodes: string[];
}

export interface TrackedDevice {
  id: string;
  label: string;
  browser: string;
  os: string;
  ip: string;
  trusted: boolean;
  current: boolean;
  lastSeenAt: string;
}

export interface SecurityEvent {
  id: string;
  userId: string;
  type: string;
  ip: string;
  device: string;
  status: 'allowed' | 'flagged' | 'blocked';
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'credit' | 'debit' | 'refund' | 'reward' | 'referral';
  amount: number;
  taxAmount: number;
  method: string;
  status: 'completed' | 'pending' | 'rejected';
  reference: string;
  note: string;
  createdAt: string;
}

export interface HelzerxPlan {
  id: string;
  name: string;
  tagline: string;
  category: ServerCategory;
  priceMonthly: number;
  cpuLimit: number;
  memoryMb: number;
  diskMb: number;
  backupsLimit: number;
  databasesLimit: number;
  egg: string;
  popular?: boolean;
}

export interface HelzerxInvoice {
  id: string;
  userId: string;
  username: string;
  number: string;
  description: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  status: 'paid' | 'pending' | 'refunded' | 'overdue';
  method: string;
  issuedAt: string;
  paidAt: string | null;
}

export interface HelzerxCoupon {
  id: string;
  code: string;
  discountPercent: number;
  creditBonus: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  description: string;
}

export interface PaymentMethodEntry {
  id: string;
  userId: string;
  provider: 'Stripe' | 'PayPal' | 'PayHere' | 'Bank Transfer' | 'Crypto';
  label: string;
  last4: string;
  isDefault: boolean;
  createdAt: string;
}

export interface RefundRequestEntry {
  id: string;
  userId: string;
  username: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt: string;
}

export interface BillingConfig {
  taxRatePercent: number;
  currency: string;
  enabledGateways: string[];
  manualPaymentInstructions: string;
}

export interface BillingOverviewResponse {
  walletBalance: number;
  loyaltyPoints: number;
  referralCode: string;
  referralCount: number;
  referralEarnings: number;
  config: BillingConfig;
  plans: HelzerxPlan[];
  transactions: WalletTransaction[];
  invoices: HelzerxInvoice[];
  coupons: HelzerxCoupon[];
  paymentMethods: PaymentMethodEntry[];
  refunds: RefundRequestEntry[];
  pendingManualPayments: WalletTransaction[];
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  category: 'Loyalty' | 'Security' | 'Community' | 'Billing';
  xpReward: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface RewardShopItem {
  id: string;
  name: string;
  description: string;
  costPoints: number;
  type: 'wallet_credit' | 'vip_days' | 'xp_boost' | 'badge';
  value: number;
  badgeId?: string;
  stock: number;
}

export interface RewardClaimHistory {
  id: string;
  userId: string;
  type: 'daily' | 'weekly' | 'monthly' | 'birthday' | 'event' | 'shop' | 'badge' | 'referral';
  title: string;
  xpDelta: number;
  pointsDelta: number;
  walletDelta: number;
  createdAt: string;
}

export interface LoyaltyAccount {
  userId: string;
  username: string;
  displayName: string;
  xp: number;
  weeklyXp: number;
  monthlyXp: number;
  level: number;
  points: number;
  streakDays: number;
  longestStreak: number;
  lastDailyClaimAt: string | null;
  lastWeeklyClaimAt: string | null;
  lastMonthlyClaimAt: string | null;
  lastEventClaimAt: string | null;
  tier: MembershipTier;
  tierExpiresAt: string | null;
  birthdayMonthDay: string;
  referralCode: string;
  referredBy: string | null;
  referralCount: number;
  referralEarnings: number;
  badges: string[];
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  level: number;
  xp: number;
  weeklyXp: number;
  monthlyXp: number;
  points: number;
  streakDays: number;
  tier: MembershipTier;
  referralCount: number;
}

export interface RewardsOverviewResponse {
  account: LoyaltyAccount;
  badgesCatalog: BadgeDefinition[];
  shopItems: RewardShopItem[];
  claims: RewardClaimHistory[];
  leaderboards: {
    global: LeaderboardEntry[];
    weekly: LeaderboardEntry[];
    monthly: LeaderboardEntry[];
    referrals: LeaderboardEntry[];
  };
}

export interface SupportAgentProfile {
  id: string;
  name: string;
  role: string;
  department: string;
  online: boolean;
  resolvedCount: number;
  avgRating: number;
}

export interface SupportResponseTemplate {
  id: string;
  title: string;
  department: string;
  body: string;
}

export interface TicketAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  dataUrl: string;
}

export interface SupportTicketMessage {
  id: string;
  author: string;
  role: 'customer' | 'staff';
  internalNote?: boolean;
  body: string;
  attachments?: TicketAttachment[];
  createdAt: string;
}

export interface SupportTicketFull {
  id: string;
  userId: string;
  username: string;
  subject: string;
  category: 'General' | 'Billing' | 'Technical' | 'Abuse' | 'Migration';
  department: 'Technical Support' | 'Billing & Renewals' | 'Node Infrastructure';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'answered' | 'escalated' | 'closed';
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  rating: number | null;
  ratingComment: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: 'Getting Started' | 'Billing' | 'Security' | 'Troubleshooting';
  summary: string;
  content: string;
  helpfulCount: number;
  views: number;
  updatedAt: string;
}

export interface SupportOverviewResponse {
  tickets: SupportTicketFull[];
  agents: SupportAgentProfile[];
  templates: SupportResponseTemplate[];
  knowledgeBase: KnowledgeArticle[];
  stats: {
    total: number;
    open: number;
    escalated: number;
    closed: number;
    avgRating: number;
  };
}

export interface CommunityComment {
  id: string;
  userId: string;
  authorUsername: string;
  authorDisplayName: string;
  body: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  userId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string;
  authorTier: MembershipTier;
  category: 'General' | 'Tutorials' | 'Showcase' | 'Feature Requests' | 'Help';
  title: string;
  body: string;
  hashtags: string[];
  mentions: string[];
  pinned: boolean;
  likes: string[];
  dislikes: string[];
  reactions: Record<string, string[]>;
  bookmarks: string[];
  views: number;
  createdAt: string;
  comments: CommunityComment[];
}

export interface PostReportEntry {
  id: string;
  postId: string;
  postTitle: string;
  reporterUsername: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface PublicUserView {
  profile: ExtendedProfile;
  loyalty: Pick<LoyaltyAccount, 'level' | 'xp' | 'tier' | 'badges' | 'streakDays'>;
  recentPosts: Array<{ id: string; title: string; category: string; createdAt: string }>;
}

export interface AnnouncementEntry {
  id: string;
  title: string;
  category: 'Maintenance' | 'Emergency' | 'Promotional' | 'Release' | 'General';
  priority: 'normal' | 'high' | 'critical';
  targetAudience: 'all' | 'vip' | 'admins';
  displayMode: 'feed' | 'banner' | 'popup';
  pinned: boolean;
  archived: boolean;
  publishAt: string;
  expiresAt: string | null;
  body: string;
  author: string;
  readBy: string[];
  reactions: Record<string, string[]>;
  comments: Array<{ id: string; author: string; body: string; createdAt: string }>;
  createdAt: string;
}

export interface ServiceIncidentEntry {
  id: string;
  title: string;
  component: string;
  status: 'operational' | 'degraded' | 'maintenance' | 'outage';
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface NotificationEntry {
  id: string;
  userId: string;
  category: 'security' | 'billing' | 'support' | 'community' | 'announcement' | 'reward';
  priority: 'low' | 'normal' | 'high';
  title: string;
  body: string;
  read: boolean;
  linkPage: 'dashboard' | 'account' | 'billing' | 'support' | 'rewards' | 'community' | 'updates';
  createdAt: string;
}

export interface NotificationChannelPrefs {
  browserEnabled: boolean;
  emailEnabled: boolean;
  soundEnabled: boolean;
  discordWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  categories: Record<'security' | 'billing' | 'support' | 'community' | 'announcement' | 'reward', boolean>;
}

export interface HelzerxBootstrapResponse {
  userId: string;
  username: string;
  isAdmin: boolean;
  profile: ExtendedProfile;
  securityPolicy: SecurityPolicySettings;
  devices: TrackedDevice[];
  securityEvents: SecurityEvent[];
  walletBalance: number;
  loyalty: LoyaltyAccount;
  unreadNotifications: number;
  notifications: NotificationEntry[];
  notificationPrefs: NotificationChannelPrefs;
  activeAnnouncements: AnnouncementEntry[];
  incidents: ServiceIncidentEntry[];
  recentTransactions: WalletTransaction[];
}
