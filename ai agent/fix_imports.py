import os

with open('src/app/components/chat/MainLayout/index.tsx', 'r', encoding='utf-8') as f:
    main_lines = f.readlines()

imports_chunk = []
for line in main_lines:
    if 'export function MainLayout' in line:
        break
    if 'import { Toasts } from' in line or 'import { Header } from' in line or 'import { Sidebar }' in line or 'import { MessageList }' in line or 'import { Composer }' in line or 'import { RightSidebar }' in line or 'import { Modals }' in line:
        continue
    imports_chunk.append(line)

# Fix relative paths
adjusted_imports = []
for line in imports_chunk:
    line = line.replace("'../TerminalPanel'", "'../../TerminalPanel'")
    line = line.replace("'../CodeBlock'", "'../../CodeBlock'")
    line = line.replace("'../../../types/chat'", "'../../../../types/chat'")
    line = line.replace("'../../../utils/chat'", "'../../../../utils/chat'")
    line = line.replace("'../../../contexts/ChatContext'", "'../../../../contexts/ChatContext'")
    line = line.replace("'../FileAttachmentCard'", "'../../FileAttachmentCard'")
    line = line.replace("'../VoiceNotePlayer'", "'../../VoiceNotePlayer'")
    adjusted_imports.append(line)

imports_str = "".join(adjusted_imports)

components = ['Toasts', 'Header', 'Sidebar', 'MessageList', 'Composer', 'RightSidebar', 'Modals']

for comp in components:
    filepath = f'src/app/components/chat/{comp}/index.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        comp_lines = f.readlines()
        
    # Find export function
    export_idx = -1
    for i, line in enumerate(comp_lines):
        if f'export function {comp}()' in line:
            export_idx = i
            break
            
    # Keep the actual component code
    comp_code = "".join(comp_lines[export_idx:])
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(imports_str + comp_code)

print("Fixed imports for subcomponents!")
