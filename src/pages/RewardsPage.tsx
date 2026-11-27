import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CalendarCheck2,
  Copy,
  Crown,
  Flame,
  Gift,
  ShoppingBag,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { helzerxApi } from '../api/helzerx';
import { usePanel } from '../context/PanelContext';
import type { RewardsOverviewResponse } from '../types/helzerx';
import { formatRelativeTime } from '../utils/format';

export function RewardsPage() {
  const { notify, refreshHelzerx } = usePanel();
  const [data, setData] = useState<RewardsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'shop' | 'membership' | 'leaderboards' | 'history'>('overview');
  const [boardKind, setBoardKind] = useState<'global' | 'weekly' | 'monthly' | 'referrals'>('global');
  const [birthdayInput, setBirthdayInput] = useState('');
  const [refInput, setRefInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const loadRewards = useCallback(async () => {
    try {
      const res = await helzerxApi.getRewards();
      setData(res);
      setBirthdayInput(res.account.birthdayMonthDay || '');
    } catch (err: any) {
      notify('Could not load rewards', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  const handleClaim = async (type: 'daily' | 'weekly' | 'monthly' | 'birthday' | 'event') => {
    setBusy(type);
    try {
      const res = await helzerxApi.claimReward(type, type === 'birthday' ? birthdayInput : undefined);
      notify(res.message || `${type.toUpperCase()} reward claimed!`, undefined, 'success');
      await Promise.all([loadRewards(), refreshHelzerx()]);
    } catch (err: any) {
      notify('Claim unavailable', err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleRedeemItem = async (id: string, name: string) => {
    setBusy(id);
    try {
      await helzerxApi.redeemShopItem(id);
      notify('Reward redeemed', name, 'success');
      await Promise.all([loadRewards(), refreshHelzerx()]);
    } catch (err: any) {
      notify('Redemption failed', err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleUpgradeTier = async (tier: 'Premium' | 'VIP') => {
    setBusy(`tier_${tier}`);
    try {
      await helzerxApi.upgradeMembershipTier(tier);
      notify(`${tier} Membership activated`, '30 days of perks unlocked', 'success');
      await Promise.all([loadRewards(), refreshHelzerx()]);
    } catch (err: any) {
      notify('Upgrade failed', err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleApplyReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refInput.trim()) return;
    setBusy('referral');
    try {
      const res = await helzerxApi.applyReferralCode(refInput.trim());
      notify('Referral bonus applied!', `+$${res.bonus.toFixed(2)} wallet credit added`, 'success');
      setRefInput('');
      await Promise.all([loadRewards(), refreshHelzerx()]);
    } catch (err: any) {
      notify('Referral failed', err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  const { account, badgesCatalog, shopItems, claims, leaderboards } = data;
  const levelProgress = Math.min(100, Math.round(((account.xp % 250) / 250) * 100));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
            Rewards, Loyalty &amp; Leaderboards
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            Earn XP, maintain check-in streaks, unlock badges, and redeem Loyalty Points for hosting credit
          </p>
        </div>

        <div className="mx-well-3d inline-flex flex-wrap gap-1 p-1.5 rounded-2xl">
          {(
            [
              { id: 'overview', label: 'Daily & Badges' },
              { id: 'shop', label: 'Reward Shop' },
              { id: 'membership', label: 'VIP & Referrals' },
              { id: 'leaderboards', label: 'Leaderboards' },
              { id: 'history', label: 'Claim History' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                tab === item.id ? 'mx-btn-3d-primary' : 'text-[#525252] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-[#777777] dark:text-zinc-400">
            <span>Current Level</span>
            <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <div className="mt-1.5 text-2xl font-bold mx-stat-3d-violet">Level {account.level}</div>
          <div className="mt-2 mx-well-3d h-2 rounded-full overflow-hidden p-[1px]">
            <div className="mx-meter-violet h-full rounded-full" style={{ width: `${levelProgress}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500 tabular-nums">
            {account.xp} Total XP ({250 - (account.xp % 250)} XP to next)
          </div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-[#777777] dark:text-zinc-400">
            <span>Loyalty Points</span>
            <ShoppingBag className="w-4 h-4 text-[#06B6D4]" />
          </div>
          <div className="mt-1.5 text-2xl font-bold mx-stat-3d-cyan tabular-nums">{account.points}</div>
          <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500">
            Spendable in Reward Shop
          </div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-[#777777] dark:text-zinc-400">
            <span>Check-In Streak</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold mx-stat-3d tabular-nums">{account.streakDays} Days</div>
          <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500">
            Best streak: {account.longestStreak} days
          </div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-[#777777] dark:text-zinc-400">
            <span>Membership Tier</span>
            <Crown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold mx-stat-3d-emerald">{account.tier}</div>
          <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500">
            {account.badges.length} / {badgesCatalog.length} Badges Unlocked
          </div>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Reward Claim Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#171717] dark:text-white">
                  <CalendarCheck2 className="w-4 h-4 text-[#8B5CF6]" />
                  Daily Login Reward
                </div>
                <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">
                  Build your loyalty streak to earn scaling XP and points every 24 hours.
                </p>
              </div>
              <button
                type="button"
                disabled={busy === 'daily'}
                onClick={() => handleClaim('daily')}
                className="mx-btn-3d-primary w-full py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                {busy === 'daily' ? 'Claiming...' : 'Claim Daily Check-In'}
              </button>
            </div>

            <div className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#171717] dark:text-white">
                  <Gift className="w-4 h-4 text-[#06B6D4]" />
                  Weekly &amp; Event Drops
                </div>
                <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">
                  Claim +120 XP weekly bonus or today&apos;s special event reward crate.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy === 'weekly'}
                  onClick={() => handleClaim('weekly')}
                  className="mx-btn-3d py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                  Weekly Drop
                </button>
                <button
                  type="button"
                  disabled={busy === 'event'}
                  onClick={() => handleClaim('event')}
                  className="mx-btn-3d py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                  Event Bonus
                </button>
              </div>
            </div>

            <div className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#171717] dark:text-white">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Monthly Member Gift
                </div>
                <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">
                  +300 XP &amp; +200 Points (+$1 Premium / +$2 VIP wallet credit bonus).
                </p>
              </div>
              <button
                type="button"
                disabled={busy === 'monthly'}
                onClick={() => handleClaim('monthly')}
                className="mx-btn-3d w-full py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                Claim Monthly Gift
              </button>
            </div>

            <div className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#171717] dark:text-white">
                  <Gift className="w-4 h-4 text-amber-500" />
                  Birthday Reward
                </div>
                <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">
                  Set MM-DD to receive a +$1.00 gift &amp; 250 XP on your birthday.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={birthdayInput}
                  onChange={(e) => setBirthdayInput(e.target.value)}
                  placeholder="MM-DD (e.g. 11-27)"
                  className="mx-input-3d flex-1 px-2.5 py-1.5 rounded-xl text-xs font-mono"
                />
                <button
                  type="button"
                  disabled={busy === 'birthday'}
                  onClick={() => handleClaim('birthday')}
                  className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Save/Claim
                </button>
              </div>
            </div>
          </div>

          {/* Achievement Badges */}
          <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                Achievement Badges
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {badgesCatalog.map((b) => {
                const unlocked = account.badges.includes(b.id);
                return (
                  <div
                    key={b.id}
                    className={`mx-well-3d p-4 rounded-xl flex items-start gap-3 ${
                      unlocked ? 'ring-1 ring-[#8B5CF6]/40' : 'opacity-65'
                    }`}
                  >
                    <div className="mx-btn-3d w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                      <Award className={`w-4 h-4 ${unlocked ? 'text-[#8B5CF6]' : 'text-[#777777]'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#171717] dark:text-white">{b.name}</span>
                        <span className="text-[10px] uppercase font-mono text-[#8B5CF6]">+{b.xpReward} XP</span>
                      </div>
                      <p className="text-[11px] text-[#777777] dark:text-zinc-400 mt-0.5">{b.description}</p>
                      <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
                        {unlocked ? 'Unlocked' : 'Locked'} · {b.rarity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === 'shop' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {shopItems.map((item) => {
            const canAfford = account.points >= item.costPoints;
            return (
              <div key={item.id} className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#777777]">
                    <span>{item.type.replace('_', ' ').toUpperCase()}</span>
                    <span>Stock: {item.stock}</span>
                  </div>
                  <h3 className="mx-heading-3d text-base font-bold mt-1.5 text-[#171717] dark:text-white">
                    {item.name}
                  </h3>
                  <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">{item.description}</p>
                </div>
                <div className="space-y-2.5">
                  <div className="text-lg font-bold mx-stat-3d-cyan tabular-nums">{item.costPoints} Points</div>
                  <button
                    type="button"
                    disabled={!canAfford || busy === item.id || item.stock <= 0}
                    onClick={() => handleRedeemItem(item.id, item.name)}
                    className="mx-btn-3d-primary w-full py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-45"
                  >
                    {busy === item.id ? 'Redeeming...' : canAfford ? 'Redeem Now' : 'Insufficient Points'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'membership' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-[#06B6D4] uppercase">Premium Tier</div>
                <div className="mt-1 text-2xl font-bold mx-stat-3d-cyan">$4.99 <span className="text-xs font-normal text-[#777777]">/ 30 days</span></div>
                <ul className="mt-3 space-y-1.5 text-xs text-[#525252] dark:text-zinc-300">
                  <li>• 1.25x XP multiplier across all activities</li>
                  <li>• +$1.00 monthly wallet loyalty bonus</li>
                  <li>• Priority queue in Support Tickets</li>
                </ul>
              </div>
              <button
                type="button"
                disabled={busy === 'tier_Premium' || account.tier === 'Premium'}
                onClick={() => handleUpgradeTier('Premium')}
                className="mx-btn-3d w-full py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                {account.tier === 'Premium' ? 'Current Active Plan' : 'Activate with Wallet ($4.99)'}
              </button>
            </div>

            <div className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-4 ring-1 ring-[#8B5CF6]/40">
              <div>
                <div className="text-xs font-semibold text-[#8B5CF6] uppercase">VIP Membership</div>
                <div className="mt-1 text-2xl font-bold mx-stat-3d-violet">$9.99 <span className="text-xs font-normal text-[#777777]">/ 30 days</span></div>
                <ul className="mt-3 space-y-1.5 text-xs text-[#525252] dark:text-zinc-300">
                  <li>• 1.5x XP boost + VIP exclusive announcements</li>
                  <li>• +$2.00 monthly wallet loyalty bonus</li>
                  <li>• VIP badge next to Community discussions</li>
                </ul>
              </div>
              <button
                type="button"
                disabled={busy === 'tier_VIP' || account.tier === 'VIP'}
                onClick={() => handleUpgradeTier('VIP')}
                className="mx-btn-3d-primary w-full py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                {account.tier === 'VIP' ? 'VIP Active' : 'Upgrade with Wallet ($9.99)'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 mx-card-3d p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#171717] dark:text-white">
              <Users className="w-4 h-4 text-[#8B5CF6]" />
              Referral Program
            </div>
            <p className="text-xs text-[#777777] dark:text-zinc-400">
              Share your code to earn $2.50 credit per invited user. New users get $1.50 welcome bonus!
            </p>
            <div className="mx-well-3d p-3 rounded-xl flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-[#8B5CF6]">{account.referralCode}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(account.referralCode);
                  notify('Referral code copied', account.referralCode, 'success');
                }}
                className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="mx-well-3d p-3 rounded-xl">
                <div className="text-[#777777]">Invited Users</div>
                <div className="text-lg font-bold mt-0.5 tabular-nums">{account.referralCount}</div>
              </div>
              <div className="mx-well-3d p-3 rounded-xl">
                <div className="text-[#777777]">Earned Credit</div>
                <div className="text-lg font-bold mt-0.5 text-emerald-500 tabular-nums">
                  ${account.referralEarnings.toFixed(2)}
                </div>
              </div>
            </div>

            {!account.referredBy && (
              <form onSubmit={handleApplyReferral} className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex gap-2">
                <input
                  type="text"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  placeholder="Have a friend's referral code?"
                  className="mx-input-3d flex-1 px-3 py-2 rounded-xl text-xs font-mono uppercase"
                />
                <button
                  type="submit"
                  disabled={busy === 'referral'}
                  className="mx-btn-3d-primary px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Apply
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {tab === 'leaderboards' && (
        <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
                Platform Leaderboards
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['global', 'weekly', 'monthly', 'referrals'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setBoardKind(k)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium capitalize cursor-pointer ${
                    boardKind === k ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {leaderboards[boardKind].map((row, idx) => (
              <div key={row.userId} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="mx-well-3d w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[#171717] dark:text-white truncate">
                      {row.displayName || row.username}{' '}
                      <span className="text-[10px] font-mono text-[#8B5CF6]">[{row.tier}]</span>
                    </div>
                    <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                      @{row.username} · Level {row.level} · {row.streakDays}d streak
                    </div>
                  </div>
                </div>
                <div className="font-display font-bold tabular-nums text-right">
                  {boardKind === 'referrals'
                    ? `${row.referralCount} Referrals`
                    : boardKind === 'weekly'
                      ? `${row.weeklyXp} XP`
                      : boardKind === 'monthly'
                        ? `${row.monthlyXp} XP`
                        : `${row.xp} XP`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'history' && (
        <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-3">
          <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
            Reward Claim &amp; Redemption History
          </h2>
          {claims.length === 0 ? (
            <div className="py-6 text-xs text-[#777777]">No reward claims recorded yet.</div>
          ) : (
            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {claims.map((c) => (
                <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-[#171717] dark:text-white">{c.title}</div>
                    <div className="text-[11px] text-[#777777]">{formatRelativeTime(c.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    {c.xpDelta !== 0 && <span className="text-[#8B5CF6]">+{c.xpDelta} XP</span>}
                    {c.pointsDelta !== 0 && (
                      <span className={c.pointsDelta > 0 ? 'text-[#06B6D4]' : 'text-amber-500'}>
                        {c.pointsDelta > 0 ? `+${c.pointsDelta}` : c.pointsDelta} Pts
                      </span>
                    )}
                    {c.walletDelta > 0 && <span className="text-emerald-500">+${c.walletDelta.toFixed(2)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
