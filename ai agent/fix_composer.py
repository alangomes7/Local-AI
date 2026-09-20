with open('src/app/components/chat/Composer/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = lines[:-3] + ['            </div>\n', '          </div>\n'] + lines[-3:]
with open('src/app/components/chat/Composer/index.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
