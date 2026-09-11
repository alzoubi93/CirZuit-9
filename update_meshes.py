import sys
import re

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

bottom_solder_mesh_def = """export const BottomSolderMesh = ({ position, rotation, children }: any) => {
  const { showBottomSolder } = React.useContext(BoardConfigContext);
  if (!showBottomSolder) return null;
  return <mesh position={position} rotation={rotation}>{children}</mesh>;
};
"""

if "export const BottomSolderMesh" not in content:
    content = content.replace("export const BoardConfigContext", bottom_solder_mesh_def + "\nexport const BoardConfigContext")
    print("Added BottomSolderMesh component")

# Regex to find:
# <mesh position={[... -bt - 0.05]} ...> ... </mesh>
# Wait, some are -bt - 0.05, some might be something else. Let's just use string replacement on known lines.
# Actually, the string `-bt - 0.05` is very unique! Let's find all mesh tags that contain `-bt - 0.05` or `-bt - 0.7`?
# Wait, `-bt - 0.05` is for the solder fillet.
# Let's use regex to replace `<mesh position={[..., -bt - 0.05]} ...> ... </mesh>`

def replacer(match):
    # match.group(0) is the entire `<mesh ...> ... </mesh>` block
    m_text = match.group(0)
    m_text = m_text.replace("<mesh", "<BottomSolderMesh", 1)
    m_text = m_text.replace("</mesh>", "</BottomSolderMesh>")
    return m_text

# Regex: <mesh position=\{[^}]*-bt - 0.05[^}]*\}[^>]*>.*?</mesh>
# re.DOTALL so .*? matches newlines
content = re.sub(r'<mesh\s+position=\{[^}]*-bt - 0\.05[^}]*\}[^>]*>.*?</mesh>', replacer, content, flags=re.DOTALL)

with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
    f.write(content)

