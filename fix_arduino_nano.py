import sys

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

target = """export const ArduinoNano3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    const rawHoles = getComponentHoles(fp, size, "header");
    return rawHoles.map(h => ({
      ...h,
      relativeX: -h.relativeY,
      relativeY: h.relativeX
    }));
  }, [fp, size]);
  const bt = fp?.boardThickness || 1.6;

  const isMini = (fp.value || fp.footprint || fp.name || "").toLowerCase().includes("mini") || (fp.reference || "").toLowerCase().includes("mini");
  const moduleColor = "#005a9c"; // Royal Arduino Blue

  const boardW = size.w || (isMini ? 33.02 : 43.18);
  const boardH = size.h || 17.78;
  const boardD = 1.2;
  const zPCB = 4.0; // bottom of raised board
  const pcbMidZ = zPCB + boardD / 2; // 4.6
  const pcbTopZ = zPCB + boardD; // 5.2

  const rotZ = typeof rotation === "number" ? rotation : (Array.isArray(rotation) ? rotation[2] : (rotation?.z ?? 0));
  const adjustedRotation: [number, number, number] = [
    Array.isArray(rotation) ? rotation[0] : (rotation?.x ?? 0),
    Array.isArray(rotation) ? rotation[1] : (rotation?.y ?? 0),
    rotZ - Math.PI / 2
  ];

  return (
    <group position={position} rotation={adjustedRotation}"""

replacement = """export const ArduinoNano3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);
  const bt = fp?.boardThickness || 1.6;

  const isMini = (fp.value || fp.footprint || fp.name || "").toLowerCase().includes("mini") || (fp.reference || "").toLowerCase().includes("mini");
  const moduleColor = "#005a9c"; // Royal Arduino Blue

  const boardW = size.w || (isMini ? 33.02 : 43.18);
  const boardH = size.h || 17.78;
  const boardD = 1.2;
  const zPCB = 4.0; // bottom of raised board
  const pcbMidZ = zPCB + boardD / 2; // 4.6
  const pcbTopZ = zPCB + boardD; // 5.2

  return (
    <group position={position} rotation={rotation}"""

if target in content:
    content = content.replace(target, replacement)
    with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
        f.write(content)
    print("Fixed Arduino Nano")
else:
    print("Target not found")
