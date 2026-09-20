import os

def check_lines():
    large_files = []
    for root, dirs, files in os.walk('src'):
        for file in files:
            if not file.endswith(('.ts', '.tsx', '.js', '.jsx', '.py', '.css')): continue
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    if len(lines) > 500:
                        large_files.append((filepath, len(lines)))
            except Exception as e:
                pass
    
    # Also check Python files in root
    for file in os.listdir('.'):
        if file.endswith('.py'):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    if len(lines) > 500:
                        large_files.append((file, len(lines)))
            except:
                pass

    for f, count in sorted(large_files, key=lambda x: x[1], reverse=True):
        print(f"{count} lines: {f}")

check_lines()
