with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Let's count where the functions start
for i, line in enumerate(lines):
    if line.startswith('  const fetchRam = useCallback'):
        print(f"fetchRam: {i}")
    elif line.startswith('  const loadModels = useCallback'):
        print(f"loadModels: {i}")
    elif line.startswith('  const handleSend = async'):
        print(f"handleSend: {i}")
    elif line.startswith('  const handleStartRecording = async'):
        print(f"handleStartRecording: {i}")
