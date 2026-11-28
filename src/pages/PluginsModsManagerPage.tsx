import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCode2,
  FolderPlus,
  Loader2,
  Package,
  Power,
  Puzzle,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { usePanel } from '../context/PanelContext';
import type { FileEntry } from '../types/panel';
import { formatBytes, formatRelativeTime } from '../utils/format';

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

interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: Array<{
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }>;
}

type ManagerMode = 'plugins' | 'mods';
type ActiveTab = 'installed' | 'browse';

export function PluginsModsManagerPage({
  serverId,
  mode,
}: {
  serverId: string;
  mode: ManagerMode;
}) {
  const { servers, notify, panelConnected, connectionError } = usePanel();
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

  // Config viewer/editor modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configFiles, setConfigFiles] = useState<FileEntry[]>([]);
  const [selectedConfigPath, setSelectedConfigPath] = useState<string | null>(null);
  const [configContent, setConfigContent] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Modrinth browse/install state
  const [query, setQuery] = useState('');
  const [loaderFilter, setLoaderFilter] = useState('all');
  const [mcVersion, setMcVersion] = useState('');
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<ModrinthHit[]>([]);
  const [installingId, setInstallingId] = useState<string | null>(null);

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

  useEffect(() => {
    loadInstalled();
  }, [loadInstalled]);

  const searchModrinth = useCallback(
    async (qText = query) => {
      setSearching(true);
      try {
        const facets: string[][] = [[`project_type:${isPlugins ? 'plugin' : 'mod'}`]];
        if (loaderFilter !== 'all') {
          facets.push([`categories:${loaderFilter}`]);
        }
        if (mcVersion.trim()) {
          facets.push([`versions:${mcVersion.trim()}`]);
        }
        const url = new URL('https://api.modrinth.com/v2/search');
        if (qText.trim()) url.searchParams.set('query', qText.trim());
        url.searchParams.set('facets', JSON.stringify(facets));
        url.searchParams.set('limit', '18');
        url.searchParams.set('index', 'downloads');

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Modrinth HTTP ${res.status}`);
        const json = await res.json();
        setHits(Array.isArray(json?.hits) ? json.hits : []);
      } catch (err: any) {
        notify(`Could not search Modrinth ${labelPlural}`, err?.message || 'Network error', 'error');
      } finally {
        setSearching(false);
      }
    },
    [query, isPlugins, loaderFilter, mcVersion, labelPlural, notify]
  );

  useEffect(() => {
    if (tab === 'browse' && hits.length === 0) {
      searchModrinth('');
    }
  }, [tab, hits.length, searchModrinth]);

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

  const configFolders = useMemo(
    () => files.filter((f) => f.isDirectory),
    [files]
  );

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

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
      notify(
        `${labelSingular} ${isEnabled ? 'disabled' : 'enabled'}`,
        nextName,
        'success'
      );
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

  const handleInstallFromModrinth = async (hit: ModrinthHit) => {
    setInstallingId(hit.project_id);
    try {
      const params = new URLSearchParams();
      if (loaderFilter !== 'all') params.set('loaders', JSON.stringify([loaderFilter]));
      if (mcVersion.trim()) params.set('game_versions', JSON.stringify([mcVersion.trim()]));

      const vRes = await fetch(
        `https://api.modrinth.com/v2/project/${encodeURIComponent(hit.project_id)}/version?${params.toString()}`
      );
      if (!vRes.ok) throw new Error('Failed to fetch project versions');
      let versions: ModrinthVersion[] = await vRes.json();
      if (!Array.isArray(versions) || versions.length === 0) {
        const fallbackRes = await fetch(
          `https://api.modrinth.com/v2/project/${encodeURIComponent(hit.project_id)}/version`
        );
        versions = await fallbackRes.json();
      }
      const chosen = versions[0];
      const jarFile = chosen?.files?.find((f) => f.primary) || chosen?.files?.[0];
      if (!jarFile?.url) {
        throw new Error('No downloadable .jar file found for this version.');
      }

      if (!folderExists) {
        await panelApi.createFolder(server.id, '/', isPlugins ? 'plugins' : 'mods').catch(() => {});
      }

      const binRes = await fetch(jarFile.url);
      if (!binRes.ok) throw new Error(`Download error (${binRes.status})`);
      const blob = await binRes.blob();
      const fileObj = new File([blob], jarFile.filename, { type: 'application/java-archive' });

      const signedUrl = await panelApi.getUploadUrl(server.id);
      await panelApi.uploadFilesToSignedUrl(signedUrl, targetDir, [fileObj]);

      await loadInstalled();
      notify(`Installed ${hit.title}`, `${jarFile.filename} -> ${targetDir}`, 'success');
    } catch (err: any) {
      notify(
        `Install failed for ${hit.title}`,
        err?.message || 'Try downloading the .jar and uploading manually.',
        'error'
      );
    } finally {
      setInstallingId(null);
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
        { id: 'spigot', label: 'Spigot' },
        { id: 'bukkit', label: 'Bukkit' },
        { id: 'velocity', label: 'Velocity' },
        { id: 'bungeecord', label: 'BungeeCord' },
      ]
    : [
        { id: 'all', label: 'All Loaders' },
        { id: 'fabric', label: 'Fabric' },
        { id: 'forge', label: 'Forge' },
        { id: 'neoforge', label: 'NeoForge' },
        { id: 'quilt', label: 'Quilt' },
      ];

  const enabledCount = files.filter((f) => !f.isDirectory && f.name.endsWith('.jar')).length;
  const disabledCount = files.filter((f) => !f.isDirectory && f.name.endsWith('.jar.disabled')).length;

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
              {server.name} · Manage <span className="font-mono">{targetDir}</span>, enable/disable .jar files, edit configs &amp; install directly from Modrinth
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
            {uploading ? 'Uploading...' : `Upload .jar`}
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
            onClick={loadInstalled}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

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
          Browse &amp; Install (Modrinth)
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
                    Upload a .jar file or switch to Browse &amp; Install to add {labelPlural.toLowerCase()} directly from Modrinth.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {jarItems.map((entry) => {
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
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: BROWSE MODRINTH */}
      {tab === 'browse' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchModrinth(query);
            }}
            className="mx-card-3d p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center gap-3"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search Modrinth ${labelPlural.toLowerCase()} (e.g. ${isPlugins ? 'LuckPerms, EssentialsX, Spark' : 'Sodium, Lithium, FerriteCore'})...`}
                className="mx-input-3d w-full pl-8 pr-3 py-2 text-xs rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={loaderFilter}
                onChange={(e) => setLoaderFilter(e.target.value)}
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
                className="mx-input-3d w-36 px-3 py-2 text-xs rounded-xl"
              />

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

          {searching && hits.length === 0 ? (
            <div className="mx-card-3d p-10 rounded-2xl text-center text-xs text-[#777777]">
              Searching Modrinth {labelPlural.toLowerCase()}...
            </div>
          ) : hits.length === 0 ? (
            <div className="mx-card-3d p-10 rounded-2xl text-center text-xs text-[#777777]">
              No matching {labelPlural.toLowerCase()} found on Modrinth.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {hits.map((hit) => {
                const alreadyInstalled = files.some((f) =>
                  f.name.toLowerCase().includes(hit.slug.toLowerCase().split('-')[0])
                );
                const isInstalling = installingId === hit.project_id;
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
                        {isInstalling ? 'Installing...' : 'Install'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
