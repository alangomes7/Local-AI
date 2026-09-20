with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def print_funcs():
    for i, line in enumerate(lines):
        if line.startswith('  const handle') or line.startswith('  const fetch') or line.startswith('  const load') or line.startswith('  const connect') or line.startswith('  const showToast') or line.startswith('  const dismissToast') or line.startswith('  const scrollToBottom') or line.startswith('  const addLog') or line.startswith('  const resizeTextarea') or line.startswith('  const preprocessLaTeX') or line.startswith('  const formatMarkdownContent') or line.startswith('  const cleanModelResponse') or line.startswith('  const startContinuousRecording') or line.startswith('  const stopVoiceChatRecording') or line.startswith('  const processVoiceChatTurn'):
            print(f"{i}: {line.strip()}")

print_funcs()
