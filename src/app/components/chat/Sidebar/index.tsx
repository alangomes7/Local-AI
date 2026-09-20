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
export function Sidebar() {
  const {
    messages,
    conversations,
    activeChatId,
    showMobileSidebar,
    setShowMobileSidebar,
    searchQuery,
    setSearchQuery,
    sidebarView,
    setSidebarView,
    setConversationToDelete,
    setConversationToPermanentlyDelete,
    handleNewChat,
    handleSelectConversation,
    activeConversations,
    handleRestore,
    trashConversations,
  } = useChatContext();

  return (
    <>
      {/* MOBILE SIDEBAR BACKDROP */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setShowMobileSidebar(false)}
          aria-hidden="true"
        />
      )}

      {/* LEFT SIDEBAR (CHAT HISTORY) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-64 sm:w-72 lg:w-64 xl:w-72 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0 transition-transform duration-200 ease-in-out ${
          showMobileSidebar
            ? 'translate-x-0 shadow-2xl'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* TOP BAR / NEW CHAT BUTTON */}
        <div className="p-3 border-b border-neutral-800 flex items-center justify-between gap-2">
          {sidebarView === 'trash' ? (
            <div className="flex-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSidebarView('chats')}
                className="flex items-center gap-2 text-xs font-semibold text-neutral-200 hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4 text-sky-400" />
                <span>Trash</span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarView('chats')}
                className="text-[11px] text-sky-400 hover:underline"
              >
                Back to chats
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleNewChat}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Chat</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowMobileSidebar(false)}
            className="lg:hidden p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SEARCH INPUT (ACTIVE CHATS ONLY) */}
        {sidebarView === 'chats' && (
          <div className="p-2 border-b border-neutral-800">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search chats..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-neutral-400 hover:text-neutral-200 p-0.5 rounded"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* CONVERSATIONS LIST */}
        {sidebarView === 'trash' ? (
          /* TRASH VIEW */
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <span>Deleted Chats</span>
              <span className="text-[10px] text-neutral-500">
                {trashConversations.length}{' '}
                {trashConversations.length === 1 ? 'chat' : 'chats'}
              </span>
            </div>

            {trashConversations.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-xs">
                <Trash2 className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p>Trash is empty</p>
              </div>
            ) : (
              trashConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 flex flex-col gap-2 group hover:border-neutral-700 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span
                      className="truncate flex-1 text-xs text-neutral-300 font-medium"
                      title={conv.title}
                    >
                      {conv.title || 'Untitled Chat'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-800/60">
                    <button
                      type="button"
                      onClick={() => handleRestore(conv.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-sky-400 rounded text-[11px] font-medium transition"
                      title="Restore conversation"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConversationToPermanentlyDelete(conv)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-900/30 text-red-400 rounded text-[11px] font-medium transition"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete Permanently</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* ACTIVE CHATS VIEW */
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              {searchQuery.trim() ? 'Search Results' : 'Chats'}
            </div>

            {activeConversations.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-xs">
                <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p>
                  {searchQuery.trim()
                    ? 'No matching conversations'
                    : 'No active chats'}
                </p>
              </div>
            ) : (
              activeConversations.map((conv) => {
                const isActive = conv.id === activeChatId;

                return (
                  <div
                    key={conv.id}
                    className={`w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition group ${
                      isActive
                        ? 'bg-neutral-800 text-sky-400 font-medium'
                        : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-neutral-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectConversation(conv)}
                      className="flex-1 flex items-center gap-2.5 min-w-0 text-left py-1.5"
                      title={conv.title}
                    >
                      <MessageSquare
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive
                            ? 'text-sky-400'
                            : 'text-neutral-500 group-hover:text-neutral-300'
                        }`}
                      />
                      <span className="truncate flex-1">
                        {conv.title || 'Untitled Chat'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        const targetConv =
                          conv.id === activeChatId && messages.length > 0
                            ? { ...conv, messages }
                            : conv;
                        downloadConversationAsMarkdown(targetConv);
                      }}
                      className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 p-1.5 rounded text-neutral-500 hover:text-sky-400 hover:bg-neutral-700/50 transition shrink-0"
                      title="Export as Markdown"
                      aria-label="Export as Markdown"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setConversationToDelete(conv);
                      }}
                      className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-700/50 transition shrink-0"
                      title="Delete conversation"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SIDEBAR FOOTER: TRASH TOGGLE */}
        <div className="p-2 border-t border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setSidebarView((prev) => (prev === 'trash' ? 'chats' : 'trash'));
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
              sidebarView === 'trash'
                ? 'bg-neutral-800 text-sky-400'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title={sidebarView === 'trash' ? 'Back to Chats' : 'Open Trash'}
          >
            <div className="flex items-center gap-2">
              {sidebarView === 'trash' ? (
                <>
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Chats</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 text-neutral-500" />
                  <span>Trash</span>
                </>
              )}
            </div>

            {sidebarView !== 'trash' && trashConversations.length > 0 && (
              <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-full border border-neutral-700 font-mono">
                {trashConversations.length}
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
