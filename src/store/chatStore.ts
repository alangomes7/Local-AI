import type { Dispatch, SetStateAction } from 'react';
import { create } from 'zustand';
import type { LogEntry } from '../app/components/TerminalPanel';
import type {
  Conversation,
  LoadedModel,
  Message,
  SystemMemoryStatus,
  ToastNotification,
  VoiceChatState,
} from '../types/chat';

export type RamStats = {
  used: string;
  total: string;
  available: string;
  percentage: string;
  availablePercentage: string;
};

export type PendingVoiceNote = {
  file: File;
  durationSeconds: number;
  url: string;
};

export type ChatState = {
  serverUrl: string;
  toasts: ToastNotification[];
  serverStatus: 'online' | 'offline' | 'checking';
  isConnecting: boolean;
  lastServerError: string | null;
  models: string[];
  selectedModel: string;
  activeChatModel: string;
  loadingModels: boolean;
  modelStatus: 'unloaded' | 'loading' | 'loaded';
  ramStats: RamStats;
  systemMemory: SystemMemoryStatus | null;
  loadedModels: LoadedModel[];
  showLoadedPanel: boolean;
  prompt: string;
  messages: Message[];
  loading: boolean;
  voiceChatState: VoiceChatState;
  isVoiceChatActive: boolean;
  logs: LogEntry[];
  showLogs: boolean;
  selectedFile: File | null;
  isRecording: boolean;
  recordingSeconds: number;
  isTranscribingVoiceNote: boolean;
  pendingVoiceNote: PendingVoiceNote | null;
  enableThinking: boolean;
  conversations: Conversation[];
  activeChatId: string | null;
  showMobileSidebar: boolean;
  searchQuery: string;
  sidebarView: 'chats' | 'trash';
  conversationToDelete: Conversation | null;
  conversationToPermanentlyDelete: Conversation | null;
  showScrollBottom: boolean;
  ttsVoice: string;
  ttsSpeed: number;
};

type StateSetter<T> = Dispatch<SetStateAction<T>>;

export type ChatStore = ChatState & {
  [K in keyof ChatState as `set${Capitalize<string & K>}`]: StateSetter<
    ChatState[K]
  >;
};

const initialState: ChatState = {
  serverUrl: 'http://localhost:8000/v1/chat/completions',
  toasts: [],
  serverStatus: 'checking',
  isConnecting: true,
  lastServerError: null,
  models: [],
  selectedModel: '',
  activeChatModel: '',
  loadingModels: false,
  modelStatus: 'unloaded',
  ramStats: {
    used: '0',
    total: '0',
    available: '0',
    percentage: '0',
    availablePercentage: '100',
  },
  systemMemory: null,
  loadedModels: [],
  showLoadedPanel: false,
  prompt: '',
  messages: [],
  loading: false,
  voiceChatState: 'idle',
  isVoiceChatActive: false,
  logs: [],
  showLogs: false,
  selectedFile: null,
  isRecording: false,
  recordingSeconds: 0,
  isTranscribingVoiceNote: false,
  pendingVoiceNote: null,
  enableThinking: false,
  conversations: [],
  activeChatId: null,
  showMobileSidebar: false,
  searchQuery: '',
  sidebarView: 'chats',
  conversationToDelete: null,
  conversationToPermanentlyDelete: null,
  showScrollBottom: false,
  ttsVoice:
    typeof window !== 'undefined'
      ? localStorage.getItem('last_tts_voice') || 'af_heart'
      : 'af_heart',
  ttsSpeed:
    typeof window !== 'undefined' && localStorage.getItem('last_tts_speed')
      ? parseFloat(localStorage.getItem('last_tts_speed')!) || 1.0
      : 1.0,
};

const setterKey = <K extends keyof ChatState>(key: K) =>
  `set${String(key).charAt(0).toUpperCase()}${String(key).slice(1)}` as `set${Capitalize<string & K>}`;

export const useChatStore = create<ChatStore>((set) => {
  const setters = Object.keys(initialState).reduce(
    (result, key) => {
      const stateKey = key as keyof ChatState;
      result[setterKey(stateKey)] = ((
        value: SetStateAction<ChatState[typeof stateKey]>,
      ) =>
        set((state) => ({
          [stateKey]:
            typeof value === 'function'
              ? (
                  value as (
                    previous: ChatState[typeof stateKey],
                  ) => ChatState[typeof stateKey]
                )(state[stateKey])
              : value,
        }))) as StateSetter<ChatState[keyof ChatState]>;
      return result;
    },
    {} as Record<string, unknown>,
  );

  return { ...initialState, ...setters } as ChatStore;
});
