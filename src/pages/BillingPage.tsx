import { useEffect, useState } from 'react';
import { CreditCard, Wallet } from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { BillingState } from '../types/panel';
import { formatDate, formatMb } from '../utils/format';

export function BillingPage() {
  const { billingConfigured } = usePanel();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!billingConfigured) {
      setError('Billing module is not connected. Configure BILLING_API_URL in .env to link Paymenter, WHMCS, or your billing backend.');
      return;
    }
    panelApi
      .getBilling()
      .then((res) => setBilling(res.billing))
      .catch((err) => setError(err.message));
  }, [billingConfigured]);

  if (error || !billing) {
    return (
      <div className="mx-card-3d rounded-2xl p-6 sm:p-8 max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="mx-rail-track w-10 h-10 rounded-xl flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#171717] dark:text-white">Billing & Hosting</h1>
            <p className="text-xs text-[#777777] dark:text-zinc-400">External billing integration status</p>
          </div>
        </div>
        <p className="text-xs text-[#525252] dark:text-zinc-300 leading-relaxed">
          {error || 'Waiting for billing backend response...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-white">
          Billing & Hosting
        </h1>
        <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
          Wallet credits, hosting plans, subscriptions, and invoices
        </p>
      </div>

      <div className="mx-card-3d p-5 rounded-2xl max-w-sm">
        <div className="flex items-center justify-between">
          <span className="mx-label-3d text-xs font-medium text-[#6B6B6B] dark:text-zinc-400">Wallet Balance</span>
          <Wallet className="w-4 h-4 text-[#8B5CF6]" />
        </div>
        <div className="mt-2 text-3xl font-bold mx-stat-3d">
          ${billing.walletBalance.toFixed(2)}
        </div>
      </div>

      {billing.plans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {billing.plans.map((plan) => (
            <div key={plan.id} className="mx-card-3d p-5 rounded-2xl space-y-3">
              <div className="text-xs text-[#777777]">{plan.category}</div>
              <h3 className="mx-heading-3d text-base font-bold">{plan.name}</h3>
              <div className="text-2xl font-bold mx-stat-3d-violet">
                ${plan.priceMonthly.toFixed(2)}<span className="text-xs font-sans font-normal text-[#777777]"> / mo</span>
              </div>
              <div className="text-xs font-medium tabular-nums text-[#777777]">
                {formatMb(plan.memoryMb)} RAM · {formatMb(plan.diskMb)} Disk · {plan.cpuLimit}% CPU
              </div>
            </div>
          ))}
        </div>
      )}

      {billing.invoices.length > 0 && (
        <div className="mx-card-3d p-5 rounded-2xl space-y-3">
          <h2 className="mx-heading-3d text-sm font-bold">Invoices</h2>
          <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {billing.invoices.map((inv) => (
              <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold">{inv.number}</div>
                  <div className="text-[#777777]">{inv.description} · Due {formatDate(inv.dueAt)}</div>
                </div>
                <span className="font-display font-bold tabular-nums">${inv.amount.toFixed(2)} ({inv.status})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
