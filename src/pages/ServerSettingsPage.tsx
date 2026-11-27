import React, { useEffect, useState } from 'react';
import { AlertTriangle, Copy, ExternalLink, FolderSync, Info, RefreshCw, Save, Server } from 'lucide-react';
import { panelApi } from '../api/client';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { usePanel } from '../context/PanelContext';

export function ServerSettingsPage({ serverId }: { serverId: string }) {
  const { servers, user, refreshData, notify, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [name, setName] = useState(server?.name || '');
  const [description, setDescription] = useState(server?.description || '');
  const [savingRename, setSavingRename] = useState(false);

  const [confirmReinstall, setConfirmReinstall] = useState(false);
  const [reinstalling, setReinstalling] = useState(false);

  useEffect(() => {
    if (server) {
      setName(server.name);
      setDescription(server.description || '');
      setConfirmReinstall(false);
    }
  }, [server?.id, server?.name, server?.description]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  const sftpHost = server.sftpDetails?.ip || server.allocations[0]?.alias || server.allocations[0]?.ip || server.node;
  const sftpPort = server.sftpDetails?.port || 2022;
  const sftpAddress = sftpHost ? `sftp://${sftpHost}:${sftpPort}` : '';
  const sftpUsername = user?.username ? `${user.username}.${server.identifier}` : server.identifier;
  const sftpLaunchHref = sftpHost
    ? `sftp://${encodeURIComponent(sftpUsername)}@${sftpHost}:${sftpPort}`
    : '#';

  const copyText = (label: string, value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    notify(`${label} copied`, value, 'success');
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingRename(true);
    try {
      await panelApi.renameServer(server.id, name.trim(), description.trim());
      await refreshData();
      notify('Server details updated', name.trim(), 'success');
    } catch (err: any) {
      notify('Update failed', err.message, 'error');
    } finally {
      setSavingRename(false);
    }
  };

  const handleReinstall = async () => {
    setReinstalling(true);
    try {
      await panelApi.reinstallServer(server.id);
      setConfirmReinstall(false);
      await refreshData();
      notify('Server reinstall queued', 'Wings is running the egg installation script.', 'success');
    } catch (err: any) {
      notify('Reinstall failed', err.message, 'error');
    } finally {
      setReinstalling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
          Server Settings & SFTP
        </h1>
        <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
          {server.name} · SFTP access credentials, metadata, debug info, and container reinstallation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SFTP Details */}
        <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderSync className="w-4 h-4 text-[#06B6D4]" />
              <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
                SFTP Connection Details
              </h2>
            </div>
            {sftpHost && (
              <a
                href={sftpLaunchHref}
                className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                Launch SFTP
              </a>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#777777] dark:text-zinc-400 mb-1">
                Server Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={sftpAddress || 'Unavailable'}
                  className="mx-input-3d flex-1 px-3 py-2 text-xs font-mono rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => copyText('SFTP address', sftpAddress)}
                  className="mx-btn-3d p-2 rounded-xl cursor-pointer"
                  title="Copy SFTP address"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#777777] dark:text-zinc-400 mb-1">
                Username
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={sftpUsername}
                  className="mx-input-3d flex-1 px-3 py-2 text-xs font-mono rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => copyText('SFTP username', sftpUsername)}
                  className="mx-btn-3d p-2 rounded-xl cursor-pointer"
                  title="Copy SFTP username"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="mx-well-3d p-3 rounded-xl text-[11px] text-[#525252] dark:text-zinc-300 leading-relaxed">
            Your SFTP password is the same password you use to access this Pterodactyl Panel account.
          </div>
        </section>

        {/* Rename Server */}
        <form onSubmit={handleRename} className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#8B5CF6]" />
            <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
              Change Server Details
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                Server Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                Server Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description shown on server cards"
                className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingRename}
              className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingRename ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Debug Info */}
        <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#06B6D4]" />
            <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
              Debug Information
            </h2>
          </div>

          <div className="mx-well-3d rounded-xl divide-y divide-black/[0.06] dark:divide-white/[0.06] text-xs">
            <div className="flex items-center justify-between px-3.5 py-2.5 gap-3">
              <span className="text-[#777777] dark:text-zinc-400">Node</span>
              <span className="font-medium text-[#171717] dark:text-zinc-100">{server.node}</span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 gap-3">
              <span className="text-[#777777] dark:text-zinc-400">Server ID</span>
              <button
                type="button"
                onClick={() => copyText('Server ID', server.identifier)}
                className="font-mono text-[#171717] dark:text-zinc-100 hover:text-[#8B5CF6] cursor-pointer"
              >
                {server.identifier}
              </button>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 gap-3">
              <span className="text-[#777777] dark:text-zinc-400">Server UUID</span>
              <button
                type="button"
                onClick={() => copyText('Server UUID', server.uuid)}
                className="font-mono text-[11px] text-[#171717] dark:text-zinc-100 hover:text-[#8B5CF6] truncate max-w-[230px] cursor-pointer"
              >
                {server.uuid}
              </button>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 gap-3">
              <span className="text-[#777777] dark:text-zinc-400">Feature Quotas</span>
              <span className="font-semibold tabular-nums text-[#171717] dark:text-zinc-100">
                {server.featureLimits.databases} DB · {server.featureLimits.backups} Backups ·{' '}
                {server.featureLimits.allocations} Ports
              </span>
            </div>
          </div>
        </section>

        {/* Reinstall Server */}
        <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
              Reinstall Server
            </h2>
          </div>

          <p className="text-xs text-[#525252] dark:text-zinc-300 leading-relaxed">
            Reinstalling your server will stop it and re-run the installation script that initially set it up.{' '}
            <strong className="text-rose-600 dark:text-rose-400">
              Some files may be deleted or modified during this process — back up your data before continuing.
            </strong>
          </p>

          {!confirmReinstall ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setConfirmReinstall(true)}
                className="mx-btn-3d-danger inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reinstall Server
              </button>
            </div>
          ) : (
            <div className="mx-well-3d p-4 rounded-xl border border-rose-500/30 space-y-3">
              <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Confirm server reinstallation for {server.name}?
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={reinstalling}
                  onClick={handleReinstall}
                  className="mx-btn-3d-danger px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 cursor-pointer"
                >
                  {reinstalling ? 'Reinstalling...' : 'Yes, Reinstall Now'}
                </button>
                <button
                  type="button"
                  disabled={reinstalling}
                  onClick={() => setConfirmReinstall(false)}
                  className="mx-btn-3d px-3.5 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
