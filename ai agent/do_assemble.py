import os

with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_logic = "".join(lines[:266]) + '''

  const refs = useChatRefs();
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
    setShowMobileSidebar, searchQuery, setSearchQuery, sidebarView, setSidebarView, showScrollBottom, setShowScrollBottom
  };

  const h1 = useChatHandlers1(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h1);
  const h2 = useChatHandlers2(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h2);
  const h3 = useChatHandlers3(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h3);
  const h4 = useChatHandlers4(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h4);

''' + "".join(lines[2562:])

with open('src/hooks/useChatLogic.tsx', 'w', encoding='utf-8') as f:
    f.write(new_logic)

# We need to add the imports for useChatRefs and useChatHandlers1..4 to useChatLogic.tsx!
