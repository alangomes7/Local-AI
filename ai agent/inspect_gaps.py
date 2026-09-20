import os
import re

with open('backup_logic.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.splitlines(True)

def find_idx(start_str):
    for i, line in enumerate(lines):
        if line.strip().startswith(start_str):
            return i
    return -1

idx_startContinuousRecording = find_idx("const startContinuousRecording = async () => {")
idx_fetchRam = find_idx("const fetchRam = useCallback(async () => {")
idx_handleCancel = find_idx("const handleCancel = () => {")
idx_handleSend = find_idx("const handleSend = async () => {")
idx_return = find_last_idx("return {") # need to define this

# wait, find_last_idx
def find_last_idx(start_str):
    for i in range(len(lines)-1, -1, -1):
        if lines[i].strip().startswith(start_str):
            return i
    return -1

idx_return = find_last_idx("return {")

# Let's print what is between the handler blocks!
print("--- Between startContinuousRecording and fetchRam ---")
print("".join(lines[idx_startContinuousRecording:idx_fetchRam]))

