with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if line.strip().startswith('useEffect(') or line.strip().startswith('useMemo('):
        print(f"{i}: {line.strip()}")
