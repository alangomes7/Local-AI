import os

with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Read the extracted chunk from utils/format.ts
with open('src/utils/format.ts', 'r', encoding='utf-8') as f:
    format_lines = f.readlines()

# The extracted chunk is the last part of format.ts
# Let's find where it starts
start_idx = -1
for i, line in enumerate(format_lines):
    if line.startswith('export const preprocessLaTeX'):
        start_idx = i
        break

extracted = format_lines[start_idx:]
# Restore original indents
restored = []
for line in extracted:
    if line.startswith('export const preprocessLaTeX'):
        restored.append(line.replace('export const ', '  const '))
    elif line.startswith('export const formatMarkdownContent'):
        restored.append(line.replace('export const ', '  const '))
    elif line.startswith('export const cleanModelResponse'):
        restored.append(line.replace('export const ', '  const '))
    else:
        restored.append('  ' + line)

# put it back in useChatLogic.tsx at line 1209
lines = lines[:1209] + restored + lines[1209:]
with open('src/hooks/useChatLogic.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

# remove it from format.ts
with open('src/utils/format.ts', 'w', encoding='utf-8') as f:
    f.writelines(format_lines[:start_idx-1]) # remove newline before it

