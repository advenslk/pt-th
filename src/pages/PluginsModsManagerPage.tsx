import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  ExternalLink,
  FileCode2,
  FolderPlus,
  Layers,
  Loader2,
  Package,
  Power,
  Puzzle,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { usePanel } from '../context/PanelContext';
import type { FileEntry } from '../types/panel';
import { formatBytes, formatRelativeTime } from '../utils/format';
import {
  detectServerEnvironment,
  getCompatibleLoaders,
  getLoaderKind,
  LOADER_LABELS,
  selectBestModrinthVersion,
  type DetectedServerEnv,
  type ModrinthVersionCandidate,
  type ServerLoaderId,
} from '../utils/serverCompatibility';

interface ModrinthHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  icon_url?: string;
  downloads: number;
  categories?: string[];
  versions?: string[];
  latest_version?: string;
}

type ManagerMode = 'plugins' | 'mods';
type ActiveTab = 'installed' | 'browse';
type ModrinthSort = 'downloads' | 'relevance' | 'updated' | 'newest';

const BROWSE_PAGE_SIZE = 24;
const INSTALLED_PAGE_SIZE = 24;

function PaginationBar({
  page,
  totalItems,
  pageSize,
  loading,
  label,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  pageSize: number;
  loading?: boolean;
  label: string;
  onPageChange: (nextPage: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  const pageTokens: Array<number | 'ellipsis'> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageTokens.push(i);
  } else {
    pageTokens.push(1);
    if (page > 3) pageTokens.push('ellipsis');
    const winStart = Math.max(2, page - 1);
    const winEnd = Math.min(totalPages - 1, page + 1);
    for (let i = winStart; i <= winEnd; i++) pageTokens.push(i);
    if (page < totalPages - 2) pageTokens.push('ellipsis');
    pageTokens.push(totalPages);
  }

  return (
    <div className="mx-card-3d px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="text-xs text-[#777777] dark:text-zinc-400 tabular-nums">
        Showing <span className="font-semibold text-[#171717] dark:text-white">{start.toLocaleString()}</span>–
        <span className="font-semibold text-[#171717] dark:text-white">{end.toLocaleString()}</span> of{' '}
        <span className="font-semibold text-[#171717] dark:text-white">{totalItems.toLocaleString()}</span>{' '}
        {label}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>

          {pageTokens.map((tok, idx) =>
            tok === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-1.5 text-xs text-[#777777] dark:text-zinc-500">
                ...
              </span>
            ) : (
              <button
                key={tok}
                type="button"
                disabled={loading}
                onClick={() => onPageChange(tok)}
                className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-semibold tabular-nums cursor-pointer transition-all disabled:opacity-50 ${
                  tok === page
                    ? 'mx-btn-3d-primary'
                    : 'mx-btn-3d text-[#525252] dark:text-zinc-300'
                }`}
              >
                {tok}
              </button>
            )
          )}

          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function PluginsModsManagerPage({
  serverId,
  mode,
}: {
  serverId: string;
  mode: ManagerMode;
}) {
  const { servers, notify, navigate, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const isPlugins = mode === 'plugins';
  const targetDir = isPlugins ? '/plugins' : '/mods';
  const labelSingular = isPlugins ? 'Plugin' : 'Mod';
  const labelPlural = isPlugins ? 'Plugins' : 'Mods';

  const [tab, setTab] = useState<ActiveTab>('installed');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [folderExists, setFolderExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchInstalled, setSearchInstalled] = useState('');
  const [filterState, setFilterState] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-detected server environment
  const [detectingEnv, setDetectingEnv] = useState(false);
  const [detectedEnv, setDetectedEnv] = useState<DetectedServerEnv | null>(null);
  const [autoMatch, setAutoMatch] = useState(true);
  const [autoInstallDeps, setAutoInstallDeps] = useState(true);

  // Config viewer/editor modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configFiles, setConfigFiles] = useState<FileEntry[]>([]);
  const [selectedConfigPath, setSelectedConfigPath] = useState<string | null>(null);
  const [configContent, setConfigContent] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Installed pagination
  const [installedPage, setInstalledPage] = useState(1);

  // Modrinth browse/install state
  const [query, setQuery] = useState('');
  const [loaderFilter, setLoaderFilter] = useState('all');
  const [mcVersion, setMcVersion] = useState('');
  const [sortBy, setSortBy] = useState<ModrinthSort>('downloads');
  const [browsePage, setBrowsePage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<ModrinthHit[]>([]);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<string | null>(null);
  const browseTopRef = useRef<HTMLDivElement | null>(null);

  // Version picker modal (for manual selection or incompatibility fallback)
  const [versionModalHit, setVersionModalHit] = useState<ModrinthHit | null>(null);
  const [versionModalList, setVersionModalList] = useState<ModrinthVersionCandidate[]>([]);
  const [versionModalLoading, setVersionModalLoading] = useState(false);
  const [versionModalWarning, setVersionModalWarning] = useState<string | null>(null);

  const loadInstalled = useCallback(async () => {
    if (!server || !panelConnected) return;
    setLoading(true);
    try {
      const list = await panelApi.listFiles(server.id, targetDir);
      setFiles(list);
      setFolderExists(true);
    } catch {
      setFiles([]);
      setFolderExists(false);
    } finally {
      setLoading(false);
    }
  }, [server?.id, panelConnected, targetDir]);

  const runEnvDetection = useCallback(async () => {
    if (!server || !panelConnected) return;
    setDetectingEnv(true);
    try {
      const env = await detectServerEnvironment(server);
      setDetectedEnv(env);

      // Apply detected loader & MC version if matching current manager mode (or override via saved pref)
      const envKind = env.kind;
      const modeMatches =
        (isPlugins && envKind === 'plugin') || (!isPlugins && envKind === 'mod');

      if (modeMatches && env.loader !== 'unknown') {
        setLoaderFilter(env.loader);
      } else {
        setLoaderFilter('all');
      }
      if (env.mcVersion) {
        setMcVersion(env.mcVersion);
      }
    } finally {
      setDetectingEnv(false);
    }
  }, [server, panelConnected, isPlugins]);

  useEffect(() => {
    loadInstalled();
  }, [loadInstalled]);

  useEffect(() => {
    setHits([]);
    setTotalHits(0);
    setBrowsePage(1);
    setInstalledPage(1);
    setDetectedEnv(null);
    runEnvDetection();
  }, [server?.id, mode, runEnvDetection]);

  const searchModrinth = useCallback(
    async (
      qText = query,
      pageNum = browsePage,
      overrideLoader?: string,
      overrideMc?: string,
      overrideSort?: ModrinthSort
    ) => {
      setSearching(true);
      try {
        const activeLoader = overrideLoader !== undefined ? overrideLoader : loaderFilter;
        const activeMc = (overrideMc !== undefined ? overrideMc : mcVersion).trim();
        const activeSort = overrideSort !== undefined ? overrideSort : sortBy;
        const safePage = Math.max(1, pageNum);
        const offset = (safePage - 1) * BROWSE_PAGE_SIZE;

        const facets: string[][] = [[`project_type:${isPlugins ? 'plugin' : 'mod'}`]];

        if (activeLoader && activeLoader !== 'all' && activeLoader !== 'unknown') {
          if (autoMatch) {
            const compat = getCompatibleLoaders(activeLoader, mode);
            if (compat.length > 0) {
              facets.push(compat.map((c) => `categories:${c}`));
            } else {
              facets.push([`categories:${activeLoader}`]);
            }
          } else {
            facets.push([`categories:${activeLoader}`]);
          }
        }

        if (activeMc) {
          facets.push([`versions:${activeMc}`]);
        }

        const url = new URL('https://api.modrinth.com/v2/search');
        if (qText.trim()) url.searchParams.set('query', qText.trim());
        url.searchParams.set('facets', JSON.stringify(facets));
        url.searchParams.set('limit', String(BROWSE_PAGE_SIZE));
        url.searchParams.set('offset', String(offset));
        url.searchParams.set('index', activeSort);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Modrinth HTTP ${res.status}`);
        const json = await res.json();
        setHits(Array.isArray(json?.hits) ? json.hits : []);
        setTotalHits(Number(json?.total_hits ?? 0));
      } catch (err: any) {
        notify(`Could not search Modrinth ${labelPlural}`, err?.message || 'Network error', 'error');
      } finally {
        setSearching(false);
      }
    },
    [query, browsePage, isPlugins, mode, loaderFilter, mcVersion, sortBy, autoMatch, labelPlural, notify]
  );

  // Re-run search automatically from page 1 whenever filters or tab sync on Browse tab
  useEffect(() => {
    if (tab === 'browse' && !detectingEnv) {
      setBrowsePage(1);
      searchModrinth(query, 1, loaderFilter, mcVersion, sortBy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loaderFilter, mcVersion, sortBy, autoMatch, detectingEnv]);

  const handleBrowsePageChange = (nextPage: number) => {
    setBrowsePage(nextPage);
    searchModrinth(query, nextPage, loaderFilter, mcVersion, sortBy);
    browseTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    setInstalledPage(1);
  }, [searchInstalled, filterState]);

  const jarItems = useMemo(() => {
    const q = searchInstalled.trim().toLowerCase();
    return files
      .filter((f) => !f.isDirectory && (f.name.endsWith('.jar') || f.name.endsWith('.jar.disabled')))
      .filter((f) => {
        const isEnabled = f.name.endsWith('.jar');
        if (filterState === 'enabled' && !isEnabled) return false;
        if (filterState === 'disabled' && isEnabled) return false;
        if (q && !f.name.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [files, searchInstalled, filterState]);

  const pagedJarItems = useMemo(() => {
    const start = (installedPage - 1) * INSTALLED_PAGE_SIZE;
    return jarItems.slice(start, start + INSTALLED_PAGE_SIZE);
  }, [jarItems, installedPage]);

  const configFolders = useMemo(() => files.filter((f) => f.isDirectory), [files]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  const compatibleLoadersForActive =
    loaderFilter !== 'all' && loaderFilter !== 'unknown'
      ? getCompatibleLoaders(loaderFilter, mode)
      : [];

  const checkHitCompatibility = (hit: ModrinthHit) => {
    const cats = (hit.categories || []).map((c) => c.toLowerCase());
    const vers = hit.versions || [];

    const loaderOk =
      compatibleLoadersForActive.length === 0 ||
      compatibleLoadersForActive.some((cl) => cats.includes(cl));

    const trimmedMc = mcVersion.trim();
    const mcOk = !trimmedMc || vers.includes(trimmedMc);

    return { loaderOk, mcOk, compatible: loaderOk && mcOk };
  };

  const handleCreateFolder = async () => {
    try {
      await panelApi.createFolder(server.id, '/', isPlugins ? 'plugins' : 'mods');
      await loadInstalled();
      notify(`Created ${targetDir} directory`, undefined, 'success');
    } catch (err: any) {
      notify('Could not create folder', err.message, 'error');
    }
  };

  const handleToggleJar = async (entry: FileEntry) => {
    const isEnabled = entry.name.endsWith('.jar');
    const nextName = isEnabled ? `${entry.name}.disabled` : entry.name.replace(/\.disabled$/, '');
    setBusyFile(entry.name);
    try {
      await panelApi.renameFile(server.id, targetDir, entry.name, nextName);
      await loadInstalled();
      notify(`${labelSingular} ${isEnabled ? 'disabled' : 'enabled'}`, nextName, 'success');
    } catch (err: any) {
      notify('Toggle failed', err.message, 'error');
    } finally {
      setBusyFile(null);
    }
  };

  const handleDeleteJar = async (entry: FileEntry) => {
    setBusyFile(entry.name);
    try {
      await panelApi.deleteFiles(server.id, targetDir, [entry.name]);
      await loadInstalled();
      notify(`${labelSingular} removed`, entry.name, 'success');
    } catch (err: any) {
      notify('Delete failed', err.message, 'error');
    } finally {
      setBusyFile(null);
    }
  };

  const handleUploadLocalJars = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      if (!folderExists) {
        await panelApi.createFolder(server.id, '/', isPlugins ? 'plugins' : 'mods').catch(() => {});
      }
      const url = await panelApi.getUploadUrl(server.id);
      await panelApi.uploadFilesToSignedUrl(url, targetDir, fileList);
      await loadInstalled();
      notify(`Uploaded ${fileList.length} ${labelSingular.toLowerCase()}(s)`, targetDir, 'success');
    } catch (err: any) {
      notify('Upload failed', err.message, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const installChosenVersion = async (
    projectTitle: string,
    chosen: ModrinthVersionCandidate,
    visitedProjects: Set<string>,
    depth = 0
  ): Promise<string[]> => {
    const jarFile =
      chosen.files?.find((f) => f.primary && f.filename.toLowerCase().endsWith('.jar')) ||
      chosen.files?.find((f) => f.filename.toLowerCase().endsWith('.jar')) ||
      chosen.files?.[0];

    if (!jarFile?.url) {
      throw new Error(`No downloadable .jar file found for ${projectTitle}.`);
    }

    if (!folderExists) {
      await panelApi.createFolder(server.id, '/', isPlugins ? 'plugins' : 'mods').catch(() => {});
    }

    setInstallProgress(`Downloading ${jarFile.filename}...`);
    const binRes = await fetch(jarFile.url);
    if (!binRes.ok) throw new Error(`Download error (${binRes.status})`);
    const blob = await binRes.blob();
    const fileObj = new File([blob], jarFile.filename, { type: 'application/java-archive' });

    setInstallProgress(`Uploading ${jarFile.filename} to ${targetDir}...`);
    const signedUrl = await panelApi.getUploadUrl(server.id);
    await panelApi.uploadFilesToSignedUrl(signedUrl, targetDir, [fileObj]);

    const installedNames = [jarFile.filename];

    // Auto-install required dependencies (depth limited to 2 to avoid cycles)
    if (autoInstallDeps && depth < 2 && Array.isArray(chosen.dependencies)) {
      const requiredDeps = chosen.dependencies.filter(
        (d) => d.dependency_type === 'required' && d.project_id && !visitedProjects.has(d.project_id)
      );

      for (const dep of requiredDeps) {
        if (!dep.project_id) continue;
        visitedProjects.add(dep.project_id);
        try {
          const [projRes, depVersRes] = await Promise.all([
            fetch(`https://api.modrinth.com/v2/project/${encodeURIComponent(dep.project_id)}`),
            fetch(`https://api.modrinth.com/v2/project/${encodeURIComponent(dep.project_id)}/version`),
          ]);
          if (!projRes.ok || !depVersRes.ok) continue;
          const depProj = await projRes.json();
          const depSlug = String(depProj?.slug || '').toLowerCase();
          const depTitle = String(depProj?.title || dep.project_id);

          // Skip if a matching jar already appears in targetDir
          const alreadyHasDep = files.some((f) => {
            const lower = f.name.toLowerCase();
            return (
              lower.endsWith('.jar') &&
              (lower.includes(depSlug.replace(/-/g, '')) ||
                lower.includes(depSlug.split('-')[0]))
            );
          });
          if (alreadyHasDep) continue;

          const depVersions: ModrinthVersionCandidate[] = await depVersRes.json();
          let depChosen: ModrinthVersionCandidate | null = null;

          if (dep.version_id) {
            depChosen = depVersions.find((v) => v.id === dep.version_id) || null;
          }
          if (!depChosen) {
            const bestDep = selectBestModrinthVersion(depVersions, {
              loader: loaderFilter,
              mcVersion,
              mode,
            });
            depChosen = bestDep.version;
          }

          if (depChosen) {
            const subInstalled = await installChosenVersion(
              depTitle,
              depChosen,
              visitedProjects,
              depth + 1
            );
            installedNames.push(...subInstalled);
          }
        } catch {
          // Non-fatal: continue even if optional resolution fails
        }
      }
    }

    return installedNames;
  };

  const openVersionSelector = async (hit: ModrinthHit, warningMsg?: string, preloaded?: ModrinthVersionCandidate[]) => {
    setVersionModalHit(hit);
    setVersionModalWarning(warningMsg || null);
    if (preloaded) {
      setVersionModalList(preloaded);
      setVersionModalLoading(false);
      return;
    }
    setVersionModalLoading(true);
    setVersionModalList([]);
    try {
      const res = await fetch(
        `https://api.modrinth.com/v2/project/${encodeURIComponent(hit.project_id)}/version`
      );
      if (!res.ok) throw new Error('Failed to load versions');
      const data: ModrinthVersionCandidate[] = await res.json();
      setVersionModalList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setVersionModalWarning(err?.message || 'Could not load project versions');
    } finally {
      setVersionModalLoading(false);
    }
  };

  const handleInstallFromModrinth = async (hit: ModrinthHit) => {
    setInstallingId(hit.project_id);
    setInstallProgress(`Finding compatible build for ${hit.title}...`);
    try {
      const vRes = await fetch(
        `https://api.modrinth.com/v2/project/${encodeURIComponent(hit.project_id)}/version`
      );
      if (!vRes.ok) throw new Error('Failed to fetch project versions');
      const versions: ModrinthVersionCandidate[] = await vRes.json();

      if (autoMatch && (loaderFilter !== 'all' || mcVersion.trim())) {
        const selection = selectBestModrinthVersion(versions, {
          loader: loaderFilter,
          mcVersion,
          mode,
        });

        if (!selection.version) {
          // Do NOT install an incompatible build blindly — let the user see available versions cleanly
          setInstallingId(null);
          setInstallProgress(null);
          openVersionSelector(hit, selection.reason, versions);
          return;
        }

        const installedFiles = await installChosenVersion(
          hit.title,
          selection.version,
          new Set([hit.project_id])
        );
        await loadInstalled();
        const extraDeps = installedFiles.length > 1 ? ` (+${installedFiles.length - 1} dep)` : '';
        notify(
          `Installed ${hit.title}${extraDeps}`,
          `${installedFiles[0]} · ${selection.reason}`,
          'success'
        );
      } else {
        // Manual / unfiltered fallback
        const selection = selectBestModrinthVersion(versions, {
          loader: loaderFilter,
          mcVersion,
          mode,
        });
        const chosen = selection.version || versions[0];
        if (!chosen) throw new Error('No downloadable version found.');
        const installedFiles = await installChosenVersion(
          hit.title,
          chosen,
          new Set([hit.project_id])
        );
        await loadInstalled();
        notify(`Installed ${hit.title}`, `${installedFiles[0]} -> ${targetDir}`, 'success');
      }
    } catch (err: any) {
      notify(
        `Install failed for ${hit.title}`,
        err?.message || 'Try downloading the .jar and uploading manually.',
        'error'
      );
    } finally {
      setInstallingId(null);
      setInstallProgress(null);
    }
  };

  const handleInstallExplicitVersion = async (hit: ModrinthHit, ver: ModrinthVersionCandidate) => {
    setVersionModalHit(null);
    setInstallingId(hit.project_id);
    setInstallProgress(`Installing ${ver.version_number}...`);
    try {
      const installedFiles = await installChosenVersion(hit.title, ver, new Set([hit.project_id]));
      await loadInstalled();
      const extraDeps = installedFiles.length > 1 ? ` (+${installedFiles.length - 1} dep)` : '';
      notify(`Installed ${hit.title}${extraDeps}`, `${installedFiles[0]} -> ${targetDir}`, 'success');
    } catch (err: any) {
      notify(`Install failed for ${hit.title}`, err?.message || 'Upload error', 'error');
    } finally {
      setInstallingId(null);
      setInstallProgress(null);
    }
  };

  const openConfigBrowser = async (folderPath?: string) => {
    setConfigModalOpen(true);
    setSelectedConfigPath(null);
    setConfigContent('');
    setLoadingConfig(true);
    try {
      const scanDir = folderPath || (isPlugins ? '/plugins' : '/config');
      const list = await panelApi.listFiles(server.id, scanDir);
      const editable = list.filter(
        (f) =>
          !f.isDirectory &&
          /\.(ya?ml|toml|json|properties|conf|cfg|txt)$/i.test(f.name)
      );
      setConfigFiles(editable);
      if (editable[0]) {
        setSelectedConfigPath(editable[0].path);
        const text = await panelApi.getFileContents(server.id, editable[0].path);
        setConfigContent(text);
      }
    } catch {
      setConfigFiles([]);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleOpenConfigFile = async (path: string) => {
    setSelectedConfigPath(path);
    setLoadingConfig(true);
    try {
      const text = await panelApi.getFileContents(server.id, path);
      setConfigContent(text);
    } catch (err: any) {
      notify('Could not open config', err.message, 'error');
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveConfigFile = async () => {
    if (!selectedConfigPath) return;
    setSavingConfig(true);
    try {
      await panelApi.writeFile(server.id, selectedConfigPath, configContent);
      notify('Config saved', selectedConfigPath, 'success');
    } catch (err: any) {
      notify('Failed to save config', err.message, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const loaderOptions = isPlugins
    ? [
        { id: 'all', label: 'All Loaders' },
        { id: 'paper', label: 'Paper' },
        { id: 'purpur', label: 'Purpur' },
        { id: 'folia', label: 'Folia' },
        { id: 'spigot', label: 'Spigot' },
        { id: 'bukkit', label: 'Bukkit' },
        { id: 'velocity', label: 'Velocity' },
        { id: 'waterfall', label: 'Waterfall' },
        { id: 'bungeecord', label: 'BungeeCord' },
      ]
    : [
        { id: 'all', label: 'All Loaders' },
        { id: 'forge', label: 'Forge' },
        { id: 'neoforge', label: 'NeoForge' },
        { id: 'fabric', label: 'Fabric' },
        { id: 'quilt', label: 'Quilt' },
      ];

  const enabledCount = files.filter((f) => !f.isDirectory && f.name.endsWith('.jar')).length;
  const disabledCount = files.filter((f) => !f.isDirectory && f.name.endsWith('.jar.disabled')).length;

  const detectedKindMismatch =
    detectedEnv &&
    detectedEnv.loader !== 'unknown' &&
    ((isPlugins && getLoaderKind(detectedEnv.loader) === 'mod') ||
      (!isPlugins && getLoaderKind(detectedEnv.loader) === 'plugin'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mx-well-3d w-11 h-11 rounded-2xl flex items-center justify-center shrink-0">
            {isPlugins ? (
              <Puzzle className="w-5 h-5 text-[#8B5CF6]" />
            ) : (
              <Boxes className="w-5 h-5 text-[#06B6D4]" />
            )}
          </div>
          <div>
            <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
              {labelPlural} Manager
            </h1>
            <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
              {server.name} · Manage <span className="font-mono">{targetDir}</span>, auto-match server software &amp; MC version, and install safely from Modrinth
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jar"
            onChange={(e) => handleUploadLocalJars(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5 text-[#06B6D4]" />
            {uploading ? 'Uploading...' : 'Upload .jar'}
          </button>
          <button
            type="button"
            onClick={() => openConfigBrowser()}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 text-[#8B5CF6]" />
            Configs
          </button>
          <button
            type="button"
            onClick={() => {
              loadInstalled();
              runEnvDetection();
            }}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || detectingEnv ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Auto-Detected Server Compatibility Banner */}
      <div className="mx-card-3d p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-[#8B5CF6]/20">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mx-well-3d w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
            {detectingEnv ? (
              <Loader2 className="w-4 h-4 text-[#8B5CF6] animate-spin" />
            ) : (
              <Cpu className="w-4 h-4 text-[#8B5CF6]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#171717] dark:text-white">
                Server Environment
              </span>
              {detectingEnv ? (
                <span className="text-[11px] text-[#777777] dark:text-zinc-400">
                  Detecting software &amp; Minecraft version...
                </span>
              ) : (
                <>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#8B5CF6]/15 text-[#8B5CF6] dark:text-violet-300">
                    {loaderFilter !== 'all'
                      ? LOADER_LABELS[loaderFilter as ServerLoaderId] || loaderFilter
                      : detectedEnv?.loader && detectedEnv.loader !== 'unknown'
                        ? detectedEnv.loaderLabel
                        : 'Loader Unknown'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#06B6D4]/15 text-[#06B6D4] dark:text-cyan-300 font-mono">
                    {mcVersion.trim() ? `MC ${mcVersion.trim()}` : 'MC Version Unknown'}
                  </span>
                  {detectedEnv && detectedEnv.sources.length > 0 && (
                    <span className="text-[11px] text-[#777777] dark:text-zinc-400 truncate">
                      Detected via {detectedEnv.sources.slice(0, 2).join(', ')}
                    </span>
                  )}
                </>
              )}
            </div>
            <p className="text-[11px] text-[#777777] dark:text-zinc-400 mt-1">
              {autoMatch
                ? `Auto-Match is ON — searching and installing only ${labelPlural.toLowerCase()} compatible with ${
                    loaderFilter !== 'all' ? LOADER_LABELS[loaderFilter as ServerLoaderId] || loaderFilter : 'your server'
                  }${mcVersion.trim() ? ` (${mcVersion.trim()})` : ''}.`
                : 'Auto-Match is OFF — showing unfiltered Modrinth results.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <label className="mx-well-3d inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoMatch}
              onChange={(e) => {
                const next = e.target.checked;
                setAutoMatch(next);
                if (next && detectedEnv) {
                  const modeMatches =
                    (isPlugins && detectedEnv.kind === 'plugin') ||
                    (!isPlugins && detectedEnv.kind === 'mod');
                  if (modeMatches && detectedEnv.loader !== 'unknown') {
                    setLoaderFilter(detectedEnv.loader);
                  }
                  if (detectedEnv.mcVersion) {
                    setMcVersion(detectedEnv.mcVersion);
                  }
                }
              }}
              className="accent-[#8B5CF6] rounded cursor-pointer"
            />
            <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span className="font-medium">Auto-Match Server</span>
          </label>

          <label
            title="Automatically install required library dependencies (e.g. Fabric API, Cloth Config, Architectury, GeckoLib)"
            className="mx-well-3d inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={autoInstallDeps}
              onChange={(e) => setAutoInstallDeps(e.target.checked)}
              className="accent-[#06B6D4] rounded cursor-pointer"
            />
            <Layers className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span className="font-medium">Auto Dependencies</span>
          </label>

          <button
            type="button"
            onClick={runEnvDetection}
            disabled={detectingEnv}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${detectingEnv ? 'animate-spin' : ''}`} />
            Re-detect
          </button>
        </div>
      </div>

      {/* Mode mismatch helpful prompt (e.g. opened Plugins on a Forge server, or Mods on a Paper server) */}
      {detectedKindMismatch && detectedEnv && (
        <div className="mx-card-3d p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-amber-500/35 bg-amber-500/5">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-[#171717] dark:text-zinc-200">
              This server was detected as <strong>{detectedEnv.loaderLabel}</strong>
              {detectedEnv.mcVersion ? ` (${detectedEnv.mcVersion})` : ''}, which normally uses the{' '}
              <strong>{isPlugins ? 'Mods Manager' : 'Plugins Manager'}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              navigate({
                page: isPlugins ? 'server-mods' : 'server-plugins',
                serverId: server.id,
              })
            }
            className="mx-btn-3d-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
          >
            Open {isPlugins ? 'Mods Manager' : 'Plugins Manager'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mx-well-3d inline-flex items-center gap-1.5 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setTab('installed')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
            tab === 'installed' ? 'mx-btn-3d-primary' : 'text-[#525252] dark:text-zinc-400'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Installed ({enabledCount} active{disabledCount > 0 ? `, ${disabledCount} disabled` : ''})
        </button>
        <button
          type="button"
          onClick={() => setTab('browse')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
            tab === 'browse' ? 'mx-btn-3d-primary' : 'text-[#525252] dark:text-zinc-400'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          Browse &amp; Auto-Install (Modrinth)
        </button>
      </div>

      {/* TAB 1: INSTALLED */}
      {tab === 'installed' && (
        <div className="space-y-4">
          {!folderExists ? (
            <div className="mx-card-3d p-10 rounded-2xl text-center space-y-3">
              <p className="text-sm font-semibold text-[#171717] dark:text-white">
                Directory <span className="font-mono">{targetDir}</span> does not exist yet
              </p>
              <p className="text-xs text-[#777777] dark:text-zinc-400">
                Create the folder to upload or install {labelPlural.toLowerCase()} from Modrinth.
              </p>
              <div className="flex justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  Create {targetDir}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('browse')}
                  className="mx-btn-3d inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Browse Modrinth
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mx-card-3d p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchInstalled}
                    onChange={(e) => setSearchInstalled(e.target.value)}
                    placeholder={`Filter installed ${labelPlural.toLowerCase()}...`}
                    className="mx-input-3d w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
                  />
                </div>
                <div className="mx-well-3d inline-flex items-center gap-1 p-1 rounded-xl">
                  {(['all', 'enabled', 'disabled'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterState(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                        filterState === st ? 'mx-btn-3d' : 'text-[#777777] dark:text-zinc-400'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="mx-card-3d p-8 rounded-2xl text-center text-xs text-[#777777]">
                  Loading {targetDir}...
                </div>
              ) : jarItems.length === 0 ? (
                <div className="mx-card-3d p-10 rounded-2xl text-center space-y-2">
                  <p className="text-sm font-semibold">No {labelPlural.toLowerCase()} found</p>
                  <p className="text-xs text-[#777777] dark:text-zinc-400">
                    Upload a .jar file or switch to Browse &amp; Auto-Install to add compatible {labelPlural.toLowerCase()} directly from Modrinth.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {pagedJarItems.map((entry) => {
                    const isEnabled = entry.name.endsWith('.jar');
                    const displayName = entry.name.replace(/\.jar(\.disabled)?$/i, '');
                    const matchingConfigFolder = configFolders.find(
                      (cf) =>
                        displayName.toLowerCase().includes(cf.name.toLowerCase()) ||
                        cf.name.toLowerCase().includes(displayName.split(/[-_0-9]/)[0].toLowerCase())
                    );
                    const isBusy = busyFile === entry.name;

                    return (
                      <div
                        key={entry.path}
                        className="mx-card-3d p-4 rounded-2xl flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isEnabled ? 'bg-emerald-500' : 'bg-zinc-400'
                                }`}
                              />
                              <h3 className="text-sm font-bold text-[#171717] dark:text-white truncate">
                                {displayName}
                              </h3>
                            </div>
                            <div className="text-[11px] font-mono text-[#777777] dark:text-zinc-400 truncate mt-1">
                              {entry.name}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                              isEnabled
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-zinc-500/15 text-zinc-500'
                            }`}
                          >
                            {isEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#777777] dark:text-zinc-400 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                          <span className="font-mono tabular-nums">
                            {formatBytes(entry.size)} · {formatRelativeTime(entry.modifiedAt)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {matchingConfigFolder && (
                              <button
                                type="button"
                                title="Edit Config"
                                onClick={() => openConfigBrowser(matchingConfigFolder.path)}
                                className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
                              >
                                <FileCode2 className="w-3.5 h-3.5 text-[#06B6D4]" />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isBusy}
                              title={isEnabled ? 'Disable' : 'Enable'}
                              onClick={() => handleToggleJar(entry)}
                              className="mx-btn-3d p-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                            >
                              <Power
                                className={`w-3.5 h-3.5 ${
                                  isEnabled ? 'text-emerald-500' : 'text-zinc-400'
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              title="Delete"
                              onClick={() => handleDeleteJar(entry)}
                              className="mx-btn-3d-danger p-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                  <PaginationBar
                    page={installedPage}
                    totalItems={jarItems.length}
                    pageSize={INSTALLED_PAGE_SIZE}
                    label={`installed ${labelPlural.toLowerCase()}`}
                    onPageChange={setInstalledPage}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: BROWSE MODRINTH */}
      {tab === 'browse' && (
        <div ref={browseTopRef} className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBrowsePage(1);
              searchModrinth(query, 1);
            }}
            className="mx-card-3d p-4 rounded-2xl flex flex-col xl:flex-row xl:items-center gap-3"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search Modrinth ${labelPlural.toLowerCase()} (e.g. ${
                  isPlugins ? 'LuckPerms, EssentialsX, Spark' : 'Sodium, JEI, Create, Lithium'
                })...`}
                className="mx-input-3d w-full pl-8 pr-3 py-2 text-xs rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={loaderFilter}
                onChange={(e) => setLoaderFilter(e.target.value)}
                aria-label="Server loader"
                className="mx-input-3d px-3 py-2 text-xs rounded-xl cursor-pointer"
              >
                {loaderOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-white dark:bg-[#19191F]">
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={mcVersion}
                onChange={(e) => setMcVersion(e.target.value)}
                placeholder="MC Version (e.g. 1.21.1)"
                className="mx-input-3d w-36 px-3 py-2 text-xs rounded-xl font-mono"
              />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ModrinthSort)}
                aria-label="Sort order"
                className="mx-input-3d px-3 py-2 text-xs rounded-xl cursor-pointer"
              >
                <option value="downloads" className="bg-white dark:bg-[#19191F]">
                  Most Downloaded
                </option>
                <option value="relevance" className="bg-white dark:bg-[#19191F]">
                  Relevance
                </option>
                <option value="updated" className="bg-white dark:bg-[#19191F]">
                  Recently Updated
                </option>
                <option value="newest" className="bg-white dark:bg-[#19191F]">
                  Newest
                </option>
              </select>

              <button
                type="submit"
                disabled={searching}
                className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Search
              </button>
            </div>
          </form>

          {installProgress && (
            <div className="mx-card-3d px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-xs text-[#8B5CF6] font-medium">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{installProgress}</span>
            </div>
          )}

          {searching && hits.length === 0 ? (
            <div className="mx-card-3d p-10 rounded-2xl text-center text-xs text-[#777777]">
              Searching Modrinth {labelPlural.toLowerCase()} compatible with your server...
            </div>
          ) : hits.length === 0 ? (
            <div className="mx-card-3d p-10 rounded-2xl text-center space-y-2">
              <p className="text-sm font-semibold">
                No matching {labelPlural.toLowerCase()} found on Modrinth
              </p>
              <p className="text-xs text-[#777777] dark:text-zinc-400">
                Try clearing the search query or temporarily disabling Auto-Match if your server version is very new or older.
              </p>
            </div>
              ) : (
            <>
              <div
                className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 transition-opacity ${
                  searching ? 'opacity-60' : 'opacity-100'
                }`}
              >
                {hits.map((hit) => {
                  const alreadyInstalled = files.some((f) =>
                    f.name.toLowerCase().includes(hit.slug.toLowerCase().split('-')[0])
                  );
                  const isInstalling = installingId === hit.project_id;
                  const compat = checkHitCompatibility(hit);
                  const activeLoaderLabel =
                    loaderFilter !== 'all'
                      ? LOADER_LABELS[loaderFilter as ServerLoaderId] || loaderFilter
                      : 'Any';

                  return (
                    <div
                      key={hit.project_id}
                      className="mx-card-3d p-4 rounded-2xl flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mx-well-3d w-11 h-11 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                          {hit.icon_url ? (
                            <img src={hit.icon_url} alt={hit.title} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-[#8B5CF6]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-[#171717] dark:text-white truncate">
                              {hit.title}
                            </h3>
                            {alreadyInstalled && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                            by {hit.author} · {hit.downloads.toLocaleString()} downloads
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-[#525252] dark:text-zinc-300 line-clamp-2 leading-relaxed">
                        {hit.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            compat.compatible
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {compat.compatible ? (
                            <>
                              <Sparkles className="w-2.5 h-2.5" />
                              Compatible · {activeLoaderLabel}
                              {mcVersion.trim() ? ` ${mcVersion.trim()}` : ''}
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {!compat.loaderOk ? `${activeLoaderLabel} unsupported` : `No MC ${mcVersion.trim()}`}
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                        <a
                          href={`https://modrinth.com/${isPlugins ? 'plugin' : 'mod'}/${hit.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#777777] hover:text-[#8B5CF6]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Modrinth
                        </a>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={Boolean(installingId)}
                            onClick={() => openVersionSelector(hit)}
                            className="mx-btn-3d px-2.5 py-1.5 rounded-xl text-[11px] font-medium cursor-pointer disabled:opacity-50"
                          >
                            Versions
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(installingId)}
                            onClick={() => handleInstallFromModrinth(hit)}
                            className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {isInstalling ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            {isInstalling ? 'Installing...' : autoMatch ? 'Auto-Install' : 'Install'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <PaginationBar
                page={browsePage}
                totalItems={totalHits}
                pageSize={BROWSE_PAGE_SIZE}
                loading={searching}
                label={labelPlural.toLowerCase()}
                onPageChange={handleBrowsePageChange}
              />
            </>
          )}
        </div>
      )}

      {/* Version Picker Modal */}
      {versionModalHit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          onClick={() => setVersionModalHit(null)}
        >
          <div
            className="mx-card-3d w-full max-w-2xl max-h-[82vh] rounded-2xl p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="mx-heading-3d text-sm font-bold">
                  Select Version — {versionModalHit.title}
                </h2>
                <p className="text-[11px] text-[#777777] dark:text-zinc-400">
                  Target server: {loaderFilter !== 'all' ? LOADER_LABELS[loaderFilter as ServerLoaderId] || loaderFilter : 'Any loader'}
                  {mcVersion.trim() ? ` · MC ${mcVersion.trim()}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVersionModalHit(null)}
                className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {versionModalWarning && (
              <div className="p-3 rounded-xl border border-amber-500/35 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{versionModalWarning}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {versionModalLoading ? (
                <div className="py-10 text-center text-xs text-[#777777]">
                  Loading available versions from Modrinth...
                </div>
              ) : versionModalList.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#777777]">
                  No downloadable versions found.
                </div>
              ) : (
                [...versionModalList]
                  .sort((a, b) => {
                    const aL = a.loaders.map((l) => l.toLowerCase());
                    const bL = b.loaders.map((l) => l.toLowerCase());
                    const aOk =
                      (compatibleLoadersForActive.length === 0 ||
                        compatibleLoadersForActive.some((cl) => aL.includes(cl))) &&
                      (!mcVersion.trim() || a.game_versions.includes(mcVersion.trim()));
                    const bOk =
                      (compatibleLoadersForActive.length === 0 ||
                        compatibleLoadersForActive.some((cl) => bL.includes(cl))) &&
                      (!mcVersion.trim() || b.game_versions.includes(mcVersion.trim()));
                    return Number(bOk) - Number(aOk);
                  })
                  .slice(0, 30)
                  .map((ver) => {
                  const vLoaders = ver.loaders.map((l) => l.toLowerCase());
                  const loaderMatched =
                    compatibleLoadersForActive.length === 0 ||
                    compatibleLoadersForActive.some((cl) => vLoaders.includes(cl));
                  const mcMatched =
                    !mcVersion.trim() || ver.game_versions.includes(mcVersion.trim());
                  const isCompatible = loaderMatched && mcMatched;
                  const jar =
                    ver.files.find((f) => f.primary) || ver.files[0];

                  return (
                    <div
                      key={ver.id}
                      className={`p-3 rounded-xl flex items-center justify-between gap-3 ${
                        isCompatible ? 'mx-well-3d border border-emerald-500/35' : 'mx-well-3d opacity-75'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-[#171717] dark:text-white">
                            {ver.version_number}
                          </span>
                          {isCompatible && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              Compatible
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/[0.06] dark:bg-white/[0.06]">
                            {ver.loaders.join(', ')}
                          </span>
                          <span className="text-[10px] text-[#777777] dark:text-zinc-400 font-mono">
                            MC {ver.game_versions.slice(0, 4).join(', ')}
                            {ver.game_versions.length > 4 ? ` +${ver.game_versions.length - 4}` : ''}
                          </span>
                        </div>
                        {jar && (
                          <div className="text-[11px] font-mono text-[#777777] dark:text-zinc-400 truncate mt-0.5">
                            {jar.filename} · {formatBytes(jar.size)}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInstallExplicitVersion(versionModalHit, ver)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 ${
                          isCompatible ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                        }`}
                      >
                        Install
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Config Editor Modal */}
      {configModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          onClick={() => setConfigModalOpen(false)}
        >
          <div
            className="mx-card-3d w-full max-w-4xl max-h-[85vh] rounded-2xl p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[#8B5CF6]" />
                <h2 className="mx-heading-3d text-sm font-bold">
                  {labelSingular} Configuration Editor
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConfigModalOpen(false)}
                className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingConfig && configFiles.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#777777]">Loading config files...</div>
            ) : configFiles.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#777777]">
                No editable config files (.yml/.toml/.json/.properties) found in this directory.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
                <div className="md:col-span-4 mx-well-3d rounded-xl p-2 space-y-1 overflow-y-auto max-h-[52vh]">
                  {configFiles.map((cf) => (
                    <button
                      key={cf.path}
                      type="button"
                      onClick={() => handleOpenConfigFile(cf.path)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono truncate cursor-pointer ${
                        selectedConfigPath === cf.path
                          ? 'mx-nav-active font-semibold'
                          : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      {cf.name}
                    </button>
                  ))}
                </div>
                <div className="md:col-span-8 flex flex-col gap-3 min-h-0">
                  <textarea
                    value={configContent}
                    onChange={(e) => setConfigContent(e.target.value)}
                    rows={16}
                    className="mx-input-3d w-full flex-1 p-3 rounded-xl font-mono text-xs leading-relaxed"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-[#777777] truncate">
                      {selectedConfigPath}
                    </span>
                    <button
                      type="button"
                      disabled={savingConfig || !selectedConfigPath}
                      onClick={handleSaveConfigFile}
                      className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingConfig ? 'Saving...' : 'Save Config'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
