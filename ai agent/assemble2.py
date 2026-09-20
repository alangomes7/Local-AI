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

idx_startContinuousRecording = find_idx("const startContinuousRecording = async () => {")
idx_return = find_idx("return {")

match = re.search(r'^(.*?)export function useChatLogic\(\) \{', text, re.DOTALL)
imports = match.group(1)

new_imports = imports.replace("import { useCallback, useEffect, useMemo, useRef, useState } from 'react';", "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';\nimport { useChatRefs } from './useChatRefs';\nimport { useChatHandlers1 } from './logic/useChatHandlers1';\nimport { useChatHandlers2 } from './logic/useChatHandlers2';\nimport { useChatHandlers3 } from './logic/useChatHandlers3';\nimport { useChatHandlers4 } from './logic/useChatHandlers4';\n")

state_block = "".join(lines[match.end():idx_startContinuousRecording])

glue = '''
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

'''

return_block = "".join(lines[idx_return:])

new_text = new_imports + "export function useChatLogic() {" + state_block + glue + return_block

with open('src/hooks/useChatLogic.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("useChatLogic.tsx written")
