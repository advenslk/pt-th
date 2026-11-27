import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Download, Lock, Plus, RotateCcw, Trash2, Unlock } from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { BackupEntry } from '../types/panel';
import { formatBytes, formatDate, formatRelativeTime } from '../utils/format';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';

export function BackupsPage({ serverId }: { serverId: string }) {
  const { servers, notify, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [ignoredFiles, setIgnoredFiles] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const loadBackups = useCallback(async () => {
    if (!server || !panelConnected) return;
    try {
      const list = await panelApi.listBackups(server.id);
      setBackups(list);
    } catch (err: any) {
      notify('Failed to load backups', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [server?.id, panelConnected, notify]);

  useEffect(() => {
    loadBackups();
    const timer = setInterval(loadBackups, 5000);
    return () => clearInterval(timer);
  }, [loadBackups]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await panelApi.createBackup(server.id, {
        name: name.trim() || `Backup ${new Date().toLocaleTimeString()}`,
        ignoredFiles,
        isLocked,
      });
      setName('');
      setCreating(false);
      notify('Backup started', 'Archive task queued on Wings daemon', 'success');
      loadBackups();
    } catch (err: any) {
      notify('Backup creation failed', err.message, 'error');
    }
  };

  const handleDownload = async (uuid: string) => {
    try {
      const url = await panelApi.getBackupDownloadUrl(server.id, uuid);
      const a = document.createElement('a');
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      notify('Download failed', err.message, 'error');
    }
  };

  const handleRestore = async (uuid: string) => {
    try {
      await panelApi.restoreBackup(server.id, uuid);
      notify('Restore initiated', 'Wings is extracting backup archive', 'success');
    } catch (err: any) {
      notify('Restore failed', err.message, 'error');
    }
  };

  const handleToggleLock = async (uuid: string) => {
    try {
      await panelApi.toggleBackupLock(server.id, uuid);
      loadBackups();
    } catch (err: any) {
      notify('Could not toggle lock', err.message, 'error');
    }
  };

  const handleDelete = async (uuid: string) => {
    try {
      await panelApi.deleteBackup(server.id, uuid);
      notify('Backup deleted', undefined, 'success');
      loadBackups();
    } catch (err: any) {
      notify('Delete blocked', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-white">
            Backups
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            {server.name} · Compressed container snapshots
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Backup
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="mx-card-3d p-5 rounded-2xl space-y-4">
          <h2 className="text-sm font-semibold text-[#171717] dark:text-white">New Server Backup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                Backup Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pre-upgrade snapshot"
                className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                Ignored Files & Directories
              </label>
              <textarea
                rows={2}
                value={ignoredFiles}
                onChange={(e) => setIgnoredFiles(e.target.value)}
                placeholder="/logs/*.gz"
                className="mx-input-3d w-full px-3 py-2 text-xs font-mono rounded-xl"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-[#525252] dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isLocked}
                onChange={(e) => setIsLocked(e.target.checked)}
                className="accent-[#8B5CF6]"
              />
              Lock backup to prevent accidental deletion
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCreating(false)} className="mx-btn-3d px-3.5 py-2 rounded-xl text-xs cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
                Start Backup
              </button>
            </div>
          </div>
        </form>
      )}

      {loading && backups.length === 0 ? (
        <div className="mx-card-3d p-8 rounded-2xl text-center text-xs text-[#777777]">Loading backups...</div>
      ) : backups.length === 0 ? (
        <div className="mx-card-3d p-12 rounded-2xl text-center">
          <Archive className="w-8 h-8 text-[#777777] mx-auto mb-2" />
          <p className="text-sm font-medium text-[#171717] dark:text-white">No backups created yet</p>
          <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">
            Create your first snapshot before making major plugin or configuration edits.
          </p>
        </div>
      ) : (
        <div className="mx-card-3d rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] font-medium text-[#777777] dark:text-zinc-400">
                <th className="py-3 px-4">Snapshot Name</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Size</th>
                <th className="py-3 px-3">Checksum</th>
                <th className="py-3 px-3 text-right">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05] text-xs">
              {backups.map((b) => (
                <tr key={b.uuid} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 font-medium text-[#171717] dark:text-zinc-100">
                      {b.isLocked && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <span>{b.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {b.completedAt ? (
                      <span className={b.isSuccessful ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-rose-500 font-medium'}>
                        {b.isSuccessful ? 'Completed' : 'Failed'}
                      </span>
                    ) : (
                      <span className="text-[#06B6D4] font-medium">In Progress</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">{formatBytes(b.bytes)}</td>
                  <td className="py-3 px-3 font-mono text-[11px] text-[#777777] dark:text-zinc-400">
                    {b.sha256Hash ? `${b.sha256Hash.slice(0, 12)}…` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-[#777777] dark:text-zinc-400">
                    {formatDate(b.createdAt)} · {formatRelativeTime(b.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        title={b.isLocked ? 'Unlock backup' : 'Lock backup'}
                        onClick={() => handleToggleLock(b.uuid)}
                        className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
                      >
                        {b.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        title="Restore backup"
                        disabled={!b.isSuccessful}
                        onClick={() => handleRestore(b.uuid)}
                        className="mx-btn-3d p-1.5 rounded-lg text-[#8B5CF6] disabled:opacity-40 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Download backup"
                        disabled={!b.isSuccessful}
                        onClick={() => handleDownload(b.uuid)}
                        className="mx-btn-3d p-1.5 rounded-lg text-[#06B6D4] disabled:opacity-40 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete backup"
                        disabled={b.isLocked}
                        onClick={() => handleDelete(b.uuid)}
                        className="mx-btn-3d p-1.5 rounded-lg text-rose-500 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
