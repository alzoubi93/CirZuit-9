import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Update PcbEditorProps
content = content.replace(
    '  lang: string;\n}',
    '  lang: string;\n  onUndo?: () => void;\n  onRedo?: () => void;\n  canUndo?: boolean;\n  canRedo?: boolean;\n}'
)

content = content.replace(
    '  lang,\n}: PcbEditorProps) {',
    '  lang,\n  onUndo,\n  onRedo,\n  canUndo,\n  canRedo,\n}: PcbEditorProps) {'
)

# Add Undo/Redo buttons to Left Action Menu in PCB
# Right after:
# <div className="h-px w-full bg-slate-800/80" />
# <Button ... Settings2 ... />

undo_redo_buttons = '''
                      <div className="h-px w-full bg-slate-800/80" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-none text-slate-300 hover:text-white hover:bg-slate-800/50"
                        onClick={onUndo}
                        disabled={!canUndo}
                        title={lang === "ar" ? "تراجع" : "Undo"}
                      >
                        <Undo2 className="h-5 w-5" />
                      </Button>
                      <div className="h-px w-full bg-slate-800/80" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-none text-slate-300 hover:text-white hover:bg-slate-800/50"
                        onClick={onRedo}
                        disabled={!canRedo}
                        title={lang === "ar" ? "إعادة" : "Redo"}
                      >
                        <Redo2 className="h-5 w-5" />
                      </Button>
'''

content = content.replace(
    '<SlidersHorizontal className="h-5 w-5 text-slate-300" />\n                </Button>',
    '<SlidersHorizontal className="h-5 w-5 text-slate-300" />\n                </Button>' + undo_redo_buttons
)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
