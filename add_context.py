import sys
import re

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

# 1. Add Context definition
context_def = """export const BoardConfigContext = React.createContext({
  showBottomSolder: true,
  solderColor: "#c0c0c0",
  trackColor: COPPER_COLOR,
});
"""

# Insert after SOLDER_METAL
if "export const SOLDER_METAL" in content and "BoardConfigContext" not in content:
    content = content.replace("export const SOLDER_METAL = { metalness: 0.85, roughness: 0.45, color: \"#c0c0c0\" };", 
    "export const SOLDER_METAL = { metalness: 0.85, roughness: 0.45, color: \"#c0c0c0\" };\n\n" + context_def)
    print("Added BoardConfigContext")

with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
    f.write(content)
