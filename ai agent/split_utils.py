import os

with open('src/utils/chat.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# We can just manually split it because it's only 567 lines.
# But let's just make sure we are correctly distributing lines.
# Instead of doing that, let me just split the file roughly in half based on export statements!
# Wait, if I re-export, I have to update all imports?
# Yes, or chat.ts can just be:
# export * from './format';
# export * from './markdown';
