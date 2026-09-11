import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Make it look better:
# Replace grid-cols-2 with flex column or better padding
content = content.replace('<div className="grid grid-cols-2 gap-3">', '<div className="grid grid-cols-2 gap-4">')
content = content.replace('bg-muted/20 shrink-0', 'bg-slate-900/50 shrink-0 border-b border-slate-800')
content = content.replace('<aside className="w-80 md:w-96 border-s bg-slate-900/95 backdrop-blur-md flex flex-col overflow-hidden absolute md:relative inset-y-0 end-0 z-40 md:z-auto shadow-lg md:shadow-none transition-all">', '<aside className="w-80 md:w-96 border-s border-slate-800/80 bg-[#090d16]/95 backdrop-blur-xl flex flex-col overflow-hidden absolute md:relative inset-y-0 end-0 z-40 md:z-auto shadow-2xl transition-all">')

# Also fix drag highlight color
# "عندما يضغط المستخدم على زر سحب أجعل لون التظليل بلون ازرق شفاف كما هو الحال في وحدة schematic"
# This means Marquee selection should be blue transparent
content = content.replace('fill="none"\n                  stroke="#3b82f6"\n                  strokeWidth={1}\n                  strokeDasharray="4 2"', 'fill="rgba(59, 130, 246, 0.15)"\n                  stroke="#3b82f6"\n                  strokeWidth={1.5}\n                  strokeDasharray="4 2"')


with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
