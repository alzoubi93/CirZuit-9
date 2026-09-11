import sys

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

target = """export const ArduinoUno3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    const rawHoles = getComponentHoles(fp, size, "header");
    return rawHoles.map(h => ({
      ...h,
      relativeX: -h.relativeY,
      relativeY: h.relativeX
    }));
  }, [fp, size]);
  const bt = fp?.boardThickness || 1.6;

  const boardW = size.w || 68.6;
  const boardH = size.h || 53.34;
  const boardD = 1.6;
  const zPCB = 1.2; // slight clearance stance
  const pcbMidZ = zPCB + boardD / 2; // 2.0
  const pcbTopZ = zPCB + boardD; // 2.8

  // Main Arduino Teal color
  const boardColor = "#008184"; 

  const rotZ = typeof rotation === "number" ? rotation : (Array.isArray(rotation) ? rotation[2] : (rotation?.z ?? 0));
  const adjustedRotation: [number, number, number] = [
    Array.isArray(rotation) ? rotation[0] : (rotation?.x ?? 0),
    Array.isArray(rotation) ? rotation[1] : (rotation?.y ?? 0),
    rotZ - Math.PI / 2
  ];

  return (
    <group position={position} rotation={adjustedRotation}"""

replacement = """export const ArduinoUno3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);
  const bt = fp?.boardThickness || 1.6;

  const boardW = size.w || 68.6;
  const boardH = size.h || 53.34;
  const boardD = 1.6;
  const zPCB = 1.2; // slight clearance stance
  const pcbMidZ = zPCB + boardD / 2; // 2.0
  const pcbTopZ = zPCB + boardD; // 2.8

  // Main Arduino Teal color
  const boardColor = "#008184"; 

  return (
    <group position={position} rotation={rotation}"""

if target in content:
    content = content.replace(target, replacement)
    with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
        f.write(content)
    print("Fixed Arduino Uno")
else:
    print("Target not found")
