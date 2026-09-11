import sys

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

# Fix IC_DIP3D Notch
content = content.replace(
    '<mesh position={[-size.w / 2 + 0.1, 0, size.d / 2 + 0.005]}>',
    '<mesh position={[-size.w / 2 + 0.1, 0, size.d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>'
)

# Fix IC_DIP3D Pin 1 Dot
content = content.replace(
    '<mesh position={[-size.w / 2 + 0.8, -size.h / 2 + 0.8, size.d / 2 + 0.005]}>',
    '<mesh position={[-size.w / 2 + 0.8, -size.h / 2 + 0.8, size.d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>'
)

# Fix IC_SOIC3D Pin 1 Dot
content = content.replace(
    '<mesh position={[-size.w / 2 + 0.5, -size.h / 2 + 0.5, size.d / 2 + 0.005]}>',
    '<mesh position={[-size.w / 2 + 0.5, -size.h / 2 + 0.5, size.d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>'
)

# Fix IC_QFP3D Pin 1 Dot
content = content.replace(
    '<mesh position={[-size.w / 2 + 0.8, -size.h / 2 + 0.8, size.d / 2 + 0.005]}>',
    '<mesh position={[-size.w / 2 + 0.8, -size.h / 2 + 0.8, size.d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>'
)

# Fix Fuse Body and Caps
# They had rotation={[0, Math.PI / 2, 0]} which rotates around Y (doing nothing to a Y-aligned cylinder)
# They should be rotation={[0, 0, Math.PI / 2]} to align along X axis.
content = content.replace(
    '<mesh position={[0, 0, bodyZ]} rotation={[0, Math.PI / 2, 0]} castShadow>',
    '<mesh position={[0, 0, bodyZ]} rotation={[0, 0, Math.PI / 2]} castShadow>'
)
content = content.replace(
    '<mesh position={[0, 0, bodyZ]} rotation={[0, Math.PI / 2, 0]}>',
    '<mesh position={[0, 0, bodyZ]} rotation={[0, 0, Math.PI / 2]}>'
)
content = content.replace(
    '<mesh position={[-size.w * 0.42, 0, bodyZ]} rotation={[0, Math.PI / 2, 0]} castShadow>',
    '<mesh position={[-size.w * 0.42, 0, bodyZ]} rotation={[0, 0, Math.PI / 2]} castShadow>'
)
content = content.replace(
    '<mesh position={[size.w * 0.42, 0, bodyZ]} rotation={[0, Math.PI / 2, 0]} castShadow>',
    '<mesh position={[size.w * 0.42, 0, bodyZ]} rotation={[0, 0, Math.PI / 2]} castShadow>'
)

with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
    f.write(content)
print("Rotations fixed")
