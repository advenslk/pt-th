import type {
  ActivityLogEntry,
  AdminDatabaseHost,
  AdminLocation,
  AdminNode,
  AdminUser,
  AllocationEntry,
  ApiKeyEntry,
  BackupEntry,
  BillingState,
  DatabaseEntry,
  FileEntry,
  PanelSettings,
  PermissionGroupMap,
  PowerSignal,
  PterodactylServer,
  ScheduleTask,
  ScheduleTaskAction,
  ServerCategory,
  ServerSchedule,
  ServerStartupData,
  ServerStatus,
  ServerSubuser,
  SshKeyEntry,
  StartupVariable,
  SupportTicket,
  UserProfile,
} from '../types/panel';

function getXsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getMetaCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;
}

export class PanelApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function rawRequest(url: string, options: RequestInit = {}, retriedCsrf = false): Promise<Response> {
  const xsrf = getXsrfToken();
  const metaCsrf = getMetaCsrfToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (xsrf) {
    headers['X-XSRF-TOKEN'] = xsrf;
  } else if (metaCsrf) {
    headers['X-CSRF-TOKEN'] = metaCsrf;
  }

  if (options.body !== undefined && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (res.status === 419 && !retriedCsrf) {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' }).catch(() => {});
    return rawRequest(url, options, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const pteroErr = body?.errors?.[0]?.detail;
    throw new PanelApiError(
      pteroErr || body?.message || body?.error || `HTTP ${res.status}`,
      res.status,
      body?.error
    );
  }

  return res;
}

async function jsonRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await rawRequest(url, options);
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

function inferCategory(eggName: string, invocation: string): ServerCategory {
  const s = `${eggName} ${invocation}`.toLowerCase();
  if (s.includes('bungee') || s.includes('velocity') || s.includes('waterfall') || s.includes('proxy')) return 'Proxies';
  if (s.includes('redis') || s.includes('mongo') || s.includes('postgres') || s.includes('mariadb') || s.includes('mysql')) return 'Databases';
  if (s.includes('node') || s.includes('python') || s.includes('rust') === false && (s.includes('bot') || s.includes('java') === false && s.includes('uvicorn'))) return 'Applications';
  return 'Game Servers';
}

function normalizeServer(item: any, resources?: any): PterodactylServer {
  const attr = item?.attributes || item;
  const rawAllocs = attr?.relationships?.allocations?.data || [];
  const allocations: AllocationEntry[] = rawAllocs.map((a: any) => {
    const aa = a.attributes || a;
    return {
      id: aa.id,
      ip: aa.ip,
      alias: aa.ip_alias || null,
      port: aa.port,
      notes: aa.notes || null,
      isDefault: Boolean(aa.is_default),
    };
  });

  const statusRaw = resources?.current_state || attr?.status || 'offline';
  const status: ServerStatus =
    statusRaw === 'running' || statusRaw === 'starting' || statusRaw === 'stopping' ? statusRaw : 'offline';

  const resAttr = resources?.resources || {};
  const eggName = attr?.egg_name || attr?.docker_image?.split('/').pop() || 'Container';
  const invocation = attr?.invocation || '';

  return {
    id: attr.identifier,
    uuid: attr.uuid,
    identifier: attr.identifier,
    name: attr.name,
    description: attr.description || '',
    node: attr.node || 'Node',
    location: attr.location || attr.node || '',
    egg: eggName,
    category: inferCategory(eggName, invocation),
    status,
    isFavorite: loadFavoriteIds().includes(attr.identifier),
    limits: {
      memory: attr.limits?.memory ?? 0,
      swap: attr.limits?.swap ?? 0,
      disk: attr.limits?.disk ?? 0,
      io: attr.limits?.io ?? 500,
      cpu: attr.limits?.cpu ?? 0,
    },
    featureLimits: {
      databases: Number(attr.feature_limits?.databases ?? 0),
      allocations: Number(attr.feature_limits?.allocations ?? 0),
      backups: Number(attr.feature_limits?.backups ?? 0),
    },
    sftpDetails: {
      ip: attr.sftp_details?.ip || '',
      port: Number(attr.sftp_details?.port ?? 2022),
    },
    resources: {
      cpuPercent: Number(resAttr.cpu_absolute ?? 0),
      memoryBytes: Number(resAttr.memory_bytes ?? 0),
      diskBytes: Number(resAttr.disk_bytes ?? 0),
      networkRxBytes: Number(resAttr.network_rx_bytes ?? 0),
      networkTxBytes: Number(resAttr.network_tx_bytes ?? 0),
      uptimeMs: Number(resAttr.uptime ?? 0),
    },
    allocations,
    startupCommand: invocation,
    dockerImage: attr.docker_image || '',
    createdAt: attr.created_at || new Date().toISOString(),
    renewalDate: attr.renewal_date || '',
    ownerId: attr.server_owner ? 1 : 0,
    isServerOwner: Boolean(attr.server_owner),
    userPermissions: Array.isArray(attr.user_permissions) ? attr.user_permissions : [],
    isSuspended: Boolean(attr.is_suspended),
    isInstalling: Boolean(attr.is_installing),
    isTransferring: Boolean(attr.is_transferring),
  };
}

function loadFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem('midnightx_favorites');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleLocalFavorite(identifier: string): boolean {
  const current = loadFavoriteIds();
  const exists = current.includes(identifier);
  const next = exists ? current.filter((x) => x !== identifier) : [...current, identifier];
  try {
    localStorage.setItem('midnightx_favorites', JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return !exists;
}

export const panelApi = {
  getHealth: () =>
    jsonRequest<{
      ok: boolean;
      connected: boolean;
      hasAdminApi: boolean;
      billingConfigured: boolean;
      panelVersion: string;
    }>('/api/health'),

  getClientServers: async (): Promise<PterodactylServer[]> => {
    const listRes = await jsonRequest<{ data: any[] }>('/api/client?include=allocations');
    const items = listRes.data || [];
    const hydrated = await Promise.all(
      items.map(async (item) => {
        const identifier = item?.attributes?.identifier || item?.identifier;
        try {
          const res = await jsonRequest<{ attributes: any }>(`/api/client/servers/${encodeURIComponent(identifier)}/resources`);
          return normalizeServer(item, res.attributes);
        } catch {
          return normalizeServer(item);
        }
      })
    );
    return hydrated;
  },

  getServerResources: async (identifier: string) => {
    const res = await jsonRequest<{ attributes: any }>(`/api/client/servers/${encodeURIComponent(identifier)}/resources`);
    return res.attributes;
  },

  getWebsocketAuth: async (identifier: string): Promise<{ token: string; socket: string }> => {
    const res = await jsonRequest<{ data: { token: string; socket: string } }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/websocket`
    );
    return res.data;
  },

  sendPowerSignal: (identifier: string, signal: PowerSignal) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/power`, {
      method: 'POST',
      body: JSON.stringify({ signal }),
    }),

  sendConsoleCommand: (identifier: string, command: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/command`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),

  // Account & Security
  getAccount: async (): Promise<UserProfile> => {
    const res = await jsonRequest<{ attributes: any }>('/api/client/account');
    const a = res.attributes || {};
    return {
      id: a.id,
      uuid: a.uuid || String(a.id),
      username: a.username,
      email: a.email,
      firstName: a.first_name || '',
      lastName: a.last_name || '',
      role: a.admin ? 'admin' : 'user',
      twoFactorEnabled: Boolean(a['2fa_enabled'] ?? a.two_factor_enabled),
      recoveryCodes: [],
      avatarUrl: '',
      notifications: {
        serverPowerAlerts: true,
        backupCompleted: true,
        billingRenewals: true,
        securityLogins: true,
      },
      language: a.language || 'en',
    };
  },

  updateEmail: (email: string, password: string) =>
    rawRequest('/api/client/account/email', {
      method: 'PUT',
      body: JSON.stringify({ email, password }),
    }),

  updatePassword: (currentPassword: string, password: string) =>
    rawRequest('/api/client/account/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: currentPassword,
        password,
        password_confirmation: password,
      }),
    }),

  getTwoFactorSetup: async () => {
    const res = await jsonRequest<{ data: { image_url_data: string; secret: string } }>('/api/client/account/two-factor');
    return res.data;
  },

  enableTwoFactor: async (code: string, password: string) => {
    const res = await jsonRequest<{ attributes: { tokens: string[] } }>('/api/client/account/two-factor', {
      method: 'POST',
      body: JSON.stringify({ code, password }),
    });
    return res.attributes?.tokens || [];
  },

  disableTwoFactor: (password: string) =>
    rawRequest('/api/client/account/two-factor', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  getApiKeys: async (): Promise<ApiKeyEntry[]> => {
    const res = await jsonRequest<{ data: any[] }>('/api/client/account/api-keys');
    return (res.data || []).map((k) => {
      const a = k.attributes || k;
      return {
        identifier: a.identifier,
        description: a.description,
        allowedIps: a.allowed_ips || [],
        lastUsedAt: a.last_used_at || null,
        createdAt: a.created_at,
        tokenPreview: `${a.identifier}••••••••••••••••`,
      };
    });
  },

  createApiKey: async (description: string, allowedIps: string[]) => {
    const res = await jsonRequest<{ attributes: any; meta: { secret_token: string } }>('/api/client/account/api-keys', {
      method: 'POST',
      body: JSON.stringify({ description, allowed_ips: allowedIps }),
    });
    const a = res.attributes;
    return {
      key: {
        identifier: a.identifier,
        description: a.description,
        allowedIps: a.allowed_ips || [],
        lastUsedAt: a.last_used_at || null,
        createdAt: a.created_at,
        tokenPreview: `${a.identifier}••••••••••••••••`,
      } as ApiKeyEntry,
      secretToken: res.meta?.secret_token || '',
    };
  },

  deleteApiKey: (identifier: string) =>
    rawRequest(`/api/client/account/api-keys/${encodeURIComponent(identifier)}`, { method: 'DELETE' }),

  getSshKeys: async (): Promise<SshKeyEntry[]> => {
    const res = await jsonRequest<{ data: any[] }>('/api/client/account/ssh-keys');
    return (res.data || []).map((k) => {
      const a = k.attributes || k;
      return {
        name: a.name,
        fingerprint: a.fingerprint,
        publicKey: a.public_key,
        createdAt: a.created_at,
      };
    });
  },

  createSshKey: async (name: string, publicKey: string): Promise<SshKeyEntry> => {
    const res = await jsonRequest<{ attributes: any }>('/api/client/account/ssh-keys', {
      method: 'POST',
      body: JSON.stringify({ name, public_key: publicKey }),
    });
    const a = res.attributes || res;
    return {
      name: a.name,
      fingerprint: a.fingerprint,
      publicKey: a.public_key,
      createdAt: a.created_at,
    };
  },

  deleteSshKey: (fingerprint: string) =>
    rawRequest('/api/client/account/ssh-keys/remove', {
      method: 'POST',
      body: JSON.stringify({ fingerprint }),
    }),

  logout: () => rawRequest('/auth/logout', { method: 'POST' }),

  getAccountActivity: async (): Promise<ActivityLogEntry[]> => {
    const res = await jsonRequest<{ data: any[] }>('/api/client/account/activity');
    return (res.data || []).map((item) => {
      const a = item.attributes || item;
      return {
        id: a.id || String(Math.random()),
        event: a.event,
        actor: a.actor_id || 'Account',
        target: a.properties?.file || a.properties?.name || a.event,
        timestamp: a.timestamp,
        ip: a.ip || '',
        category: a.event?.startsWith('server:backup')
          ? 'backup'
          : a.event?.startsWith('server:file')
            ? 'file'
            : a.event?.startsWith('server:power')
              ? 'power'
              : 'auth',
        properties: a.properties || {},
      };
    });
  },

  // File Manager
  listFiles: async (identifier: string, directory: string): Promise<FileEntry[]> => {
    const res = await jsonRequest<{ data: any[] }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/files/list?directory=${encodeURIComponent(directory)}`
    );
    const base = directory.replace(/\/+$/, '');
    return (res.data || [])
      .map((item) => {
        const a = item.attributes || item;
        const fullPath = `${base}/${a.name}`.replace(/\/+/g, '/');
        return {
          name: a.name,
          path: fullPath,
          isDirectory: !a.is_file,
          size: Number(a.size ?? 0),
          mime: a.mimetype || 'application/octet-stream',
          modifiedAt: a.modified_at,
        } as FileEntry;
      })
      .sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));
  },

  getFileContents: async (identifier: string, file: string): Promise<string> => {
    const res = await rawRequest(
      `/api/client/servers/${encodeURIComponent(identifier)}/files/contents?file=${encodeURIComponent(file)}`,
      { headers: { Accept: 'text/plain, */*' } }
    );
    return await res.text();
  },

  writeFile: (identifier: string, file: string, content: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/files/write?file=${encodeURIComponent(file)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: content,
    }),

  getDownloadUrl: async (identifier: string, file: string): Promise<string> => {
    const res = await jsonRequest<{ attributes: { url: string } }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/files/download?file=${encodeURIComponent(file)}`
    );
    return res.attributes.url;
  },

  getUploadUrl: async (identifier: string): Promise<string> => {
    const res = await jsonRequest<{ attributes: { url: string } }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/files/upload`
    );
    return res.attributes.url;
  },

