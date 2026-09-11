import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

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
    '<SlidersHorizontal className="h-5 w-5" />\n                </Button>',
    '<SlidersHorizontal className="h-5 w-5" />\n                </Button>' + undo_redo_buttons
)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
