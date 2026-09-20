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
import { Toasts } from '../Toasts';
import { Header } from '../Header';
import { Sidebar } from '../Sidebar';
import { MessageList } from '../MessageList';
import { Composer } from '../Composer';
import { RightSidebar } from '../RightSidebar';
import { Modals } from '../Modals';
export function MainLayout() {
  const {
    serverUrl,
    setServerUrl,
    toasts,
    setToasts,
    serverStatus,
    setServerStatus,
    isConnecting,
    setIsConnecting,
    lastServerError,
    setLastServerError,
    connectToServerRef,
    showToast,
    dismissToast,
    models,
    setModels,
    selectedModel,
    setSelectedModel,
    activeChatModel,
    setActiveChatModel,
    loadingModels,
    setLoadingModels,
    modelStatus,
    setModelStatus,
    ramStats,
    setRamStats,
    systemMemory,
    setSystemMemory,
    loadedModels,
    setLoadedModels,
    showLoadedPanel,
    setShowLoadedPanel,
    sortedModels,
    sortedLoadedModels,
    totalLoadedBytes,
    totalLoadedMemory,
    memoryOverview,
    prompt,
    setPrompt,
    messages,
    setMessages,
    loading,
    setLoading,
    voiceChatState,
    setVoiceChatState,
    isVoiceChatActive,
    setIsVoiceChatActive,
    audioPlaybackRef,
    startContinuousRecording,
    stopVoiceChatRecording,
    generateLLMResponseText,
    processVoiceChatTurn,
    logs,
    setLogs,
    showLogs,
    setShowLogs,
    selectedFile,
    setSelectedFile,
    isRecording,
    setIsRecording,
    recordingSeconds,
    setRecordingSeconds,
    pendingVoiceNote,
    setPendingVoiceNote,
    enableThinking,
    setEnableThinking,
    conversations,
    setConversations,
    activeChatId,
    setActiveChatId,
    showMobileSidebar,
    setShowMobileSidebar,
    searchQuery,
    setSearchQuery,
    sidebarView,
    setSidebarView,
    conversationToDelete,
    setConversationToDelete,
    conversationToPermanentlyDelete,
    setConversationToPermanentlyDelete,
    fileInputRef,
    abortControllerRef,
    textareaRef,
    activeChatIdRef,
    mediaRecorderRef,
    audioChunksRef,
    recordingTimerRef,
    scrollContainerRef,
    autoScrollEnabled,
    showScrollBottom,
    setShowScrollBottom,
    scrollToBottom,
    handleScroll,
    handleWheel,
    handleTouchMove,
    addLog,
    resizeTextarea,
    fetchRam,
    fetchLoadedModels,
    loadModels,
    connectToServer,
    handleLoadModel,
    handleUnloadModel,
    handleUnloadAll,
    toggleThinking,
    preprocessLaTeX,
    formatMarkdownContent,
    markdownComponents,
    cleanModelResponse,
    handleCancel,
    handleNewChat,
    handleSelectConversation,
    normalizedQuery,
    activeConversations,
    confirmMoveToTrash,
    handleRestore,
    confirmPermanentDelete,
    trashConversations,
    handleRetryMessage,
    handleStartRecording,
    handleStopRecording,
    handleCancelVoiceNote,
    handleSend,
    handleFileChange,
    handleRemoveFile,
  } = useChatContext();
  return (
    <main className="h-screen max-h-screen w-screen max-w-full flex flex-col bg-neutral-950 text-neutral-100 font-sans overflow-hidden">
      <Toasts />
      <Header />
      <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden relative">
        <Sidebar />
        <div className="flex-1 flex flex-col lg:flex-row min-w-0 min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden h-full relative">
            <MessageList />
            <Composer />
          </div>
          <RightSidebar />
        </div>
      </div>
      <Modals />
    </main>
  );
}
