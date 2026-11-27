export type ServerStatus = 'running' | 'offline' | 'starting' | 'stopping';
export type PowerSignal = 'start' | 'stop' | 'restart' | 'kill';
export type ServerCategory = 'Game Servers' | 'Applications' | 'Databases' | 'Proxies';

export interface ServerLimits {
  memory: number; // MB
  swap: number; // MB
  disk: number; // MB
  io: number;
  cpu: number; // % (e.g. 200 = 2 vCPU)
}

export interface ServerResources {
  cpuPercent: number;
  memoryBytes: number;
  diskBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  uptimeMs: number;
}

export interface AllocationEntry {
  id: number;
  ip: string;
  alias: string | null;
  port: number;
  notes: string | null;
  isDefault: boolean;
  serverId?: string | null;
  nodeId?: number;
}

export interface PterodactylServer {
  id: string;
  uuid: string;
  identifier: string;
  name: string;
  description: string;
  node: string;
  location: string;
  egg: string;
  category: ServerCategory;
  status: ServerStatus;
  isFavorite: boolean;
  limits: ServerLimits;
  resources: ServerResources;
  allocations: AllocationEntry[];
  startupCommand: string;
  dockerImage: string;
  createdAt: string;
  renewalDate: string;
  ownerId: number;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mime: string;
  modifiedAt: string;
  content?: string;
}

export interface BackupEntry {
  uuid: string;
  name: string;
  ignoredFiles: string[];
  sha256Hash: string;
  bytes: number;
  createdAt: string;
  completedAt: string | null;
  isSuccessful: boolean;
  isLocked: boolean;
  progress: number;
}

export interface DatabaseEntry {
  id: string;
  name: string;
  username: string;
  host: string;
  port: number;
  connectionsFrom: string;
  maxConnections: number;
  password: string;
  createdAt: string;
}

export interface NotificationPrefs {
  serverPowerAlerts: boolean;
  backupCompleted: boolean;
  billingRenewals: boolean;
  securityLogins: boolean;
}

export interface UserProfile {
  id: number;
  uuid: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  twoFactorEnabled: boolean;
  recoveryCodes: string[];
  avatarUrl: string;
  notifications: NotificationPrefs;
  language: string;
}

export interface ApiKeyEntry {
  identifier: string;
  description: string;
  allowedIps: string[];
  lastUsedAt: string | null;
  createdAt: string;
  tokenPreview: string;
}

export interface SessionEntry {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface LoginHistoryEntry {
  id: string;
  timestamp: string;
  ip: string;
  location: string;
  device: string;
  status: 'success' | 'blocked';
}

export interface ActivityLogEntry {
  id: string;
  event: string;
  actor: string;
  target: string;
  timestamp: string;
  ip: string;
  category: 'power' | 'file' | 'backup' | 'database' | 'auth' | 'admin' | 'billing';
}

export interface AdminNode {
  id: number;
  name: string;
  locationId: number;
  locationCode: string;
  fqdn: string;
  scheme: 'https' | 'http';
  memoryTotal: number;
  memoryAllocated: number;
  diskTotal: number;
  diskAllocated: number;
  daemonListen: number;
  daemonSftp: number;
  maintenanceMode: boolean;
  serversCount: number;
  cpuThreads: number;
  status: 'online' | 'maintenance';
}

export interface AdminLocation {
  id: number;
  shortCode: string;
  description: string;
  nodesCount: number;
  serversCount: number;
}

export interface AdminDatabaseHost {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  maxDatabases: number;
  nodeId: number;
  databasesCount: number;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  serversCount: number;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface PanelSettings {
  panelName: string;
  supportEmail: string;
  registrationEnabled: boolean;
  defaultTheme: 'light' | 'dark';
  telemetryIntervalMs: number;
  maintenanceBanner: string;
}

export interface HostingPlan {
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
}

export interface InvoiceEntry {
  id: string;
  number: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
}

export interface SubscriptionEntry {
  id: string;
  serverId: string;
  serverName: string;
  planName: string;
  amountMonthly: number;
  status: 'active' | 'expiring_soon' | 'suspended';
  nextRenewal: string;
  autoRenew: boolean;
}

export interface CouponEntry {
  code: string;
  discountPercent: number;
  creditBonus: number;
  description: string;
  redeemed: boolean;
}

export interface BillingState {
  walletBalance: number;
  referralCode: string;
  referralCount: number;
  referralEarnings: number;
  plans: HostingPlan[];
  invoices: InvoiceEntry[];
  subscriptions: SubscriptionEntry[];
  coupons: CouponEntry[];
  paymentGatewayConfigured: boolean;
}

export interface TicketMessage {
  id: string;
  author: string;
  role: 'customer' | 'staff';
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  department: 'Technical Support' | 'Billing & Renewals' | 'Node Infrastructure';
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'answered' | 'closed';
  serverName?: string;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface ConsoleLine {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'daemon' | 'cmd';
  text: string;
}

export interface TelemetryPoint {
  time: string;
  cpu: number;
  memoryPercent: number;
  networkKbps: number;
}