  uploadFilesToSignedUrl: async (signedUrl: string, directory: string, files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append('files', f));
    const urlObj = new URL(signedUrl, window.location.origin);
    urlObj.searchParams.set('directory', directory);
    const res = await fetch(urlObj.toString(), { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  },

  createFolder: (identifier: string, root: string, name: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/files/create-folder`, {
      method: 'POST',
      body: JSON.stringify({ root, name }),
    }),

  renameFile: (identifier: string, root: string, from: string, to: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/files/rename`, {
      method: 'PUT',
      body: JSON.stringify({ root, files: [{ from, to }] }),
    }),

  deleteFiles: (identifier: string, root: string, files: string[]) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/files/delete`, {
      method: 'POST',
      body: JSON.stringify({ root, files }),
    }),

  compressFiles: async (identifier: string, root: string, files: string[]) => {
    const res = await jsonRequest<{ attributes: { name: string } }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/files/compress`,
      { method: 'POST', body: JSON.stringify({ root, files }) }
    );
    return res.attributes?.name || 'archive.tar.gz';
  },

  decompressFile: (identifier: string, root: string, file: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/files/decompress`, {
      method: 'POST',
      body: JSON.stringify({ root, file }),
    }),

  // Backups
  listBackups: async (identifier: string): Promise<BackupEntry[]> => {
    const res = await jsonRequest<{ data: any[] }>(`/api/client/servers/${encodeURIComponent(identifier)}/backups`);
    return (res.data || []).map((b) => {
      const a = b.attributes || b;
      return {
        uuid: a.uuid,
        name: a.name,
        ignoredFiles: a.ignored_files || [],
        sha256Hash: a.checksum || '',
        bytes: Number(a.bytes ?? 0),
        createdAt: a.created_at,
        completedAt: a.completed_at,
        isSuccessful: Boolean(a.is_successful),
        isLocked: Boolean(a.is_locked),
        progress: a.completed_at ? 100 : 50,
      };
    });
  },

  createBackup: (identifier: string, payload: { name: string; ignoredFiles: string; isLocked: boolean }) =>
    jsonRequest(`/api/client/servers/${encodeURIComponent(identifier)}/backups`, {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        ignored: payload.ignoredFiles,
        is_locked: payload.isLocked,
      }),
    }),

  toggleBackupLock: (identifier: string, uuid: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/backups/${encodeURIComponent(uuid)}/lock`, {
      method: 'POST',
    }),

  restoreBackup: (identifier: string, uuid: string, truncate = false) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/backups/${encodeURIComponent(uuid)}/restore`, {
      method: 'POST',
      body: JSON.stringify({ truncate }),
    }),

  getBackupDownloadUrl: async (identifier: string, uuid: string): Promise<string> => {
    const res = await jsonRequest<{ attributes: { url: string } }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/backups/${encodeURIComponent(uuid)}/download`
    );
    return res.attributes.url;
  },

  deleteBackup: (identifier: string, uuid: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/backups/${encodeURIComponent(uuid)}`, {
      method: 'DELETE',
    }),

  // Databases
  listDatabases: async (identifier: string): Promise<Array<Omit<DatabaseEntry, 'password'> & { password?: string }>> => {
    const res = await jsonRequest<{ data: any[] }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/databases?include=password`
    );
    return (res.data || []).map((d) => {
      const a = d.attributes || d;
      return {
        id: a.id,
        name: a.name,
        username: a.username,
        host: a.host?.address || '',
        port: a.host?.port || 3306,
        connectionsFrom: a.connections_from || '%',
        maxConnections: a.max_connections || 0,
        password: a.relationships?.password?.attributes?.password,
        createdAt: a.created_at || new Date().toISOString(),
      };
    });
  },

  createDatabase: (identifier: string, database: string, remote: string) =>
    jsonRequest(`/api/client/servers/${encodeURIComponent(identifier)}/databases`, {
      method: 'POST',
      body: JSON.stringify({ database, remote }),
    }),

  rotateDatabasePassword: async (identifier: string, dbId: string): Promise<string | undefined> => {
    const res = await jsonRequest<{ attributes: any }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/databases/${encodeURIComponent(dbId)}/rotate-password`,
      { method: 'POST' }
    );
    return res.attributes?.relationships?.password?.attributes?.password;
  },

  deleteDatabase: (identifier: string, dbId: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/databases/${encodeURIComponent(dbId)}`, {
      method: 'DELETE',
    }),

  // Network Allocations
  listAllocations: async (identifier: string): Promise<AllocationEntry[]> => {
    const res = await jsonRequest<{ data: any[] }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/network/allocations`
    );
    return (res.data || []).map((x) => {
      const a = x.attributes || x;
      return {
        id: a.id,
        ip: a.ip,
        alias: a.ip_alias || null,
        port: a.port,
        notes: a.notes || null,
        isDefault: Boolean(a.is_default),
      };
    });
  },

  createAllocation: (identifier: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/network/allocations`, { method: 'POST' }),

  setPrimaryAllocation: (identifier: string, allocId: number) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/network/allocations/${allocId}/primary`, {
      method: 'POST',
    }),

  updateAllocationNotes: (identifier: string, allocId: number, notes: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/network/allocations/${allocId}`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  deleteAllocation: (identifier: string, allocId: number) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/network/allocations/${allocId}`, {
      method: 'DELETE',
    }),

  // Schedules & Tasks
  listSchedules: async (identifier: string): Promise<ServerSchedule[]> => {
    const res = await jsonRequest<{ data: any[] }>(`/api/client/servers/${encodeURIComponent(identifier)}/schedules`);
    return (res.data || []).map((s) => {
      const a = s.attributes || s;
      const rawTasks = a.relationships?.tasks?.data || [];
      const tasks: ScheduleTask[] = rawTasks
        .map((t: any) => {
          const ta = t.attributes || t;
          return {
            id: ta.id,
            sequenceId: Number(ta.sequence_id ?? 1),
            action: (ta.action || 'command') as ScheduleTaskAction,
            payload: ta.payload || '',
            timeOffset: Number(ta.time_offset ?? 0),
            isQueued: Boolean(ta.is_queued),
            continueOnFailure: Boolean(ta.continue_on_failure),
            createdAt: ta.created_at,
            updatedAt: ta.updated_at,
          };
        })
        .sort((x: ScheduleTask, y: ScheduleTask) => x.sequenceId - y.sequenceId);

      return {
        id: a.id,
        name: a.name,
        cron: {
          dayOfWeek: a.cron?.day_of_week ?? '*',
          dayOfMonth: a.cron?.day_of_month ?? '*',
          month: a.cron?.month ?? '*',
          hour: a.cron?.hour ?? '*',
          minute: a.cron?.minute ?? '*',
        },
        isActive: Boolean(a.is_active),
        isProcessing: Boolean(a.is_processing),
        onlyWhenOnline: Boolean(a.only_when_online),
        lastRunAt: a.last_run_at || null,
        nextRunAt: a.next_run_at || null,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        tasks,
      };
    });
  },

  createSchedule: (
    identifier: string,
    payload: {
      name: string;
      minute: string;
      hour: string;
      dayOfMonth: string;
      month: string;
      dayOfWeek: string;
      isActive: boolean;
      onlyWhenOnline: boolean;
    }
  ) =>
    jsonRequest(`/api/client/servers/${encodeURIComponent(identifier)}/schedules`, {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        minute: payload.minute,
        hour: payload.hour,
        day_of_month: payload.dayOfMonth,
        month: payload.month,
        day_of_week: payload.dayOfWeek,
        is_active: payload.isActive,
        only_when_online: payload.onlyWhenOnline,
      }),
    }),

  updateSchedule: (
    identifier: string,
    scheduleId: number,
    payload: {
      name: string;
      minute: string;
      hour: string;
      dayOfMonth: string;
      month: string;
      dayOfWeek: string;
      isActive: boolean;
      onlyWhenOnline: boolean;
    }
  ) =>
    jsonRequest(`/api/client/servers/${encodeURIComponent(identifier)}/schedules/${scheduleId}`, {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        minute: payload.minute,
        hour: payload.hour,
        day_of_month: payload.dayOfMonth,
        month: payload.month,
        day_of_week: payload.dayOfWeek,
        is_active: payload.isActive,
        only_when_online: payload.onlyWhenOnline,
      }),
    }),

  executeSchedule: (identifier: string, scheduleId: number) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/schedules/${scheduleId}/execute`, {
      method: 'POST',
    }),

  deleteSchedule: (identifier: string, scheduleId: number) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/schedules/${scheduleId}`, {
      method: 'DELETE',
    }),

  createScheduleTask: (
    identifier: string,
    scheduleId: number,
    payload: { action: ScheduleTaskAction; payload: string; timeOffset: number; continueOnFailure: boolean }
  ) =>
    jsonRequest(`/api/client/servers/${encodeURIComponent(identifier)}/schedules/${scheduleId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        action: payload.action,
        payload: payload.payload,
        time_offset: payload.timeOffset,
        continue_on_failure: payload.continueOnFailure,
      }),
    }),

  updateScheduleTask: (
    identifier: string,
    scheduleId: number,
    taskId: number,
    payload: { action: ScheduleTaskAction; payload: string; timeOffset: number; continueOnFailure: boolean }
  ) =>
    jsonRequest(`/api/client/servers/${encodeURIComponent(identifier)}/schedules/${scheduleId}/tasks/${taskId}`, {
      method: 'POST',
      body: JSON.stringify({
        action: payload.action,
        payload: payload.payload,
        time_offset: payload.timeOffset,
        continue_on_failure: payload.continueOnFailure,
      }),
    }),

  deleteScheduleTask: (identifier: string, scheduleId: number, taskId: number) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/schedules/${scheduleId}/tasks/${taskId}`, {
      method: 'DELETE',
    }),

  // Sub-Users & Permissions
  getClientPermissions: async (): Promise<PermissionGroupMap> => {
    const res = await jsonRequest<{ attributes: { permissions: PermissionGroupMap } }>('/api/client/permissions');
    return res.attributes?.permissions || {};
  },

  listSubusers: async (identifier: string): Promise<ServerSubuser[]> => {
    const res = await jsonRequest<{ data: any[] }>(`/api/client/servers/${encodeURIComponent(identifier)}/users`);
    return (res.data || []).map((u) => {
      const a = u.attributes || u;
      return {
        uuid: a.uuid,
        username: a.username,
        email: a.email,
        image: a.image || '',
        twoFactorEnabled: Boolean(a['2fa_enabled'] ?? a.two_factor_enabled),
        createdAt: a.created_at,
        permissions: Array.isArray(a.permissions) ? a.permissions : [],
      };
    });
  },

  createSubuser: (identifier: string, email: string, permissions: string[]) =>
    jsonRequest(`/api/client/servers/${encodeURIComponent(identifier)}/users`, {
      method: 'POST',
      body: JSON.stringify({ email, permissions }),
    }),

  updateSubuser: (identifier: string, uuid: string, permissions: string[]) =>
    jsonRequest(`/api/client/servers/${encodeURIComponent(identifier)}/users/${encodeURIComponent(uuid)}`, {
      method: 'POST',
      body: JSON.stringify({ permissions }),
    }),

  deleteSubuser: (identifier: string, uuid: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/users/${encodeURIComponent(uuid)}`, {
      method: 'DELETE',
    }),

  // Startup & Variables
  getServerStartup: async (identifier: string): Promise<ServerStartupData> => {
    const res = await jsonRequest<{ data: any[]; meta: any }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/startup`
    );
    const variables: StartupVariable[] = (res.data || []).map((v) => {
      const a = v.attributes || v;
      return {
        name: a.name,
        description: a.description || '',
        envVariable: a.env_variable,
        defaultValue: a.default_value ?? '',
        serverValue: a.server_value ?? '',
        isEditable: Boolean(a.is_editable),
        rules: a.rules || '',
      };
    });
    return {
      startupCommand: res.meta?.startup_command || '',
      rawStartupCommand: res.meta?.raw_startup_command || '',
      dockerImages: res.meta?.docker_images || {},
      variables,
    };
  },

  updateStartupVariable: async (identifier: string, key: string, value: string): Promise<StartupVariable> => {
    const res = await jsonRequest<{ attributes: any }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/startup/variable`,
      {
        method: 'PUT',
        body: JSON.stringify({ key, value }),
      }
    );
    const a = res.attributes || res;
    return {
      name: a.name,
      description: a.description || '',
      envVariable: a.env_variable,
      defaultValue: a.default_value ?? '',
      serverValue: a.server_value ?? '',
      isEditable: Boolean(a.is_editable),
      rules: a.rules || '',
    };
  },

  updateDockerImage: (identifier: string, dockerImage: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/settings/docker-image`, {
      method: 'PUT',
      body: JSON.stringify({ docker_image: dockerImage }),
    }),

  // Server Settings & Activity
  renameServer: (identifier: string, name: string, description: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/settings/rename`, {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  reinstallServer: (identifier: string) =>
    rawRequest(`/api/client/servers/${encodeURIComponent(identifier)}/settings/reinstall`, {
      method: 'POST',
    }),

  getServerActivity: async (identifier: string): Promise<ActivityLogEntry[]> => {
    const res = await jsonRequest<{ data: any[] }>(
      `/api/client/servers/${encodeURIComponent(identifier)}/activity?include=actor`
    );
    return (res.data || []).map((item) => {
      const a = item.attributes || item;
      const actorAttr = a.relationships?.actor?.attributes;
      return {
        id: a.id || String(Math.random()),
        event: a.event,
        actor: actorAttr?.username || actorAttr?.email || (a.actor_id ? `User #${a.actor_id}` : 'System'),
        target:
          a.properties?.file ||
          a.properties?.directory ||
          a.properties?.name ||
          a.properties?.email ||
          a.properties?.key ||
          a.event,
        timestamp: a.timestamp,
        ip: a.ip || '',
        category: a.event?.startsWith('server:backup')
          ? 'backup'
          : a.event?.startsWith('server:file')
            ? 'file'
            : a.event?.startsWith('server:power') || a.event?.startsWith('server:console')
              ? 'power'
              : a.event?.startsWith('server:database')
                ? 'database'
                : 'admin',
        properties: a.properties || {},
      };
    });
  },

  // Application (Admin) API
  getAdminOverview: async () => {
    const [usersRes, serversRes, nodesRes, locationsRes] = await Promise.all([
      jsonRequest<{ data: any[] }>('/api/application/users'),
      jsonRequest<{ data: any[] }>('/api/application/servers'),
      jsonRequest<{ data: any[] }>('/api/application/nodes'),
      jsonRequest<{ data: any[] }>('/api/application/locations'),
    ]);

    const users: AdminUser[] = (usersRes.data || []).map((u) => {
      const a = u.attributes || u;
      return {
        id: a.id,
        username: a.username,
        email: a.email,
        firstName: a.first_name || '',
        lastName: a.last_name || '',
        role: a.root_admin ? 'admin' : 'user',
        serversCount: 0,
        twoFactorEnabled: Boolean(a['2fa']),
        createdAt: a.created_at,
      };
    });

    const servers: PterodactylServer[] = (serversRes.data || []).map((s) => normalizeServer(s));

    const nodes: AdminNode[] = (nodesRes.data || []).map((n) => {
      const a = n.attributes || n;
      return {
        id: a.id,
        name: a.name,
        locationId: a.location_id,
        locationCode: String(a.location_id),
        fqdn: a.fqdn,
        scheme: a.scheme || 'https',
        memoryTotal: a.memory,
        memoryAllocated: a.allocated_resources?.memory || 0,
        diskTotal: a.disk,
        diskAllocated: a.allocated_resources?.disk || 0,
        daemonListen: a.daemon_listen,
        daemonSftp: a.daemon_sftp,
        maintenanceMode: Boolean(a.maintenance_mode),
        serversCount: 0,
        cpuThreads: 0,
        status: a.maintenance_mode ? 'maintenance' : 'online',
      };
    });

    const locations: AdminLocation[] = (locationsRes.data || []).map((l) => {
      const a = l.attributes || l;
      return {
        id: a.id,
        shortCode: a.short,
        description: a.long || a.short,
        nodesCount: nodes.filter((n) => n.locationId === a.id).length,
        serversCount: 0,
      };
    });

    const dbHosts: AdminDatabaseHost[] = [];
    const allocations: AllocationEntry[] = [];
    const settings: PanelSettings = {
      panelName: 'MidnightX',
      supportEmail: '',
      registrationEnabled: false,
      defaultTheme: 'light',
      telemetryIntervalMs: 1500,
      maintenanceBanner: '',
    };

    return {
      stats: {
        totalUsers: users.length,
        totalServers: servers.length,
        totalNodes: nodes.length,
        totalAllocations: allocations.length,
      },
      users,
      servers,
      nodes,
      locations,
      databaseHosts: dbHosts,
      allocations,
      settings,
      appKeys: [] as ApiKeyEntry[],
      activityLogs: [] as ActivityLogEntry[],
    };
  },

  createAdminUser: (payload: { username: string; email: string; firstName: string; lastName: string; role: string }) =>
    jsonRequest('/api/application/users', {
      method: 'POST',
      body: JSON.stringify({
        username: payload.username,
        email: payload.email,
        first_name: payload.firstName || payload.username,
        last_name: payload.lastName || 'User',
        root_admin: payload.role === 'admin',
      }),
    }),

  deleteAdminUser: (id: number) =>
    rawRequest(`/api/application/users/${id}`, { method: 'DELETE' }),

  deleteAdminServer: (id: number | string) =>
    rawRequest(`/api/application/servers/${encodeURIComponent(String(id))}`, { method: 'DELETE' }),

  createAdminLocation: (payload: { shortCode: string; description: string }) =>
    jsonRequest('/api/application/locations', {
      method: 'POST',
      body: JSON.stringify({ short: payload.shortCode, long: payload.description }),
    }),

  // Optional external billing & support endpoints
  getBilling: () => jsonRequest<{ billing: BillingState }>('/api/billing'),
  getTickets: () => jsonRequest<{ tickets: SupportTicket[] }>('/api/support/tickets'),
  createTicket: (payload: any) =>
    jsonRequest<{ ticket: SupportTicket }>('/api/support/tickets', { method: 'POST', body: JSON.stringify(payload) }),
  replyTicket: (id: string, message: string) =>
    jsonRequest<{ ticket: SupportTicket }>(`/api/support/tickets/${encodeURIComponent(id)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
