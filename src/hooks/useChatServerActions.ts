'use client';

import { useCallback, useEffect, useMemo } from 'react';
import type { LoadedModelsResponse, ModelsResponse } from '../types/chat';
import { isVoiceOrToolModel } from '../utils/chat';
import type { AddLog, ShowToast, Store } from './chatHookTypes';

export function useChatServerActions(
  store: Store,
  showToast: ShowToast,
  addLog: AddLog,
  connectToServerRef: React.MutableRefObject<
    (isManual?: boolean) => Promise<void>
  >,
) {
  const {
    serverUrl,
    selectedModel,
    activeChatModel,
    models,
    isConnecting,
    showLoadedPanel,
    loadedModels,
    loading,
    systemMemory,
    ramStats,
    setServerStatus,
    setLastServerError,
    setModels,
    setSelectedModel,
    setLoadingModels,
    setLoadedModels,
    setModelStatus,
    setSystemMemory,
    setRamStats,
    setShowLoadedPanel,
    setActiveChatModel,
    setShowLogs,
    setIsConnecting,
  } = store;

  const fetchRam = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/system/ram?serverUrl=${encodeURIComponent(serverUrl)}`,
        { cache: 'no-store' },
      );
      if (!response.ok) return;
      const data = (await response.json()) as Record<string, unknown>;
      const total = String(data.total ?? '0');
      const used = String(data.used ?? '0');
      const available = String(
        data.available ?? Math.max(Number(total) - Number(used), 0).toFixed(2),
      );
      const percentage = String(data.percentage ?? '0');
      setRamStats({
        used,
        total,
        available,
        percentage,
        availablePercentage: String(
          data.availablePercentage ?? (100 - Number(percentage)).toFixed(1),
        ),
      });
      if (data.system_ram || data.gpu)
        setSystemMemory(
          data as typeof systemMemory extends infer T ? T : never,
        );
    } catch {
      /* Passive metrics are best effort. */
    }
  }, [serverUrl, setRamStats, setSystemMemory]);

  const fetchLoadedModels = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/models/loaded?serverUrl=${encodeURIComponent(serverUrl)}`,
        { cache: 'no-store' },
      );
      if (!response.ok) {
        setServerStatus('offline');
        setLoadedModels([]);
        setModelStatus('unloaded');
        setLastServerError('Inference server offline or unreachable');
        return;
      }
      const data = (await response.json()) as LoadedModelsResponse;
      const loaded = Array.isArray(data.data) ? data.data : [];
      setLoadedModels(loaded);
      setServerStatus('online');
      setLastServerError(null);
      if (data.memory_status) {
        setSystemMemory(data.memory_status);
        const memory = data.memory_status.system_ram;
        if (memory)
          setRamStats((previous) => ({
            ...previous,
            used: memory.used_bytes
              ? (memory.used_bytes / 1024 ** 3).toFixed(2)
              : previous.used,
            total: memory.total_bytes
              ? (memory.total_bytes / 1024 ** 3).toFixed(2)
              : previous.total,
            available: memory.available_bytes
              ? (memory.available_bytes / 1024 ** 3).toFixed(2)
              : previous.available,
            percentage: String(memory.percentage ?? previous.percentage),
            availablePercentage:
              memory.total_bytes && memory.available_bytes
                ? ((memory.available_bytes / memory.total_bytes) * 100).toFixed(
                    1,
                  )
                : previous.availablePercentage,
          }));
      }
      if (selectedModel) {
        const base = selectedModel.split('@')[0];
        setModelStatus(
          loaded.some(
            (model) => model.loaded && model.id.split('@')[0] === base,
          )
            ? 'loaded'
            : 'unloaded',
        );
      }
    } catch (error) {
      setServerStatus('offline');
      setLoadedModels([]);
      setModelStatus('unloaded');
      setLastServerError(
        error instanceof Error
          ? error.message
          : 'Inference server offline or unreachable',
      );
    }
  }, [
    serverUrl,
    selectedModel,
    setLastServerError,
    setLoadedModels,
    setModelStatus,
    setRamStats,
    setServerStatus,
    setSystemMemory,
  ]);

  const loadModels = useCallback(
    async (isManual = false) => {
      try {
        setLoadingModels(true);
        setServerStatus('checking');
        const response = await fetch(
          `/api/models?serverUrl=${encodeURIComponent(serverUrl)}`,
          { cache: 'no-store' },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as ModelsResponse;
        const ids = (
          data.data
            ?.map((model) => model.id)
            .filter((id): id is string => Boolean(id)) ?? []
        ).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
        );
        setModels(ids);
        setServerStatus('online');
        setLastServerError(null);
        setSelectedModel((current) =>
          current && ids.includes(current) ? current : ids[0] || '',
        );
        if (isManual)
          showToast({
            type: 'success',
            title: 'Server Connected',
            message: `Discovered ${ids.length} available model${ids.length === 1 ? '' : 's'}.`,
          });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        setServerStatus('offline');
        setLastServerError(message);
        setModels([]);
        setSelectedModel('');
        addLog(`Model Discovery Error: ${message}`, 'error');
        showToast({
          type: 'error',
          title: 'Server Connection Error',
          message: `Cannot reach inference server at ${serverUrl}: ${message}`,
          action: {
            label: 'Retry',
            onClick: () => connectToServerRef.current(true),
          },
        });
      } finally {
        setLoadingModels(false);
      }
    },
    [
      serverUrl,
      addLog,
      connectToServerRef,
      setLastServerError,
      setLoadingModels,
      setModels,
      setSelectedModel,
      setServerStatus,
      showToast,
    ],
  );

  const connectToServer = useCallback(
    async (isManual = false) => {
      setIsConnecting(true);
      setServerStatus('checking');
      if (isManual)
        addLog(
          `Attempting connection to inference completions server at ${serverUrl}...`,
        );
      await Promise.allSettled([
        loadModels(isManual),
        fetchLoadedModels(),
        fetchRam(),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);
      setIsConnecting(false);
    },
    [
      addLog,
      fetchLoadedModels,
      fetchRam,
      loadModels,
      serverUrl,
      setServerStatus,
      setIsConnecting,
    ],
  );

  useEffect(() => {
    connectToServerRef.current = connectToServer;
  }, [connectToServer, connectToServerRef]);
  useEffect(() => {
    void connectToServer(false);
  }, [connectToServer]);
  useEffect(() => {
    const id = setInterval(() => {
      if (!isConnecting) {
        void fetchLoadedModels();
        void fetchRam();
      }
    }, 2500);
    return () => clearInterval(id);
  }, [fetchLoadedModels, fetchRam, isConnecting]);
  useEffect(() => {
    if (showLoadedPanel) {
      void fetchLoadedModels();
      void fetchRam();
    }
  }, [fetchLoadedModels, fetchRam, showLoadedPanel]);
  useEffect(() => {
    const loaded = loadedModels.filter((model) => model.loaded);
    if (!loaded.length) {
      setActiveChatModel('');
      return;
    }
    if (loaded.some((model) => model.id === activeChatModel)) return;
    const base = selectedModel.split('@')[0];
    setActiveChatModel(
      loaded.find((model) => model.id.split('@')[0] === base)?.id ??
        loaded[0].id,
    );
  }, [activeChatModel, loadedModels, selectedModel, setActiveChatModel]);
  const runModelAction = useCallback(
    async (endpoint: string, model?: string) => {
      const body = model ? { model, serverUrl } : { serverUrl };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchLoadedModels();
      await fetchRam();
    },
    [fetchLoadedModels, fetchRam, serverUrl],
  );

  const handleLoadModel = useCallback(async () => {
    if (!selectedModel || loading) return;

    const selectedBase = selectedModel.split('@')[0];
    const alreadyLoaded = loadedModels.find(
      (model) => model.loaded && model.id.split('@')[0] === selectedBase,
    );

    if (alreadyLoaded) {
      setModelStatus('loaded');
      setActiveChatModel(alreadyLoaded.id);
      setShowLoadedPanel(true);
      showToast({
        type: 'info',
        title: 'Model Already Loaded',
        message: `${alreadyLoaded.id} is ready for chat.`,
      });
      return;
    }

    setModelStatus('loading');
    addLog(`Loading ${selectedModel}...`);
    try {
      await runModelAction('/api/models/load', selectedModel);
      setShowLoadedPanel(true);
      setModelStatus('loaded');
      addLog(`${selectedModel} loaded.`, 'success');
      showToast({
        type: 'success',
        title: 'Model Loaded',
        message: `${selectedModel} is loaded and ready for chat.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setModelStatus('unloaded');
      addLog(`Load Error: ${message}`, 'error');
      showToast({
        type: 'error',
        title: `Failed to Load ${selectedModel}`,
        message,
        action: { label: 'View Logs', onClick: () => setShowLogs(true) },
      });
    }
  }, [
    addLog,
    loadedModels,
    loading,
    runModelAction,
    selectedModel,
    setActiveChatModel,
    setModelStatus,
    setShowLoadedPanel,
    setShowLogs,
    showToast,
  ]);

  const handleUnloadModel = useCallback(
    async (modelId: string) => {
      if (!modelId) return;
      addLog(`Unloading ${modelId}...`);
      try {
        await runModelAction('/api/models/unload', modelId);
        if (modelId.split('@')[0] === selectedModel.split('@')[0])
          setModelStatus('unloaded');
        if (modelId === activeChatModel) setActiveChatModel('');
        addLog(`${modelId} unloaded.`, 'success');
        showToast({
          type: 'info',
          title: 'Model Unloaded',
          message: `Successfully unloaded ${modelId}.`,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        addLog(`Unload Error: ${message}`, 'error');
        showToast({
          type: 'error',
          title: `Failed to Unload ${modelId}`,
          message,
          action: { label: 'View Logs', onClick: () => setShowLogs(true) },
        });
      }
    },
    [
      activeChatModel,
      addLog,
      runModelAction,
      selectedModel,
      setActiveChatModel,
      setModelStatus,
      setShowLogs,
      showToast,
    ],
  );

  const handleUnloadAll = useCallback(async () => {
    addLog('Unloading all models...');
    try {
      await runModelAction('/api/models/unload-all');
      setLoadedModels([]);
      setActiveChatModel('');
      setModelStatus('unloaded');
      addLog('All models unloaded.', 'success');
      showToast({
        type: 'info',
        title: 'Models Unloaded',
        message: 'All models have been unloaded from memory.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Unload All Error: ${message}`, 'error');
      showToast({
        type: 'error',
        title: 'Failed to Unload Models',
        message,
        action: { label: 'View Logs', onClick: () => setShowLogs(true) },
      });
    }
  }, [
    addLog,
    runModelAction,
    setActiveChatModel,
    setLoadedModels,
    setModelStatus,
    setShowLogs,
    showToast,
  ]);

  const sortedModels = useMemo(
    () =>
      [...models].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    [models],
  );
  const sortedLoadedModels = useMemo(
    () =>
      [...loadedModels].sort((a, b) =>
        a.id.localeCompare(b.id, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      ),
    [loadedModels],
  );
  const totalLoadedBytes = useMemo(
    () =>
      loadedModels.reduce(
        (sum, model) =>
          sum +
          (model.memory_bytes ??
            (model.memory_mb ? Math.round(model.memory_mb * 1024 * 1024) : 0)),
        0,
      ),
    [loadedModels],
  );
  const totalLoadedMemory = useMemo(
    () =>
      totalLoadedBytes
        ? totalLoadedBytes >= 1024 ** 3
          ? `${(totalLoadedBytes / 1024 ** 3).toFixed(2)} GB`
          : `${(totalLoadedBytes / 1024 ** 2).toFixed(1)} MB`
        : null,
    [totalLoadedBytes],
  );
  const memoryOverview = useMemo(() => {
    const active =
      systemMemory?.primary_device === 'gpu' && systemMemory.gpu
        ? systemMemory.gpu
        : systemMemory?.system_ram;
    const total = active?.total_bytes ?? Number(ramStats.total) * 1024 ** 3;
    const used = active?.used_bytes ?? Number(ramStats.used) * 1024 ** 3;
    const available =
      active?.available_bytes ?? Number(ramStats.available) * 1024 ** 3;
    const modelsBytes = totalLoadedBytes;
    const percent = (value: number) =>
      total
        ? Math.min(Math.max((value / total) * 100, 0), 100).toFixed(1)
        : '0.0';
    return {
      totalBytes: total,
      totalGb: (total / 1024 ** 3).toFixed(2),
      usedGb: (used / 1024 ** 3).toFixed(2),
      availableGb: (available / 1024 ** 3).toFixed(2),
      modelsGb: (modelsBytes / 1024 ** 3).toFixed(2),
      otherUsedGb: (Math.max(used - modelsBytes, 0) / 1024 ** 3).toFixed(2),
      usedPercent: percent(used),
      modelPercent: percent(modelsBytes),
      otherUsedPercent: percent(Math.max(used - modelsBytes, 0)),
      availablePercent: percent(available),
      deviceLabel:
        systemMemory?.primary_device === 'gpu'
          ? `GPU VRAM (${systemMemory.gpu?.device_name || 'CUDA'})`
          : 'System Memory (RAM)',
      isGpu: systemMemory?.primary_device === 'gpu',
      gpu: systemMemory?.gpu,
      systemRam: systemMemory?.system_ram,
    };
  }, [ramStats, systemMemory, totalLoadedBytes]);

  return {
    fetchRam,
    fetchLoadedModels,
    loadModels,
    connectToServer,
    handleLoadModel,
    handleUnloadModel,
    handleUnloadAll,
    sortedModels,
    sortedLoadedModels,
    totalLoadedBytes,
    totalLoadedMemory,
    memoryOverview,
  };
}
