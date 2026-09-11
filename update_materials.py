import sys
import re

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

# Replace <meshStandardMaterial color="#c0c0c0" {...SOLDER_METAL} /> with <SolderMaterial />
content = content.replace('<meshStandardMaterial color="#c0c0c0" {...SOLDER_METAL} />', '<SolderMaterial />')
content = content.replace('<meshStandardMaterial {...SOLDER_METAL} color="#c0c0c0" />', '<SolderMaterial />')

# Let's define SolderMaterial and SolderFillet
solder_material_def = """export const SolderMaterial = () => {
  const { solderColor } = React.useContext(BoardConfigContext);
  return <meshStandardMaterial metalness={0.85} roughness={0.45} color={solderColor || "#c0c0c0"} />;
};

export const TrackMaterial = () => {
  const { trackColor } = React.useContext(BoardConfigContext);
  return <meshStandardMaterial metalness={0.95} roughness={0.32} color={trackColor || COPPER_COLOR} />;
};
"""

if "export const SolderMaterial" not in content:
    content = content.replace("export const BoardConfigContext", solder_material_def + "\nexport const BoardConfigContext")
    print("Added Material components")

# Now, let's just make the Bottom Solder meshes conditional.
# They are generally like:
# <mesh position={[..., -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
#   <coneGeometry ... />
#   <SolderMaterial />
# </mesh>
# We can just wrap them with {showBottomSolder && ( ... )}
# However, `showBottomSolder` needs to be read from context in every component that renders it.
# This requires adding `const { showBottomSolder } = React.useContext(BoardConfigContext);` to many components!

with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
    f.write(content)

