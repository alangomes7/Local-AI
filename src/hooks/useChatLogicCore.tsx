'use client';
/* eslint-disable react-hooks/immutability, react-hooks/refs */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Components } from 'react-markdown';
import CodeBlock from '../app/components/CodeBlock';
import type { ToastNotification } from '../types/chat';
import { cleanModelResponse } from './logic/cleanModelResponse';
import { useChatStore } from '../store/chatStore';
import { useChatServerActions } from './useChatServerActions';
import { useChatHistoryActions } from './useChatHistoryActions';
import { useChatVoiceActions } from './useChatVoiceActions';
import { useChatStreamingActions } from './useChatStreamingActions';
import {
  preprocessCodeBlocks,
  preprocessWhatsApp,
  hasThinkTags,
  parseThinkContent,
} from '../utils/chat';
import type { ChatRefs } from './chatHookTypes';

export function useChatLogicCore() {
  const store = useChatStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollEnabled = useRef(true);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const refs: ChatRefs = useMemo(
    () => ({
      fileInputRef,
      abortControllerRef,
      textareaRef,
      activeChatIdRef,
      mediaRecorderRef,
      audioChunksRef,
      recordingTimerRef,
      scrollContainerRef,
      autoScrollEnabled,
      audioPlaybackRef,
    }),
    [],
  );
  const connectToServerRef = useRef<(isManual?: boolean) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const showToast = useCallback(
    (toast: Omit<ToastNotification, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      store.setToasts((previous) => [...previous, { ...toast, id }]);
      const duration = toast.duration ?? (toast.type === 'error' ? 8000 : 5000);
      if (duration > 0)
        setTimeout(
          () =>
            store.setToasts((previous) =>
              previous.filter((item) => item.id !== id),
            ),
          duration,
        );
      return id;
    },
    [store.setToasts],
  );
  const dismissToast = useCallback(
    (id: string) =>
      store.setToasts((previous) => previous.filter((item) => item.id !== id)),
    [store.setToasts],
  );
  const addLog = useCallback(
    (
      message: string,
      type: 'info' | 'success' | 'warning' | 'error' = 'info',
    ) =>
      store.setLogs((previous) => [
        ...previous,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          message,
          type,
        },
      ]),
    [store.setLogs],
  );
  const resizeTextarea = useCallback(() => {
    const textarea = refs.textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 50), 200)}px`;
    }
  }, [refs.textareaRef]);
  useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea, store.prompt]);
  const scrollToBottom = useCallback(
    (smooth = false) => {
      const container = refs.scrollContainerRef.current;
      if (!container) return;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      refs.autoScrollEnabled.current = true;
      store.setShowScrollBottom(false);
    },
    [refs, store.setShowScrollBottom],
  );
  const handleScroll = useCallback(() => {
    const container = refs.scrollContainerRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      40;
    refs.autoScrollEnabled.current = nearBottom;
    store.setShowScrollBottom(!nearBottom);
  }, [refs, store.setShowScrollBottom]);
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.deltaY < 0) {
        refs.autoScrollEnabled.current = false;
        store.setShowScrollBottom(true);
      }
    },
    [refs, store.setShowScrollBottom],
  );
  const handleTouchMove = useCallback(() => {
    const container = refs.scrollContainerRef.current;
    if (
      container &&
      container.scrollHeight - container.scrollTop - container.clientHeight > 40
    ) {
      refs.autoScrollEnabled.current = false;
      store.setShowScrollBottom(true);
    }
  }, [refs, store.setShowScrollBottom]);
  useEffect(() => {
    if (refs.autoScrollEnabled.current && refs.scrollContainerRef.current)
      refs.scrollContainerRef.current.scrollTop =
        refs.scrollContainerRef.current.scrollHeight;
  }, [refs, store.messages]);
  const server = useChatServerActions(
    store,
    showToast,
    addLog,
    connectToServerRef,
  );
  const history = useChatHistoryActions(store, refs, scrollToBottom);
  const voice = useChatVoiceActions(
    store,
    refs,
    showToast,
    dismissToast,
    addLog,
  );
  const streaming = useChatStreamingActions(
    store,
    refs,
    showToast,
    addLog,
    resizeTextarea,
    scrollToBottom,
    history.handleRetryMessage,
    server.fetchRam,
    server.fetchLoadedModels,
    voice.prefetchAudio,
  );
  const preprocessLaTeX = useCallback((content: string) => {
    if (!content) return '';
    let text = content
      .replace(
        /\\\[([\s\S]*?)\\\]/g,
        (_match, expression: string) => `\n\n$$\n${expression.trim()}\n$$\n\n`,
      )
      .replace(
        /\\\(([\s\S]*?)\\\)/g,
        (_match, expression: string) => `$${expression.trim()}$`,
      );
    text = text.replace(
      /\\begin\{(aligned|align|align\*|equation|equation\*|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|gather|gather\*)\}([\s\S]*?)\\end\{\1\}/g,
      (match: string) => `\n\n$$\n${match.trim()}\n$$\n\n`,
    );
    return text
      .split(/(```[\s\S]*?```)/g)
      .map((part, index) =>
        index % 2
          ? part
          : part
              .split('\n')
              .map((line) =>
                /^[a-zA-Z][\w{}+\-]*\s*=\s*[^=]+$/.test(line.trim())
                  ? `$$${line.trim()}$$`
                  : line,
              )
              .join('\n'),
      )
      .join('');
  }, []);
  const formatMarkdownContent = useCallback(
    (content?: string) => {
      if (!content) return '';
      const parsed = hasThinkTags(content)
        ? parseThinkContent(content).answer
        : content;
      return preprocessLaTeX(preprocessCodeBlocks(preprocessWhatsApp(parsed)));
    },
    [preprocessLaTeX],
  );
  const markdownComponents = useMemo<Components>(
    () => ({
      pre: ({ children }) => <>{children}</>,
      code: ({ className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '');
        const code = String(children || '').replace(/\n$/, '');
        return match || code.includes('\n') ? (
          <CodeBlock language={match?.[1]} code={code} />
        ) : (
          <code
            className="px-1.5 py-0.5 rounded bg-neutral-800 text-emerald-300 font-mono text-xs border border-neutral-700/60"
            {...props}
          >
            {children}
          </code>
        );
      },
      a: ({ href, children, ...props }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
          {...props}
        >
          {children}
        </a>
      ),
    }),
    [],
  );
  const handleCancel = useCallback(() => {
    refs.abortControllerRef.current?.abort();
    addLog('Cancelled.', 'warning');
    store.setLoading(false);
  }, [refs, addLog, store.setLoading]);
  return {
    ...store,
    connectToServerRef,
    showToast,
    dismissToast,
    ...server,
    ...voice,
    ...history,
    fileInputRef: refs.fileInputRef,
    abortControllerRef: refs.abortControllerRef,
    textareaRef: refs.textareaRef,
    activeChatIdRef: refs.activeChatIdRef,
    mediaRecorderRef: refs.mediaRecorderRef,
    audioChunksRef: refs.audioChunksRef,
    recordingTimerRef: refs.recordingTimerRef,
    scrollContainerRef: refs.scrollContainerRef,
    autoScrollEnabled: refs.autoScrollEnabled,
    showScrollBottom: store.showScrollBottom,
    setShowScrollBottom: store.setShowScrollBottom,
    scrollToBottom,
    handleScroll,
    handleWheel,
    handleTouchMove,
    addLog,
    resizeTextarea,
    preprocessLaTeX,
    formatMarkdownContent,
    markdownComponents,
    cleanModelResponse,
    handleCancel,
    ...streaming,
  };
}
