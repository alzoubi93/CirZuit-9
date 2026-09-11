import sys

with open("src/components/editor/ThreeDPreview.tsx", "r") as f:
    content = f.read()

content = content.replace(
    "  InstancedLED,\n} from \"./ThreeDRealModels\";",
    "  InstancedLED,\n  BoardConfigContext,\n  TrackMaterial,\n} from \"./ThreeDRealModels\";"
)

with open("src/components/editor/ThreeDPreview.tsx", "w") as f:
    f.write(content)
print("Updated imports")
