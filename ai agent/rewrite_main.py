import os

with open('src/app/components/chat/MainLayout/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_return = False
for line in lines:
    if 'return (' in line:
        in_return = True
        new_lines.append(line)
        new_lines.append('    <main className="h-screen max-h-screen w-screen max-w-full flex flex-col bg-neutral-950 text-neutral-100 font-sans overflow-hidden">\n')
        new_lines.append('      <Toasts />\n')
        new_lines.append('      <Header />\n')
        new_lines.append('      <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden relative">\n')
        new_lines.append('        <Sidebar />\n')
        new_lines.append('        <div className="flex-1 flex flex-col lg:flex-row min-w-0 min-h-0 overflow-hidden">\n')
        new_lines.append('          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden h-full relative">\n')
        new_lines.append('            <MessageList />\n')
        new_lines.append('            <Composer />\n')
        new_lines.append('          </div>\n')
        new_lines.append('          <RightSidebar />\n')
        new_lines.append('        </div>\n')
        new_lines.append('      </div>\n')
        new_lines.append('      <Modals />\n')
        new_lines.append('    </main>\n')
        new_lines.append('  );\n')
        new_lines.append('}\n')
        break
    else:
        new_lines.append(line)

with open('src/app/components/chat/MainLayout/index.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
