import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Add Check icon to imports if not there
if "Check," not in content and "Check " not in content:
    content = content.replace('import {', 'import { Check,', 1)

# Add Confirm button
search_button = """          </svg>

          {/* Floating Left Properties Button & Actions (Matching Schematic) */}"""

replace_button = """          </svg>

          {/* Floating Confirm Track Button */}
          {(unconfirmedTracks.length > 0 || draftTrack) && tool === "track" && (
            <div className="absolute bottom-6 right-6 z-30">
              <Button
                variant="default"
                size="icon"
                className="size-12 rounded-full shadow-xl shadow-green-900/20 bg-green-600 hover:bg-green-500 text-white border-2 border-green-400/30 transition-transform hover:scale-105"
                onClick={() => {
                  if (unconfirmedTracks.length > 0) {
                    commitHistory();
                    setPcb((d) => ({ ...d, tracks: [...d.tracks, ...unconfirmedTracks] }), true);
                    setUnconfirmedTracks([]);
                  }
                  setDraftTrack(null);
                  setRoutingNetId(null);
                  toast.success(
                    lang === "ar"
                      ? "تم التأكيد على المسار بنجاح!"
                      : "Trace confirmed successfully!"
                  );
                }}
              >
                <Check className="size-6" />
              </Button>
            </div>
          )}

          {/* Floating Left Properties Button & Actions (Matching Schematic) */}"""

content = content.replace(search_button, replace_button)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
