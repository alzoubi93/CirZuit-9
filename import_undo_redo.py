import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'MousePointer2,\n  Move,',
    'MousePointer2,\n  Move,\n  Undo2,\n  Redo2,'
)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
