import os

with open('src/utils/chat.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

os.makedirs('src/utils', exist_ok=True)

# Find function starts
funcs = []
for i, line in enumerate(lines):
    if line.startswith('export const ') or line.startswith('export function ') or line.startswith('export const EMOJI_MAP'):
        funcs.append((i, line.split()[2].split('(')[0].replace(':', '')))

# It's better to just split into 2 files: format.ts and markdown.ts
# Let's see what is inside chat.ts
