import os
import re

with open('backup_logic.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

effects = re.findall(r'(  useEffect\(\(\) => \{.*?\n  \}, \[.*?\]\);)', text, re.DOTALL)

out = "import { useEffect } from 'react';\n"
out += "export function useChatEffects(state: any, refs: any, handlers: any) {\n"
out += '''  const {
    serverUrl, setServerUrl, toasts, setToasts, serverStatus, setServerStatus, isConnecting, setIsConnecting, 
    lastServerError, setLastServerError, models, setModels, selectedModel, setSelectedModel, activeChatModel, 
    setActiveChatModel, loadingModels, setLoadingModels, modelStatus, setModelStatus, ramStats, setRamStats, 
    systemMemory, setSystemMemory, loadedModels, setLoadedModels, showLoadedPanel, setShowLoadedPanel, prompt, 
    setPrompt, messages, setMessages, loading, setLoading, voiceChatState, setVoiceChatState, isVoiceChatActive, 
    setIsVoiceChatActive, logs, setLogs, showLogs, setShowLogs, selectedFile, setSelectedFile, isRecording, 
    setIsRecording, recordingSeconds, setRecordingSeconds, pendingVoiceNote, setPendingVoiceNote, enableThinking, 
    setEnableThinking, conversations, setConversations, activeChatId, setActiveChatId, showMobileSidebar, 
    setShowMobileSidebar, searchQuery, setSearchQuery, sidebarView, setSidebarView, showScrollBottom, setShowScrollBottom
  } = state;

  const {
    connectToServerRef, audioPlaybackRef, fileInputRef, abortControllerRef, textareaRef, activeChatIdRef, 
    mediaRecorderRef, audioChunksRef, recordingTimerRef, scrollContainerRef, autoScrollEnabled
  } = refs;

  const {
    showToast, dismissToast, startContinuousRecording, stopVoiceChatRecording, processVoiceChatTurn, scrollToBottom, 
    handleScroll, handleWheel, handleTouchMove, addLog, resizeTextarea, fetchRam, fetchLoadedModels, loadModels, 
    connectToServer, handleLoadModel, handleUnloadModel, handleUnloadAll, handleCancel, handleNewChat, 
    handleSelectConversation, handleRestore, handleRetryMessage, handleStartRecording, handleStopRecording, 
    handleCancelVoiceNote, handleSend, handleFileChange, handleRemoveFile
  } = handlers;
'''
for e in effects:
    out += e + "\n"

out += "}\n"

with open('src/hooks/logic/useChatEffects.tsx', 'w', encoding='utf-8') as f:
    f.write(out)

# Now add to useChatLogic.tsx
with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    master = f.read()

master = master.replace("import { useChatHandlers4 } from './logic/useChatHandlers4';", "import { useChatHandlers4 } from './logic/useChatHandlers4';\nimport { useChatEffects } from './logic/useChatEffects';")
master = master.replace("Object.assign(handlersRef.current, h4);", "Object.assign(handlersRef.current, h4);\n  useChatEffects(state, refs, handlersRef.current);")

with open('src/hooks/useChatLogic.tsx', 'w', encoding='utf-8') as f:
    f.write(master)

print("Generated useChatEffects and updated master")
