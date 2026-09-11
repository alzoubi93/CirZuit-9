import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Replace track insertion
search_track = """        const newTrack: PcbTrack = {
          id: trackId,
          layer: activeLayer === "bottom_copper" ? "bottom_copper" : "top_copper",
          width: selectedTrackWidth,
          points: routePts,
          netId: routingNetId !== null ? routingNetId : undefined
        };
        
        setPcb((d) => ({ ...d, tracks: [...d.tracks, newTrack] }));"""

replace_track = """        const newTrack: PcbTrack = {
          id: trackId,
          layer: activeLayer === "bottom_copper" ? "bottom_copper" : "top_copper",
          width: selectedTrackWidth,
          points: routePts,
          netId: routingNetId !== null ? routingNetId : undefined
        };
        
        setUnconfirmedTracks(prev => [...prev, newTrack]);"""
content = content.replace(search_track, replace_track)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
