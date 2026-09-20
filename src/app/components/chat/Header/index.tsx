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
  isVoiceOrToolModel,
  hasThinkTags,
  parseThinkContent,
  preprocessCodeBlocks,
  preprocessWhatsApp,
  exportChatToMarkdown,
  sanitizeFilename,
  downloadConversationAsMarkdown,
} from '../../../../utils/chat';
import { useChatContext } from '../../../../contexts/ChatContext';
export function Header() {
  const {
    serverUrl,
    setServerUrl,
    serverStatus,
    isConnecting,
    lastServerError,
    models,
    selectedModel,
    setSelectedModel,
    loadingModels,
    modelStatus,
    loadedModels,
    showLoadedPanel,
    setShowLoadedPanel,
    sortedModels,
    totalLoadedMemory,
    memoryOverview,
    messages,
    loading,
    logs,
    showLogs,
    setShowLogs,
    conversations,
    activeChatId,
    showMobileSidebar,
    setShowMobileSidebar,
    fetchRam,
    fetchLoadedModels,
    connectToServer,
    handleLoadModel,
    handleUnloadModel,
  } = useChatContext();

  return (
    <>
      {/* ======================================================
          HEADER
      ======================================================= */}

      <header className="py-2.5 px-3 lg:py-0 h-auto shrink-0 border-b border-neutral-800 lg:px-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between bg-neutral-900 gap-2.5 lg:gap-0">
        <div className="flex items-center justify-between lg:justify-start gap-2 lg:gap-4 font-semibold tracking-wide w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMobileSidebar((prev) => !prev)}
              className="lg:hidden p-1.5 -ml-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition"
              title={showMobileSidebar ? 'Close sidebar' : 'Open sidebar'}
              aria-label="Toggle chat history sidebar"
            >
              {showMobileSidebar ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            <Bot className="w-5 h-5 text-sky-400" />

            <span className="text-sm lg:text-base">Transformers AI Chat</span>
          </div>

          {(activeChatId || messages.length > 0) && (
            <button
              type="button"
              onClick={() => {
                const activeConv = conversations.find(
                  (conv) => conv.id === activeChatId,
                );
                const convToExport: Conversation = activeConv
                  ? { ...activeConv, messages }
                  : {
                      id: activeChatId || 'current',
                      title: messages[0]?.content
                        ? messages[0].content.slice(0, 30)
                        : 'Current Conversation',
                      messages,
                      updatedAt: Date.now(),
                      status: 'active',
                    };
                downloadConversationAsMarkdown(convToExport);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-xs text-neutral-200 rounded-md transition shrink-0"
              title="Export as Markdown"
              aria-label="Export as Markdown"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export as Markdown</span>
              <span className="sm:hidden">Export</span>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:gap-3 w-full lg:w-auto">
          {/* MODEL CONTROLS */}

          <div className="flex items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              disabled={loadingModels || loading}
              className="flex-1 lg:flex-none bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-sky-500 min-w-0 max-w-full lg:max-w-[200px] truncate"
            >
              {loadingModels ? (
                <option value="">Loading...</option>
              ) : sortedModels.filter((m) => !isVoiceOrToolModel(m)).length ===
                0 ? (
                <option value="">No models found</option>
              ) : (
                sortedModels
                  .filter((m) => !isVoiceOrToolModel(m))
                  .map((model) => {
                    const baseModel = model.split('@')[0];
                    const loadedInfo = loadedModels.find(
                      (m) => m.loaded && m.id.split('@')[0] === baseModel,
                    );
                    const mem = loadedInfo
                      ? formatModelMemory(loadedInfo)
                      : null;
                    const suffix =
                      mem && mem !== '0 MB'
                        ? ` (${mem})`
                        : loadedInfo
                          ? ' (Loaded)'
                          : '';

                    return (
                      <option key={model} value={model}>
                        {model}
                        {suffix}
                      </option>
                    );
                  })
              )}
            </select>

            <button
              type="button"
              onClick={handleLoadModel}
              disabled={modelStatus !== 'unloaded' || !selectedModel || loading}
              className="shrink-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-xs text-neutral-200 rounded-md transition disabled:opacity-50"
            >
              {modelStatus === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Load
            </button>

            <button
              type="button"
              onClick={() => {
                const selectedBase = selectedModel.split('@')[0];

                const target =
                  loadedModels.find(
                    (model) =>
                      model.loaded && model.id.split('@')[0] === selectedBase,
                  )?.id ?? selectedModel;

                handleUnloadModel(target);
              }}
              disabled={modelStatus !== 'loaded' || !selectedModel || loading}
              className="shrink-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-red-900/30 border border-red-900/50 hover:bg-red-900/50 text-xs text-red-400 rounded-md transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Unload
            </button>
          </div>

          {/* SERVER CONTROLS */}

          <div className="flex items-center justify-between lg:justify-start gap-1.5 sm:gap-2 border-t sm:border-t-0 lg:border-l border-neutral-800 pt-2 sm:pt-0 lg:pl-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => connectToServer(true)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded transition cursor-pointer shrink-0 border ${
                serverStatus === 'online'
                  ? 'bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700/80'
                  : serverStatus === 'offline'
                    ? 'bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700/80'
                    : 'bg-yellow-500/10 border-yellow-400/60 animate-button-shutter'
              }`}
              title={
                serverStatus === 'online'
                  ? 'Server Online · Click to test/refresh connection'
                  : serverStatus === 'offline'
                    ? `Server Offline: ${lastServerError || 'Unreachable'} · Click to connect`
                    : 'Attempting connection to inference completions server...'
              }
              aria-label="Server status"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  serverStatus === 'online'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : serverStatus === 'offline'
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                      : 'bg-yellow-400 animate-shutter'
                }`}
              />
              <Server
                className={`w-3.5 h-3.5 ${
                  serverStatus === 'checking'
                    ? 'text-yellow-400'
                    : 'text-neutral-300'
                }`}
              />
            </button>

            <input
              type="text"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  connectToServer(true);
                }
              }}
              className="flex-1 min-w-0 lg:w-44 bg-neutral-800 border border-neutral-700 rounded p-1.5 text-xs text-neutral-100 focus:outline-none focus:border-sky-500"
              placeholder="Server URL"
            />

            <button
              type="button"
              onClick={() => connectToServer(true)}
              disabled={isConnecting}
              className={`shrink-0 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition ${
                serverStatus === 'checking' || isConnecting
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/80 animate-button-shutter cursor-wait'
                  : serverStatus === 'online'
                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-600/40 hover:bg-emerald-900/40 cursor-pointer'
                    : 'bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 cursor-pointer'
              }`}
              title={
                serverStatus === 'checking' || isConnecting
                  ? 'Attempting connection to inference completions server...'
                  : serverStatus === 'online'
                    ? 'Connected to inference server · Click to reconnect'
                    : 'Connect to inference completions server'
              }
            >
              {serverStatus === 'checking' || isConnecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-400" />
                  <span className="text-yellow-300 font-semibold">
                    Connecting...
                  </span>
                </>
              ) : serverStatus === 'online' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <PlugZap className="w-3.5 h-3.5 text-neutral-300" />
                  <span>Connect</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowLoadedPanel((value) => {
                    const next = !value;
                    if (next) {
                      fetchLoadedModels();
                      fetchRam();
                    }
                    return next;
                  });
                }}
                className={`p-1.5 rounded transition relative ${
                  showLoadedPanel ? 'text-sky-400' : 'text-neutral-400'
                }`}
                title={
                  loadedModels.length > 0
                    ? `Loaded models: ${loadedModels.length} (${totalLoadedMemory || '0 MB'}) · Available: ${memoryOverview.availableGb} GB`
                    : `Loaded models · Available: ${memoryOverview.availableGb} GB`
                }
              >
                <Layers className="w-4 h-4" />
                {loadedModels.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-sky-400 rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowLogs((value) => !value)}
                className={`p-1.5 rounded transition ${
                  showLogs ? 'text-sky-400' : 'text-neutral-400'
                }`}
                title="Server logs"
              >
                <Terminal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
