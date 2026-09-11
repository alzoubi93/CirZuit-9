import re

with open('src/pages/Editor.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '<PcbEditor\n                  schematic={project.doc}\n                  pcb={project.doc.pcb}',
    '<PcbEditor\n                  schematic={project.doc}\n                  pcb={project.doc.pcb}\n                  onUndo={handleUndo}\n                  onRedo={handleRedo}\n                  canUndo={history.length > 0}\n                  canRedo={redoStack.length > 0}'
)

with open('src/pages/Editor.tsx', 'w') as f:
    f.write(content)
