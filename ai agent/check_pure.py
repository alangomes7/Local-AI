with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
chunk = "".join(lines[1209:1490])
# check for use of state vars like 'prompt', 'messages', 'set...'
print("State vars found?" if " set" in chunk or "prompt" in chunk else "No obvious state vars")
