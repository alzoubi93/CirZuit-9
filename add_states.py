import sys

with open("src/components/editor/ThreeDPreview.tsx", "r") as f:
    content = f.read()

states = """  const [showStudioMenu, setShowStudioMenu] = useState<boolean>(false);
  const [showBottomSolder, setShowBottomSolder] = useState<boolean>(true);
  const [solderColor, setSolderColor] = useState<string>("#c0c0c0");
  const [trackColor, setTrackColor] = useState<string>(COPPER_COLOR);"""

content = content.replace("  const [showStudioMenu, setShowStudioMenu] = useState<boolean>(false);", states)

with open("src/components/editor/ThreeDPreview.tsx", "w") as f:
    f.write(content)
print("Updated states")
