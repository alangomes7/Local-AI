with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'const memoryOverview = useMemo(' in line:
            print(f"Found memoryOverview at {i+1}")
