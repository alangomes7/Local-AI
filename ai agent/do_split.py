import os
import re

with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

os.makedirs('src/hooks/logic', exist_ok=True)

# Define the chunks based on the list_funcs2.py output:
# imports: 0 - 61
# state: 62 - 265
# handlers1 (Voice & UI): 266 - 643
# handlers2 (Server & Models): 644 - 1208
# handlers3 (pure & conv): 1209 - 1794
# handlers4 (Send & Files): 1795 - 2561
# return block: 2562 - end

imports = "".join(lines[:62])

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

with open('src/hooks/logic/useChatHandlers1.ts', 'w', encoding='utf-8') as f:
    f.write(imports.replace('export function useChatLogic() {', ''))
    f.write("export function useChatHandlers1(state: any, refs: any, handlers: any) {\n")
    f.write(get_destructure())
    f.write("".join(lines[266:643]))
    f.write("  return { startContinuousRecording, stopVoiceChatRecording, processVoiceChatTurn, scrollToBottom, handleScroll, handleWheel, handleTouchMove, addLog, resizeTextarea };\n}\n")

with open('src/hooks/logic/useChatHandlers2.ts', 'w', encoding='utf-8') as f:
    f.write(imports.replace('export function useChatLogic() {', ''))
    f.write("export function useChatHandlers2(state: any, refs: any, handlers: any) {\n")
    f.write(get_destructure())
    f.write("".join(lines[644:1208]))
    f.write("  return { fetchRam, fetchLoadedModels, loadModels, connectToServer, handleLoadModel, handleUnloadModel, handleUnloadAll };\n}\n")

with open('src/hooks/logic/useChatHandlers3.ts', 'w', encoding='utf-8') as f:
    f.write(imports.replace('export function useChatLogic() {', ''))
    f.write("export function useChatHandlers3(state: any, refs: any, handlers: any) {\n")
    f.write(get_destructure())
    f.write("".join(lines[1490:1794])) # skipped 1209 to 1490 because those were the pure functions! Wait!
    f.write("  return { handleCancel, handleNewChat, handleSelectConversation, handleRestore, handleRetryMessage, handleStartRecording, handleStopRecording, handleCancelVoiceNote };\n}\n")

with open('src/hooks/logic/useChatHandlers4.ts', 'w', encoding='utf-8') as f:
    f.write(imports.replace('export function useChatLogic() {', ''))
    f.write("export function useChatHandlers4(state: any, refs: any, handlers: any) {\n")
    f.write(get_destructure())
    f.write("".join(lines[1795:2561]))
    f.write("  return { handleSend, handleFileChange, handleRemoveFile };\n}\n")

