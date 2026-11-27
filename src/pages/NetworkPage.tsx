import { useCallback, useEffect, useState } from 'react';
import { Globe, Plus, Star, Trash2 } from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { AllocationEntry } from '../types/panel';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';

export function NetworkPage({ serverId }: { serverId: string }) {
  const { servers, refreshData, notify, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];
  const [allocations, setAllocations] = useState<AllocationEntry[]>(server?.allocations || []);

  const loadAllocations = useCallback(async () => {
    if (!server || !panelConnected) return;
    try {
      const list = await panelApi.listAllocations(server.id);
      setAllocations(list);
    } catch {
      setAllocations(server.allocations);
    }
  }, [server?.id, panelConnected]);

  useEffect(() => {
    loadAllocations();
  }, [loadAllocations]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  const handleCreate = async () => {
    try {
      await panelApi.createAllocation(server.id);
      await Promise.all([loadAllocations(), refreshData()]);
      notify('Allocation assigned', undefined, 'success');
    } catch (err: any) {
      notify('Failed to create allocation', err.message, 'error');
    }
  };

  const handlePrimary = async (allocId: number) => {
    try {
      await panelApi.setPrimaryAllocation(server.id, allocId);
      await Promise.all([loadAllocations(), refreshData()]);
      notify('Primary allocation updated', undefined, 'success');
    } catch (err: any) {
      notify('Could not update primary allocation', err.message, 'error');
    }
  };

  const handleDelete = async (allocId: number) => {
    try {
      await panelApi.deleteAllocation(server.id, allocId);
      await Promise.all([loadAllocations(), refreshData()]);
      notify('Allocation removed', undefined, 'success');
    } catch (err: any) {
      notify('Cannot remove allocation', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-white">
            Network Allocations
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            {server.name} · Manage bound IPv4 endpoints, aliases, and primary port routing
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Allocation
        </button>
      </div>

      <div className="mx-card-3d rounded-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] font-medium text-[#777777] dark:text-zinc-400">
              <th className="py-3 px-4">Endpoint</th>
              <th className="py-3 px-3">Port</th>
              <th className="py-3 px-3">Notes</th>
              <th className="py-3 px-3">Role</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05] text-xs">
            {allocations.map((alloc) => (
              <tr key={alloc.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 text-[#171717] dark:text-white font-semibold tabular-nums">
                    <Globe className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>{alloc.alias || alloc.ip}</span>
                  </div>
                  {alloc.alias && (
                    <div className="text-[11px] font-medium tabular-nums text-[#777777] dark:text-zinc-500 pl-5">{alloc.ip}</div>
                  )}
                </td>
                <td className="py-3 px-3 font-display font-bold tabular-nums">{alloc.port}</td>
                <td className="py-3 px-3 text-[#777777] dark:text-zinc-400">{alloc.notes || '—'}</td>
                <td className="py-3 px-3">
                  {alloc.isDefault ? (
                    <span className="text-[#8B5CF6] font-medium">Primary</span>
                  ) : (
                    <span className="text-[#777777] dark:text-zinc-400">Secondary</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    {!alloc.isDefault && (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePrimary(alloc.id)}
                          className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer"
                        >
                          <Star className="w-3 h-3" />
                          Make Primary
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(alloc.id)}
                          className="mx-btn-3d p-1.5 rounded-lg text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
