import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Render unconfirmed tracks
search_render = """              {pcb.tracks.map((tr) => {"""
replace_render = """              {[...pcb.tracks, ...unconfirmedTracks].map((tr) => {"""
content = content.replace(search_render, replace_render)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
