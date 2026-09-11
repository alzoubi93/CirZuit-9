import sys

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

target = """  if (map) {
    const fallbackNode = (
      <Fallback position={pos} rotation={rot} size={enhancedSize} fp={common.fp}
        isSelected={common.isSelected} isHovered={common.isHovered}
        onSelect={common.onSelect} onHover={common.onHover} />
    );"""

replacement = """  // Normalize axial components (Resistor, Diode, Fuse, Inductor)
  // If their pads are oriented vertically in local space, rotate them by 90 deg
  const isAxial = ["resistor", "diode", "fuse", "inductor"].includes(model.type);
  let finalRot = [...rot] as [number, number, number];
  let finalSize = { ...enhancedSize };
  let finalFp = { ...common.fp };

  if (isAxial && meas.width > meas.length * 1.2) {
    // Pads are vertical. Rotate the component by 90 degrees on Z
    finalRot[2] += Math.PI / 2;
    // Swap width and length for the model rendering
    finalSize.w = enhancedSize.h;
    finalSize.h = enhancedSize.w;
    
    // Rotate the pads in local space by -90 degrees so they match the rotated component
    if (finalFp.pads && Array.isArray(finalFp.pads)) {
      finalFp = {
        ...finalFp,
        pads: finalFp.pads.map((p: any) => ({
          ...p,
          x: p.y,
          y: -p.x
        }))
      };
    }
  }

  if (map) {
    const fallbackNode = (
      <Fallback position={pos} rotation={finalRot} size={finalSize} fp={finalFp}
        isSelected={common.isSelected} isHovered={common.isHovered}
        onSelect={common.onSelect} onHover={common.onHover} />
    );"""

if target not in content:
    print("Target not found")
else:
    content = content.replace(target, replacement)
    
    # Also replace for the fallback return
    target2 = """  return (
    <FrustumCulled>
      <Fallback position={pos} rotation={rot} size={enhancedSize} fp={common.fp}
        isSelected={common.isSelected} isHovered={common.isHovered}
        onSelect={common.onSelect} onHover={common.onHover} />
    </FrustumCulled>
  );"""
    replacement2 = """  return (
    <FrustumCulled>
      <Fallback position={pos} rotation={finalRot} size={finalSize} fp={finalFp}
        isSelected={common.isSelected} isHovered={common.isHovered}
        onSelect={common.onSelect} onHover={common.onHover} />
    </FrustumCulled>
  );"""
    
    content = content.replace(target2, replacement2)
    
    # Also fix GLBComponent passing
    target3 = """            <GLBComponent url={map.glb} position={pos} rotation={rot} fp={common.fp}
              size={enhancedSize}"""
    replacement3 = """            <GLBComponent url={map.glb} position={pos} rotation={finalRot} fp={finalFp}
              size={finalSize}"""
    content = content.replace(target3, replacement3)

    with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
        f.write(content)
    print("Axial normalization injected")
