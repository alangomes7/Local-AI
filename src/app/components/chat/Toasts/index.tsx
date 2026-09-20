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
export function Toasts() {
  const { toasts, dismissToast } = useChatContext();

  return (
    <>
      {/* ======================================================
          TOAST NOTIFICATION CONTAINER
      ======================================================= */}
      <div
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm sm:max-w-md w-full pointer-events-none px-3"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';
          const isSuccess = toast.type === 'success';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-top-2 duration-200 ${
                isError
                  ? 'bg-red-950/95 border-red-800 text-red-100'
                  : isWarning
                    ? 'bg-amber-950/95 border-amber-800 text-amber-100'
                    : isSuccess
                      ? 'bg-emerald-950/95 border-emerald-800 text-emerald-100'
                      : 'bg-neutral-900/95 border-neutral-700 text-neutral-100'
              }`}
              role="alert"
            >
              <div className="shrink-0 mt-0.5">
                {isError && <AlertCircle className="w-5 h-5 text-red-400" />}
                {isWarning && (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
                {isSuccess && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
                {!isError && !isWarning && !isSuccess && (
                  <Info className="w-5 h-5 text-sky-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold leading-tight">
                  {toast.title}
                </h4>
                <p className="text-xs opacity-90 mt-1 leading-normal break-words whitespace-pre-wrap">
                  {toast.message}
                </p>
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismissToast(toast.id);
                    }}
                    className="mt-2 text-xs font-medium underline underline-offset-2 hover:opacity-80 transition cursor-pointer text-sky-300 block"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 p-1 text-neutral-400 hover:text-white rounded transition cursor-pointer"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
