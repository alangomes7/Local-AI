import re

# Fix chatStore.ts
with open('src/store/chatStore.ts', 'r', encoding='utf-8') as f:
    store = f.read()
store = store.replace("Message, Conversation, LogEntry } from '../types/chat';", "Message, Conversation } from '../types/chat';\nimport { LogEntry } from '../app/components/terminalPanel';")
with open('src/store/chatStore.ts', 'w', encoding='utf-8') as f:
    f.write(store)

# Fix useChatLogic.tsx
with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    logic = f.read()

# Replace the giant return { ... } with return { ...state, ...refs, ...handlersRef.current };
# The return block starts at     return { and ends with   }; or similar, right after Object.assign(handlersRef.current, h4);
logic = re.sub(r'    return \{\s*totalBytes,[\s\S]*?\};\s*\}\s*$', '  return { ...state, ...refs, ...handlersRef.current, memoryOverview };\n}\n', logic)

with open('src/hooks/useChatLogic.tsx', 'w', encoding='utf-8') as f:
    f.write(logic)

print("Fixed!")
