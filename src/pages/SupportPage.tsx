import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  LifeBuoy,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  Star,
  ThumbsUp,
  UserCheck,
  X,
} from 'lucide-react';
import { helzerxApi } from '../api/helzerx';
import { usePanel } from '../context/PanelContext';
import type { SupportOverviewResponse, SupportTicketFull, TicketAttachment } from '../types/helzerx';
import { formatRelativeTime } from '../utils/format';

const MAX_ATTACHMENT_BYTES = 1_500_000;

function readAttachmentFiles(files: FileList | null, onError: (msg: string) => void): Promise<TicketAttachment[]> {
  if (!files || files.length === 0) return Promise.resolve([]);
  const list = Array.from(files).slice(0, 3);
  return Promise.all(
    list.map(
      (file) =>
        new Promise<TicketAttachment | null>((resolve) => {
          if (file.size > MAX_ATTACHMENT_BYTES) {
            onError(`${file.name} exceeds 1.5 MB limit.`);
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              mime: file.type || 'application/octet-stream',
              size: file.size,
              dataUrl: String(reader.result || ''),
            });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        })
    )
  ).then((arr) => arr.filter((x): x is TicketAttachment => x !== null));
}

export function SupportPage() {
  const { user, helzerxData, notify } = usePanel();
  const isAdmin = Boolean(helzerxData?.isAdmin || user?.role === 'admin');

  const [data, setData] = useState<SupportOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tickets' | 'kb' | 'agents'>('tickets');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketFull['status']>('all');

  // New Ticket Form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicketFull['category']>('Technical');
  const [department, setDepartment] = useState<SupportTicketFull['department']>('Technical Support');
  const [priority, setPriority] = useState<SupportTicketFull['priority']>('medium');
  const [message, setMessage] = useState('');
  const [newAttachments, setNewAttachments] = useState<TicketAttachment[]>([]);

  // Reply & Admin Tools
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<TicketAttachment[]>([]);
  const [internalNote, setInternalNote] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<TicketAttachment | null>(null);

  // Rating
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  // Admin: Canned template & KB creator
  const [tplTitle, setTplTitle] = useState('');
  const [tplDept, setTplDept] = useState('Technical Support');
  const [tplBody, setTplBody] = useState('');

  const [kbTitle, setKbTitle] = useState('');
  const [kbCategory, setKbCategory] = useState<'Getting Started' | 'Billing' | 'Security' | 'Troubleshooting'>('Troubleshooting');
  const [kbSummary, setKbSummary] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbSearch, setKbSearch] = useState('');

  const loadSupport = useCallback(async () => {
    try {
      const res = await helzerxApi.getSupport();
      setData(res);
      setActiveTicketId((prev) => prev || res.tickets[0]?.id || null);
    } catch (err: any) {
      notify('Could not load support data', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadSupport();
  }, [loadSupport]);

  const filteredTickets = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      return `${t.id} ${t.subject} ${t.category} ${t.department} ${t.username}`.toLowerCase().includes(q);
    });
  }, [data, searchQuery, statusFilter]);

  const filteredKb = useMemo(() => {
    if (!data) return [];
    const q = kbSearch.trim().toLowerCase();
    if (!q) return data.knowledgeBase;
    return data.knowledgeBase.filter((a) =>
      `${a.title} ${a.category} ${a.summary} ${a.content}`.toLowerCase().includes(q)
    );
  }, [data, kbSearch]);

  const activeTicket = useMemo(
    () => data?.tickets.find((t) => t.id === activeTicketId) || null,
    [data, activeTicketId]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await helzerxApi.createSupportTicket({
        subject: subject.trim(),
        category,
        department,
        priority,
        message: message.trim(),
        attachments: newAttachments,
      });
      notify('Support ticket opened', res.ticket?.id || res.id, 'success');
      setCreating(false);
      setSubject('');
      setMessage('');
      setNewAttachments([]);
      await loadSupport();
      if (res.ticket?.id || res.id) setActiveTicketId(res.ticket?.id || res.id || null);
    } catch (err: any) {
      notify('Could not create ticket', err.message, 'error');
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;
    try {
      await helzerxApi.replySupportTicket(activeTicket.id, {
        message: replyText.trim(),
        internalNote: isAdmin && internalNote,
        attachments: replyAttachments,
      });
      setReplyText('');
      setReplyAttachments([]);
      setInternalNote(false);
      await loadSupport();
    } catch (err: any) {
      notify('Reply failed', err.message, 'error');
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
        <div className="h-72 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
            Support Center &amp; Knowledge Base
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            Multi-department ticketing, attachment previews, escalation, and self-service guides
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setTab('tickets');
            setCreating((c) => !c);
          }}
          className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Open Ticket
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs text-[#777777] dark:text-zinc-400">Total Tickets</div>
          <div className="mt-1.5 text-2xl font-bold mx-stat-3d">{data.stats.total}</div>
        </div>
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs text-[#777777] dark:text-zinc-400">Active / Open</div>
          <div className="mt-1.5 text-2xl font-bold mx-stat-3d-cyan">{data.stats.open}</div>
        </div>
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs text-[#777777] dark:text-zinc-400">Escalated</div>
          <div className="mt-1.5 text-2xl font-bold mx-stat-3d-violet">{data.stats.escalated}</div>
        </div>
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="mx-label-3d text-xs text-[#777777] dark:text-zinc-400">Satisfaction</div>
          <div className="mt-1.5 text-2xl font-bold mx-stat-3d-emerald">{data.stats.avgRating} / 5.0</div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="mx-well-3d inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl">
        {(
          [
            { id: 'tickets', label: `Tickets (${data.tickets.length})` },
            { id: 'kb', label: `Knowledge Base (${data.knowledgeBase.length})` },
            { id: 'agents', label: `Support Team (${data.agents.length})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
              tab === item.id
                ? 'mx-btn-3d-primary'
                : 'text-[#525252] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* TICKETS TAB */}
      {tab === 'tickets' && (
        <div className="space-y-5">
          {creating && (
            <form onSubmit={handleCreate} className="mx-card-3d p-5 rounded-2xl space-y-3.5">
              <h2 className="mx-heading-3d text-sm font-bold">New Support Request</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Concise ticket subject"
                  className="mx-input-3d sm:col-span-2 lg:col-span-4 px-3 py-2 rounded-xl"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportTicketFull['category'])}
                  className="mx-input-3d px-3 py-2 rounded-xl"
                >
                  <option value="Technical" className="bg-white dark:bg-[#19191F]">Technical</option>
                  <option value="Billing" className="bg-white dark:bg-[#19191F]">Billing</option>
                  <option value="General" className="bg-white dark:bg-[#19191F]">General</option>
                  <option value="Migration" className="bg-white dark:bg-[#19191F]">Migration</option>
                  <option value="Abuse" className="bg-white dark:bg-[#19191F]">Abuse</option>
                </select>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as SupportTicketFull['department'])}
                  className="mx-input-3d px-3 py-2 rounded-xl"
                >
                  <option value="Technical Support" className="bg-white dark:bg-[#19191F]">Technical Support</option>
                  <option value="Billing & Renewals" className="bg-white dark:bg-[#19191F]">Billing & Renewals</option>
                  <option value="Node Infrastructure" className="bg-white dark:bg-[#19191F]">Node Infrastructure</option>
                </select>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SupportTicketFull['priority'])}
                  className="mx-input-3d px-3 py-2 rounded-xl"
                >
                  <option value="low" className="bg-white dark:bg-[#19191F]">Low Priority</option>
                  <option value="medium" className="bg-white dark:bg-[#19191F]">Medium Priority</option>
                  <option value="high" className="bg-white dark:bg-[#19191F]">High Priority</option>
                  <option value="urgent" className="bg-white dark:bg-[#19191F]">Urgent Priority</option>
                </select>
                <label className="mx-btn-3d inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer">
                  <Paperclip className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>Attach ({newAttachments.length}/3)</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = await readAttachmentFiles(e.target.files, (m) =>
                        notify('Attachment skipped', m, 'error')
                      );
                      setNewAttachments((prev) => [...prev, ...files].slice(0, 3));
                    }}
                  />
                </label>
              </div>
              <textarea
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue clearly..."
                className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
              />
              {newAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {newAttachments.map((att) => (
                    <span key={att.id} className="mx-well-3d inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px]">
                      <FileText className="w-3 h-3 text-[#06B6D4]" />
                      {att.name}
                      <button
                        type="button"
                        onClick={() => setNewAttachments((p) => p.filter((x) => x.id !== att.id))}
                        className="text-rose-500 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreating(false)} className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
                  Submit Ticket
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Ticket Sidebar List */}
            <div className="lg:col-span-5 mx-card-3d rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#777777] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tickets..."
                    className="mx-input-3d w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | SupportTicketFull['status'])}
                  className="mx-input-3d px-2.5 py-1.5 text-xs rounded-xl"
                >
                  <option value="all" className="bg-white dark:bg-[#19191F]">All Status</option>
                  <option value="open" className="bg-white dark:bg-[#19191F]">Open</option>
                  <option value="answered" className="bg-white dark:bg-[#19191F]">Answered</option>
                  <option value="escalated" className="bg-white dark:bg-[#19191F]">Escalated</option>
                  <option value="closed" className="bg-white dark:bg-[#19191F]">Closed</option>
                </select>
              </div>

              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05] max-h-[540px] overflow-y-auto">
                {filteredTickets.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#777777]">No matching support tickets.</div>
                ) : (
                  filteredTickets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTicketId(t.id)}
                      className={`w-full p-3 text-left rounded-xl transition-colors cursor-pointer ${
                        activeTicketId === t.id ? 'mx-nav-active' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#777777]">
                        <span>
                          {t.id} · {t.priority.toUpperCase()}
                        </span>
                        <span
                          className={`uppercase font-semibold ${
                            t.status === 'escalated'
                              ? 'text-rose-500'
                              : t.status === 'answered'
                                ? 'text-emerald-500'
                                : t.status === 'closed'
                                  ? 'text-[#777777]'
                                  : 'text-[#8B5CF6]'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-[#171717] dark:text-white truncate">
                        {t.subject}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#777777] dark:text-zinc-400 truncate">
                        {t.department} · Agent: {t.assignedAgentName || 'Unassigned'}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Active Ticket Conversation */}
            <div className="lg:col-span-7 mx-card-3d rounded-2xl p-5 flex flex-col justify-between min-h-[420px] space-y-4">
              {activeTicket ? (
                <>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#777777]">
                          <span>{activeTicket.id}</span>
                          <span>·</span>
                          <span>{activeTicket.category}</span>
                          <span>·</span>
                          <span>{activeTicket.department}</span>
                        </div>
                        <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white mt-0.5">
                          {activeTicket.subject}
                        </h2>
                        <div className="text-[11px] text-[#777777] mt-0.5">
                          Assigned: <span className="font-medium text-[#8B5CF6]">{activeTicket.assignedAgentName || 'Queue'}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {activeTicket.status !== 'escalated' && activeTicket.status !== 'closed' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await helzerxApi.updateSupportTicketStatus(activeTicket.id, 'escalated');
                              notify('Ticket escalated', 'Flagged for senior infrastructure review', 'info');
                              loadSupport();
                            }}
                            className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-amber-500 cursor-pointer"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Escalate
                          </button>
                        )}
                        {activeTicket.status === 'closed' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await helzerxApi.updateSupportTicketStatus(activeTicket.id, 'open');
                              notify('Ticket reopened', activeTicket.id, 'success');
                              loadSupport();
                            }}
                            className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-emerald-500 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reopen
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              await helzerxApi.updateSupportTicketStatus(activeTicket.id, 'closed');
                              notify('Ticket closed', activeTicket.id, 'info');
                              loadSupport();
                            }}
                            className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Close
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Admin Assignment & Templates Bar */}
                    {isAdmin && (
                      <div className="mx-well-3d p-3 rounded-xl flex flex-wrap items-center gap-2 text-xs">
                        <select
                          value={activeTicket.assignedAgentId || ''}
                          onChange={async (e) => {
                            if (!e.target.value) return;
                            await helzerxApi.assignSupportTicket(activeTicket.id, e.target.value);
                            notify('Agent assigned', undefined, 'success');
                            loadSupport();
                          }}
                          className="mx-input-3d px-2.5 py-1.5 rounded-lg"
                        >
                          <option value="" className="bg-white dark:bg-[#19191F]">Assign Agent...</option>
                          {data.agents.map((ag) => (
                            <option key={ag.id} value={ag.id} className="bg-white dark:bg-[#19191F]">
                              {ag.name} ({ag.department})
                            </option>
                          ))}
                        </select>

                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const tpl = data.templates.find((x) => x.id === e.target.value);
                            if (tpl) setReplyText(tpl.body);
                            e.target.value = '';
                          }}
                          className="mx-input-3d px-2.5 py-1.5 rounded-lg"
                        >
                          <option value="" className="bg-white dark:bg-[#19191F]">Insert Response Template...</option>
                          {data.templates.map((tpl) => (
                            <option key={tpl.id} value={tpl.id} className="bg-white dark:bg-[#19191F]">
                              {tpl.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Messages */}
                    <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                      {activeTicket.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-xl text-xs space-y-2 ${
                            m.internalNote
                              ? 'border border-amber-500/35 bg-amber-500/10'
                              : 'mx-well-3d'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-medium">
                            <span className="flex items-center gap-2">
                              <span className="font-semibold text-[#171717] dark:text-white">{m.author}</span>
                              {m.role === 'staff' && (
                                <span className="px-1.5 py-0.5 rounded bg-[#8B5CF6]/20 text-[#8B5CF6] text-[10px]">
                                  STAFF
                                </span>
                              )}
                              {m.internalNote && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px]">
                                  INTERNAL NOTE
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-[#777777]">{formatRelativeTime(m.createdAt)}</span>
                          </div>
                          <p className="text-[#3B3B3B] dark:text-zinc-200 whitespace-pre-wrap">{m.body}</p>
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {m.attachments.map((att) => (
                                <button
                                  key={att.id}
                                  type="button"
                                  onClick={() => setPreviewAttachment(att)}
                                  className="mx-btn-3d inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
                                >
                                  <Eye className="w-3 h-3 text-[#06B6D4]" />
                                  {att.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Customer Rating Box */}
                    {(activeTicket.status === 'answered' || activeTicket.status === 'closed') && (
                      <div className="mx-well-3d p-3 rounded-xl space-y-2 text-xs">
                        {activeTicket.rating ? (
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-amber-500">
                              Rated {activeTicket.rating} / 5 Stars
                            </span>
                            {activeTicket.ratingComment && (
                              <span className="text-[#777777] truncate max-w-[260px]">
                                &ldquo;{activeTicket.ratingComment}&rdquo;
                              </span>
                            )}
                          </div>
                        ) : (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              await helzerxApi.rateSupportTicket(activeTicket.id, ratingScore, ratingComment);
                              notify('Thank you for rating support!', `${ratingScore}/5 stars saved`, 'success');
                              setRatingComment('');
                              loadSupport();
                            }}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span className="font-medium">Rate resolution:</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setRatingScore(n)}
                                  className="p-0.5 cursor-pointer"
                                >
                                  <Star
                                    className={`w-4 h-4 ${
                                      n <= ratingScore ? 'text-amber-500 fill-amber-500' : 'text-[#777777]'
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              value={ratingComment}
                              onChange={(e) => setRatingComment(e.target.value)}
                              placeholder="Optional feedback..."
                              className="mx-input-3d flex-1 min-w-[140px] px-2.5 py-1 rounded-lg"
                            />
                            <button type="submit" className="mx-btn-3d-primary px-3 py-1 rounded-lg cursor-pointer">
                              Submit Rating
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Reply Form */}
                  <form onSubmit={handleReply} className="space-y-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                    {isAdmin && (
                      <label className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={internalNote}
                          onChange={(e) => setInternalNote(e.target.checked)}
                          className="rounded accent-amber-500"
                        />
                        Send as internal staff-only note
                      </label>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        className="mx-input-3d flex-1 min-w-[200px] px-3 py-2 text-xs rounded-xl"
                      />
                      <label className="mx-btn-3d inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs cursor-pointer">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>{replyAttachments.length > 0 ? `${replyAttachments.length}` : 'File'}</span>
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = await readAttachmentFiles(e.target.files, (m) =>
                              notify('Attachment skipped', m, 'error')
                            );
                            setReplyAttachments((p) => [...p, ...files].slice(0, 3));
                          }}
                        />
                      </label>
                      <button
                        type="submit"
                        className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Reply
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-xs text-[#777777] gap-2">
                  <LifeBuoy className="w-6 h-6 text-[#06B6D4]" />
                  Select a ticket from the list or click Open Ticket.
                </div>
              )}
            </div>
          </div>

          {/* Admin Template Creator */}
          {isAdmin && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await helzerxApi.createSupportTemplate({ title: tplTitle, department: tplDept, body: tplBody });
                setTplTitle('');
                setTplBody('');
                notify('Response template saved', undefined, 'success');
                loadSupport();
              }}
              className="mx-card-3d p-5 rounded-2xl space-y-3"
            >
              <h2 className="mx-heading-3d text-sm font-bold">Add Support Response Template (Admin)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <input
                  type="text"
                  required
                  value={tplTitle}
                  onChange={(e) => setTplTitle(e.target.value)}
                  placeholder="Template title"
                  className="mx-input-3d px-3 py-2 rounded-xl"
                />
                <select
                  value={tplDept}
                  onChange={(e) => setTplDept(e.target.value)}
                  className="mx-input-3d px-3 py-2 rounded-xl"
                >
                  <option value="Technical Support" className="bg-white dark:bg-[#19191F]">Technical Support</option>
                  <option value="Billing & Renewals" className="bg-white dark:bg-[#19191F]">Billing & Renewals</option>
                  <option value="Node Infrastructure" className="bg-white dark:bg-[#19191F]">Node Infrastructure</option>
                </select>
              </div>
              <textarea
                rows={2}
                required
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                placeholder="Template message body..."
                className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
              />
              <button type="submit" className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
                Save Template
              </button>
            </form>
          )}
        </div>
      )}

      {/* KNOWLEDGE BASE TAB */}
      {tab === 'kb' && (
        <div className="space-y-5">
          <div className="relative max-w-md">
            <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={kbSearch}
              onChange={(e) => setKbSearch(e.target.value)}
              placeholder="Search tutorials, billing FAQ, SFTP guides..."
              className="mx-input-3d w-full pl-9 pr-3 py-2 text-xs rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredKb.map((art) => (
              <div key={art.id} className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#777777]">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#8B5CF6]">
                      <BookOpen className="w-3.5 h-3.5" />
                      {art.category}
                    </span>
                    <span className="font-mono">{art.views} views</span>
                  </div>
                  <h3 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">{art.title}</h3>
                  <p className="text-xs font-medium text-[#525252] dark:text-zinc-300">{art.summary}</p>
                  <div className="mx-well-3d p-3 rounded-xl text-xs text-[#525252] dark:text-zinc-300 leading-relaxed">
                    {art.content}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#777777]">Updated {formatRelativeTime(art.updatedAt)}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await helzerxApi.markKbHelpful(art.id);
                      notify('Feedback recorded', 'Marked article as helpful', 'success');
                      loadSupport();
                    }}
                    className="mx-btn-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                    Helpful ({art.helpfulCount})
                  </button>
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await helzerxApi.createKnowledgeArticle({
                  title: kbTitle,
                  category: kbCategory,
                  summary: kbSummary,
                  content: kbContent,
                });
                setKbTitle('');
                setKbSummary('');
                setKbContent('');
                notify('Knowledge Base article published', undefined, 'success');
                loadSupport();
              }}
              className="mx-card-3d p-5 rounded-2xl space-y-3"
            >
              <h2 className="mx-heading-3d text-sm font-bold">Publish Knowledge Base Article (Admin)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <input
                  type="text"
                  required
                  value={kbTitle}
                  onChange={(e) => setKbTitle(e.target.value)}
                  placeholder="Article title"
                  className="mx-input-3d px-3 py-2 rounded-xl"
                />
                <select
                  value={kbCategory}
                  onChange={(e) => setKbCategory(e.target.value as any)}
                  className="mx-input-3d px-3 py-2 rounded-xl"
                >
                  <option value="Getting Started" className="bg-white dark:bg-[#19191F]">Getting Started</option>
                  <option value="Billing" className="bg-white dark:bg-[#19191F]">Billing</option>
                  <option value="Security" className="bg-white dark:bg-[#19191F]">Security</option>
                  <option value="Troubleshooting" className="bg-white dark:bg-[#19191F]">Troubleshooting</option>
                </select>
                <input
                  type="text"
                  required
                  value={kbSummary}
                  onChange={(e) => setKbSummary(e.target.value)}
                  placeholder="Short summary"
                  className="mx-input-3d sm:col-span-2 px-3 py-2 rounded-xl"
                />
              </div>
              <textarea
                rows={3}
                required
                value={kbContent}
                onChange={(e) => setKbContent(e.target.value)}
                placeholder="Full step-by-step instructions..."
                className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
              />
              <button type="submit" className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
                Publish Article
              </button>
            </form>
          )}
        </div>
      )}

      {/* AGENTS TAB */}
      {tab === 'agents' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.agents.map((ag) => (
            <div key={ag.id} className="mx-card-3d p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="mx-well-3d w-10 h-10 rounded-xl flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#171717] dark:text-white">{ag.name}</div>
                    <div className="text-[11px] text-[#777777]">{ag.role}</div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${ag.online ? 'text-emerald-500' : 'text-[#777777]'}`}>
                  <span className={`w-2 h-2 rounded-full ${ag.online ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                  {ag.online ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="mx-well-3d p-3 rounded-xl flex justify-between text-xs">
                <div>
                  <div className="text-[#777777] text-[10px]">Department</div>
                  <div className="font-semibold">{ag.department}</div>
                </div>
                <div className="text-right">
                  <div className="text-[#777777] text-[10px]">Resolved · Rating</div>
                  <div className="font-mono font-semibold">
                    {ag.resolvedCount} · {ag.avgRating}★
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="mx-card-3d w-full max-w-xl p-5 rounded-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="mx-heading-3d text-sm font-bold truncate">{previewAttachment.name}</h3>
                <div className="text-[11px] font-mono text-[#777777]">
                  {previewAttachment.mime} · {(previewAttachment.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button type="button" onClick={() => setPreviewAttachment(null)} className="mx-btn-3d p-1.5 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {previewAttachment.mime.startsWith('image/') ? (
              <img
                src={previewAttachment.dataUrl}
                alt={previewAttachment.name}
                className="max-h-[60vh] w-full object-contain rounded-xl bg-black/20"
              />
            ) : (
              <div className="mx-well-3d p-4 rounded-xl text-xs text-center space-y-3">
                <p className="text-[#777777]">Preview not available for binary file type.</p>
                <a
                  href={previewAttachment.dataUrl}
                  download={previewAttachment.name}
                  className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl"
                >
                  Download {previewAttachment.name}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
