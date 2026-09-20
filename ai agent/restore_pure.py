import os
import re

with open('backup_logic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def find_idx(start_str):
    for i, line in enumerate(lines):
        if line.strip().startswith(start_str):
            return i
    return -1

idx_latex = find_idx("const preprocessLaTeX = (content: string) => {")
idx_cancel = find_idx("const handleCancel = () => {")

pure_funcs = "".join(lines[idx_latex:idx_cancel])

with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Insert before return {
text = text.replace("return { ...state,", pure_funcs + "\n  return { ...state, preprocessLaTeX, formatMarkdownContent, markdownComponents, cleanModelResponse,")

with open('src/hooks/useChatLogic.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Restored pure funcs")
