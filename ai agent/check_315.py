with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 310 <= i <= 320:
            print(f"{i+1}: {line.rstrip()}")
