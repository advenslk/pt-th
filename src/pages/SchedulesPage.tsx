import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  Play,
  Plus,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { usePanel } from '../context/PanelContext';
import type { ScheduleTask, ScheduleTaskAction, ServerSchedule } from '../types/panel';
import { formatDate, formatRelativeTime } from '../utils/format';

interface ScheduleFormState {
  name: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  isActive: boolean;
  onlyWhenOnline: boolean;
}

const DEFAULT_SCHEDULE_FORM: ScheduleFormState = {
  name: '',
  minute: '*/30',
  hour: '*',
  dayOfMonth: '*',
  month: '*',
  dayOfWeek: '*',
  isActive: true,
  onlyWhenOnline: true,
};

const CRON_PRESETS: Array<{ label: string; cron: Pick<ScheduleFormState, 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek'> }> = [
  { label: 'Every 15m', cron: { minute: '*/15', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' } },
  { label: 'Hourly', cron: { minute: '0', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' } },
  { label: 'Daily 04:00', cron: { minute: '0', hour: '4', dayOfMonth: '*', month: '*', dayOfWeek: '*' } },
  { label: 'Weekly Sun', cron: { minute: '0', hour: '4', dayOfMonth: '*', month: '*', dayOfWeek: '0' } },
];

export function SchedulesPage({ serverId }: { serverId: string }) {
  const { servers, notify, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [schedules, setSchedules] = useState<ServerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(DEFAULT_SCHEDULE_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskAction, setTaskAction] = useState<ScheduleTaskAction>('command');
  const [taskPayload, setTaskPayload] = useState('');
  const [taskOffset, setTaskOffset] = useState('0');
  const [taskContinue, setTaskContinue] = useState(false);

  const [confirmDeleteScheduleId, setConfirmDeleteScheduleId] = useState<number | null>(null);

  const loadSchedules = useCallback(async () => {
    if (!server || !panelConnected) return;
    try {
      const list = await panelApi.listSchedules(server.id);
      setSchedules(list);
      setSelectedId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err: any) {
      notify('Failed to load schedules', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [server?.id, panelConnected, notify]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  const selectedSchedule = schedules.find((s) => s.id === selectedId) || null;

  const openNewSchedule = () => {
    setEditingScheduleId(null);
    setScheduleForm(DEFAULT_SCHEDULE_FORM);
    setShowScheduleForm(true);
  };

  const openEditSchedule = (sched: ServerSchedule) => {
    setEditingScheduleId(sched.id);
    setScheduleForm({
      name: sched.name,
      minute: sched.cron.minute,
      hour: sched.cron.hour,
      dayOfMonth: sched.cron.dayOfMonth,
      month: sched.cron.month,
      dayOfWeek: sched.cron.dayOfWeek,
      isActive: sched.isActive,
      onlyWhenOnline: sched.onlyWhenOnline,
    });
    setShowScheduleForm(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingScheduleId) {
        await panelApi.updateSchedule(server.id, editingScheduleId, scheduleForm);
        notify('Schedule updated', scheduleForm.name, 'success');
      } else {
        await panelApi.createSchedule(server.id, scheduleForm);
        notify('Schedule created', scheduleForm.name, 'success');
      }
      setShowScheduleForm(false);
      setEditingScheduleId(null);
      await loadSchedules();
    } catch (err: any) {
      notify('Schedule save failed', err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunNow = async (scheduleId: number) => {
    try {
      await panelApi.executeSchedule(server.id, scheduleId);
      notify('Schedule queued', 'Tasks dispatched to Wings daemon', 'success');
      setTimeout(loadSchedules, 1200);
    } catch (err: any) {
      notify('Could not execute schedule', err.message, 'error');
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    try {
      await panelApi.deleteSchedule(server.id, scheduleId);
      setConfirmDeleteScheduleId(null);
      notify('Schedule deleted', undefined, 'success');
      await loadSchedules();
    } catch (err: any) {
      notify('Delete failed', err.message, 'error');
    }
  };

  const openAddTask = () => {
    setEditingTaskId(null);
    setTaskAction('command');
    setTaskPayload('');
    setTaskOffset('0');
    setTaskContinue(false);
    setShowTaskForm(true);
  };

  const openEditTask = (task: ScheduleTask) => {
    setEditingTaskId(task.id);
    setTaskAction(task.action);
    setTaskPayload(task.payload);
    setTaskOffset(String(task.timeOffset));
    setTaskContinue(task.continueOnFailure);
    setShowTaskForm(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule) return;
    const finalPayload = taskAction === 'power' ? taskPayload || 'restart' : taskPayload;
    setSubmitting(true);
    try {
      const payload = {
        action: taskAction,
        payload: finalPayload,
        timeOffset: Math.max(0, Number(taskOffset) || 0),
        continueOnFailure: taskContinue,
      };
      if (editingTaskId) {
        await panelApi.updateScheduleTask(server.id, selectedSchedule.id, editingTaskId, payload);
        notify('Task updated', undefined, 'success');
      } else {
        await panelApi.createScheduleTask(server.id, selectedSchedule.id, payload);
        notify('Task added to schedule', undefined, 'success');
      }
      setShowTaskForm(false);
      setEditingTaskId(null);
      await loadSchedules();
    } catch (err: any) {
      notify('Failed to save task', err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (scheduleId: number, taskId: number) => {
    try {
      await panelApi.deleteScheduleTask(server.id, scheduleId, taskId);
      notify('Task removed', undefined, 'success');
      await loadSchedules();
    } catch (err: any) {
      notify('Could not remove task', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
            Schedules & Automation
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            {server.name} · Automated cron triggers and sequenced container tasks
          </p>
        </div>
        <button
          type="button"
          onClick={openNewSchedule}
          className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Schedule
        </button>
      </div>

      {showScheduleForm && (
        <form onSubmit={handleSaveSchedule} className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
              {editingScheduleId ? 'Edit Schedule' : 'New Automated Schedule'}
            </h2>
            <button
              type="button"
              onClick={() => setShowScheduleForm(false)}
              className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                Schedule Name
              </label>
              <input
                type="text"
                required
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                placeholder="Daily Restart & Backup"
                className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                Quick Cron Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CRON_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setScheduleForm({ ...scheduleForm, ...p.cron })}
                    className="mx-btn-3d px-2.5 py-1.5 rounded-xl text-[11px] font-medium cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#777777] dark:text-zinc-400 mb-1">Minute</label>
              <input
                type="text"
                required
                value={scheduleForm.minute}
                onChange={(e) => setScheduleForm({ ...scheduleForm, minute: e.target.value })}
                className="mx-input-3d w-full px-3 py-2 text-xs font-mono rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#777777] dark:text-zinc-400 mb-1">Hour</label>
              <input
                type="text"
                required
                value={scheduleForm.hour}
                onChange={(e) => setScheduleForm({ ...scheduleForm, hour: e.target.value })}
                className="mx-input-3d w-full px-3 py-2 text-xs font-mono rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#777777] dark:text-zinc-400 mb-1">Day of Month</label>
              <input
                type="text"
                required
                value={scheduleForm.dayOfMonth}
                onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfMonth: e.target.value })}
                className="mx-input-3d w-full px-3 py-2 text-xs font-mono rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#777777] dark:text-zinc-400 mb-1">Month</label>
              <input
                type="text"
                required
                value={scheduleForm.month}
                onChange={(e) => setScheduleForm({ ...scheduleForm, month: e.target.value })}
                className="mx-input-3d w-full px-3 py-2 text-xs font-mono rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#777777] dark:text-zinc-400 mb-1">Day of Week</label>
              <input
                type="text"
                required
                value={scheduleForm.dayOfWeek}
                onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfWeek: e.target.value })}
                className="mx-input-3d w-full px-3 py-2 text-xs font-mono rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs text-[#525252] dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleForm.onlyWhenOnline}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, onlyWhenOnline: e.target.checked })}
                  className="accent-[#8B5CF6]"
                />
                Only run when server is online
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-[#525252] dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleForm.isActive}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, isActive: e.target.checked })}
                  className="accent-[#8B5CF6]"
                />
                Schedule enabled
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowScheduleForm(false)}
                className="mx-btn-3d px-3.5 py-2 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 cursor-pointer"
              >
                {editingScheduleId ? 'Save Changes' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading && schedules.length === 0 ? (
        <div className="mx-card-3d p-8 rounded-2xl text-center text-xs text-[#777777]">Loading schedules...</div>
      ) : schedules.length === 0 ? (
        <div className="mx-card-3d p-12 rounded-2xl text-center">
          <CalendarClock className="w-8 h-8 text-[#777777] mx-auto mb-2" />
          <p className="text-sm font-medium text-[#171717] dark:text-white">No schedules configured</p>
          <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">
            Create automated cron schedules to run console commands, power actions, or backups.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Schedule List */}
          <div className="lg:col-span-5 space-y-3">
            {schedules.map((sched) => {
              const selected = selectedSchedule?.id === sched.id;
              const cronStr = `${sched.cron.minute} ${sched.cron.hour} ${sched.cron.dayOfMonth} ${sched.cron.month} ${sched.cron.dayOfWeek}`;
              return (
                <div
                  key={sched.id}
                  onClick={() => setSelectedId(sched.id)}
                  className={`mx-card-3d mx-card-3d-interactive p-4 rounded-2xl cursor-pointer transition-all ${
                    selected ? 'ring-2 ring-[#8B5CF6]/70' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            sched.isProcessing
                              ? 'bg-[#06B6D4] animate-pulse'
                              : sched.isActive
                                ? 'bg-emerald-500'
                                : 'bg-zinc-400'
                          }`}
                        />
                        <h3 className="text-sm font-semibold text-[#171717] dark:text-white truncate">
                          {sched.name}
                        </h3>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#777777] dark:text-zinc-400">
                        <span className="mx-well-3d px-2 py-0.5 rounded-lg font-mono text-[#171717] dark:text-zinc-200">
                          {cronStr}
                        </span>
                        <span className="font-medium tabular-nums">
                          {sched.tasks.length} {sched.tasks.length === 1 ? 'task' : 'tasks'}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${
                        sched.isActive
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {sched.isProcessing ? 'Processing' : sched.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between text-[11px] text-[#777777] dark:text-zinc-400 tabular-nums">
                    <span>Last: {sched.lastRunAt ? formatRelativeTime(sched.lastRunAt) : 'Never'}</span>
                    <span>Next: {sched.nextRunAt ? formatDate(sched.nextRunAt) : 'Paused'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Schedule & Task Pipeline */}
          {selectedSchedule && (
            <div className="lg:col-span-7 mx-card-3d p-5 sm:p-6 rounded-2xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                <div>
                  <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                    {selectedSchedule.name}
                  </h2>
                  <p className="text-xs text-[#777777] dark:text-zinc-400 mt-0.5">
                    {selectedSchedule.onlyWhenOnline ? 'Runs only when online' : 'Runs regardless of server power state'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunNow(selectedSchedule.id)}
                    className="mx-btn-3d-success inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Run Now
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditSchedule(selectedSchedule)}
                    className="mx-btn-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  {confirmDeleteScheduleId === selectedSchedule.id ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteSchedule(selectedSchedule.id)}
                        className="mx-btn-3d-danger px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteScheduleId(null)}
                        className="mx-btn-3d px-2.5 py-1.5 rounded-xl text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteScheduleId(selectedSchedule.id)}
                      className="mx-btn-3d p-1.5 rounded-xl text-rose-500 cursor-pointer"
                      title="Delete Schedule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#777777] dark:text-zinc-400">
                  Task Sequence ({selectedSchedule.tasks.length})
                </h3>
                <button
                  type="button"
                  onClick={openAddTask}
                  className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Task
                </button>
              </div>

              {showTaskForm && (
                <form onSubmit={handleSaveTask} className="mx-well-3d p-4 rounded-2xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#525252] dark:text-zinc-300 mb-1">
                        Action Type
                      </label>
                      <select
                        value={taskAction}
                        onChange={(e) => {
                          const next = e.target.value as ScheduleTaskAction;
                          setTaskAction(next);
                          if (next === 'power') setTaskPayload('restart');
                          else if (next === 'backup') setTaskPayload('');
                        }}
                        className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
                      >
                        <option value="command">Send Command</option>
                        <option value="power">Send Power Action</option>
                        <option value="backup">Create Backup</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[#525252] dark:text-zinc-300 mb-1">
                        Time Offset (seconds)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={900}
                        value={taskOffset}
                        onChange={(e) => setTaskOffset(e.target.value)}
                        className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl tabular-nums"
                      />
                    </div>
                  </div>

                  {taskAction === 'command' && (
                    <div>
                      <label className="block text-[11px] font-medium text-[#525252] dark:text-zinc-300 mb-1">
                        Console Command Payload
                      </label>
                      <input
                        type="text"
                        required
                        value={taskPayload}
                        onChange={(e) => setTaskPayload(e.target.value)}
                        placeholder="say Server restarting in 60 seconds!"
                        className="mx-input-3d w-full px-3 py-2 text-xs font-mono rounded-xl"
                      />
                    </div>
                  )}

                  {taskAction === 'power' && (
                    <div>
                      <label className="block text-[11px] font-medium text-[#525252] dark:text-zinc-300 mb-1">
                        Power Signal
                      </label>
                      <select
                        value={taskPayload || 'restart'}
                        onChange={(e) => setTaskPayload(e.target.value)}
                        className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
                      >
                        <option value="start">Start Server</option>
                        <option value="restart">Restart Server</option>
                        <option value="stop">Stop Server</option>
                        <option value="kill">Kill Process</option>
                      </select>
                    </div>
                  )}

                  {taskAction === 'backup' && (
                    <div>
                      <label className="block text-[11px] font-medium text-[#525252] dark:text-zinc-300 mb-1">
                        Ignored Files (optional, newline or comma separated)
                      </label>
                      <textarea
                        rows={2}
                        value={taskPayload}
                        onChange={(e) => setTaskPayload(e.target.value)}
                        placeholder="/logs/*.gz"
                        className="mx-input-3d w-full px-3 py-2 text-xs font-mono rounded-xl"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs text-[#525252] dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taskContinue}
                        onChange={(e) => setTaskContinue(e.target.checked)}
                        className="accent-[#8B5CF6]"
                      />
                      Continue pipeline on failure
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTaskForm(false)}
                        className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="mx-btn-3d-primary px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
                      >
                        {editingTaskId ? 'Update Task' : 'Add Task'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {selectedSchedule.tasks.length === 0 ? (
                <div className="mx-well-3d p-8 rounded-2xl text-center text-xs text-[#777777] dark:text-zinc-400">
                  No tasks attached yet. Click <strong>New Task</strong> to chain commands, power actions, or backups.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedSchedule.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="mx-well-3d p-3.5 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg mx-btn-3d flex items-center justify-center text-xs font-bold tabular-nums shrink-0">
                          {task.sequenceId}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#171717] dark:text-white">
                            <Terminal className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                            <span className="capitalize">{task.action}</span>
                            {task.timeOffset > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#06B6D4] tabular-nums">
                                <Clock className="w-3 h-3" />+{task.timeOffset}s
                              </span>
                            )}
                            {task.continueOnFailure && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Continue on fail
                              </span>
                            )}
                          </div>
                          {task.payload && (
                            <div className="font-mono text-[11px] text-[#525252] dark:text-zinc-300 mt-1 truncate">
                              {task.payload}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditTask(task)}
                          className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
                          title="Edit task"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(selectedSchedule.id, task.id)}
                          className="mx-btn-3d p-1.5 rounded-lg text-rose-500 cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
