import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Key,
  Lock,
  MonitorCog,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { ActivityLogEntry, ApiKeyEntry, SshKeyEntry } from '../types/panel';
import { formatRelativeTime } from '../utils/format';
import {
  computeSecurityScore,
  evaluatePasswordStrength,
  exportAccountDataJson,
  type FontScale,
  type ThemeMode,
} from '../utils/userPreferences';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import defaultAvatar from '../assets/images/avatar_midnightx_user_1795748243919.jpg';

export function UserProfilePage() {
  const {
    user,
    servers,
    refreshData,
    notify,
    panelConnected,
    connectionError,
    themeMode,
    setThemeMode,
    accessibilityPrefs,
    setAccessibilityPrefs,
  } = usePanel();
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [sshKeys, setSshKeys] = useState<SshKeyEntry[]>([]);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityCategory, setActivityCategory] = useState<'all' | 'auth' | 'power' | 'file' | 'backup'>('all');

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

  const [sshName, setSshName] = useState('');
  const [sshPublicKey, setSshPublicKey] = useState('');

  const loadAccountExtras = useCallback(async () => {
    if (!panelConnected) return;
    try {
      const [keys, ssh, act] = await Promise.all([
        panelApi.getApiKeys(),
        panelApi.getSshKeys().catch(() => []),
        panelApi.getAccountActivity().catch(() => []),
      ]);
      setApiKeys(keys);
      setSshKeys(ssh);
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

  const handleCreateSshKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await panelApi.createSshKey(sshName.trim(), sshPublicKey.trim());
      setSshName('');
      setSshPublicKey('');
      loadAccountExtras();
      notify('SSH key added', undefined, 'success');
    } catch (err: any) {
      notify('Failed to add SSH key', err.message, 'error');
    }
  };

  const handleDeleteSshKey = async (fingerprint: string) => {
    try {
      await panelApi.deleteSshKey(fingerprint);
      loadAccountExtras();
      notify('SSH key removed', undefined, 'success');
    } catch (err: any) {
      notify('Could not remove SSH key', err.message, 'error');
    }
  };

  const securityAssessment = useMemo(
    () => computeSecurityScore(user, apiKeys, sshKeys),
    [user, apiKeys, sshKeys]
  );

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(newPassword),
    [newPassword]
  );

  const filteredActivity = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    return activity.filter((item) => {
      if (activityCategory !== 'all' && item.category !== activityCategory) return false;
      if (!q) return true;
      return `${item.event} ${item.ip} ${item.target || ''}`.toLowerCase().includes(q);
    });
  }, [activity, activitySearch, activityCategory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-white">
            Account & Security
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            Manage your Pterodactyl credentials, Two-Factor Authentication, and Client API keys
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            exportAccountDataJson({ user, servers, apiKeys, sshKeys, activity });
            notify('Account data exported', 'Downloaded JSON snapshot of your account.', 'success');
          }}
          className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-[#8B5CF6]" />
          Export Account Data (JSON)
        </button>
      </div>

      {/* Account Security Score & Recommendations */}
      <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="mx-well-3d w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
              {securityAssessment.score >= 80 ? (
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-500" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#171717] dark:text-white">
                Account Security Score & Recommendations
              </h2>
              <p className="text-xs text-[#777777] dark:text-zinc-400">
                Real-time assessment of your active 2FA, SSH keys, and API key allowlists
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-bold mx-stat-3d-violet">{securityAssessment.score}%</span>
            <span className="mx-well-3d px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#171717] dark:text-zinc-200">
              {securityAssessment.grade}
            </span>
          </div>
        </div>

        <div className="mx-well-3d h-2.5 rounded-full overflow-hidden p-[1.5px]">
          <div
            className="mx-meter-violet h-full rounded-full transition-all duration-300"
            style={{ width: `${securityAssessment.score}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {securityAssessment.recommendations.map((rec) => (
            <div key={rec.id} className="mx-well-3d p-3.5 rounded-xl flex items-start gap-2.5">
              <CheckCircle2
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  rec.completed ? 'text-emerald-500' : 'text-amber-500'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#171717] dark:text-zinc-100">{rec.title}</div>
                <div className="text-[11px] text-[#777777] dark:text-zinc-400 mt-0.5">{rec.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

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

            {newPassword.length > 0 && (
              <div className="mx-well-3d p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#777777] dark:text-zinc-400 font-medium">Password Strength</span>
                  <span
                    className={`font-semibold ${
                      passwordStrength.score >= 3
                        ? 'text-emerald-500'
                        : passwordStrength.score === 2
                          ? 'text-amber-500'
                          : 'text-rose-500'
                    }`}
                  >
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-1.5 rounded-full transition-colors ${
                        passwordStrength.score >= step
                          ? passwordStrength.score >= 3
                            ? 'bg-emerald-500'
                            : passwordStrength.score === 2
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          : 'bg-black/10 dark:bg-white/10'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#777777] dark:text-zinc-400">
                  <span className={passwordStrength.checks.length ? 'text-emerald-500 font-medium' : ''}>
                    10+ chars
                  </span>
                  <span className={passwordStrength.checks.upper && passwordStrength.checks.lower ? 'text-emerald-500 font-medium' : ''}>
                    Upper &amp; lower
                  </span>
                  <span className={passwordStrength.checks.number ? 'text-emerald-500 font-medium' : ''}>
                    Number
                  </span>
                  <span className={passwordStrength.checks.symbol ? 'text-emerald-500 font-medium' : ''}>
                    Symbol
                  </span>
                </div>
              </div>
            )}

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

      {/* Account SSH Keys */}
      <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#171717] dark:text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#8B5CF6]" />
            SSH Keys
          </h2>
          <p className="text-xs text-[#777777] dark:text-zinc-400">
            Configure SSH public keys for SFTP authentication across your servers
          </p>
        </div>

        <form onSubmit={handleCreateSshKey} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              type="text"
              value={sshName}
              onChange={(e) => setSshName(e.target.value)}
              placeholder="SSH Key Name (e.g. Workstation)"
              required
              className="mx-input-3d md:col-span-4 px-3 py-2 text-xs rounded-xl"
            />
            <input
              type="text"
              value={sshPublicKey}
              onChange={(e) => setSshPublicKey(e.target.value)}
              placeholder="ssh-ed25519 AAAA..."
              required
              className="mx-input-3d md:col-span-6 px-3 py-2 text-xs font-mono rounded-xl"
            />
            <button type="submit" className="mx-btn-3d-primary md:col-span-2 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
              Add SSH Key
            </button>
          </div>
        </form>

        <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
          {sshKeys.length === 0 ? (
            <div className="py-4 text-xs text-[#777777]">No SSH keys added yet.</div>
          ) : (
            sshKeys.map((k) => (
              <div key={k.fingerprint} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-[#171717] dark:text-white">{k.name}</div>
                  <div className="font-mono text-[11px] text-[#777777] dark:text-zinc-400 mt-0.5 truncate">
                    SHA256:{k.fingerprint} · Added {formatRelativeTime(k.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSshKey(k.fingerprint)}
                  className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-500 self-start sm:self-auto cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Theme & Accessibility Preferences */}
      <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#171717] dark:text-white flex items-center gap-2">
            <MonitorCog className="w-4 h-4 text-[#8B5CF6]" />
            Appearance &amp; Accessibility Preferences
          </h2>
          <p className="text-xs text-[#777777] dark:text-zinc-400">
            Configure system theme auto-switching, typography scale, reduced motion, and contrast
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mx-well-3d p-4 rounded-xl space-y-2.5">
            <div className="text-xs font-semibold text-[#171717] dark:text-zinc-200">Theme Mode</div>
            <div className="flex flex-wrap gap-2">
              {(['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setThemeMode(mode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize cursor-pointer ${
                    themeMode === mode ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                  }`}
                >
                  {mode === 'auto' ? 'Auto (System)' : mode}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-well-3d p-4 rounded-xl space-y-2.5">
            <div className="text-xs font-semibold text-[#171717] dark:text-zinc-200">Interface Font Scale</div>
            <div className="flex flex-wrap gap-2">
              {(['compact', 'default', 'large'] as FontScale[]).map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() =>
                    setAccessibilityPrefs((prev) => ({ ...prev, fontScale: scale }))
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize cursor-pointer ${
                    accessibilityPrefs.fontScale === scale ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                  }`}
                >
                  {scale}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-5 pt-1">
          <label className="flex items-center gap-2 text-xs text-[#171717] dark:text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              checked={accessibilityPrefs.reducedMotion}
              onChange={(e) =>
                setAccessibilityPrefs((prev) => ({ ...prev, reducedMotion: e.target.checked }))
              }
              className="rounded accent-[#8B5CF6]"
            />
            Reduced motion (disable RGB gradient &amp; transition animations)
          </label>
          <label className="flex items-center gap-2 text-xs text-[#171717] dark:text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              checked={accessibilityPrefs.highContrast}
              onChange={(e) =>
                setAccessibilityPrefs((prev) => ({ ...prev, highContrast: e.target.checked }))
              }
              className="rounded accent-[#8B5CF6]"
            />
            High-contrast card &amp; input borders
          </label>
        </div>
      </section>

      {/* Account Activity Audit Log */}
      <section className="mx-card-3d p-5 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#171717] dark:text-white">Account Activity Log</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#777777] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Search event or IP..."
                className="mx-input-3d pl-8 pr-3 py-1.5 text-xs rounded-xl w-48"
              />
            </div>
            {(['all', 'auth', 'power', 'file', 'backup'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActivityCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize cursor-pointer ${
                  activityCategory === cat ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        {filteredActivity.length === 0 ? (
          <div className="text-xs text-[#777777] py-4">
            {activity.length === 0 ? 'No activity events recorded.' : 'No events match your current filter.'}
          </div>
        ) : (
          <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {filteredActivity.slice(0, 25).map((item) => (
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
