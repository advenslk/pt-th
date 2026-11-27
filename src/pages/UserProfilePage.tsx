import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Key, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { ActivityLogEntry, ApiKeyEntry } from '../types/panel';
import { formatRelativeTime } from '../utils/format';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import defaultAvatar from '../assets/images/avatar_midnightx_user_1795748243919.jpg';

export function UserProfilePage() {
  const { user, refreshData, notify, panelConnected, connectionError } = usePanel();
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);

  const [email, setEmail] = useState(user?.email || '');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [totpSetup, setTotpSetup] = useState<{ image_url_data: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpPassword, setTotpPassword] = useState('');
  const [recoveryTokens, setRecoveryTokens] = useState<string[]>([]);

  const [keyDesc, setKeyDesc] = useState('');
  const [keyIps, setKeyIps] = useState('');
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const loadAccountExtras = useCallback(async () => {
    if (!panelConnected) return;
    try {
      const [keys, act] = await Promise.all([
        panelApi.getApiKeys(),
        panelApi.getAccountActivity().catch(() => []),
      ]);
      setApiKeys(keys);
      setActivity(act);
    } catch (err: any) {
      notify('Could not load account details', err.message, 'error');
    }
  }, [panelConnected, notify]);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
    loadAccountExtras();
  }, [user?.email, loadAccountExtras]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await panelApi.updateEmail(email, emailPassword);
      setEmailPassword('');
      await refreshData();
      notify('Account email updated', email, 'success');
    } catch (err: any) {
      notify('Update failed', err.message, 'error');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await panelApi.updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      notify('Password updated', undefined, 'success');
    } catch (err: any) {
      notify('Password error', err.message, 'error');
    }
  };

  const handleStart2FA = async () => {
    try {
      const data = await panelApi.getTwoFactorSetup();
      setTotpSetup(data);
    } catch (err: any) {
      notify('Could not initialize 2FA', err.message, 'error');
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tokens = await panelApi.enableTwoFactor(totpCode, totpPassword);
      setRecoveryTokens(tokens);
      setTotpSetup(null);
      setTotpCode('');
      setTotpPassword('');
      await refreshData();
      notify('Two-Factor Authentication enabled', undefined, 'success');
    } catch (err: any) {
      notify('2FA verification failed', err.message, 'error');
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await panelApi.disableTwoFactor(totpPassword);
      setTotpPassword('');
      await refreshData();
      notify('Two-Factor Authentication disabled', undefined, 'success');
    } catch (err: any) {
      notify('Could not disable 2FA', err.message, 'error');
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ips = keyIps
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await panelApi.createApiKey(keyDesc, ips);
      setRevealedSecret(res.secretToken);
      setKeyDesc('');
      setKeyIps('');
      loadAccountExtras();
      notify('API key created', 'Copy the token now — it will only be displayed once.', 'success');
    } catch (err: any) {
      notify('Failed to create API key', err.message, 'error');
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    try {
      await panelApi.deleteApiKey(id);
      loadAccountExtras();
      notify('API key revoked', id, 'success');
    } catch (err: any) {
      notify('Could not revoke key', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-white">
          Account & Security
        </h1>
        <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
          Manage your Pterodactyl credentials, Two-Factor Authentication, and Client API keys
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSaveEmail} className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-[#171717] dark:ring-white/20 shrink-0 shadow-[0_6px_14px_rgba(0,0,0,0.22)]">
              <img
                src={defaultAvatar}
                alt={user?.username || 'User'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#171717] dark:text-white">
                {user ? `${user.firstName} ${user.lastName}`.trim() || user.username : 'Account'}
              </h2>
              <p className="text-xs text-[#777777] dark:text-zinc-400 font-mono">
                @{user?.username} · {user?.role}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-zinc-300 mb-1">Confirm Current Password</label>
              <input
                type="password"
                required
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Required by Pterodactyl to change email"
                className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button type="submit" className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
              Update Email
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <form onSubmit={handleUpdatePassword} className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171717] dark:text-white">
              <Lock className="w-4 h-4 text-[#8B5CF6]" />
              Password Management
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                required
                className="mx-input-3d px-3 py-2 text-xs rounded-xl"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                required
                className="mx-input-3d px-3 py-2 text-xs rounded-xl"
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="mx-btn-3d px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
                Update Password
              </button>
            </div>
          </form>

          <div className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${user?.twoFactorEnabled ? 'text-emerald-600' : 'text-[#777777]'}`} />
                <div>
                  <div className="text-sm font-semibold text-[#171717] dark:text-white">
                    Two-Factor Authentication
                  </div>
                  <div className="text-xs text-[#777777] dark:text-zinc-400">
                    {user?.twoFactorEnabled ? 'Enabled on your account' : 'Disabled'}
                  </div>
                </div>
              </div>
              {!user?.twoFactorEnabled && !totpSetup && (
                <button type="button" onClick={handleStart2FA} className="mx-btn-3d-primary px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer">
                  Configure 2FA
                </button>
              )}
            </div>

            {totpSetup && (
              <form onSubmit={handleEnable2FA} className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <img src={totpSetup.image_url_data} alt="2FA QR Code" className="w-28 h-28 rounded-xl bg-white p-1.5" />
                  <div className="space-y-2 flex-1">
                    <div className="text-[#777777]">Scan with your authenticator app or enter secret:</div>
                    <div className="mx-well-3d p-2 rounded-lg font-mono text-[11px] break-all">{totpSetup.secret}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="6-digit TOTP code"
                    className="mx-input-3d px-3 py-2 rounded-xl font-mono"
                  />
                  <input
                    type="password"
                    required
                    value={totpPassword}
                    onChange={(e) => setTotpPassword(e.target.value)}
                    placeholder="Account password"
                    className="mx-input-3d px-3 py-2 rounded-xl"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setTotpSetup(null)} className="mx-btn-3d px-3 py-1.5 rounded-xl cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="mx-btn-3d-primary px-4 py-1.5 rounded-xl font-medium cursor-pointer">
                    Verify & Enable
                  </button>
                </div>
              </form>
            )}

            {user?.twoFactorEnabled && (
              <form onSubmit={handleDisable2FA} className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex gap-2 text-xs">
                <input
                  type="password"
                  required
                  value={totpPassword}
                  onChange={(e) => setTotpPassword(e.target.value)}
                  placeholder="Enter password to disable 2FA"
                  className="mx-input-3d flex-1 px-3 py-1.5 rounded-xl"
                />
                <button type="submit" className="mx-btn-3d-danger px-3.5 py-1.5 rounded-xl font-medium cursor-pointer">
                  Disable
                </button>
              </form>
            )}

            {recoveryTokens.length > 0 && (
              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <div className="text-[11px] text-[#777777] mb-1.5">Backup Recovery Tokens (save securely)</div>
                <div className="grid grid-cols-2 gap-2">
                  {recoveryTokens.map((code) => (
                    <div key={code} className="mx-well-3d px-2 py-1 rounded-lg font-mono text-[11px] text-center">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Client API Keys */}
      <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#171717] dark:text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-[#06B6D4]" />
            Account API Keys
          </h2>
          <p className="text-xs text-[#777777] dark:text-zinc-400">
            Generate scoped Pterodactyl Client API tokens
          </p>
        </div>

        <form onSubmit={handleCreateApiKey} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <input
            type="text"
            value={keyDesc}
            onChange={(e) => setKeyDesc(e.target.value)}
            placeholder="Key description"
            required
            className="mx-input-3d md:col-span-6 px-3 py-2 text-xs rounded-xl"
          />
          <input
            type="text"
            value={keyIps}
            onChange={(e) => setKeyIps(e.target.value)}
            placeholder="Allowed IPs (comma-separated, optional)"
            className="mx-input-3d md:col-span-4 px-3 py-2 text-xs font-mono rounded-xl"
          />
          <button type="submit" className="mx-btn-3d-primary md:col-span-2 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
            Create Key
          </button>
        </form>

        {revealedSecret && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                New Secret Token (copy now — shown once)
              </div>
              <div className="font-mono text-xs text-[#171717] dark:text-white truncate mt-0.5">
                {revealedSecret}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(revealedSecret);
                notify('Secret token copied', undefined, 'success');
              }}
              className="mx-btn-3d-success inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
        )}

        <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
          {apiKeys.length === 0 ? (
            <div className="py-4 text-xs text-[#777777]">No API keys generated yet.</div>
          ) : (
            apiKeys.map((k) => (
              <div key={k.identifier} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-medium text-[#171717] dark:text-white">{k.description}</div>
                  <div className="font-mono text-[11px] text-[#777777] dark:text-zinc-400 mt-0.5">
                    {k.tokenPreview} · Last used: {formatRelativeTime(k.lastUsedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteApiKey(k.identifier)}
                  className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-500 self-start sm:self-auto cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revoke
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Account Activity Audit Log */}
      <section className="mx-card-3d p-5 rounded-2xl space-y-3">
        <h2 className="text-sm font-semibold text-[#171717] dark:text-white">Account Activity Log</h2>
        {activity.length === 0 ? (
          <div className="text-xs text-[#777777] py-4">No activity events recorded.</div>
        ) : (
          <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {activity.slice(0, 15).map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-mono font-medium">{item.event}</div>
                  <div className="text-[11px] text-[#777777] dark:text-zinc-400">{item.ip}</div>
                </div>
                <span className="font-mono text-[11px] text-[#777777]">{formatRelativeTime(item.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
