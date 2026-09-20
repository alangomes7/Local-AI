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
export function Modals() {
  const {
    conversationToDelete,
    setConversationToDelete,
    conversationToPermanentlyDelete,
    setConversationToPermanentlyDelete,
    confirmMoveToTrash,
    confirmPermanentDelete,
  } = useChatContext();

  return (
    <>
      {/* ======================================================
          CONFIRMATION MODALS
      ======================================================= */}

      {/* SOFT DELETE CONFIRMATION MODAL */}
      {conversationToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setConversationToDelete(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-100">
                Delete conversation?
              </h3>
              <button
                type="button"
                onClick={() => setConversationToDelete(null)}
                className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3">
              <p className="text-xs text-neutral-300 font-medium truncate">
                &ldquo;{conversationToDelete.title || 'Untitled Chat'}&rdquo;
              </p>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              This conversation will be moved to Trash. You can recover it
              later.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConversationToDelete(null)}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmMoveToTrash}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      {conversationToPermanentlyDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setConversationToPermanentlyDelete(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-neutral-900 border border-red-900/40 rounded-xl p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-red-400">
                Permanently delete conversation?
              </h3>
              <button
                type="button"
                onClick={() => setConversationToPermanentlyDelete(null)}
                className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3">
              <p className="text-xs text-neutral-300 font-medium truncate">
                &ldquo;
                {conversationToPermanentlyDelete.title || 'Untitled Chat'}
                &rdquo;
              </p>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              This action cannot be undone. All conversation data will be
              deleted.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConversationToPermanentlyDelete(null)}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmPermanentDelete}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
