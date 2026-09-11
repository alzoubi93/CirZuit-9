import sys

with open("src/components/editor/ThreeDPreview.tsx", "r") as f:
    content = f.read()

content = content.replace("<color attach=\"background\"", "<BoardConfigContext.Provider value={{ showBottomSolder, solderColor, trackColor }}>\n          <color attach=\"background\"")
content = content.replace("        </Canvas>", "          </BoardConfigContext.Provider>\n        </Canvas>")

with open("src/components/editor/ThreeDPreview.tsx", "w") as f:
    f.write(content)
print("Wrapped with Provider")
