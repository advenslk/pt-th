import { PanelApiError } from './client';
import type {
  AnnouncementEntry,
  BillingConfig,
  BillingOverviewResponse,
  CommunityPost,
  ExtendedProfile,
  GlobalServerLockState,
  HelzerxBootstrapResponse,
  HelzerxCoupon,
  KnowledgeArticle,
  NotificationChannelPrefs,
  PostReportEntry,
  PublicUserView,
  RewardsOverviewResponse,
  SecurityPolicySettings,
  ServiceIncidentEntry,
  SupportOverviewResponse,
  SupportTicketFull,
  TicketAttachment,
  TrackedDevice,
} from '../types/helzerx';

function getXsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getMetaCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;
}

async function hxRequest<T>(path: string, options: RequestInit = {}, retriedCsrf = false): Promise<T> {
  const xsrf = getXsrfToken();
  const metaCsrf = getMetaCsrfToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (xsrf) {
    headers['X-XSRF-TOKEN'] = xsrf;
  } else if (metaCsrf) {
    headers['X-CSRF-TOKEN'] = metaCsrf;
  }

  if (options.body !== undefined && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/api/client/helzerx${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (res.status === 419 && !retriedCsrf) {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' }).catch(() => {});
    return hxRequest<T>(path, options, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new PanelApiError(
      body?.errors?.[0]?.detail || body?.error || body?.message || `HTTP ${res.status}`,
      res.status,
      body?.error
    );
  }

  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

export const helzerxApi = {
  getBootstrap: () => hxRequest<HelzerxBootstrapResponse>('/bootstrap'),

  // Extended Profile & Account
  updateProfile: (payload: Partial<ExtendedProfile>) =>
    hxRequest<{ profile: ExtendedProfile }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  verifyContact: (channel: 'email' | 'phone') =>
    hxRequest<{ profile: ExtendedProfile }>('/profile/verify-contact', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    }),

  setDeactivationStatus: (action: 'active' | 'deactivated' | 'deletion_requested') =>
    hxRequest<{ profile: ExtendedProfile }>('/profile/deactivation', {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  getPublicProfile: (username: string) =>
    hxRequest<PublicUserView>(`/profile/${encodeURIComponent(username)}`),

  // Security Policy, Devices & Lockdown
  updateSecurityPolicy: (payload: Partial<SecurityPolicySettings>) =>
    hxRequest<{ securityPolicy: SecurityPolicySettings }>('/security/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  regenerateBackupCodes: () =>
    hxRequest<{ backupCodes: string[] }>('/security/backup-codes/regenerate', { method: 'POST' }),

  toggleDeviceTrust: (deviceId: string) =>
    hxRequest<{ devices: TrackedDevice[] }>(`/security/devices/${encodeURIComponent(deviceId)}/trust`, {
      method: 'POST',
    }),

  revokeDevice: (deviceId: string) =>
    hxRequest<{ devices: TrackedDevice[] }>(`/security/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    }),

  forceLogoutAll: () =>
    hxRequest<{ devices: TrackedDevice[] }>('/security/sessions/force-logout', { method: 'POST' }),

  setLockdownMode: (enabled: boolean) =>
    hxRequest<{ lockdownMode: boolean }>('/security/lockdown', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),

  // Billing, Wallet, Coupons, Methods & Refunds
  getBilling: () => hxRequest<BillingOverviewResponse>('/billing'),

  addFunds: (payload: { amount: number; method: string; reference?: string }) =>
    hxRequest<{ walletBalance: number }>('/billing/add-funds', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyManualPayment: (transactionId: string, approve: boolean) =>
    hxRequest<{ ok?: boolean }>('/billing/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ transactionId, approve }),
    }),

  purchasePlan: (planId: string, couponCode?: string) =>
    hxRequest<{ walletBalance: number }>(`/billing/plans/${encodeURIComponent(planId)}/purchase`, {
      method: 'POST',
      body: JSON.stringify({ couponCode }),
    }),

  redeemCoupon: (code: string) =>
    hxRequest<{ message: string; walletBalance: number }>('/billing/coupons/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  createCoupon: (payload: Partial<HelzerxCoupon>) =>
    hxRequest<{ coupon?: HelzerxCoupon }>('/billing/coupons', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteCoupon: (id: string) =>
    hxRequest<{ ok: boolean }>(`/billing/coupons/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  addPaymentMethod: (payload: { provider: string; label: string; last4: string }) =>
    hxRequest<{ ok?: boolean }>('/billing/methods', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deletePaymentMethod: (id: string) =>
    hxRequest<{ ok: boolean }>(`/billing/methods/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  requestRefund: (invoiceId: string, reason: string) =>
    hxRequest<{ ok?: boolean }>('/billing/refunds', {
      method: 'POST',
      body: JSON.stringify({ invoiceId, reason }),
    }),

  resolveRefund: (id: string, approve: boolean, adminNote: string) =>
    hxRequest<{ ok?: boolean }>(`/billing/refunds/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ approve, adminNote }),
    }),

  updateBillingConfig: (payload: Partial<BillingConfig>) =>
    hxRequest<{ config: BillingConfig }>('/billing/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Rewards & Loyalty
  getRewards: () => hxRequest<RewardsOverviewResponse>('/rewards'),

  claimReward: (type: 'daily' | 'weekly' | 'monthly' | 'birthday' | 'event', birthdayMonthDay?: string) =>
    hxRequest<{ message?: string; walletBalance?: number }>('/rewards/claim', {
      method: 'POST',
      body: JSON.stringify({ type, birthdayMonthDay }),
    }),

  redeemShopItem: (itemId: string) =>
    hxRequest<{ walletBalance: number }>(`/rewards/shop/${encodeURIComponent(itemId)}/redeem`, {
      method: 'POST',
    }),

  upgradeMembershipTier: (tier: 'Premium' | 'VIP') =>
    hxRequest<{ walletBalance: number }>('/rewards/tier/upgrade', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    }),

  applyReferralCode: (code: string) =>
    hxRequest<{ bonus: number; walletBalance: number }>('/rewards/referral/apply', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // Support & Knowledge Base
  getSupport: () => hxRequest<SupportOverviewResponse>('/support'),

  createSupportTicket: (payload: {
    subject: string;
    category: string;
    department: string;
    priority: string;
    message: string;
    attachments?: TicketAttachment[];
  }) =>
    hxRequest<{ ticket?: SupportTicketFull; id?: string }>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  replySupportTicket: (
    ticketId: string,
    payload: { message: string; internalNote?: boolean; attachments?: TicketAttachment[] }
  ) =>
    hxRequest<{ ok?: boolean }>(`/support/tickets/${encodeURIComponent(ticketId)}/reply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSupportTicketStatus: (ticketId: string, status: SupportTicketFull['status']) =>
    hxRequest<{ ok?: boolean }>(`/support/tickets/${encodeURIComponent(ticketId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  assignSupportTicket: (ticketId: string, agentId: string) =>
    hxRequest<{ ok?: boolean }>(`/support/tickets/${encodeURIComponent(ticketId)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    }),

  rateSupportTicket: (ticketId: string, rating: number, comment: string) =>
    hxRequest<{ ok?: boolean }>(`/support/tickets/${encodeURIComponent(ticketId)}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    }),

  createSupportTemplate: (payload: { title: string; department: string; body: string }) =>
    hxRequest<{ ok?: boolean }>('/support/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createKnowledgeArticle: (payload: Partial<KnowledgeArticle>) =>
    hxRequest<{ ok?: boolean }>('/support/kb', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  markKbHelpful: (articleId: string) =>
    hxRequest<{ ok?: boolean }>(`/support/kb/${encodeURIComponent(articleId)}/helpful`, {
      method: 'POST',
    }),

  // Community Forum
  getCommunity: () =>
    hxRequest<{ posts: CommunityPost[]; reports: PostReportEntry[]; following: string[] }>('/community'),

  createPost: (payload: { title: string; category: string; body: string; pinned?: boolean }) =>
    hxRequest<{ id?: string }>('/community/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reactPost: (postId: string, payload: { type?: 'like' | 'dislike'; emoji?: string }) =>
    hxRequest<{ ok?: boolean }>(`/community/posts/${encodeURIComponent(postId)}/react`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  bookmarkPost: (postId: string) =>
    hxRequest<{ ok?: boolean }>(`/community/posts/${encodeURIComponent(postId)}/bookmark`, {
      method: 'POST',
    }),

  commentPost: (postId: string, body: string) =>
    hxRequest<{ ok?: boolean }>(`/community/posts/${encodeURIComponent(postId)}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  reportPost: (postId: string, reason: string) =>
    hxRequest<{ ok?: boolean }>(`/community/posts/${encodeURIComponent(postId)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  toggleFollowUser: (username: string) =>
    hxRequest<{ following: string[] }>(`/community/follow/${encodeURIComponent(username)}`, {
      method: 'POST',
    }),

  deletePost: (postId: string) =>
    hxRequest<{ ok?: boolean }>(`/community/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
    }),

  resolveReport: (reportId: string, action: 'resolve' | 'dismiss' | 'remove_post') =>
    hxRequest<{ ok?: boolean }>(`/community/reports/${encodeURIComponent(reportId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  // Announcements, Status Incidents & Notifications
  getUpdates: () =>
    hxRequest<{
      announcements: AnnouncementEntry[];
      incidents: ServiceIncidentEntry[];
      notifications: HelzerxBootstrapResponse['notifications'];
      notificationPrefs: NotificationChannelPrefs;
    }>('/updates'),

  createAnnouncement: (payload: Partial<AnnouncementEntry>) =>
    hxRequest<{ id?: string }>('/updates/announcements', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAnnouncement: (id: string, payload: { pinned?: boolean; archived?: boolean }) =>
    hxRequest<{ ok?: boolean }>(`/updates/announcements/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteAnnouncement: (id: string) =>
    hxRequest<{ ok?: boolean }>(`/updates/announcements/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  markAnnouncementRead: (id: string) =>
    hxRequest<{ ok?: boolean }>(`/updates/announcements/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    }),

  reactAnnouncement: (id: string, emoji: string) =>
    hxRequest<{ ok?: boolean }>(`/updates/announcements/${encodeURIComponent(id)}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  commentAnnouncement: (id: string, body: string) =>
    hxRequest<{ ok?: boolean }>(`/updates/announcements/${encodeURIComponent(id)}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  createIncident: (payload: Partial<ServiceIncidentEntry>) =>
    hxRequest<{ id?: string }>('/updates/incidents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateIncident: (id: string, status: ServiceIncidentEntry['status']) =>
    hxRequest<{ ok?: boolean }>(`/updates/incidents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  readAllNotifications: () =>
    hxRequest<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),

  readNotification: (id: string) =>
    hxRequest<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),

  updateNotificationPrefs: (payload: Partial<NotificationChannelPrefs>) =>
    hxRequest<{ notificationPrefs: NotificationChannelPrefs }>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  testWebhook: () => hxRequest<{ ok: boolean }>('/notifications/test-webhook', { method: 'POST' }),

  // Admin Global Force-Stop & Start Lock
  forceStopAllServers: (payload?: { reason?: string; signal?: 'kill' | 'stop' }) =>
    hxRequest<{
      globalServerLock: GlobalServerLockState;
      totalTargeted: number;
      stoppedCount: number;
      failedCount: number;
    }>('/admin/force-stop-all', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),

  resumeAllServers: (payload?: { startServers?: boolean; targetIdentifiers?: string[] }) =>
    hxRequest<{
      globalServerLock: GlobalServerLockState;
      startedCount: number;
      failedCount: number;
    }>('/admin/resume-all', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
};
