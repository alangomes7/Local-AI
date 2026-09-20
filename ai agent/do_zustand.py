import re

with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove all lines matching const \[xxx, setXxx\] = useState(...)
new_text = re.sub(r'^\s*const \[.*?\] = useState.*?;$', '', text, flags=re.MULTILINE)

# Remove all lines matching const xxxRef = useRef(...)
new_text = re.sub(r'^\s*const [a-zA-Z0-9_]+Ref = useRef.*?;$', '', text, flags=re.MULTILINE)

# Remove autoScrollEnabled
new_text = re.sub(r'^\s*const autoScrollEnabled = useRef.*?;$', '', text, flags=re.MULTILINE)

# Insert the Zustand destructuring right after useChatLogic() {
destructure = '''
  const store = useChatStore();
  const {
    serverUrl, setServerUrl, toasts, setToasts, serverStatus, setServerStatus, isConnecting, setIsConnecting, 
    lastServerError, setLastServerError, models, setModels, selectedModel, setSelectedModel, activeChatModel, 
    setActiveChatModel, loadingModels, setLoadingModels, modelStatus, setModelStatus, ramStats, setRamStats, 
    systemMemory, setSystemMemory, loadedModels, setLoadedModels, showLoadedPanel, setShowLoadedPanel, prompt, 
    setPrompt, messages, setMessages, loading, setLoading, voiceChatState, setVoiceChatState, isVoiceChatActive, 
    setIsVoiceChatActive, logs, setLogs, showLogs, setShowLogs, selectedFile, setSelectedFile, isRecording, 
    setIsRecording, recordingSeconds, setRecordingSeconds, pendingVoiceNote, setPendingVoiceNote, enableThinking, 
    setEnableThinking, conversations, setConversations, activeChatId, setActiveChatId, showMobileSidebar, 
    setShowMobileSidebar, searchQuery, setSearchQuery, sidebarView, setSidebarView, showScrollBottom, setShowScrollBottom
  } = store;

  const refs = useChatRefs();
  const {
    connectToServerRef, audioPlaybackRef, fileInputRef, abortControllerRef, textareaRef, activeChatIdRef, 
    mediaRecorderRef, audioChunksRef, recordingTimerRef, scrollContainerRef, autoScrollEnabled
  } = refs;
'''

new_text = new_text.replace('export function useChatLogic() {', 'import { useChatStore } from "../store/chatStore";\nimport { useChatRefs } from "./useChatRefs";\n\nexport function useChatLogic() {' + destructure)

# We need to manually fix multi-line useState declarations like toasts, ramStats, etc!
# Because re.sub with $ only matches single line.
