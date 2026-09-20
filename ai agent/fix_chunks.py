import os
import re

with open('backup_logic.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# find imports
match = re.search(r'^(.*?)export function useChatLogic\(\) \{', text, re.DOTALL)
imports = match.group(1)

def get_destructure():
    return '''  const {
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

lines = text.splitlines(True)
# from list_funcs2.py:
# 267: startContinuousRecording -> wait, I have to match the strings exactly to avoid line number mismatch!
def find_idx(start_str):
    for i, line in enumerate(lines):
        if line.strip().startswith(start_str):
            return i
    return -1

idx_startContinuousRecording = find_idx("const startContinuousRecording = async () => {")
idx_fetchRam = find_idx("const fetchRam = useCallback(async () => {")
idx_handleCancel = find_idx("const handleCancel = () => {")
idx_handleSend = find_idx("const handleSend = async () => {")
idx_return = find_idx("return {")

with open('src/hooks/logic/useChatHandlers1.ts', 'w', encoding='utf-8') as f:
    f.write(imports)
    f.write("export function useChatHandlers1(state: any, refs: any, handlers: any) {\n")
    f.write(get_destructure())
    f.write("".join(lines[idx_startContinuousRecording:idx_fetchRam]))
    f.write("  return { startContinuousRecording, stopVoiceChatRecording, processVoiceChatTurn, scrollToBottom, handleScroll, handleWheel, handleTouchMove, addLog, resizeTextarea };\n}\n")

with open('src/hooks/logic/useChatHandlers2.ts', 'w', encoding='utf-8') as f:
    f.write(imports)
    f.write("export function useChatHandlers2(state: any, refs: any, handlers: any) {\n")
    f.write(get_destructure())
    f.write("".join(lines[idx_fetchRam:idx_handleCancel]))
    f.write("  return { fetchRam, fetchLoadedModels, loadModels, connectToServer, handleLoadModel, handleUnloadModel, handleUnloadAll };\n}\n")

with open('src/hooks/logic/useChatHandlers3.ts', 'w', encoding='utf-8') as f:
    f.write(imports)
    f.write("export function useChatHandlers3(state: any, refs: any, handlers: any) {\n")
    f.write(get_destructure())
    f.write("".join(lines[idx_handleCancel:idx_handleSend]))
    f.write("  return { handleCancel, handleNewChat, handleSelectConversation, handleRestore, handleRetryMessage, handleStartRecording, handleStopRecording, handleCancelVoiceNote };\n}\n")

with open('src/hooks/logic/useChatHandlers4.ts', 'w', encoding='utf-8') as f:
    f.write(imports)
    f.write("export function useChatHandlers4(state: any, refs: any, handlers: any) {\n")
    f.write(get_destructure())
    f.write("".join(lines[idx_handleSend:idx_return]))
    f.write("  return { handleSend, handleFileChange, handleRemoveFile };\n}\n")

print("Files written")
