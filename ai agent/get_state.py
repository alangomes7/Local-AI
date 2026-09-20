with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

state_lines = lines[60:644]
with open('state_block.txt', 'w', encoding='utf-8') as f:
    f.writelines(state_lines)
