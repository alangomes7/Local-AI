with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 110 <= i <= 120 or 2540 <= i <= 2550:
            print(f"{i+1}: {line.rstrip()}")
