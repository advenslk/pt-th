import { RefreshCw, Server, Terminal } from 'lucide-react';
import { usePanel } from '../../context/PanelContext';

export function PanelConnectionNotice({ message }: { message: string }) {
  const { refreshData } = usePanel();

  return (
    <div className="mx-card-3d rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="mx-rail-track w-12 h-12 rounded-2xl flex items-center justify-center shrink-0">
          <Server className="w-5 h-5 text-[#8B5CF6]" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-[#171717] dark:text-white">
            Connect to Pterodactyl Panel v1.15.2
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-1">
            {message}
          </p>
        </div>
      </div>

      <div className="mx-well-3d rounded-xl p-4 space-y-3 text-xs">
        <div className="font-semibold text-[#171717] dark:text-zinc-100 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#06B6D4]" />
          Deployment Options (Zero Mock Data)
        </div>
        <div className="space-y-2 text-[#525252] dark:text-zinc-300 leading-relaxed">
          <p>
            <span className="font-semibold text-[#171717] dark:text-white">1. Install inside Pterodactyl Panel:</span>{' '}
            Build the frontend (`npm run build`) and serve the bundle inside your Pterodactyl `/var/www/pterodactyl` installation. HelzerX automatically authenticates using Laravel&apos;s `XSRF-TOKEN` session cookie and connects directly to `/api/client/*`, `/api/application/*`, and Wings WebSockets.
          </p>
          <p>
            <span className="font-semibold text-[#171717] dark:text-white">2. Standalone Proxy Mode:</span>{' '}
            Configure `PTERODACTYL_URL`, `PTERODACTYL_CLIENT_API_KEY`, and optionally `PTERODACTYL_APP_API_KEY` in your server `.env` file and restart the server.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={refreshData}
          className="mx-btn-3d-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Panel Connection
        </button>
      </div>
    </div>
  );
}
