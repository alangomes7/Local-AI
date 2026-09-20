import os

zustand_code = '''import { create } from 'zustand';
import { ToastNotification, VoiceChatState, LoadedModel, SystemMemoryStatus, Message, Conversation, LogEntry } from '../types/chat';

export interface ChatStore {
  serverUrl: string;
  setServerUrl: (val: any) => void;
  toasts: ToastNotification[];
  setToasts: (val: any) => void;
  serverStatus: 'online' | 'offline' | 'checking';
  setServerStatus: (val: any) => void;
  isConnecting: boolean;
  setIsConnecting: (val: any) => void;
  lastServerError: string | null;
  setLastServerError: (val: any) => void;
  models: string[];
  setModels: (val: any) => void;
  selectedModel: string;
  setSelectedModel: (val: any) => void;
  activeChatModel: string;
  setActiveChatModel: (val: any) => void;
  loadingModels: boolean;
  setLoadingModels: (val: any) => void;
  modelStatus: 'unloaded' | 'loading' | 'loaded';
  setModelStatus: (val: any) => void;
  ramStats: any;
  setRamStats: (val: any) => void;
  systemMemory: SystemMemoryStatus | null;
  setSystemMemory: (val: any) => void;
  loadedModels: LoadedModel[];
  setLoadedModels: (val: any) => void;
  showLoadedPanel: boolean;
  setShowLoadedPanel: (val: any) => void;
  prompt: string;
  setPrompt: (val: any) => void;
  messages: Message[];
  setMessages: (val: any) => void;
  loading: boolean;
  setLoading: (val: any) => void;
  voiceChatState: VoiceChatState;
  setVoiceChatState: (val: any) => void;
  isVoiceChatActive: boolean;
  setIsVoiceChatActive: (val: any) => void;
  logs: LogEntry[];
  setLogs: (val: any) => void;
  showLogs: boolean;
  setShowLogs: (val: any) => void;
  selectedFile: File | null;
  setSelectedFile: (val: any) => void;
  isRecording: boolean;
  setIsRecording: (val: any) => void;
  recordingSeconds: number;
  setRecordingSeconds: (val: any) => void;
  pendingVoiceNote: any | null;
  setPendingVoiceNote: (val: any) => void;
  enableThinking: boolean;
  setEnableThinking: (val: any) => void;
  conversations: Conversation[];
  setConversations: (val: any) => void;
  activeChatId: string | null;
  setActiveChatId: (val: any) => void;
  showMobileSidebar: boolean;
  setShowMobileSidebar: (val: any) => void;
  searchQuery: string;
  setSearchQuery: (val: any) => void;
  sidebarView: 'chats' | 'trash';
  setSidebarView: (val: any) => void;
  showScrollBottom: boolean;
  setShowScrollBottom: (val: any) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  serverUrl: 'http://localhost:8000/v1/chat/completions',
  setServerUrl: (val: any) => set((s: any) => ({ serverUrl: typeof val === 'function' ? val(s.serverUrl) : val })),
  toasts: [],
  setToasts: (val: any) => set((s: any) => ({ toasts: typeof val === 'function' ? val(s.toasts) : val })),
  serverStatus: 'checking',
  setServerStatus: (val: any) => set((s: any) => ({ serverStatus: typeof val === 'function' ? val(s.serverStatus) : val })),
  isConnecting: true,
  setIsConnecting: (val: any) => set((s: any) => ({ isConnecting: typeof val === 'function' ? val(s.isConnecting) : val })),
  lastServerError: null,
  setLastServerError: (val: any) => set((s: any) => ({ lastServerError: typeof val === 'function' ? val(s.lastServerError) : val })),
  models: [],
  setModels: (val: any) => set((s: any) => ({ models: typeof val === 'function' ? val(s.models) : val })),
  selectedModel: '',
  setSelectedModel: (val: any) => set((s: any) => ({ selectedModel: typeof val === 'function' ? val(s.selectedModel) : val })),
  activeChatModel: '',
  setActiveChatModel: (val: any) => set((s: any) => ({ activeChatModel: typeof val === 'function' ? val(s.activeChatModel) : val })),
  loadingModels: false,
  setLoadingModels: (val: any) => set((s: any) => ({ loadingModels: typeof val === 'function' ? val(s.loadingModels) : val })),
  modelStatus: 'unloaded',
  setModelStatus: (val: any) => set((s: any) => ({ modelStatus: typeof val === 'function' ? val(s.modelStatus) : val })),
  ramStats: { used: '0', total: '0', available: '0', percentage: '0', availablePercentage: '100' },
  setRamStats: (val: any) => set((s: any) => ({ ramStats: typeof val === 'function' ? val(s.ramStats) : val })),
  systemMemory: null,
  setSystemMemory: (val: any) => set((s: any) => ({ systemMemory: typeof val === 'function' ? val(s.systemMemory) : val })),
  loadedModels: [],
  setLoadedModels: (val: any) => set((s: any) => ({ loadedModels: typeof val === 'function' ? val(s.loadedModels) : val })),
  showLoadedPanel: false,
  setShowLoadedPanel: (val: any) => set((s: any) => ({ showLoadedPanel: typeof val === 'function' ? val(s.showLoadedPanel) : val })),
  prompt: '',
  setPrompt: (val: any) => set((s: any) => ({ prompt: typeof val === 'function' ? val(s.prompt) : val })),
  messages: [],
  setMessages: (val: any) => set((s: any) => ({ messages: typeof val === 'function' ? val(s.messages) : val })),
  loading: false,
  setLoading: (val: any) => set((s: any) => ({ loading: typeof val === 'function' ? val(s.loading) : val })),
  voiceChatState: 'idle',
  setVoiceChatState: (val: any) => set((s: any) => ({ voiceChatState: typeof val === 'function' ? val(s.voiceChatState) : val })),
  isVoiceChatActive: false,
  setIsVoiceChatActive: (val: any) => set((s: any) => ({ isVoiceChatActive: typeof val === 'function' ? val(s.isVoiceChatActive) : val })),
  logs: [],
  setLogs: (val: any) => set((s: any) => ({ logs: typeof val === 'function' ? val(s.logs) : val })),
  showLogs: false,
  setShowLogs: (val: any) => set((s: any) => ({ showLogs: typeof val === 'function' ? val(s.showLogs) : val })),
  selectedFile: null,
  setSelectedFile: (val: any) => set((s: any) => ({ selectedFile: typeof val === 'function' ? val(s.selectedFile) : val })),
  isRecording: false,
  setIsRecording: (val: any) => set((s: any) => ({ isRecording: typeof val === 'function' ? val(s.isRecording) : val })),
  recordingSeconds: 0,
  setRecordingSeconds: (val: any) => set((s: any) => ({ recordingSeconds: typeof val === 'function' ? val(s.recordingSeconds) : val })),
  pendingVoiceNote: null,
  setPendingVoiceNote: (val: any) => set((s: any) => ({ pendingVoiceNote: typeof val === 'function' ? val(s.pendingVoiceNote) : val })),
  enableThinking: true,
  setEnableThinking: (val: any) => set((s: any) => ({ enableThinking: typeof val === 'function' ? val(s.enableThinking) : val })),
  conversations: [],
  setConversations: (val: any) => set((s: any) => ({ conversations: typeof val === 'function' ? val(s.conversations) : val })),
  activeChatId: null,
  setActiveChatId: (val: any) => set((s: any) => ({ activeChatId: typeof val === 'function' ? val(s.activeChatId) : val })),
  showMobileSidebar: false,
  setShowMobileSidebar: (val: any) => set((s: any) => ({ showMobileSidebar: typeof val === 'function' ? val(s.showMobileSidebar) : val })),
  searchQuery: '',
  setSearchQuery: (val: any) => set((s: any) => ({ searchQuery: typeof val === 'function' ? val(s.searchQuery) : val })),
  sidebarView: 'chats',
  setSidebarView: (val: any) => set((s: any) => ({ sidebarView: typeof val === 'function' ? val(s.sidebarView) : val })),
  showScrollBottom: false,
  setShowScrollBottom: (val: any) => set((s: any) => ({ showScrollBottom: typeof val === 'function' ? val(s.showScrollBottom) : val }))
}));
'''

os.makedirs('src/store', exist_ok=True)
with open('src/store/chatStore.ts', 'w', encoding='utf-8') as f:
    f.write(zustand_code)

print("Created Zustand store!")
