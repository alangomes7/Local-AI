import re

with open('src/hooks/useChatLogic.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Match standard useState
state_matches = re.findall(r'const \[([a-zA-Z0-9_]+), set([a-zA-Z0-9_]+)\] = useState(?:<([^>]+)>)?\((.*?)\);', text, re.DOTALL)

for match in state_matches:
    var_name = match[0]
    setter = "set" + match[1]
    type_annotation = match[2] if match[2] else ""
    initial_value = match[3].strip()
    
    print(f"{var_name}: {initial_value},")
    if type_annotation:
        print(f"{setter}: (val: {type_annotation} | ((prev: {type_annotation}) => {type_annotation})) => set((s) => ({{ {var_name}: typeof val === 'function' ? (val as any)(s.{var_name}) : val }})),")
    else:
        print(f"{setter}: (val: any) => set((s) => ({{ {var_name}: typeof val === 'function' ? (val as any)(s.{var_name}) : val }})),")

