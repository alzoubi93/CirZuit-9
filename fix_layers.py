import sys

with open("src/components/editor/ThreeDPreview.tsx", "r") as f:
    content = f.read()

target = """                  { label: isAr ? "الشبكة الأرضية" : "Grid", state: showGrid, set: setShowGrid },
                ].map((l, i) => ("""
replacement = """                  { label: isAr ? "الشبكة الأرضية" : "Grid", state: showGrid, set: setShowGrid },
                  { label: isAr ? "اللحام السفلي" : "Bottom Solder", state: showBottomSolder, set: setShowBottomSolder },
                ].map((l, i) => ("""

content = content.replace(target, replacement)

with open("src/components/editor/ThreeDPreview.tsx", "w") as f:
    f.write(content)
print("Updated Layers")
