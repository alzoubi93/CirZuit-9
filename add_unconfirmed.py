import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Add unconfirmedTracks state
state_search = "const [draftTrack, setDraftTrack] = useState<{ x: number; y: number }[] | null>(null);"
state_replace = state_search + "\n  const [unconfirmedTracks, setUnconfirmedTracks] = useState<PcbTrack[]>([]);"
content = content.replace(state_search, state_replace)

# Modify cancelDraft
cancel_search = "const cancelDraft = () => { setDraftTrack(null); setMeasureA(null); };"
cancel_replace = "const cancelDraft = () => { setDraftTrack(null); setMeasureA(null); setUnconfirmedTracks([]); };"
content = content.replace(cancel_search, cancel_replace)

# Modify useEffect for tool change
effect_search = """  useEffect(() => {
    setDraftTrack(null);
    setMeasureA(null);
  }, [tool]);"""
effect_replace = """  useEffect(() => {
    setDraftTrack(null);
    setMeasureA(null);
    setUnconfirmedTracks([]);
  }, [tool]);"""
content = content.replace(effect_search, effect_replace)

# Modify handleKeyDown for Escape
escape_search = """      } else if (e.key === "Escape") {
        setDraftTrack(null);
        setMeasureA(null);
      }"""
escape_replace = """      } else if (e.key === "Escape") {
        setDraftTrack(null);
        setMeasureA(null);
        setUnconfirmedTracks([]);
      }"""
content = content.replace(escape_search, escape_replace)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
