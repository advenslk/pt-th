import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  FileText,
  Gift,
  Lock,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Tag,
  Trash2,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { helzerxApi } from '../api/helzerx';
import { usePanel } from '../context/PanelContext';
import type { BillingOverviewResponse, HelzerxInvoice, PaymentMethodEntry } from '../types/helzerx';
import { formatDate, formatMb, formatRelativeTime } from '../utils/format';

type BillingTab = 'wallet' | 'plans' | 'invoices' | 'methods' | 'admin';

export function BillingPage() {
  const { user, navigate, notify, refreshHelzerx } = usePanel();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState<BillingOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BillingTab>('wallet');
  const [busy, setBusy] = useState<string | null>(null);

  // Add Funds
  const [fundAmount, setFundAmount] = useState('10.00');
  const [fundMethod, setFundMethod] = useState('Stripe');
  const [fundRef, setFundRef] = useState('');

  // Promo / Coupon redeem
  const [promoCode, setPromoCode] = useState('');
  const [planCoupon, setPlanCoupon] = useState('');

  // Receipt modal & Refund modal
  const [receiptInvoice, setReceiptInvoice] = useState<HelzerxInvoice | null>(null);
  const [refundTarget, setRefundTarget] = useState<HelzerxInvoice | null>(null);
  const [refundReason, setRefundReason] = useState('');

  // Payment method form
  const [pmProvider, setPmProvider] = useState<PaymentMethodEntry['provider']>('Stripe');
  const [pmLabel, setPmLabel] = useState('');
  const [pmLast4, setPmLast4] = useState('');

  // Admin: Coupon creation
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState('15');
  const [newCouponBonus, setNewCouponBonus] = useState('0');
  const [newCouponMaxUses, setNewCouponMaxUses] = useState('100');
  const [newCouponDesc, setNewCouponDesc] = useState('');

  // Admin: Tax & config
  const [taxRateInput, setTaxRateInput] = useState('0');
  const [manualInstructionsInput, setManualInstructionsInput] = useState('');
  const [adminRefundNotes, setAdminRefundNotes] = useState<Record<string, string>>({});

  const loadBilling = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      const res = await helzerxApi.getBilling();
      setData(res);
      setTaxRateInput(String(res.config.taxRatePercent ?? 0));
      setManualInstructionsInput(res.config.manualPaymentInstructions || '');
      if (res.config.enabledGateways.length > 0 && !res.config.enabledGateways.includes(fundMethod)) {
        setFundMethod(res.config.enabledGateways[0]);
      }
    } catch (err: any) {
      notify('Could not load billing data', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, notify, fundMethod]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  if (!isAdmin) {
    return (
      <div className="mx-card-3d p-8 sm:p-10 rounded-2xl border border-rose-500/35 bg-rose-500/[0.06] max-w-xl mx-auto text-center space-y-4">
        <div className="mx-well-3d w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border border-rose-500/30 bg-rose-500/15">
          <Lock className="w-6 h-6 text-rose-500" />
        </div>
        <div className="space-y-1.5">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30">
            Not yet ready
          </span>
          <h1 className="mx-heading-3d text-lg sm:text-xl font-bold text-[#171717] dark:text-white">
            Billing Module Locked
          </h1>
          <p className="text-xs sm:text-sm text-[#525252] dark:text-zinc-300 leading-relaxed">
            The Billing &amp; Wallet section is not yet ready for user accounts. Only administrators can access this area during setup.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ page: 'dashboard' })}
          className="mx-btn-3d-primary px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(fundAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      notify('Invalid amount', 'Enter at least $1.00', 'error');
      return;
    }
    setBusy('add-funds');
    try {
      await helzerxApi.addFunds({ amount, method: fundMethod, reference: fundRef.trim() || undefined });
      const isManual = fundMethod.toLowerCase().includes('manual') || fundMethod.toLowerCase().includes('bank');
      notify(
        isManual ? 'Manual payment submitted' : 'Wallet credited',
        isManual ? 'Pending admin verification.' : `+$${amount.toFixed(2)} added via ${fundMethod}`,
        'success'
      );
      setFundRef('');
      await Promise.all([loadBilling(), refreshHelzerx()]);
    } catch (err: any) {
      notify('Payment failed', err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleRedeemPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    setBusy('promo');
    try {
      const res = await helzerxApi.redeemCoupon(promoCode.trim());
      notify('Coupon redeemed', res.message, 'success');
      setPromoCode('');
      await Promise.all([loadBilling(), refreshHelzerx()]);
    } catch (err: any) {
      notify('Coupon error', err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handlePurchasePlan = async (planId: string, planName: string) => {
    setBusy(`plan_${planId}`);
    try {
      await helzerxApi.purchasePlan(planId, planCoupon.trim() || undefined);
      notify('Plan activated', `${planName} paid via HelzerX Wallet`, 'success');
      setPlanCoupon('');
      await Promise.all([loadBilling(), refreshHelzerx()]);
    } catch (err: any) {
      notify('Purchase failed', err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pmLabel.trim()) return;
    setBusy('add-method');
    try {
      await helzerxApi.addPaymentMethod({
        provider: pmProvider,
        label: pmLabel.trim(),
        last4: pmLast4.trim() || '0000',
      });
      setPmLabel('');
      setPmLast4('');
      notify('Payment method saved', pmLabel.trim(), 'success');
      await loadBilling();
    } catch (err: any) {
      notify('Could not save method', err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteMethod = async (id: string) => {
    setBusy(`del_method_${id}`);
    try {
      await helzerxApi.deletePaymentMethod(id);
      notify('Payment method removed', undefined, 'info');
      await loadBilling();
    } catch (err: any) {
      notify('Delete failed', err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget || !refundReason.trim()) return;
    setBusy('refund');
    try {
      await helzerxApi.requestRefund(refundTarget.id, refundReason.trim());
      notify('Refund request submitted', refundTarget.number, 'success');
      setRefundTarget(null);
      setRefundReason('');
      await loadBilling();
    } catch (err: any) {
      notify('Refund error', err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadInvoice = (inv: HelzerxInvoice) => {
    const content = [
      'HELZERX HOSTING - TAX RECEIPT / INVOICE',
      '=======================================',
      `Invoice Number : ${inv.number}`,
      `Customer       : ${inv.username}`,
      `Description    : ${inv.description}`,
      `Method         : ${inv.method}`,
      `Status         : ${inv.status.toUpperCase()}`,
      `Subtotal       : $${inv.subtotal.toFixed(2)}`,
      `Discount       : -$${inv.discountAmount.toFixed(2)}`,
      `Tax (${inv.taxRate}%)     : $${inv.taxAmount.toFixed(2)}`,
      `Total Charged  : $${inv.total.toFixed(2)}`,
      `Issued At      : ${inv.issuedAt}`,
      `Paid At        : ${inv.paidAt || 'Pending'}`,
      '=======================================',
      'Thank you for choosing HelzerX Infrastructure.',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  const parsedFund = Number(fundAmount) || 0;
  const estTax = Number(((parsedFund * (data.config.taxRatePercent || 0)) / 100).toFixed(2));
  const isManualSelected =
    fundMethod.toLowerCase().includes('manual') || fundMethod.toLowerCase().includes('bank');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
            Billing, Wallet &amp; Hosting
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            Manage wallet credits, promo codes, hosting plans, invoices, and refunds
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadBilling()}
          className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#8B5CF6]" />
          Refresh Balance
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-[#777777] dark:text-zinc-400">
            <span className="mx-label-3d font-medium">Wallet Balance</span>
            <Wallet className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <div className="mt-2 text-2xl font-bold mx-stat-3d-violet">${data.walletBalance.toFixed(2)}</div>
          <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500">{data.config.currency} Credits</div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-[#777777] dark:text-zinc-400">
            <span className="mx-label-3d font-medium">Loyalty Points</span>
            <Gift className="w-4 h-4 text-[#06B6D4]" />
          </div>
          <div className="mt-2 text-2xl font-bold mx-stat-3d-cyan">{data.loyaltyPoints} pts</div>
          <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500">Redeemable in Rewards Shop</div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-[#777777] dark:text-zinc-400">
            <span className="mx-label-3d font-medium">Referral Code</span>
            <Tag className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-mono font-bold text-[#171717] dark:text-white truncate">
              {data.referralCode}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(data.referralCode);
                notify('Referral code copied', data.referralCode, 'success');
              }}
              className="mx-btn-3d p-1.5 rounded-lg cursor-pointer shrink-0"
              aria-label="Copy referral code"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500">
            {data.referralCount} invited · ${data.referralEarnings.toFixed(2)} earned
          </div>
        </div>

        <div className="mx-card-3d p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-[#777777] dark:text-zinc-400">
            <span className="mx-label-3d font-medium">Invoices</span>
            <Receipt className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold mx-stat-3d text-[#171717] dark:text-white">
            {data.invoices.length}
          </div>
          <div className="mt-1 text-[11px] text-[#777777] dark:text-zinc-500">
            Tax Rate: {data.config.taxRatePercent}%
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mx-well-3d inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl max-w-full overflow-x-auto">
        {(
          [
            { id: 'wallet', label: 'Wallet & Top-Up' },
            { id: 'plans', label: 'Hosting Plans' },
            { id: 'invoices', label: 'Invoices & Receipts' },
            { id: 'methods', label: 'Payment Methods & Refunds' },
            ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin Billing' }] : []),
          ] as Array<{ id: BillingTab; label: string }>
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer transition-all ${
              tab === item.id
                ? 'mx-btn-3d-primary'
                : 'text-[#525252] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* TAB 1: WALLET & TRANSACTIONS */}
      {tab === 'wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={handleAddFunds} className="mx-card-3d p-5 rounded-2xl space-y-4">
              <h2 className="mx-heading-3d text-sm font-bold flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#8B5CF6]" />
                Add Wallet Funds
              </h2>

              <div className="flex flex-wrap gap-2">
                {['5.00', '10.00', '25.00', '50.00'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFundAmount(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono cursor-pointer ${
                      fundAmount === preset ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[#525252] dark:text-zinc-300 font-medium mb-1">
                    Amount ({data.config.currency})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    step="0.01"
                    required
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="mx-input-3d w-full px-3 py-2 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#525252] dark:text-zinc-300 font-medium mb-1">
                    Payment Gateway
                  </label>
                  <select
                    value={fundMethod}
                    onChange={(e) => setFundMethod(e.target.value)}
                    className="mx-input-3d w-full px-3 py-2 rounded-xl"
                  >
                    {data.config.enabledGateways.map((gw) => (
                      <option key={gw} value={gw} className="bg-white dark:bg-[#19191F]">
                        {gw}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isManualSelected && (
                <div className="mx-well-3d p-3 rounded-xl space-y-2 text-xs">
                  <div className="font-semibold text-amber-600 dark:text-amber-400">
                    Manual Verification Instructions
                  </div>
                  <p className="text-[#525252] dark:text-zinc-300 leading-relaxed">
                    {data.config.manualPaymentInstructions}
                  </p>
                  <input
                    type="text"
                    required
                    value={fundRef}
                    onChange={(e) => setFundRef(e.target.value)}
                    placeholder="Bank Transfer Reference / Receipt ID"
                    className="mx-input-3d w-full px-3 py-2 rounded-xl font-mono"
                  />
                </div>
              )}

              <div className="mx-well-3d p-3 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-[#777777] dark:text-zinc-400">
                  <span>Wallet Credit</span>
                  <span className="font-mono">${parsedFund.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#777777] dark:text-zinc-400">
                  <span>Tax ({data.config.taxRatePercent}%)</span>
                  <span className="font-mono">${estTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-[#171717] dark:text-white pt-1 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <span>Total Charge</span>
                  <span className="font-mono">${(parsedFund + estTax).toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy === 'add-funds'}
                className="mx-btn-3d-primary w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {busy === 'add-funds'
                  ? 'Processing...'
                  : isManualSelected
                    ? 'Submit Manual Transfer for Approval'
                    : `Pay & Add $${parsedFund.toFixed(2)}`}
              </button>
            </form>

            <form onSubmit={handleRedeemPromo} className="mx-card-3d p-5 rounded-2xl space-y-3">
              <h2 className="mx-heading-3d text-sm font-bold flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#06B6D4]" />
                Redeem Promo / Bonus Code
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Try WELCOME10"
                  className="mx-input-3d flex-1 px-3 py-2 text-xs font-mono uppercase rounded-xl"
                />
                <button
                  type="submit"
                  disabled={busy === 'promo'}
                  className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Redeem
                </button>
              </div>
              <p className="text-[11px] text-[#777777] dark:text-zinc-400">
                Promo codes credit your wallet directly; discount coupons can be applied at plan checkout.
              </p>
            </form>
          </div>

          <div className="lg:col-span-7 mx-card-3d p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="mx-heading-3d text-sm font-bold">Wallet Transaction History</h2>
              <span className="text-[11px] font-mono text-[#777777]">{data.transactions.length} entries</span>
            </div>
            {data.transactions.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#777777] dark:text-zinc-400">
                No wallet transactions yet. Top up or redeem a promo code to get started.
              </div>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {data.transactions.map((tx) => (
                  <div key={tx.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#171717] dark:text-white truncate">{tx.note}</div>
                      <div className="text-[11px] text-[#777777] dark:text-zinc-400 font-mono">
                        {tx.method} · {tx.reference} · {formatRelativeTime(tx.createdAt)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-display font-bold tabular-nums ${
                          tx.type === 'debit'
                            ? 'text-rose-500'
                            : tx.status === 'pending'
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                        }`}
                      >
                        {tx.type === 'debit' ? '-' : '+'}${tx.amount.toFixed(2)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-[#777777]">{tx.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HOSTING PLANS */}
      {tab === 'plans' && (
        <div className="space-y-5">
          <div className="mx-card-3d p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[#171717] dark:text-white">
                Checkout Discount Coupon (Optional)
              </div>
              <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                Enter a coupon code like <span className="font-mono">HELZER20</span> or <span className="font-mono">WELCOME10</span> before purchasing a plan.
              </div>
            </div>
            <input
              type="text"
              value={planCoupon}
              onChange={(e) => setPlanCoupon(e.target.value)}
              placeholder="Discount coupon code"
              className="mx-input-3d px-3 py-2 text-xs font-mono uppercase rounded-xl w-full sm:w-56"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {data.plans.map((plan) => (
              <div key={plan.id} className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[#777777] dark:text-zinc-400">
                      {plan.category}
                    </span>
                    {plan.popular && (
                      <span className="mx-well-3d px-2 py-0.5 rounded-md text-[10px] font-semibold text-[#8B5CF6]">
                        Popular
                      </span>
                    )}
                  </div>
                  <h3 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">{plan.name}</h3>
                  <p className="text-xs text-[#777777] dark:text-zinc-400 leading-relaxed">{plan.tagline}</p>
                  <div className="text-2xl font-bold mx-stat-3d-violet pt-1">
                    ${plan.priceMonthly.toFixed(2)}
                    <span className="text-xs font-sans font-normal text-[#777777]"> / mo</span>
                  </div>
                  <div className="mx-well-3d p-3 rounded-xl space-y-1 text-[11px] text-[#525252] dark:text-zinc-300 font-mono">
                    <div>RAM: {formatMb(plan.memoryMb)}</div>
                    <div>Disk: {formatMb(plan.diskMb)} NVMe</div>
                    <div>CPU: {plan.cpuLimit}% Shared/Dedicated</div>
                    <div>
                      Backups: {plan.backupsLimit} · DBs: {plan.databasesLimit}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy === `plan_${plan.id}`}
                  onClick={() => handlePurchasePlan(plan.id, plan.name)}
                  className="mx-btn-3d-primary w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {busy === `plan_${plan.id}` ? 'Purchasing...' : 'Purchase with Wallet'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: INVOICES & RECEIPTS */}
      {tab === 'invoices' && (
        <div className="mx-card-3d p-5 rounded-2xl space-y-4">
          <h2 className="mx-heading-3d text-sm font-bold">Invoice &amp; Receipt History</h2>
          {data.invoices.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#777777]">
              No invoices issued yet. Add funds or purchase a plan to generate your first receipt.
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {data.invoices.map((inv) => (
                <div key={inv.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-[#171717] dark:text-white">{inv.number}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : inv.status === 'refunded'
                              ? 'bg-cyan-500/15 text-cyan-500'
                              : 'bg-amber-500/15 text-amber-500'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <div className="text-[#525252] dark:text-zinc-300 truncate">{inv.description}</div>
                    <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                      Issued {formatDate(inv.issuedAt)} · Method: {inv.method} · Tax: ${inv.taxAmount.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="font-display font-bold text-sm tabular-nums mr-2">
                      ${inv.total.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReceiptInvoice(inv)}
                      className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoice(inv)}
                      className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#06B6D4]" />
                      Download
                    </button>
                    {inv.status === 'paid' && (
                      <button
                        type="button"
                        onClick={() => setRefundTarget(inv)}
                        className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-rose-500 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Refund
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYMENT METHODS & REFUNDS */}
      {tab === 'methods' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="mx-card-3d p-5 rounded-2xl space-y-4">
            <h2 className="mx-heading-3d text-sm font-bold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#8B5CF6]" />
              Saved Payment Methods
            </h2>
            <form onSubmit={handleAddMethod} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
              <select
                value={pmProvider}
                onChange={(e) => setPmProvider(e.target.value as PaymentMethodEntry['provider'])}
                className="mx-input-3d sm:col-span-4 px-3 py-2 rounded-xl"
              >
                <option value="Stripe" className="bg-white dark:bg-[#19191F]">Stripe</option>
                <option value="PayPal" className="bg-white dark:bg-[#19191F]">PayPal</option>
                <option value="PayHere" className="bg-white dark:bg-[#19191F]">PayHere</option>
                <option value="Bank Transfer" className="bg-white dark:bg-[#19191F]">Bank Transfer</option>
                <option value="Crypto" className="bg-white dark:bg-[#19191F]">Crypto</option>
              </select>
              <input
                type="text"
                required
                value={pmLabel}
                onChange={(e) => setPmLabel(e.target.value)}
                placeholder="Label (e.g. Visa Personal)"
                className="mx-input-3d sm:col-span-5 px-3 py-2 rounded-xl"
              />
              <input
                type="text"
                maxLength={6}
                value={pmLast4}
                onChange={(e) => setPmLast4(e.target.value)}
                placeholder="Last 4"
                className="mx-input-3d sm:col-span-3 px-3 py-2 rounded-xl font-mono"
              />
              <button
                type="submit"
                disabled={busy === 'add-method'}
                className="mx-btn-3d-primary sm:col-span-12 py-2 rounded-xl font-medium cursor-pointer"
              >
                Save Payment Method
              </button>
            </form>

            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {data.paymentMethods.length === 0 ? (
                <div className="py-6 text-xs text-[#777777] text-center">No saved payment methods.</div>
              ) : (
                data.paymentMethods.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-[#171717] dark:text-white">
                        {m.label} <span className="font-mono text-[#777777]">•••• {m.last4}</span>
                      </div>
                      <div className="text-[11px] text-[#777777]">{m.provider}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMethod(m.id)}
                      className="mx-btn-3d p-1.5 rounded-lg text-rose-500 cursor-pointer"
                      aria-label="Remove payment method"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mx-card-3d p-5 rounded-2xl space-y-4">
            <h2 className="mx-heading-3d text-sm font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#06B6D4]" />
              Refund Requests
            </h2>
            {data.refunds.length === 0 ? (
              <div className="py-10 text-xs text-[#777777] text-center">
                No refund requests submitted. You can request a refund directly from any paid invoice.
              </div>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {data.refunds.map((rf) => (
                  <div key={rf.id} className="py-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold">{rf.invoiceNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                          rf.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : rf.status === 'rejected'
                              ? 'bg-rose-500/15 text-rose-500'
                              : 'bg-amber-500/15 text-amber-500'
                        }`}
                      >
                        {rf.status} · ${rf.amount.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[#525252] dark:text-zinc-300">{rf.reason}</p>
                    {rf.adminNote && (
                      <p className="text-[11px] text-[#8B5CF6] font-medium">Staff Note: {rf.adminNote}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ADMIN BILLING CONTROLS */}
      {tab === 'admin' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Manual Payment Verification */}
          <div className="mx-card-3d p-5 rounded-2xl space-y-3">
            <h2 className="mx-heading-3d text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Pending Manual Payments ({data.pendingManualPayments.length})
            </h2>
            {data.pendingManualPayments.length === 0 ? (
              <div className="py-6 text-xs text-[#777777]">No pending manual transfers.</div>
            ) : (
              <div className="space-y-2.5">
                {data.pendingManualPayments.map((tx) => (
                  <div key={tx.id} className="mx-well-3d p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold">
                        ${tx.amount.toFixed(2)} · {tx.method}
                      </div>
                      <div className="font-mono text-[11px] text-[#777777]">
                        User #{tx.userId} · Ref: {tx.reference}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await helzerxApi.verifyManualPayment(tx.id, true);
                          notify('Payment approved', tx.reference, 'success');
                          loadBilling();
                        }}
                        className="mx-btn-3d-success px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await helzerxApi.verifyManualPayment(tx.id, false);
                          notify('Payment rejected', tx.reference, 'info');
                          loadBilling();
                        }}
                        className="mx-btn-3d-danger px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tax & Manual Instructions Config */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await helzerxApi.updateBillingConfig({
                taxRatePercent: Number(taxRateInput) || 0,
                manualPaymentInstructions: manualInstructionsInput,
              });
              notify('Billing config saved', undefined, 'success');
              loadBilling();
            }}
            className="mx-card-3d p-5 rounded-2xl space-y-3"
          >
            <h2 className="mx-heading-3d text-sm font-bold flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#8B5CF6]" />
              Tax &amp; Gateway Settings
            </h2>
            <div className="space-y-2 text-xs">
              <label className="block font-medium text-[#525252] dark:text-zinc-300">Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={taxRateInput}
                onChange={(e) => setTaxRateInput(e.target.value)}
                className="mx-input-3d w-full px-3 py-2 rounded-xl font-mono"
              />
              <label className="block font-medium text-[#525252] dark:text-zinc-300 pt-1">
                Manual Payment Instructions
              </label>
              <textarea
                rows={3}
                value={manualInstructionsInput}
                onChange={(e) => setManualInstructionsInput(e.target.value)}
                className="mx-input-3d w-full px-3 py-2 rounded-xl"
              />
            </div>
            <button type="submit" className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
              Save Billing Config
            </button>
          </form>

          {/* Coupons Manager */}
          <div className="mx-card-3d p-5 rounded-2xl space-y-4">
            <h2 className="mx-heading-3d text-sm font-bold">Discount &amp; Promo Coupons</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await helzerxApi.createCoupon({
                  code: newCouponCode.trim().toUpperCase(),
                  discountPercent: Number(newCouponDiscount) || 0,
                  creditBonus: Number(newCouponBonus) || 0,
                  maxUses: Number(newCouponMaxUses) || 100,
                  description: newCouponDesc.trim(),
                });
                setNewCouponCode('');
                setNewCouponDesc('');
                notify('Coupon created', undefined, 'success');
                loadBilling();
              }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs"
            >
              <input
                type="text"
                required
                placeholder="CODE"
                value={newCouponCode}
                onChange={(e) => setNewCouponCode(e.target.value)}
                className="mx-input-3d px-3 py-2 rounded-xl font-mono uppercase col-span-2 sm:col-span-1"
              />
              <input
                type="number"
                min="0"
                max="95"
                placeholder="Disc %"
                value={newCouponDiscount}
                onChange={(e) => setNewCouponDiscount(e.target.value)}
                className="mx-input-3d px-3 py-2 rounded-xl font-mono"
              />
              <input
                type="number"
                min="0"
                max="500"
                placeholder="Bonus $"
                value={newCouponBonus}
                onChange={(e) => setNewCouponBonus(e.target.value)}
                className="mx-input-3d px-3 py-2 rounded-xl font-mono"
              />
              <input
                type="number"
                min="1"
                placeholder="Max uses"
                value={newCouponMaxUses}
                onChange={(e) => setNewCouponMaxUses(e.target.value)}
                className="mx-input-3d px-3 py-2 rounded-xl font-mono"
              />
              <input
                type="text"
                placeholder="Description"
                value={newCouponDesc}
                onChange={(e) => setNewCouponDesc(e.target.value)}
                className="mx-input-3d px-3 py-2 rounded-xl col-span-2 sm:col-span-3"
              />
              <button type="submit" className="mx-btn-3d-primary px-3 py-2 rounded-xl font-medium cursor-pointer">
                Add
              </button>
            </form>

            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {data.coupons.map((cpn) => (
                <div key={cpn.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-mono font-bold">
                      {cpn.code} · {cpn.discountPercent}% off · +${cpn.creditBonus}
                    </div>
                    <div className="text-[11px] text-[#777777]">
                      Used {cpn.usedCount}/{cpn.maxUses} · {cpn.description}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await helzerxApi.deleteCoupon(cpn.id);
                      notify('Coupon deleted', cpn.code, 'info');
                      loadBilling();
                    }}
                    className="mx-btn-3d p-1.5 rounded-lg text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Refund Queue */}
          <div className="mx-card-3d p-5 rounded-2xl space-y-3">
            <h2 className="mx-heading-3d text-sm font-bold">Refund Resolution Queue</h2>
            {data.refunds.filter((r) => r.status === 'pending').length === 0 ? (
              <div className="py-6 text-xs text-[#777777]">No pending refund requests.</div>
            ) : (
              <div className="space-y-3">
                {data.refunds
                  .filter((r) => r.status === 'pending')
                  .map((rf) => (
                    <div key={rf.id} className="mx-well-3d p-3 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>
                          {rf.invoiceNumber} (@{rf.username})
                        </span>
                        <span className="font-mono">${rf.amount.toFixed(2)}</span>
                      </div>
                      <p className="text-[#525252] dark:text-zinc-300">{rf.reason}</p>
                      <input
                        type="text"
                        placeholder="Optional staff note..."
                        value={adminRefundNotes[rf.id] || ''}
                        onChange={(e) => setAdminRefundNotes((p) => ({ ...p, [rf.id]: e.target.value }))}
                        className="mx-input-3d w-full px-2.5 py-1.5 rounded-lg"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await helzerxApi.resolveRefund(rf.id, true, adminRefundNotes[rf.id] || 'Approved');
                            notify('Refund approved & wallet credited', rf.invoiceNumber, 'success');
                            loadBilling();
                          }}
                          className="mx-btn-3d-success px-3 py-1 rounded-lg cursor-pointer"
                        >
                          Approve Refund
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await helzerxApi.resolveRefund(rf.id, false, adminRefundNotes[rf.id] || 'Declined');
                            notify('Refund declined', rf.invoiceNumber, 'info');
                            loadBilling();
                          }}
                          className="mx-btn-3d-danger px-3 py-1 rounded-lg cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          onClick={() => setReceiptInvoice(null)}
        >
          <div
            className="mx-card-3d w-full max-w-md p-6 rounded-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="mx-heading-3d text-base font-bold">Payment Receipt</h3>
              <button type="button" onClick={() => setReceiptInvoice(null)} className="mx-btn-3d p-1.5 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mx-well-3d p-4 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#777777]">Invoice</span>
                <span className="font-bold">{receiptInvoice.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777777]">Customer</span>
                <span>@{receiptInvoice.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777777]">Item</span>
                <span className="text-right max-w-[200px]">{receiptInvoice.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777777]">Method</span>
                <span>{receiptInvoice.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777777]">Subtotal</span>
                <span>${receiptInvoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777777]">Discount</span>
                <span>-${receiptInvoice.discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777777]">Tax ({receiptInvoice.taxRate}%)</span>
                <span>${receiptInvoice.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-black/10 dark:border-white/10">
                <span>Total</span>
                <span>${receiptInvoice.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleDownloadInvoice(receiptInvoice)}
                className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Request Modal */}
      {refundTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          onClick={() => setRefundTarget(null)}
        >
          <form
            onSubmit={handleSubmitRefund}
            className="mx-card-3d w-full max-w-md p-6 rounded-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="mx-heading-3d text-base font-bold">Request Refund ({refundTarget.number})</h3>
              <button type="button" onClick={() => setRefundTarget(null)} className="mx-btn-3d p-1.5 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#777777] dark:text-zinc-400">
              Refundable amount: <strong className="font-mono text-[#171717] dark:text-white">${refundTarget.total.toFixed(2)}</strong>
            </p>
            <textarea
              rows={3}
              required
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Explain why you are requesting a refund..."
              className="mx-input-3d w-full px-3 py-2 text-xs rounded-xl"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRefundTarget(null)} className="mx-btn-3d px-3.5 py-2 rounded-xl text-xs cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={busy === 'refund'} className="mx-btn-3d-primary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
