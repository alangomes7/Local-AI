with open('src/app/components/chat/Modals/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i in range(len(lines)-1, -1, -1):
    if '</>' in lines[i]:
        lines.insert(i, '      )}\n')
        break
with open('src/app/components/chat/Modals/index.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
