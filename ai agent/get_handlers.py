with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
print(f"Handlers: {len(lines[644:-2])} lines")
