import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  Bell,
  CheckCheck,
  Megaphone,
  Pin,
  Plus,
  Search,
  Send,
  Settings2,
  Trash2,
  Volume2,
} from 'lucide-react';
import { helzerxApi } from '../api/helzerx';
import { usePanel } from '../context/PanelContext';
import type {
  AnnouncementEntry,
  NotificationChannelPrefs,
  NotificationEntry,
  ServiceIncidentEntry,
} from '../types/helzerx';
import { formatRelativeTime } from '../utils/format';

export function UpdatesPage() {
  const { helzerxData, servers, notify, refreshHelzerx } = usePanel();
  const [announcements, setAnnouncements] = useState<AnnouncementEntry[]>([]);
  const [incidents, setIncidents] = useState<ServiceIncidentEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [prefs, setPrefs] = useState<NotificationChannelPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'announcements' | 'notifications' | 'status' | 'channels'>('announcements');

  const [notifSearch, setNotifSearch] = useState('');
  const [notifCategory, setNotifCategory] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  const [annCommentDrafts, setAnnCommentDrafts] = useState<Record<string, string>>({});
  const [newAnnOpen, setNewAnnOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annCategory, setAnnCategory] = useState<AnnouncementEntry['category']>('General');
  const [annPriority, setAnnPriority] = useState<AnnouncementEntry['priority']>('normal');
  const [annAudience, setAnnAudience] = useState<AnnouncementEntry['targetAudience']>('all');
  const [annMode, setAnnMode] = useState<AnnouncementEntry['displayMode']>('feed');
  const [annBody, setAnnBody] = useState('');
  const [annPinned, setAnnPinned] = useState(false);

  const [incTitle, setIncTitle] = useState('');
  const [incComponent, setIncComponent] = useState('Wings Infrastructure');
  const [incStatus, setIncStatus] = useState<ServiceIncidentEntry['status']>('maintenance');
  const [incMsg, setIncMsg] = useState('');

  const isAdmin = Boolean(helzerxData?.isAdmin);
  const userId = helzerxData?.userId || '1';

  const loadUpdates = useCallback(async () => {
    try {
      const res = await helzerxApi.getUpdates();
      setAnnouncements(res.announcements);
      setIncidents(res.incidents);
      setNotifications(res.notifications);
      setPrefs(res.notificationPrefs);
    } catch (err: any) {
      notify('Could not load updates', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await helzerxApi.createAnnouncement({
        title: annTitle,
        category: annCategory,
        priority: annPriority,
        targetAudience: annAudience,
        displayMode: annMode,
        body: annBody,
        pinned: annPinned,
      });
      setAnnTitle('');
      setAnnBody('');
      setNewAnnOpen(false);
      notify('Announcement published', undefined, 'success');
      await Promise.all([loadUpdates(), refreshHelzerx()]);
    } catch (err: any) {
      notify('Publish failed', err.message, 'error');
    }
  };

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefs) return;
    try {
      if (prefs.browserEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      await helzerxApi.updateNotificationPrefs(prefs);
      notify('Notification preferences saved', undefined, 'success');
      refreshHelzerx();
    } catch (err: any) {
      notify('Save failed', err.message, 'error');
    }
  };

  const handleTestWebhook = async () => {
    try {
      await helzerxApi.testWebhook();
      notify('Test alert dispatched', 'Check your Discord or Telegram channel.', 'success');
    } catch (err: any) {
      notify('Webhook test failed', err.message, 'error');
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await helzerxApi.createIncident({
        title: incTitle,
        component: incComponent,
        status: incStatus,
        message: incMsg,
      });
      setIncTitle('');
      setIncMsg('');
      notify('Service status updated', undefined, 'success');
      loadUpdates();
    } catch (err: any) {
      notify('Status update failed', err.message, 'error');
    }
  };

  const filteredNotifs = useMemo(() => {
    const q = notifSearch.trim().toLowerCase();
    return notifications.filter((n) => {
      if (notifCategory !== 'all' && n.category !== notifCategory) return false;
      if (!q) return true;
      return `${n.title} ${n.body}`.toLowerCase().includes(q);
    });
  }, [notifications, notifSearch, notifCategory]);

  const visibleAnnouncements = useMemo(
    () => announcements.filter((a) => (showArchived ? true : !a.archived)),
    [announcements, showArchived]
  );

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
        <div className="h-48 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
      </div>
    );
  }

  const onlineServers = servers.filter((s) => s.status === 'running').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
            Announcements, Service Status &amp; Alerts
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            Platform notices, infrastructure uptime, real-time alerts, and Discord / Telegram integration
          </p>
        </div>

        <div className="mx-well-3d inline-flex flex-wrap p-1.5 rounded-2xl gap-1">
          {(
            [
              { id: 'announcements', label: 'Announcements', icon: Megaphone },
              { id: 'notifications', label: `Notifications (${notifications.filter((n) => !n.read).length})`, icon: Bell },
              { id: 'status', label: 'Service Status', icon: Activity },
              { id: 'channels', label: 'Alert Channels', icon: Settings2 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                  tab === item.id ? 'mx-btn-3d-primary' : 'text-[#525252] dark:text-zinc-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-[#525252] dark:text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded accent-[#8B5CF6]" />
              Show archived announcements
            </label>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setNewAnnOpen((o) => !o)}
                className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Broadcast Announcement
              </button>
            )}
          </div>

          {newAnnOpen && isAdmin && (
            <form onSubmit={handleCreateAnnouncement} className="mx-card-3d p-5 rounded-2xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Announcement title"
                  className="mx-input-3d sm:col-span-2 px-3 py-2 rounded-xl"
                />
                <select value={annCategory} onChange={(e) => setAnnCategory(e.target.value as any)} className="mx-input-3d px-3 py-2 rounded-xl">
                  <option value="General">General</option>
                  <option value="Release">Release</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Promotional">Promotional</option>
                </select>
                <select value={annMode} onChange={(e) => setAnnMode(e.target.value as any)} className="mx-input-3d px-3 py-2 rounded-xl">
                  <option value="feed">Feed Card</option>
                  <option value="banner">Global Top Banner</option>
                  <option value="popup">Popup Modal</option>
                </select>
                <select value={annPriority} onChange={(e) => setAnnPriority(e.target.value as any)} className="mx-input-3d px-3 py-2 rounded-xl">
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical Emergency</option>
                </select>
                <select value={annAudience} onChange={(e) => setAnnAudience(e.target.value as any)} className="mx-input-3d px-3 py-2 rounded-xl">
                  <option value="all">Target: All Users</option>
                  <option value="vip">Target: VIP Members</option>
                  <option value="admins">Target: Staff/Admins</option>
                </select>
                <label className="flex items-center gap-2 text-xs cursor-pointer sm:col-span-2">
                  <input type="checkbox" checked={annPinned} onChange={(e) => setAnnPinned(e.target.checked)} className="rounded accent-[#8B5CF6]" />
                  Pin to top
                </label>
              </div>
              <textarea
                rows={3}
                required
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Write announcement details..."
                className="mx-input-3d w-full px-3 py-2 rounded-xl text-xs"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNewAnnOpen(false)} className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="mx-btn-3d-primary px-4 py-1.5 rounded-xl text-xs font-medium cursor-pointer">
                  Publish
                </button>
              </div>
            </form>
          )}

          {visibleAnnouncements.map((ann) => {
            const isRead = ann.readBy.includes(userId);
            return (
              <article key={ann.id} className="mx-card-3d p-5 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#777777]">
                      {ann.pinned && (
                        <span className="inline-flex items-center gap-1 text-[#8B5CF6] font-semibold">
                          <Pin className="w-3 h-3" /> Pinned
                        </span>
                      )}
                      <span className="mx-well-3d px-2 py-0.5 rounded-lg">{ann.category}</span>
                      <span className="uppercase font-mono">{ann.priority}</span>
                      <span>By {ann.author} · {formatRelativeTime(ann.createdAt)}</span>
                      {!isRead && <span className="text-emerald-500 font-semibold">● Unread</span>}
                    </div>
                    <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white mt-1">
                      {ann.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isRead && (
                      <button
                        type="button"
                        onClick={() => helzerxApi.markAnnouncementRead(ann.id).then(loadUpdates)}
                        className="mx-btn-3d px-2.5 py-1 rounded-xl text-xs cursor-pointer"
                      >
                        Mark Read
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => helzerxApi.updateAnnouncement(ann.id, { archived: !ann.archived }).then(loadUpdates)}
                          title="Archive / Unarchive"
                          className="mx-btn-3d p-1.5 rounded-xl cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => helzerxApi.deleteAnnouncement(ann.id).then(loadUpdates)}
                          title="Delete"
                          className="mx-btn-3d p-1.5 rounded-xl text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-[#3B3B3B] dark:text-zinc-200 whitespace-pre-wrap">{ann.body}</p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {['👍', '🎉', '🚀'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => helzerxApi.reactAnnouncement(ann.id, em).then(loadUpdates)}
                      className="mx-btn-3d px-2.5 py-1 rounded-xl text-xs cursor-pointer"
                    >
                      {em} {(ann.reactions[em] || []).length || ''}
                    </button>
                  ))}
                  {isAdmin && (
                    <span className="ml-auto text-[11px] text-[#777777]">
                      Read by {ann.readBy.length} user(s)
                    </span>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.05]">
                  {ann.comments.map((c) => (
                    <div key={c.id} className="mx-well-3d px-3 py-2 rounded-xl text-xs">
                      <span className="font-semibold">@{c.author}</span> ·{' '}
                      <span className="text-[10px] text-[#777777]">{formatRelativeTime(c.createdAt)}</span>
                      <p className="mt-0.5">{c.body}</p>
                    </div>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const txt = (annCommentDrafts[ann.id] || '').trim();
                      if (!txt) return;
                      helzerxApi.commentAnnouncement(ann.id, txt).then(() => {
                        setAnnCommentDrafts((p) => ({ ...p, [ann.id]: '' }));
                        loadUpdates();
                      });
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={annCommentDrafts[ann.id] || ''}
                      onChange={(e) => setAnnCommentDrafts((p) => ({ ...p, [ann.id]: e.target.value }))}
                      placeholder="Reply to announcement..."
                      className="mx-input-3d flex-1 px-3 py-1.5 rounded-xl text-xs"
                    />
                    <button type="submit" className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer">
                      <Send className="w-3 h-3" /> Reply
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === 'notifications' && (
        <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#777777] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={notifSearch}
                  onChange={(e) => setNotifSearch(e.target.value)}
                  placeholder="Search alerts..."
                  className="mx-input-3d pl-8 pr-3 py-1.5 rounded-xl text-xs w-44"
                />
              </div>
              {['all', 'security', 'billing', 'support', 'community', 'reward'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNotifCategory(cat)}
                  className={`px-2.5 py-1 rounded-xl text-xs capitalize cursor-pointer ${
                    notifCategory === cat ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                helzerxApi.readAllNotifications().then(() => {
                  loadUpdates();
                  refreshHelzerx();
                })
              }
              className="mx-btn-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
              Mark All Read
            </button>
          </div>

          {filteredNotifs.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#777777]">No notifications to display.</div>
          ) : (
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {filteredNotifs.map((n) => (
                <div key={n.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="w-2 h-2 rounded-full bg-[#8B5CF6] shrink-0" />}
                      <span className="font-semibold text-[#171717] dark:text-white">{n.title}</span>
                      <span className="mx-well-3d px-2 py-0.5 rounded-md text-[10px] uppercase font-mono">
                        {n.category}
                      </span>
                    </div>
                    <p className="text-[#777777] dark:text-zinc-400 mt-0.5">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-[#777777]">{formatRelativeTime(n.createdAt)}</span>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() =>
                          helzerxApi.readNotification(n.id).then(() => {
                            loadUpdates();
                            refreshHelzerx();
                          })
                        }
                        className="mx-btn-3d px-2 py-1 rounded-lg text-[11px] cursor-pointer"
                      >
                        Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'status' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="mx-card-3d p-4 rounded-2xl">
              <div className="text-xs text-[#777777]">Control Panel API</div>
              <div className="mt-1 text-lg font-bold mx-stat-3d-emerald">Operational</div>
            </div>
            <div className="mx-card-3d p-4 rounded-2xl">
              <div className="text-xs text-[#777777]">Your Running Instances</div>
              <div className="mt-1 text-lg font-bold mx-stat-3d-violet tabular-nums">
                {onlineServers} / {servers.length} Online
              </div>
            </div>
            <div className="mx-card-3d p-4 rounded-2xl">
              <div className="text-xs text-[#777777]">Active Incidents</div>
              <div className="mt-1 text-lg font-bold mx-stat-3d-cyan tabular-nums">
                {incidents.filter((i) => i.status !== 'operational').length}
              </div>
            </div>
          </div>

          {isAdmin && (
            <form onSubmit={handleCreateIncident} className="mx-card-3d p-5 rounded-2xl space-y-3">
              <h2 className="text-sm font-bold">Post Service Incident / Maintenance Window</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <input
                  type="text"
                  required
                  value={incTitle}
                  onChange={(e) => setIncTitle(e.target.value)}
                  placeholder="Incident title"
                  className="mx-input-3d px-3 py-2 rounded-xl"
                />
                <input
                  type="text"
                  required
                  value={incComponent}
                  onChange={(e) => setIncComponent(e.target.value)}
                  placeholder="Component (e.g. Node EU-01)"
                  className="mx-input-3d px-3 py-2 rounded-xl"
                />
                <select value={incStatus} onChange={(e) => setIncStatus(e.target.value as any)} className="mx-input-3d px-3 py-2 rounded-xl">
                  <option value="maintenance">Maintenance</option>
                  <option value="degraded">Degraded</option>
                  <option value="outage">Outage</option>
                  <option value="operational">Operational</option>
                </select>
              </div>
              <textarea
                rows={2}
                required
                value={incMsg}
                onChange={(e) => setIncMsg(e.target.value)}
                placeholder="Describe status details and ETA..."
                className="mx-input-3d w-full px-3 py-2 rounded-xl text-xs"
              />
              <div className="flex justify-end">
                <button type="submit" className="mx-btn-3d-primary px-4 py-1.5 rounded-xl text-xs font-medium cursor-pointer">
                  Update Status Page
                </button>
              </div>
            </form>
          )}

          <section className="mx-card-3d p-5 rounded-2xl space-y-3">
            <h2 className="mx-heading-3d text-base font-bold">Incident &amp; Maintenance Timeline</h2>
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {incidents.map((inc) => (
                <div key={inc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                          inc.status === 'operational'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : inc.status === 'outage'
                              ? 'bg-rose-500/15 text-rose-500'
                              : 'bg-amber-500/15 text-amber-500'
                        }`}
                      >
                        {inc.status}
                      </span>
                      <span className="font-semibold text-[#171717] dark:text-white">{inc.title}</span>
                      <span className="text-[#777777]">({inc.component})</span>
                    </div>
                    <p className="text-[#525252] dark:text-zinc-300 mt-1">{inc.message}</p>
                  </div>
                  {isAdmin && inc.status !== 'operational' && (
                    <button
                      type="button"
                      onClick={() => helzerxApi.updateIncident(inc.id, 'operational').then(loadUpdates)}
                      className="mx-btn-3d-success px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 cursor-pointer"
                    >
                      Mark Operational
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'channels' && prefs && (
        <form onSubmit={handleSavePrefs} className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                Notification Channels &amp; Preferences
              </h2>
              <p className="text-xs text-[#777777] dark:text-zinc-400">
                Configure Discord Webhooks, Telegram Bot alerts, browser push, sound chimes, and Do Not Disturb
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestWebhook}
              className="mx-btn-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-[#06B6D4]" />
              Send Test Webhook
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <label className="mx-well-3d p-3.5 rounded-xl flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.browserEnabled}
                onChange={(e) => setPrefs({ ...prefs, browserEnabled: e.target.checked })}
                className="rounded accent-[#8B5CF6]"
              />
              <span>Browser Desktop Notifications</span>
            </label>
            <label className="mx-well-3d p-3.5 rounded-xl flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.soundEnabled}
                onChange={(e) => setPrefs({ ...prefs, soundEnabled: e.target.checked })}
                className="rounded accent-[#8B5CF6]"
              />
              <Volume2 className="w-4 h-4 text-[#8B5CF6]" />
              <span>Notification Sound Chime</span>
            </label>
            <label className="mx-well-3d p-3.5 rounded-xl flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.emailEnabled}
                onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })}
                className="rounded accent-[#8B5CF6]"
              />
              <span>Email Alerts</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium mb-1">Discord Webhook URL</label>
              <input
                type="url"
                value={prefs.discordWebhookUrl}
                onChange={(e) => setPrefs({ ...prefs, discordWebhookUrl: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="mx-input-3d w-full px-3 py-2 rounded-xl font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium mb-1">Telegram Bot Token</label>
                <input
                  type="text"
                  value={prefs.telegramBotToken}
                  onChange={(e) => setPrefs({ ...prefs, telegramBotToken: e.target.value })}
                  placeholder="123456:ABC..."
                  className="mx-input-3d w-full px-3 py-2 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Telegram Chat ID</label>
                <input
                  type="text"
                  value={prefs.telegramChatId}
                  onChange={(e) => setPrefs({ ...prefs, telegramChatId: e.target.value })}
                  placeholder="-100..."
                  className="mx-input-3d w-full px-3 py-2 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold">Alert Categories</div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(prefs.categories).map(([cat, enabled]) => (
                <label key={cat} className="mx-well-3d px-3 py-1.5 rounded-xl flex items-center gap-2 capitalize cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) =>
                      setPrefs({ ...prefs, categories: { ...prefs.categories, [cat]: e.target.checked } })
                    }
                    className="rounded accent-[#8B5CF6]"
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
              Save Channel Settings
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
