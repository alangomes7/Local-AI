import os

with open('src/app/components/chat/MainLayout/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if i == 195:
        new_lines.append("      <Toasts />\n")
    elif i > 195 and i < 267:
        pass
    elif i == 268:
        new_lines.append("      <Header />\n")
    elif i > 268 and i < 534:
        pass
    elif i == 539:
        new_lines.append("        <Sidebar />\n")
    elif i > 539 and i < 804:
        pass
    elif i == 809:
        new_lines.append("            <MessageList />\n")
    elif i > 809 and i < 1146:
        pass
    elif i == 1149:
        new_lines.append("            <Composer />\n")
    elif i > 1149 and i < 1507:
        pass
    elif i == 1510:
        new_lines.append("          <RightSidebar />\n")
    elif i > 1510 and i < 1825:
        pass
    elif i == 1825:
        new_lines.append("      <Modals />\n")
    elif i > 1825 and i < len(lines)-4:
        pass
    else:
        new_lines.append(line)

# Add imports for these 7 components
import_lines = [
    "import { Toasts } from '../Toasts';\n",
    "import { Header } from '../Header';\n",
    "import { Sidebar } from '../Sidebar';\n",
    "import { MessageList } from '../MessageList';\n",
    "import { Composer } from '../Composer';\n",
    "import { RightSidebar } from '../RightSidebar';\n",
    "import { Modals } from '../Modals';\n"
]

# Insert imports after existing imports
last_import_idx = 0
for i, line in enumerate(new_lines):
    if line.startswith('import '):
        last_import_idx = i

new_lines = new_lines[:last_import_idx+1] + import_lines + new_lines[last_import_idx+1:]

with open('src/app/components/chat/MainLayout/index.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("MainLayout updated!")
