'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  Layers,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Server,
  Square,
  Terminal,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import TerminalPanel, { LogEntry, LogType } from '../../TerminalPanel';
import CodeBlock from '../../CodeBlock';

import {
  ToastNotification,
  Message,
  Conversation,
  VoiceChatState,
  LoadedModel,
  SystemMemoryStatus,
  LoadedModelsResponse,
  ModelsResponse,
} from '../../../../types/chat';
import {
  formatModelMemory,
  hasThinkTags,
  parseThinkContent,
  preprocessCodeBlocks,
  preprocessWhatsApp,
  exportChatToMarkdown,
  sanitizeFilename,
  downloadConversationAsMarkdown,
} from '../../../../utils/chat';
import { useChatContext } from '../../../../contexts/ChatContext';
export function RightSidebar() {
  const {
    models,
    loadedModels,
    showLoadedPanel,
    sortedLoadedModels,
    totalLoadedMemory,
    memoryOverview,
    loading,
    logs,
    showLogs,
    handleUnloadModel,
    handleUnloadAll,
  } = useChatContext();

  return (
    <>
      {/* ======================================================
            RIGHT SIDEBAR
        ======================================================= */}

      {(showLogs || showLoadedPanel) && (
        <div className="w-full lg:w-80 h-auto shrink-0 border-t lg:border-t-0 lg:border-l border-neutral-800 bg-neutral-900 flex flex-col max-h-[50vh] lg:max-h-full">
          {/* LOADED MODELS & MEMORY */}

          {showLoadedPanel && (
            <div className="flex flex-col bg-neutral-900 border-b border-neutral-800 max-h-[36rem] overflow-y-auto">
              <div className="p-3 border-b border-neutral-800 text-xs font-semibold text-neutral-400 uppercase flex items-center justify-between sticky top-0 bg-neutral-900/95 backdrop-blur-xs z-10">
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  Loaded Models & Memory
                </span>

                <button
                  type="button"
                  onClick={handleUnloadAll}
                  disabled={loading || loadedModels.length === 0}
                  className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Unload All
                </button>
              </div>

              {/* MEMORY USAGE BREAKDOWN WITH SECTION PERCENTAGES */}
              <div className="p-3 bg-neutral-950/80 border-b border-neutral-800 flex flex-col gap-3">
                {/* DEVICE TITLE & OVERALL USAGE */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-300 font-medium flex items-center gap-1.5 truncate">
                    <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate">
                      {memoryOverview.deviceLabel}
                    </span>
                  </span>
                  <span className="font-mono text-neutral-300 font-semibold text-[11px] shrink-0">
                    {memoryOverview.usedPercent}% used
                  </span>
                </div>

                {/* MULTI-SEGMENTED PROGRESS BAR */}
                <div className="flex flex-col gap-1">
                  <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden flex p-0.5">
                    {/* Models segment */}
                    {Number(memoryOverview.modelPercent) > 0 && (
                      <div
                        className="h-full bg-sky-400 rounded-l-full transition-all"
                        style={{ width: `${memoryOverview.modelPercent}%` }}
                        title={`AI Models: ${totalLoadedMemory || '0 MB'} (${memoryOverview.modelPercent}%)`}
                      />
                    )}
                    {/* System / other processes segment */}
                    <div
                      className={`h-full bg-amber-500/80 transition-all ${
                        Number(memoryOverview.modelPercent) === 0
                          ? 'rounded-l-full'
                          : ''
                      }`}
                      style={{
                        width: `${memoryOverview.otherUsedPercent}%`,
                      }}
                      title={`System & Apps: ${memoryOverview.otherUsedGb} GB (${memoryOverview.otherUsedPercent}%)`}
                    />
                    {/* Available segment */}
                    <div
                      className="h-full bg-emerald-500/20 rounded-r-full transition-all"
                      style={{
                        width: `${memoryOverview.availablePercent}%`,
                      }}
                      title={`Available: ${memoryOverview.availableGb} GB (${memoryOverview.availablePercent}%)`}
                    />
                  </div>
                </div>

                {/* 4-SECTION CARDS WITH EXACT PERCENTAGE OF EACH SECTION */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* 1. MODELS USED */}
                  <div className="bg-neutral-900/90 border border-sky-900/40 rounded-lg p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-sky-400 uppercase tracking-wider font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        AI Models
                      </span>
                      <span className="font-mono text-[11px] text-sky-300 font-semibold">
                        {memoryOverview.modelPercent}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-sm font-mono font-bold text-neutral-100">
                        {totalLoadedMemory || '0 MB'}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        of total
                      </span>
                    </div>
                  </div>

                  {/* 2. SYSTEM & APPS */}
                  <div className="bg-neutral-900/90 border border-amber-900/40 rounded-lg p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-amber-400 uppercase tracking-wider font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        System & Apps
                      </span>
                      <span className="font-mono text-[11px] text-amber-300 font-semibold">
                        {memoryOverview.otherUsedPercent}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-sm font-mono font-bold text-neutral-100">
                        {memoryOverview.otherUsedGb} GB
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        of total
                      </span>
                    </div>
                  </div>

                  {/* 3. AVAILABLE HEADROOM */}
                  <div className="bg-neutral-900/90 border border-emerald-900/40 rounded-lg p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Available
                      </span>
                      <span className="font-mono text-[11px] text-emerald-300 font-semibold">
                        {memoryOverview.availablePercent}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-sm font-mono font-bold text-emerald-400">
                        {memoryOverview.availableGb} GB
                      </span>
                      <span className="text-[10px] text-neutral-500">free</span>
                    </div>
                  </div>

                  {/* 4. TOTAL CAPACITY */}
                  <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                        Total Capacity
                      </span>
                      <span className="font-mono text-[11px] text-neutral-400 font-semibold">
                        100%
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-sm font-mono font-bold text-neutral-200">
                        {memoryOverview.totalGb} GB
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        installed
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECONDARY DEVICE BREAKDOWN (e.g. GPU VRAM if primary is RAM) */}
                {memoryOverview.gpu && !memoryOverview.isGpu && (
                  <div className="pt-2 border-t border-neutral-800/80 flex flex-col gap-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-neutral-400">
                      <span className="truncate font-medium">
                        GPU VRAM ({memoryOverview.gpu.device_name || 'CUDA'})
                      </span>
                      <span className="font-mono text-sky-400 font-semibold">
                        {memoryOverview.gpu.percentage}% used
                      </span>
                    </div>
                    <div className="flex justify-between font-mono text-[10px] text-neutral-400">
                      <span>
                        Used: {memoryOverview.gpu.used_human} (
                        {memoryOverview.gpu.percentage}%)
                      </span>
                      <span className="text-emerald-400">
                        Free: {memoryOverview.gpu.available_human}
                      </span>
                      <span>Total: {memoryOverview.gpu.total_human}</span>
                    </div>
                  </div>
                )}

                {memoryOverview.systemRam && memoryOverview.isGpu && (
                  <div className="pt-2 border-t border-neutral-800/80 flex flex-col gap-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-neutral-400">
                      <span className="truncate font-medium">
                        Host System RAM
                      </span>
                      <span className="font-mono text-neutral-300 font-semibold">
                        {memoryOverview.systemRam.percentage}% used
                      </span>
                    </div>
                    <div className="flex justify-between font-mono text-[10px] text-neutral-400">
                      <span>
                        Used: {memoryOverview.systemRam.used_human} (
                        {memoryOverview.systemRam.percentage}%)
                      </span>
                      <span className="text-emerald-400">
                        Free: {memoryOverview.systemRam.available_human}
                      </span>
                      <span>Total: {memoryOverview.systemRam.total_human}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* INDIVIDUAL LOADED MODELS LIST */}
              <div className="p-2 space-y-2">
                <div className="px-1 pt-1 pb-0.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Loaded Models ({loadedModels.length})</span>
                  {loadedModels.length > 0 && (
                    <span className="font-mono text-sky-400 font-normal">
                      {totalLoadedMemory} total
                    </span>
                  )}
                </div>

                {sortedLoadedModels.length === 0 ? (
                  <div className="text-xs text-neutral-600 text-center py-4 bg-neutral-950/40 rounded-lg border border-neutral-800/60">
                    No models loaded.
                  </div>
                ) : (
                  sortedLoadedModels.map((model) => {
                    const mem = formatModelMemory(model);
                    const displayName = model.id.split('/').pop() || model.id;

                    const modelBytes =
                      model.memory_bytes ||
                      (model.memory_mb
                        ? Math.round(model.memory_mb * 1024 * 1024)
                        : 0);

                    const modelPercentOfTotal =
                      memoryOverview.totalBytes > 0 && modelBytes > 0
                        ? (
                            (modelBytes / memoryOverview.totalBytes) *
                            100
                          ).toFixed(1)
                        : null;

                    return (
                      <div
                        key={model.id}
                        className="flex items-center justify-between p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg gap-2 hover:border-neutral-700 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span
                              className="text-xs font-medium text-neutral-200 truncate"
                              title={model.id}
                            >
                              {displayName}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] font-mono">
                            <span className="text-sky-300 bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.5 rounded">
                              {mem !== '0 MB' ? mem : 'Loaded'}
                            </span>
                            {modelPercentOfTotal && (
                              <span className="text-neutral-400 bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">
                                {modelPercentOfTotal}% of total
                              </span>
                            )}
                            {model.processor_loaded && (
                              <span className="text-neutral-500 px-1 py-0.5">
                                + tokenizer
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnloadModel(model.id)}
                          disabled={loading}
                          className="text-neutral-500 hover:text-red-400 p-1.5 hover:bg-neutral-900 rounded transition disabled:opacity-40 shrink-0"
                          title={`Unload ${displayName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* LOGS */}

          {showLogs && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-[12rem]">
              <div className="p-3 border-b border-neutral-800 text-xs font-semibold text-neutral-400 uppercase">
                Server Logs
              </div>

              <div className="flex-1 overflow-hidden flex flex-col p-3">
                <TerminalPanel logs={logs} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
