import { AnimatePresence, motion } from 'motion/react';
import { MidnightShell } from './components/layout/MidnightShell';
import { PanelProvider, usePanel } from './context/PanelContext';
import { AdminPanelPage } from './pages/AdminPanelPage';
import { BackupsPage } from './pages/BackupsPage';
import { BillingPage } from './pages/BillingPage';
import { DashboardPage } from './pages/DashboardPage';
import { DatabasesPage } from './pages/DatabasesPage';
import { FileManagerPage } from './pages/FileManagerPage';
import { NetworkPage } from './pages/NetworkPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { ServerActivityPage } from './pages/ServerActivityPage';
import { ServerConsolePage } from './pages/ServerConsolePage';
import { ServerSettingsPage } from './pages/ServerSettingsPage';
import { ServersPage } from './pages/ServersPage';
import { ServerUsersPage } from './pages/ServerUsersPage';
import { StartupPage } from './pages/StartupPage';
import { SupportPage } from './pages/SupportPage';
import { UserProfilePage } from './pages/UserProfilePage';

function ServerSubNav({ serverId, active }: { serverId: string; active: string }) {
  const { navigate } = usePanel();
  const tabs = [
    { id: 'server-console', label: 'Console' },
    { id: 'server-files', label: 'Files' },
    { id: 'server-databases', label: 'Databases' },
    { id: 'server-schedules', label: 'Schedules' },
    { id: 'server-users', label: 'Users' },
    { id: 'server-backups', label: 'Backups' },
    { id: 'server-network', label: 'Network' },
    { id: 'server-startup', label: 'Startup' },
    { id: 'server-settings', label: 'Settings' },
    { id: 'server-activity', label: 'Activity' },
  ] as const;

  return (
    <div className="mx-well-3d inline-flex items-center gap-1.5 mb-6 p-1.5 rounded-2xl overflow-x-auto max-w-full">
      {tabs.map((t) => {
        const isCurrent = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => navigate({ page: t.id, serverId })}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              isCurrent
                ? 'mx-btn-3d-primary'
                : 'text-[#525252] dark:text-zinc-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function PanelRouter() {
  const { route } = usePanel();

  const isServerRoute = route.page.startsWith('server-');
  const routeKey =
    route.page === 'admin'
      ? `admin-${route.section || 'overview'}`
      : isServerRoute && 'serverId' in route
        ? `${route.page}-${route.serverId}`
        : route.page;

  return (
    <div>
      {isServerRoute && 'serverId' in route && (
        <ServerSubNav serverId={route.serverId} active={route.page} />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={routeKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          {route.page === 'dashboard' && <DashboardPage />}
          {route.page === 'servers' && <ServersPage />}
          {route.page === 'server-console' && <ServerConsolePage serverId={route.serverId} />}
          {route.page === 'server-files' && <FileManagerPage serverId={route.serverId} />}
          {route.page === 'server-backups' && <BackupsPage serverId={route.serverId} />}
          {route.page === 'server-databases' && <DatabasesPage serverId={route.serverId} />}
          {route.page === 'server-network' && <NetworkPage serverId={route.serverId} />}
          {route.page === 'server-schedules' && <SchedulesPage serverId={route.serverId} />}
          {route.page === 'server-users' && <ServerUsersPage serverId={route.serverId} />}
          {route.page === 'server-startup' && <StartupPage serverId={route.serverId} />}
          {route.page === 'server-settings' && <ServerSettingsPage serverId={route.serverId} />}
          {route.page === 'server-activity' && <ServerActivityPage serverId={route.serverId} />}
          {route.page === 'account' && <UserProfilePage />}
          {route.page === 'billing' && <BillingPage />}
          {route.page === 'support' && <SupportPage />}
          {route.page === 'admin' && <AdminPanelPage initialSection={route.section} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <PanelProvider>
      <MidnightShell>
        <PanelRouter />
      </MidnightShell>
    </PanelProvider>
  );
}
