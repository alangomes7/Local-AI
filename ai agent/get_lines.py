with open('src/utils/chat.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'export const EMOJI_MAP' in line:
        print(f"EMOJI_MAP: {i}")
