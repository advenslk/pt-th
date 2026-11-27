import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Database, Eye, EyeOff, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { DatabaseEntry } from '../types/panel';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';

type SafeDatabase = Omit<DatabaseEntry, 'password'> & { password?: string };

export function DatabasesPage({ serverId }: { serverId: string }) {
  const { servers, notify, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [databases, setDatabases] = useState<SafeDatabase[]>([]);
  const [visibleIds, setVisibleIds] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [dbName, setDbName] = useState('');
  const [remote, setRemote] = useState('%');

  const loadDatabases = useCallback(async () => {
    if (!server || !panelConnected) return;
    try {
      const list = await panelApi.listDatabases(server.id);
      setDatabases(list);
    } catch (err: any) {
      notify('Could not load databases', err.message, 'error');
    }
  }, [server?.id, panelConnected, notify]);

  useEffect(() => {
    setVisibleIds({});
    loadDatabases();
  }, [loadDatabases]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await panelApi.createDatabase(server.id, dbName, remote);
      setDbName('');
      setCreating(false);
      notify('Database provisioned', undefined, 'success');
      loadDatabases();
    } catch (err: any) {
      notify('Database creation failed', err.message, 'error');
    }
  };

  const handleRotate = async (dbId: string) => {
    try {
      await panelApi.rotateDatabasePassword(server.id, dbId);
      await loadDatabases();
      notify('Password rotated', 'New database credentials issued', 'success');
    } catch (err: any) {
      notify('Rotation failed', err.message, 'error');
    }
  };

  const handleDelete = async (dbId: string) => {
    try {
      await panelApi.deleteDatabase(server.id, dbId);
      notify('Database deleted', undefined, 'success');
      loadDatabases();
    } catch (err: any) {
      notify('Delete failed', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-white">
            Databases
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            {server.name} · Database credentials are masked by default
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          New Database
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="mx-card-3d p-5 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
              Database Name
            </label>
            <input
              type="text"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="economy_data"
              required
              className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
              Connections From (IP / %)
            </label>
            <input
              type="text"
              value={remote}
              onChange={(e) => setRemote(e.target.value)}
              placeholder="%"
              className="mx-input-3d w-full px-3 py-2 text-xs font-mono rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
              Create Database
            </button>
            <button type="button" onClick={() => setCreating(false)} className="mx-btn-3d px-3 py-2 rounded-xl text-xs cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      {databases.length === 0 ? (
        <div className="mx-card-3d p-12 rounded-2xl text-center">
          <Database className="w-8 h-8 text-[#777777] mx-auto mb-2" />
          <p className="text-sm font-medium text-[#171717] dark:text-white">No databases attached</p>
          <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">
            Provision a managed database schema for this server.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {databases.map((db) => {
            const isVisible = Boolean(visibleIds[db.id]);
            const passwordValue = db.password;

            return (
              <div key={db.id} className="mx-card-3d p-5 rounded-2xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#06B6D4]" />
                      <h3 className="text-sm font-semibold font-mono text-[#171717] dark:text-white">
                        {db.name}
                      </h3>
                    </div>
                    <p className="text-[11px] text-[#777777] dark:text-zinc-400 mt-0.5 font-mono">
                      {db.host}:{db.port} · Allow: {db.connectionsFrom}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Rotate password"
                      onClick={() => handleRotate(db.id)}
                      className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete database"
                      onClick={() => handleDelete(db.id)}
                      className="mx-btn-3d p-1.5 rounded-lg text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
                  <div>
                    <div className="text-[11px] text-[#777777] dark:text-zinc-400">Username</div>
                    <div className="mx-well-3d mt-1 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg font-mono">
                      <span className="truncate">{db.username}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(db.username);
                          notify('Copied username', db.username, 'info');
                        }}
                        className="text-[#777777] hover:text-[#171717] dark:hover:text-white cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-[#777777] dark:text-zinc-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Password
                    </div>
                    <div className="mx-well-3d mt-1 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg font-mono">
                      <span className="truncate">
                        {isVisible
                          ? passwordValue || 'Hidden by server permissions'
                          : '••••••••••••••••'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setVisibleIds((p) => ({ ...p, [db.id]: !p[db.id] }))}
                          title={isVisible ? 'Hide password' : 'Reveal password'}
                          className="text-[#8B5CF6] hover:opacity-80 cursor-pointer"
                        >
                          {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {isVisible && passwordValue && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(passwordValue);
                              notify('Copied password', undefined, 'info');
                            }}
                            className="text-[#777777] hover:text-[#171717] dark:hover:text-white cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
