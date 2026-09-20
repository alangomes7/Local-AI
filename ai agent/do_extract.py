import os

with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

pure_funcs = lines[1209:1490]
remaining_lines = lines[:1209] + lines[1490:]

with open('src/hooks/useChatLogic.tsx', 'w', encoding='utf-8') as f:
    f.writelines(remaining_lines)

# Append to utils/format.ts but add export
with open('src/utils/format.ts', 'a', encoding='utf-8') as f:
    f.write("\n")
    for line in pure_funcs:
        if line.startswith('  const preprocessLaTeX'):
            f.write(line.replace('  const ', 'export const '))
        elif line.startswith('  const formatMarkdownContent'):
            f.write(line.replace('  const ', 'export const '))
        elif line.startswith('  const cleanModelResponse'):
            f.write(line.replace('  const ', 'export const '))
        elif line.startswith('  '):
            f.write(line[2:]) # dedent
        else:
            f.write(line)
