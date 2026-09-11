import sys

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

esp32_target = """export const ESP32Module3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    const rawHoles = getComponentHoles(fp, size, "header");
    return rawHoles.map(h => ({
      ...h,
      relativeX: h.relativeY,
      relativeY: -h.relativeX
    }));
  }, [fp, size]);
  const bt = fp?.boardThickness || 1.6;

  const isESP8266 = (fp.value || fp.footprint || fp.name || "").toLowerCase().includes("8266");
  const moduleColor = isESP8266 ? "#1565c0" : "#121212"; // Blue for ESP8266, Matte Black for ESP32

  const boardW = size.w || (isESP8266 ? 48.0 : 54.61);
  const boardH = size.h || (isESP8266 ? 25.4 : 27.94);
  const boardD = 1.2;
  const zPCB = 4.0; // bottom of raised board
  const pcbMidZ = zPCB + boardD / 2; // 4.6
  const pcbTopZ = zPCB + boardD; // 5.2

  const rotZ = typeof rotation === "number" ? rotation : (Array.isArray(rotation) ? rotation[2] : (rotation?.z ?? 0));
  const adjustedRotation: [number, number, number] = [
    Array.isArray(rotation) ? rotation[0] : (rotation?.x ?? 0),
    Array.isArray(rotation) ? rotation[1] : (rotation?.y ?? 0),
    rotZ + Math.PI / 2
  ];

  return (
    <group position={position} rotation={adjustedRotation}"""

esp32_replacement = """export const ESP32Module3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);
  const bt = fp?.boardThickness || 1.6;

  const isESP8266 = (fp.value || fp.footprint || fp.name || "").toLowerCase().includes("8266");
  const moduleColor = isESP8266 ? "#1565c0" : "#121212"; // Blue for ESP8266, Matte Black for ESP32

  const boardW = size.w || (isESP8266 ? 48.0 : 54.61);
  const boardH = size.h || (isESP8266 ? 25.4 : 27.94);
  const boardD = 1.2;
  const zPCB = 4.0; // bottom of raised board
  const pcbMidZ = zPCB + boardD / 2; // 4.6
  const pcbTopZ = zPCB + boardD; // 5.2

  return (
    <group position={position} rotation={rotation}"""

if esp32_target in content:
    content = content.replace(esp32_target, esp32_replacement)
    with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
        f.write(content)
    print("Fixed ESP32")
else:
    print("ESP32 target not found")

