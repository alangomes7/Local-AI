with open('backup_logic.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.splitlines(True)
def find_idx(start_str):
    for i, line in enumerate(lines):
        if line.strip().startswith(start_str):
            return i
    return -1
def find_last_idx(start_str):
    for i in range(len(lines)-1, -1, -1):
        if lines[i].strip().startswith(start_str):
            return i
    return -1

i1 = find_idx("const startContinuousRecording = async () => {")
i2 = find_last_idx("return {")

for i in range(i1, i2):
    if lines[i].strip().startswith("useEffect("):
        print(f"useEffect at line {i+1}")
