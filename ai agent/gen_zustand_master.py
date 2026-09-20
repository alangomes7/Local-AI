import os
import re

with open('backup_logic.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

out = '''"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useChatRefs } from './useChatRefs';
import { useChatHandlers1 } from './logic/useChatHandlers1';
import { useChatHandlers2 } from './logic/useChatHandlers2';
import { useChatHandlers3 } from './logic/useChatHandlers3';
import { useChatHandlers4 } from './logic/useChatHandlers4';
'''

match = re.search(r'(import \{\s*Activity,.*?\n\} from \'lucide-react\';)', text, re.DOTALL)
out += match.group(1) + "\n"

out += '''
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import TerminalPanel, { LogEntry, LogType } from '../app/components/terminalPanel';
import CodeBlock from '../app/components/codeBlock';
import { ToastNotification, Message, Conversation, VoiceChatState, LoadedModel, SystemMemoryStatus, LoadedModelsResponse, ModelsResponse } from '../types/chat';
import { formatModelMemory, hasThinkTags, parseThinkContent, preprocessCodeBlocks, preprocessWhatsApp, exportChatToMarkdown, sanitizeFilename, downloadConversationAsMarkdown } from '../utils/chat';

export function useChatLogic() {
  const state = useChatStore();
  const refs = useChatRefs();
  const handlersRef = useRef<any>({});
  
  const h1 = useChatHandlers1(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h1);
  const h2 = useChatHandlers2(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h2);
  const h3 = useChatHandlers3(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h3);
  const h4 = useChatHandlers4(state, refs, handlersRef.current);
  Object.assign(handlersRef.current, h4);

'''

mem_match = re.search(r'(  const memoryOverview = useMemo\(\(\) => \{.*?\n  \}, \[systemMemory, ramStats, totalLoadedBytes\]\);)', text, re.DOTALL)
out += mem_match.group(1).replace('systemMemory', 'state.systemMemory').replace('ramStats', 'state.ramStats').replace('totalLoadedBytes', 'state.totalLoadedBytes') + "\n"

pure = re.search(r'(  const preprocessLaTeX = \(content: string\) => \{.*?\n  const handleCancel = \(\) => \{)', text, re.DOTALL)
pure_funcs = pure.group(1).replace('  const handleCancel = () => {', '')
out += pure_funcs + "\n"

out += '''
  return {
    ...state,
    ...refs,
    ...handlersRef.current,
    memoryOverview,
    preprocessLaTeX,
    formatMarkdownContent,
    markdownComponents,
    cleanModelResponse
  };
}
'''

with open('src/hooks/useChatLogic.tsx', 'w', encoding='utf-8') as f:
    f.write(out)

print("Generated Zustand master hook!")
