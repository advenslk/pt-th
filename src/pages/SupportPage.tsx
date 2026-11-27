import React, { useEffect, useState } from 'react';
import { LifeBuoy, Plus, Send } from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { SupportTicket } from '../types/panel';
import { formatRelativeTime } from '../utils/format';

export function SupportPage() {
  const { billingConfigured, notify } = usePanel();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [department, setDepartment] = useState('Technical Support');
  const [priority, setPriority] = useState('medium');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    if (!billingConfigured) {
      setError('Support ticketing backend is not connected. Configure BILLING_API_URL in .env to enable live support tickets.');
      return;
    }
    panelApi
      .getTickets()
      .then((res) => {
        setTickets(res.tickets);
        if (res.tickets.length > 0) setActiveTicketId(res.tickets[0].id);
      })
      .catch((err) => setError(err.message));
  }, [billingConfigured]);

  if (error) {
    return (
      <div className="mx-card-3d rounded-2xl p-6 sm:p-8 max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="mx-rail-track w-10 h-10 rounded-xl flex items-center justify-center">
            <LifeBuoy className="w-4 h-4 text-[#06B6D4]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#171717] dark:text-white">Support Tickets</h1>
            <p className="text-xs text-[#777777] dark:text-zinc-400">External ticketing integration status</p>
          </div>
        </div>
        <p className="text-xs text-[#525252] dark:text-zinc-300 leading-relaxed">{error}</p>
      </div>
    );
  }

  const activeTicket = tickets.find((t) => t.id === activeTicketId) || null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await panelApi.createTicket({ subject, department, priority, message });
      setTickets((prev) => [res.ticket, ...prev]);
      setActiveTicketId(res.ticket.id);
      setCreating(false);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      notify('Could not open ticket', err.message, 'error');
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;
    try {
      const res = await panelApi.replyTicket(activeTicket.id, replyText);
      setTickets((prev) => prev.map((t) => (t.id === res.ticket.id ? res.ticket : t)));
      setReplyText('');
    } catch (err: any) {
      notify('Reply failed', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-white">
            Support Tickets
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            Direct technical escalation and infrastructure assistance
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Open Ticket
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="mx-card-3d p-5 rounded-2xl space-y-3">
          <h2 className="text-sm font-semibold">New Support Request</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <input
              type="text"
              placeholder="Ticket subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mx-input-3d sm:col-span-2 px-3 py-2 rounded-xl"
            />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mx-input-3d px-3 py-2 rounded-xl"
            >
              <option value="Technical Support">Technical Support</option>
              <option value="Billing & Renewals">Billing & Renewals</option>
              <option value="Node Infrastructure">Node Infrastructure</option>
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mx-input-3d px-3 py-2 rounded-xl"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
          </div>
          <textarea
            rows={3}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the issue..."
            className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
          />
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
        <div className="lg:col-span-5 mx-card-3d rounded-2xl divide-y divide-black/[0.05] dark:divide-white/[0.05]">
          {tickets.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#777777]">No support tickets open.</div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTicketId(t.id)}
                className={`w-full p-4 text-left cursor-pointer ${
                  activeTicketId === t.id ? 'bg-black/[0.04] dark:bg-white/[0.05]' : ''
                }`}
              >
                <div className="flex justify-between text-[11px] font-mono text-[#777777]">
                  <span>{t.id}</span>
                  <span>{t.status}</span>
                </div>
                <div className="mt-1 text-xs font-semibold truncate">{t.subject}</div>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-7 mx-card-3d rounded-2xl p-5 flex flex-col justify-between min-h-[300px]">
          {activeTicket ? (
            <>
              <div className="space-y-3">
                <h2 className="text-base font-semibold">{activeTicket.subject}</h2>
                {activeTicket.messages.map((m) => (
                  <div key={m.id} className="mx-well-3d p-3 rounded-xl text-xs">
                    <div className="flex justify-between text-[11px] font-medium mb-1">
                      <span>{m.author}</span>
                      <span className="font-mono text-[#777777]">{formatRelativeTime(m.createdAt)}</span>
                    </div>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleReply} className="pt-3 flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="mx-input-3d flex-1 px-3 py-2 text-xs rounded-xl"
                />
                <button type="submit" className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
                  <Send className="w-3.5 h-3.5" />
                  Reply
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-[#777777]">
              Select a ticket to view the conversation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
