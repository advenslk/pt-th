import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ChevronRight,
  Download,
  Edit3,
  FileArchive,
  FileCode2,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  PackageOpen,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { panelApi } from '../api/client';
import { usePanel } from '../context/PanelContext';
import type { FileEntry } from '../types/panel';
import { formatBytes, formatRelativeTime } from '../utils/format';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';

function getFileIcon(entry: FileEntry) {
  if (entry.isDirectory) return <Folder className="w-4 h-4 text-[#8B5CF6]" />;
  const n = entry.name.toLowerCase();
  if (n.endsWith('.json')) return <FileJson className="w-4 h-4 text-amber-500" />;
  if (n.endsWith('.zip') || n.endsWith('.tar.gz') || n.endsWith('.gz'))
    return <FileArchive className="w-4 h-4 text-[#06B6D4]" />;
  if (n.endsWith('.ts') || n.endsWith('.js') || n.endsWith('.yml') || n.endsWith('.yaml') || n.endsWith('.sh'))
    return <FileCode2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
  return <FileText className="w-4 h-4 text-[#777777] dark:text-zinc-400" />;
}

function highlightCodeLine(line: string, fileName: string): React.ReactNode {
  const lower = fileName.toLowerCase();
  if (line.trim().startsWith('#')) {
    return <span className="text-zinc-500 italic">{line}</span>;
  }
  if (lower.endsWith('.yml') || lower.endsWith('.yaml') || lower.endsWith('.properties')) {
    const idx = line.indexOf(lower.endsWith('.properties') ? '=' : ':');
    if (idx > 0) {
      return (
        <>
          <span className="text-[#06B6D4]">{line.slice(0, idx)}</span>
          <span className="text-zinc-400">{line[idx]}</span>
          <span className="text-emerald-300">{line.slice(idx + 1)}</span>
        </>
      );
    }
  }
  if (lower.endsWith('.json')) {
    const match = line.match(/^(\s*"[^"]+"\s*:)(.*)$/);
    if (match) {
      return (
        <>
          <span className="text-[#8B5CF6]">{match[1]}</span>
          <span className="text-amber-200">{match[2]}</span>
        </>
      );
    }
  }
  return <span>{line}</span>;
}

export function FileManagerPage({ serverId }: { serverId: string }) {
  const { servers, notify, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [directory, setDirectory] = useState('/');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const [editingFile, setEditingFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [renamingTarget, setRenamingTarget] = useState<{ oldName: string; nextName: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDirectory = useCallback(async () => {
    if (!server || !panelConnected) return;
    setLoading(true);
    try {
      const list = await panelApi.listFiles(server.id, directory);
      setFiles(list);
      setSelected([]);
    } catch (err: any) {
      notify('Could not load files', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [server?.id, directory, panelConnected, notify]);

  useEffect(() => {
    setDirectory('/');
  }, [server?.id]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const breadcrumbs = useMemo(() => {
    const parts = directory.split('/').filter(Boolean);
    return parts.map((name, idx) => ({
      name,
      path: '/' + parts.slice(0, idx + 1).join('/'),
    }));
  }, [directory]);

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;
  }, [files, search]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  const openEntry = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      setDirectory(entry.path);
      return;
    }
    try {
      const content = await panelApi.getFileContents(server.id, entry.path);
      setEditingFile({ path: entry.path, name: entry.name, content });
    } catch (err: any) {
      notify('Unable to open file', err.message, 'error');
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setSavingFile(true);
    try {
      await panelApi.writeFile(server.id, editingFile.path, editingFile.content);
      notify('File saved', editingFile.path, 'success');
      setEditingFile(null);
      loadDirectory();
    } catch (err: any) {
      notify('Failed to save file', err.message, 'error');
    } finally {
      setSavingFile(false);
    }
  };

  const handleUploadFileList = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    try {
      const uploadUrl = await panelApi.getUploadUrl(server.id);
      await panelApi.uploadFilesToSignedUrl(uploadUrl, directory, fileList);
      notify('Upload complete', `${fileList.length} file(s) uploaded to ${directory}`, 'success');
      loadDirectory();
    } catch (err: any) {
      notify('Upload failed', err.message, 'error');
    }
  };

  const handleDownload = async (entry: FileEntry) => {
    try {
      const signedUrl = await panelApi.getDownloadUrl(server.id, entry.path);
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = entry.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      notify('Download failed', err.message, 'error');
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await panelApi.createFolder(server.id, directory, newFolderName.trim());
      setNewFolderName('');
      setCreatingFolder(false);
      loadDirectory();
      notify('Folder created', newFolderName.trim(), 'success');
    } catch (err: any) {
      notify('Could not create folder', err.message, 'error');
    }
  };

  const handleCreateNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFileName.trim().replace(/\//g, '');
    if (!clean) return;
    const fullPath = directory === '/' ? `/${clean}` : `${directory}/${clean}`;
    try {
      await panelApi.writeFile(server.id, fullPath, '');
      setNewFileName('');
      setCreatingFile(false);
      loadDirectory();
      setEditingFile({ path: fullPath, name: clean, content: '' });
    } catch (err: any) {
      notify('Could not create file', err.message, 'error');
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingTarget || !renamingTarget.nextName.trim()) return;
    try {
      await panelApi.renameFile(server.id, directory, renamingTarget.oldName, renamingTarget.nextName.trim());
      setRenamingTarget(null);
      loadDirectory();
      notify('Renamed successfully', renamingTarget.nextName.trim(), 'success');
    } catch (err: any) {
      notify('Rename failed', err.message, 'error');
    }
  };

  const handleDeleteSelected = async (targets: string[]) => {
    if (targets.length === 0) return;
    try {
      await panelApi.deleteFiles(server.id, directory, targets);
      notify('Deleted', `${targets.length} item(s) removed`, 'success');
      loadDirectory();
    } catch (err: any) {
      notify('Delete failed', err.message, 'error');
    }
  };

  const handleCompressSelected = async () => {
    if (selected.length === 0) return;
    try {
      const archiveName = await panelApi.compressFiles(server.id, directory, selected);
      notify('Archive created', archiveName, 'success');
      loadDirectory();
    } catch (err: any) {
      notify('Compression failed', err.message, 'error');
    }
  };

  const handleDecompress = async (name: string) => {
    try {
      await panelApi.decompressFile(server.id, directory, name);
      notify('Archive extracted', name, 'success');
      loadDirectory();
    } catch (err: any) {
      notify('Extraction failed', err.message, 'error');
    }
  };

  if (editingFile) {
    const lines = editingFile.content.split('\n');
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-[#171717] dark:text-white font-mono">
              {editingFile.path}
            </h1>
            <p className="text-xs text-[#777777] dark:text-zinc-400">
              {lines.length} lines · {formatBytes(editingFile.content.length)}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setEditingFile(null)}
              className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
            <button
              type="button"
              disabled={savingFile}
              onClick={handleSaveFile}
              className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingFile ? 'Saving...' : 'Save Content'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="mx-rail-track rounded-2xl overflow-hidden">
            <div className="px-4 py-2 bg-[#161820] border-b border-white/[0.08] text-[11px] font-mono text-zinc-400">
              Editor Input
            </div>
            <textarea
              value={editingFile.content}
              onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
              spellCheck={false}
              className="w-full h-[460px] p-4 bg-[#0B0C10] font-mono text-xs leading-6 text-zinc-100 focus:outline-none resize-none"
            />
          </div>

          <div className="mx-rail-track rounded-2xl overflow-hidden">
            <div className="px-4 py-2 bg-[#161820] border-b border-white/[0.08] text-[11px] font-mono text-zinc-400">
              Syntax Highlighted View
            </div>
            <div className="h-[460px] overflow-auto p-4 bg-[#0B0C10] font-mono text-xs leading-6 text-zinc-200">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-4">
                  <span className="w-7 text-right text-zinc-600 select-none shrink-0 tabular-nums">
                    {i + 1}
                  </span>
                  <pre className="whitespace-pre-wrap break-all">
                    {highlightCodeLine(line, editingFile.name)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-5"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleUploadFileList(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-white">
            File Manager
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            {server.name} · Drag and drop files anywhere here to upload
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUploadFileList(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setCreatingFolder(true)}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New Folder
          </button>
          <button
            type="button"
            onClick={() => setCreatingFile(true)}
            className="mx-btn-3d inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            New File
          </button>
        </div>
      </div>

      {/* Breadcrumbs + Search + Bulk Actions */}
      <div className="mx-card-3d flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl">
        <div className="flex items-center gap-1 text-xs font-mono overflow-x-auto">
          <button
            type="button"
            onClick={() => setDirectory('/')}
            className="mx-btn-3d px-2.5 py-1 rounded-lg cursor-pointer"
          >
            /container
          </button>
          {breadcrumbs.map((b) => (
            <React.Fragment key={b.path}>
              <ChevronRight className="w-3.5 h-3.5 text-[#777777] shrink-0" />
              <button
                type="button"
                onClick={() => setDirectory(b.path)}
                className="mx-btn-3d px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap"
              >
                {b.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selected.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleCompressSelected}
                className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#0891B2] dark:text-[#06B6D4] cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive ({selected.length})
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSelected(selected)}
                className="mx-btn-3d-danger inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selected.length})
              </button>
            </>
          )}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-[#777777] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter files..."
              className="mx-input-3d w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
            />
          </div>
        </div>
      </div>

      {creatingFolder && (
        <form onSubmit={handleCreateFolder} className="mx-card-3d flex items-center gap-2 p-3 rounded-xl">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            autoFocus
            className="mx-input-3d flex-1 px-3 py-1.5 text-xs rounded-lg"
          />
          <button type="submit" className="mx-btn-3d-primary px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer">
            Create
          </button>
          <button type="button" onClick={() => setCreatingFolder(false)} className="mx-btn-3d px-3 py-1.5 rounded-lg text-xs cursor-pointer">
            Cancel
          </button>
        </form>
      )}

      {creatingFile && (
        <form onSubmit={handleCreateNewFile} className="mx-card-3d flex items-center gap-2 p-3 rounded-xl">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="File name (e.g. config.yml)"
            autoFocus
            className="mx-input-3d flex-1 px-3 py-1.5 text-xs rounded-lg"
          />
          <button type="submit" className="mx-btn-3d-primary px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer">
            Create & Edit
          </button>
          <button type="button" onClick={() => setCreatingFile(false)} className="mx-btn-3d px-3 py-1.5 rounded-lg text-xs cursor-pointer">
            Cancel
          </button>
        </form>
      )}

      {renamingTarget && (
        <form onSubmit={handleRename} className="mx-card-3d flex items-center gap-2 p-3 rounded-xl">
          <span className="text-xs text-[#777777]">Rename {renamingTarget.oldName}:</span>
          <input
            type="text"
            value={renamingTarget.nextName}
            onChange={(e) => setRenamingTarget({ ...renamingTarget, nextName: e.target.value })}
            autoFocus
            className="mx-input-3d flex-1 px-3 py-1.5 text-xs rounded-lg"
          />
          <button type="submit" className="mx-btn-3d-primary px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer">
            Apply
          </button>
          <button type="button" onClick={() => setRenamingTarget(null)} className="mx-btn-3d px-3 py-1.5 rounded-lg text-xs cursor-pointer">
            Cancel
          </button>
        </form>
      )}

      <div
        className={`mx-card-3d rounded-2xl overflow-x-auto ${
          dragging ? 'ring-2 ring-[#8B5CF6]' : ''
        }`}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] font-medium text-[#777777] dark:text-zinc-400">
              <th className="py-3 px-4 w-8">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={visibleFiles.length > 0 && selected.length === visibleFiles.length}
                  onChange={(e) =>
                    setSelected(e.target.checked ? visibleFiles.map((f) => f.name) : [])
                  }
                  className="accent-[#8B5CF6]"
                />
              </th>
              <th className="py-3 px-2">Name</th>
              <th className="py-3 px-3 text-right">Size</th>
              <th className="py-3 px-3 text-right">Modified</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05] text-xs">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#777777]">
                  Loading directory...
                </td>
              </tr>
            ) : visibleFiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[#777777] dark:text-zinc-400">
                  This directory is empty. Drop files here or create a new folder.
                </td>
              </tr>
            ) : (
              visibleFiles.map((entry) => {
                const isZip = /\.(zip|tar\.gz|gz)$/i.test(entry.name);
                return (
                  <tr
                    key={entry.path}
                    className="hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <input
                        type="checkbox"
                        checked={selected.includes(entry.name)}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked ? [...prev, entry.name] : prev.filter((x) => x !== entry.name)
                          )
                        }
                        className="accent-[#8B5CF6]"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <button
                        type="button"
                        onClick={() => openEntry(entry)}
                        className="flex items-center gap-2.5 text-left font-medium text-[#171717] dark:text-zinc-100 hover:text-[#8B5CF6] cursor-pointer"
                      >
                        {getFileIcon(entry)}
                        <span>{entry.name}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right font-display font-medium tabular-nums text-[#777777] dark:text-zinc-400">
                      {entry.isDirectory ? '—' : formatBytes(entry.size)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium tabular-nums text-[#777777] dark:text-zinc-400">
                      {formatRelativeTime(entry.modifiedAt)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {isZip && (
                          <button
                            type="button"
                            title="Extract archive"
                            onClick={() => handleDecompress(entry.name)}
                            className="mx-btn-3d p-1.5 rounded-lg text-[#06B6D4] cursor-pointer"
                          >
                            <PackageOpen className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!entry.isDirectory && (
                          <button
                            type="button"
                            onClick={() => handleDownload(entry)}
                            title="Download"
                            className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Rename"
                          onClick={() => setRenamingTarget({ oldName: entry.name, nextName: entry.name })}
                          className="mx-btn-3d p-1.5 rounded-lg cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => handleDeleteSelected([entry.name])}
                          className="mx-btn-3d p-1.5 rounded-lg text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
