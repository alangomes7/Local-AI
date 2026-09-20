with open('src/app/components/chat/Modals/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("TOP:")
print("".join(lines[65:80]))
print("BOTTOM:")
print("".join(lines[-15:]))
