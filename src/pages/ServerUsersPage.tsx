import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckSquare, Edit3, ShieldCheck, ShieldOff, Trash2, UserPlus, Users, X } from 'lucide-react';
import { panelApi } from '../api/client';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { usePanel } from '../context/PanelContext';
import type { PermissionGroupMap, ServerSubuser } from '../types/panel';
import { formatRelativeTime } from '../utils/format';

export function ServerUsersPage({ serverId }: { serverId: string }) {
  const { servers, notify, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [subusers, setSubusers] = useState<ServerSubuser[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<PermissionGroupMap>({});
  const [loading, setLoading] = useState(true);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<ServerSubuser | null>(null);
  const [email, setEmail] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['websocket.connect']);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteUuid, setConfirmDeleteUuid] = useState<string | null>(null);

  const loadUsersAndPermissions = useCallback(async () => {
    if (!server || !panelConnected) return;
    try {
      const [usersList, perms] = await Promise.all([
        panelApi.listSubusers(server.id),
        panelApi.getClientPermissions(),
      ]);
      setSubusers(usersList);
      setPermissionsMap(perms);
    } catch (err: any) {
      notify('Failed to load sub-users', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [server?.id, panelConnected, notify]);

  useEffect(() => {
    loadUsersAndPermissions();
  }, [loadUsersAndPermissions]);

  const allPermissionKeys = useMemo(() => {
    const keys: string[] = [];
    Object.entries(permissionsMap).forEach(([group, def]) => {
      Object.keys(def.keys || {}).forEach((key) => {
        keys.push(`${group}.${key}`);
      });
    });
    return keys;
  }, [permissionsMap]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  const openInvite = () => {
    setModalMode('create');
    setEditingUser(null);
    setEmail('');
    setSelectedPerms(['websocket.connect']);
  };

  const openEdit = (u: ServerSubuser) => {
    setModalMode('edit');
    setEditingUser(u);
    setEmail(u.email);
    setSelectedPerms(u.permissions);
  };

  const togglePermission = (perm: string) => {
    setSelectedPerms((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  };

  const toggleGroup = (group: string, keys: string[]) => {
    const full = keys.map((k) => `${group}.${k}`);
    const allSelected = full.every((p) => selectedPerms.includes(p));
    if (allSelected) {
      setSelectedPerms((prev) => prev.filter((p) => !full.includes(p)));
    } else {
      setSelectedPerms((prev) => Array.from(new Set([...prev, ...full])));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modalMode === 'create') {
        await panelApi.createSubuser(server.id, email.trim(), selectedPerms);
        notify('Sub-user invited', email.trim(), 'success');
      } else if (modalMode === 'edit' && editingUser) {
        await panelApi.updateSubuser(server.id, editingUser.uuid, selectedPerms);
        notify('Permissions updated', editingUser.username, 'success');
      }
      setModalMode(null);
      setEditingUser(null);
      await loadUsersAndPermissions();
    } catch (err: any) {
      notify('Could not save user permissions', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (uuid: string) => {
    try {
      await panelApi.deleteSubuser(server.id, uuid);
      setConfirmDeleteUuid(null);
      notify('Sub-user removed', undefined, 'success');
      await loadUsersAndPermissions();
    } catch (err: any) {
      notify('Delete failed', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
            Sub-Users & Access Control
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            {server.name} · Delegate granular server permissions to team members
          </p>
        </div>
        <button
          type="button"
          onClick={openInvite}
          className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          New User
        </button>
      </div>

      {modalMode && (
        <form onSubmit={handleSubmit} className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
                {modalMode === 'create' ? 'Invite Sub-User' : `Edit Permissions · ${editingUser?.username}`}
              </h2>
              <p className="text-xs text-[#777777] dark:text-zinc-400 mt-0.5">
                Select exact capabilities this account can perform on {server.name}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalMode(null)}
              className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {modalMode === 'create' && (
            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">
                User Account Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="mx-input-3d w-full max-w-md px-3 py-2 text-xs rounded-xl"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs font-medium text-[#525252] dark:text-zinc-300 tabular-nums">
              {selectedPerms.length} / {allPermissionKeys.length} permissions selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedPerms(allPermissionKeys)}
                className="mx-btn-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#8B5CF6]" />
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedPerms([])}
                className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(permissionsMap).map(([group, def]) => {
              const keys = Object.keys(def.keys || {});
              const selectedCount = keys.filter((k) => selectedPerms.includes(`${group}.${k}`)).length;
              return (
                <div key={group} className="mx-well-3d p-4 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-[#171717] dark:text-white">
                        {group}
                      </div>
                      <p className="text-[11px] text-[#777777] dark:text-zinc-400 mt-0.5">{def.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group, keys)}
                      className="mx-btn-3d px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 cursor-pointer tabular-nums"
                    >
                      {selectedCount === keys.length ? 'Unselect' : 'All'} ({selectedCount}/{keys.length})
                    </button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(def.keys || {}).map(([key, desc]) => {
                      const permId = `${group}.${key}`;
                      const checked = selectedPerms.includes(permId);
                      return (
                        <label
                          key={permId}
                          className="flex items-start gap-2.5 text-xs cursor-pointer rounded-lg p-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(permId)}
                            className="accent-[#8B5CF6] mt-0.5 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-mono text-[11px] font-semibold text-[#171717] dark:text-zinc-100">
                              {key}
                            </div>
                            <div className="text-[11px] text-[#777777] dark:text-zinc-400">{desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalMode(null)}
              className="mx-btn-3d px-4 py-2 rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              {modalMode === 'create' ? 'Invite User' : 'Save Permissions'}
            </button>
          </div>
        </form>
      )}

      {loading && subusers.length === 0 ? (
        <div className="mx-card-3d p-8 rounded-2xl text-center text-xs text-[#777777]">Loading sub-users...</div>
      ) : subusers.length === 0 ? (
        <div className="mx-card-3d p-12 rounded-2xl text-center">
          <Users className="w-8 h-8 text-[#777777] mx-auto mb-2" />
          <p className="text-sm font-medium text-[#171717] dark:text-white">No sub-users assigned</p>
          <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">
            Only the server owner currently has access. Invite team members with custom permission scopes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subusers.map((u) => (
            <div key={u.uuid} className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {u.image ? (
                    <img
                      src={u.image}
                      alt={u.username}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-black/10 dark:ring-white/15 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full mx-well-3d flex items-center justify-center text-xs font-bold uppercase shrink-0">
                      {u.username.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#171717] dark:text-white truncate">
                      {u.username}
                    </div>
                    <div className="text-xs text-[#777777] dark:text-zinc-400 truncate">{u.email}</div>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg shrink-0 ${
                    u.twoFactorEnabled
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {u.twoFactorEnabled ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                  {u.twoFactorEnabled ? '2FA On' : '2FA Off'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-black/[0.06] dark:border-white/[0.06] text-xs">
                <div className="text-[#777777] dark:text-zinc-400 tabular-nums">
                  <strong className="text-[#171717] dark:text-white">{u.permissions.length}</strong> permissions · Added{' '}
                  {formatRelativeTime(u.createdAt)}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit
                  </button>
                  {confirmDeleteUuid === u.uuid ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDelete(u.uuid)}
                        className="mx-btn-3d-danger px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteUuid(null)}
                        className="mx-btn-3d px-2 py-1.5 rounded-lg text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteUuid(u.uuid)}
                      className="mx-btn-3d p-1.5 rounded-lg text-rose-500 cursor-pointer"
                      title="Remove sub-user"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
