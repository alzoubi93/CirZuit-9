import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Make the properties panel slightly wider and look better
content = content.replace('className="w-80 border-s bg-card', 'className="w-80 md:w-96 border-s bg-slate-900/95 backdrop-blur-md')
content = content.replace('bg-muted/20 shrink-0', 'bg-slate-900/50 shrink-0 border-b border-slate-800')

# Also wait, what about "عنصر أو سلك" at the bottom of the screen?
# Is it possible the text is rendered by dragText?
# No, we checked dragText.

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
