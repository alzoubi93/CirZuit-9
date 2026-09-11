import sys

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

# Arduino Uno
uno_bad = """export const ArduinoUno3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
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

uno_good = """export const ArduinoUno3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
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

content = content.replace(uno_bad, uno_good)

# Arduino Nano
nano_bad = """export const ArduinoNano3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
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

nano_good = """export const ArduinoNano3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
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

content = content.replace(nano_bad, nano_good)

# Pico
pico_bad = """export const RaspberryPico3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);
  const bt = fp?.boardThickness || 1.6;

  return (
    <group position={position} rotation={rotation}"""

pico_good = """export const RaspberryPico3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    const rawHoles = getComponentHoles(fp, size, "header");
    return rawHoles.map(h => ({
      ...h,
      relativeX: -h.relativeY,
      relativeY: h.relativeX
    }));
  }, [fp, size]);
  const bt = fp?.boardThickness || 1.6;

  const rotZ = typeof rotation === "number" ? rotation : (Array.isArray(rotation) ? rotation[2] : (rotation?.z ?? 0));
  const adjustedRotation: [number, number, number] = [
    Array.isArray(rotation) ? rotation[0] : (rotation?.x ?? 0),
    Array.isArray(rotation) ? rotation[1] : (rotation?.y ?? 0),
    rotZ - Math.PI / 2
  ];

  return (
    <group position={position} rotation={adjustedRotation}"""

content = content.replace(pico_bad, pico_good)

# ESP32
esp32_bad = """export const ESP32Module3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
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

esp32_good = """export const ESP32Module3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
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

content = content.replace(esp32_bad, esp32_good)

with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
    f.write(content)
print("Reverted")
