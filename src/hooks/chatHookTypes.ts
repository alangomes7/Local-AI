'use client';

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ChatStore } from '../store/chatStore';
import type { LogType } from '../app/components/TerminalPanel';
import type { ToastNotification } from '../types/chat';

export type ChatRefs = {
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  activeChatIdRef: MutableRefObject<string | null>;
  mediaRecorderRef: MutableRefObject<MediaRecorder | null>;
  audioChunksRef: MutableRefObject<Blob[]>;
  recordingTimerRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>;
  autoScrollEnabled: MutableRefObject<boolean>;
  audioPlaybackRef: MutableRefObject<HTMLAudioElement | null>;
};

export type ShowToast = (toast: Omit<ToastNotification, 'id'>) => string;
export type AddLog = (message: string, type?: LogType) => void;
export type Setter<T> = Dispatch<SetStateAction<T>>;
export type Store = ChatStore;
