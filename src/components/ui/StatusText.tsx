import { Loader2 } from 'lucide-react';
import type { ServerStatus } from '../../types/panel';

export function StatusText({ status }: { status: ServerStatus }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        Running
      </span>
    );
  }
  if (status === 'starting') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-400 whitespace-nowrap shrink-0">
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        Starting
      </span>
    );
  }
  if (status === 'stopping') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap shrink-0">
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        Stopping
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#777777] dark:text-zinc-400 whitespace-nowrap shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" aria-hidden="true" />
      Offline
    </span>
  );
}
