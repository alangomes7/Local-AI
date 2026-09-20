import re

with open('src/store/chatStore.ts', 'r', encoding='utf-8') as f:
    store = f.read()

props = re.findall(r'^\s*([a-zA-Z0-9_]+):', store, re.MULTILINE)

with open('src/hooks/useChatRefs.ts', 'r', encoding='utf-8') as f:
    refs = f.read()
    
ref_props = re.findall(r'^\s*([a-zA-Z0-9_]+Ref|autoScrollEnabled),', refs, re.MULTILINE)

print("const {")
print("  " + ", ".join(props))
print("} = useChatStore();")

print("const {")
print("  " + ", ".join(ref_props))
print("} = useChatRefs();")

