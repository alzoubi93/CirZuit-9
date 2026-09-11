import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Remove toast messages in handlePadRouteClick
content = re.sub(r'toast\.info\([^)]+\);', '', content)
content = re.sub(r'toast\.success\([^)]+\);', '', content)
content = re.sub(r'toast\.warning\([^)]+\);', '', content)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
