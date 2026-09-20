import os
import re

with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the giant return block
text = re.sub(r'  return \{\s*serverUrl,[\s\S]*?\}\s*;\s*\}\s*$', '  return { ...state, ...refs, ...handlersRef.current, memoryOverview, sortedModels, sortedLoadedModels, totalLoadedBytes, totalLoadedMemory };\n}\n', text)

with open('src/hooks/useChatLogic.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Return block replaced")
