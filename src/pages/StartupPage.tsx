import { useCallback, useEffect, useState } from 'react';
import { Box, Check, Cpu, Lock, Save, Terminal } from 'lucide-react';
import { panelApi } from '../api/client';
import { PanelConnectionNotice } from '../components/ui/PanelConnectionNotice';
import { usePanel } from '../context/PanelContext';
import type { ServerStartupData } from '../types/panel';

export function StartupPage({ serverId }: { serverId: string }) {
  const { servers, refreshData, notify, panelConnected, connectionError } = usePanel();
  const server = servers.find((s) => s.id === serverId || s.identifier === serverId) || servers[0];

  const [startup, setStartup] = useState<ServerStartupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState('');
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);

  const loadStartup = useCallback(async () => {
    if (!server || !panelConnected) return;
    try {
      const data = await panelApi.getServerStartup(server.id);
      setStartup(data);
      const map: Record<string, string> = {};
      data.variables.forEach((v) => {
        map[v.envVariable] = v.serverValue ?? v.defaultValue ?? '';
      });
      setDraftValues(map);
      setSelectedImage(server.dockerImage || Object.values(data.dockerImages)[0] || '');
    } catch (err: any) {
      notify('Failed to load startup configuration', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [server?.id, panelConnected, notify]);

  useEffect(() => {
    loadStartup();
  }, [loadStartup]);

  if (!panelConnected && connectionError) {
    return <PanelConnectionNotice message={connectionError} />;
  }

  if (!server) return null;

  const handleSaveDockerImage = async (nextImage: string) => {
    setSelectedImage(nextImage);
    setSavingImage(true);
    try {
      await panelApi.updateDockerImage(server.id, nextImage);
      await refreshData();
      notify('Docker image updated', nextImage, 'success');
    } catch (err: any) {
      notify('Could not update Docker image', err.message, 'error');
      setSelectedImage(server.dockerImage);
    } finally {
      setSavingImage(false);
    }
  };

  const handleSaveVariable = async (envVariable: string) => {
    setSavingKey(envVariable);
    try {
      const updated = await panelApi.updateStartupVariable(server.id, envVariable, draftValues[envVariable] ?? '');
      setStartup((prev) =>
        prev
          ? {
              ...prev,
              variables: prev.variables.map((v) => (v.envVariable === envVariable ? updated : v)),
            }
          : prev
      );
      await loadStartup();
      notify('Startup variable saved', `${envVariable} updated`, 'success');
    } catch (err: any) {
      notify('Validation error', err.message, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const dockerImageEntries = Object.entries(startup?.dockerImages || {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
          Startup Configuration
        </h1>
        <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
          {server.name} · Launch invocation, Docker runtime image, and egg environment variables
        </p>
      </div>

      {loading && !startup ? (
        <div className="mx-card-3d p-8 rounded-2xl text-center text-xs text-[#777777]">Loading startup parameters...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Startup Command */}
            <div className="lg:col-span-8 mx-card-3d p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#171717] dark:text-white">
                <Terminal className="w-4 h-4 text-[#8B5CF6]" />
                Startup Command
              </div>
              <div className="mx-well-3d p-3.5 rounded-xl font-mono text-xs text-[#171717] dark:text-zinc-100 break-all leading-relaxed">
                {startup?.startupCommand || server.startupCommand || 'No startup command returned'}
              </div>
              {startup?.rawStartupCommand && startup.rawStartupCommand !== startup.startupCommand && (
                <div className="text-[11px] text-[#777777] dark:text-zinc-400">
                  Template: <span className="font-mono">{startup.rawStartupCommand}</span>
                </div>
              )}
            </div>

            {/* Docker Image */}
            <div className="lg:col-span-4 mx-card-3d p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#171717] dark:text-white">
                  <Box className="w-4 h-4 text-[#06B6D4]" />
                  Docker Image
                </div>
                {savingImage && <span className="text-[11px] text-[#06B6D4]">Saving...</span>}
              </div>

              {dockerImageEntries.length > 0 ? (
                <select
                  value={selectedImage}
                  disabled={savingImage}
                  onChange={(e) => handleSaveDockerImage(e.target.value)}
                  className="mx-input-3d w-full px-3 py-2 text-xs font-mono rounded-xl cursor-pointer"
                >
                  {dockerImageEntries.map(([label, image]) => (
                    <option key={image} value={image} className="bg-white dark:bg-[#19191F]">
                      {label} ({image})
                    </option>
                  ))}
                  {!dockerImageEntries.some(([, img]) => img === selectedImage) && selectedImage && (
                    <option value={selectedImage} className="bg-white dark:bg-[#19191F]">
                      {selectedImage}
                    </option>
                  )}
                </select>
              ) : (
                <div className="mx-well-3d px-3 py-2 rounded-xl font-mono text-xs break-all">
                  {server.dockerImage || 'Managed by host'}
                </div>
              )}
              <p className="text-[11px] text-[#777777] dark:text-zinc-400">
                Changes take effect on the next server restart.
              </p>
            </div>
          </div>

          {/* Environment Variables */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="mx-heading-3d text-sm font-bold text-[#171717] dark:text-white">
                Environment Variables
              </h2>
            </div>

            {startup && startup.variables.length === 0 ? (
              <div className="mx-card-3d p-8 rounded-2xl text-center text-xs text-[#777777]">
                No environment variables exposed for this egg.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {startup?.variables.map((v) => {
                  const currentVal = draftValues[v.envVariable] ?? '';
                  const dirty = currentVal !== (v.serverValue ?? '');
                  const isBusy = savingKey === v.envVariable;

                  return (
                    <div key={v.envVariable} className="mx-card-3d p-5 rounded-2xl flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-[#171717] dark:text-white">{v.name}</h3>
                          <span className="mx-well-3d px-2 py-0.5 rounded-lg font-mono text-[10px] text-[#8B5CF6]">
                            {v.envVariable}
                          </span>
                        </div>
                        {v.description && (
                          <p className="text-xs text-[#777777] dark:text-zinc-400 mt-1">{v.description}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            disabled={!v.isEditable || isBusy}
                            value={currentVal}
                            onChange={(e) =>
                              setDraftValues((prev) => ({ ...prev, [v.envVariable]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && v.isEditable && dirty) {
                                e.preventDefault();
                                handleSaveVariable(v.envVariable);
                              }
                            }}
                            className="mx-input-3d flex-1 px-3 py-2 text-xs font-mono rounded-xl disabled:opacity-60"
                          />
                          {v.isEditable ? (
                            <button
                              type="button"
                              disabled={!dirty || isBusy}
                              onClick={() => handleSaveVariable(v.envVariable)}
                              className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium shrink-0 cursor-pointer disabled:opacity-40 ${
                                dirty ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                              }`}
                            >
                              {dirty ? <Save className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                              {isBusy ? 'Saving' : dirty ? 'Save' : 'Saved'}
                            </button>
                          ) : (
                            <span className="mx-well-3d inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] text-[#777777] shrink-0">
                              <Lock className="w-3 h-3" />
                              Locked
                            </span>
                          )}
                        </div>
                        {v.rules && (
                          <div className="text-[11px] font-mono text-[#777777] dark:text-zinc-500">
                            Rules: {v.rules}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
