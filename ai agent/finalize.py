import os
import re

with open('backup_logic.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.splitlines(True)

def find_idx(start_str):
    for i, line in enumerate(lines):
        if line.strip().startswith(start_str):
            return i
    return -1

def find_last_idx(start_str):
    for i in range(len(lines)-1, -1, -1):
        if lines[i].strip().startswith(start_str):
            return i
    return -1

idx_useChatLogic = find_idx("export function useChatLogic() {")
idx_startContinuousRecording = find_idx("const startContinuousRecording = async () => {")
idx_return = find_last_idx("return {")

new_imports = "".join(lines[:idx_useChatLogic])
new_imports = new_imports.replace("import { useCallback, useEffect, useMemo, useRef, useState } from 'react';", "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';\nimport { useChatHandlers1 } from './logic/useChatHandlers1';\nimport { useChatHandlers2 } from './logic/useChatHandlers2';\nimport { useChatHandlers3 } from './logic/useChatHandlers3';\nimport { useChatHandlers4 } from './logic/useChatHandlers4';\n")

state_block = "".join(lines[idx_useChatLogic:idx_startContinuousRecording])

glue = '''
  const handlersRef = useRef<any>({});
  
  const state = {
    serverUrl, setServerUrl, toasts, setToasts, serverStatus, setServerStatus, isConnecting, setIsConnecting, 
    lastServerError, setLastServerError, models, setModels, selectedModel, setSelectedModel, activeChatModel, 
    setActiveChatModel, loadingModels, setLoadingModels, modelStatus, setModelStatus, ramStats, setRamStats, 
    systemMemory, setSystemMemory, loadedModels, setLoadedModels, showLoadedPanel, setShowLoadedPanel, prompt, 
    setPrompt, messages, setMessages, loading, setLoading, voiceChatState, setVoiceChatState, isVoiceChatActive, 
    setIsVoiceChatActive, logs, setLogs, showLogs, setShowLogs, selectedFile, setSelectedFile, isRecording, 
    setIsRecording, recordingSeconds, setRecordingSeconds, pendingVoiceNote, setPendingVoiceNote, enableThinking, 
    setEnableThinking, conversations, setConversations, activeChatId, setActiveChatId, showMobileSidebar, 
    setShowMobileSidebar, searchQuery, setSearchQuery, sidebarView, setSidebarView, showScrollBottom, setShowScrollBottom,
    conversationToDelete, setConversationToDelete, conversationToPermanentlyDelete, setConversationToPermanentlyDelete
  };

  const refs = {
    connectToServerRef, audioPlaybackRef, fileInputRef, abortControllerRef, textareaRef, activeChatIdRef, 
    mediaRecorderRef, audioChunksRef, recordingTimerRef, scrollContainerRef, autoScrollEnabled
  };

  const h1 = useChatHandlers1(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h1);
  const h2 = useChatHandlers2(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h2);
  const h3 = useChatHandlers3(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h3);
  const h4 = useChatHandlers4(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h4);
  
  const {
    showToast, dismissToast, startContinuousRecording, stopVoiceChatRecording, processVoiceChatTurn, scrollToBottom, 
    handleScroll, handleWheel, handleTouchMove, addLog, resizeTextarea, fetchRam, fetchLoadedModels, loadModels, 
    connectToServer, handleLoadModel, handleUnloadModel, handleUnloadAll, handleCancel, handleNewChat, 
    handleSelectConversation, handleRestore, handleRetryMessage, handleStartRecording, handleStopRecording, 
    handleCancelVoiceNote, handleSend, handleFileChange, handleRemoveFile
  } = handlersRef.current;

'''

return_block = "".join(lines[idx_return:])

new_text = new_imports + state_block + glue + return_block

with open('src/hooks/useChatLogic.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Masterpiece created.")
