with open('src/app/components/chat/MainLayout/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def print_bounds(start, end, name):
    print(f"{name}:")
    print(f"  First: {lines[start].strip()}")
    print(f"  Last: {lines[end-1].strip()}")

print_bounds(195, 268, 'Toasts')
print_bounds(268, 534, 'Header')
print_bounds(543, 804, 'Sidebar')
print_bounds(811, 1146, 'MessageList')
print_bounds(1146, 1510, 'Composer')
print_bounds(1510, 1825, 'RightSidebar')
print_bounds(1825, len(lines)-4, 'Modals') # -4 to avoid closing tags of MainLayout
