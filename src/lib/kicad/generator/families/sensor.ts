import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabRect, createFabCircle } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export type SensorPackageType =
  | "Sensor_DHT11_DHT22_4Pin"
  | "Sensor_HCSR04_Ultrasonic_4Pin"
  | "Sensor_HCSR501_PIR_3Pin"
  | "Sensor_Hall_Effect_TO92_3Pin"
  | "Sensor_BME280_BMP280_SMD"
  | "Sensor_BME280_Module_6Pin"
  | "Sensor_MPU6050_Module_8Pin"
  | "Sensor_LDR_5mm_Radial";

export interface SensorParams {
  packageType?: SensorPackageType;
  reference?: string;
  value?: string;
  [key: string]: any;
}

export function generateSensor(params: SensorParams): KicadFootprintModel {
  const pkg = params.packageType || "Sensor_DHT11_DHT22_4Pin";
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const ref = params.reference || "U";

  // 1. DHT11 / DHT22 Humidity & Temp Sensor (4-Pin 2.54mm in-line)
  if (pkg === "Sensor_DHT11_DHT22_4Pin") {
    const pitch = 2.54;
    const drill = 0.9;
    const padSize = 1.6;

    for (let i = 0; i < 4; i++) {
      const px = (i - 1.5) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: 0, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }

    // 15.5mm wide x 12.0mm deep body
    graphics.push(...createFabRect(-7.75, -9.0, 7.75, 3.0));
    graphics.push(createSilkLine(-7.85, -9.1, 7.85, -9.1));
    graphics.push(createSilkLine(7.85, -9.1, 7.85, 3.1));
    graphics.push(createSilkLine(7.85, 3.1, -7.85, 3.1));
    graphics.push(createSilkLine(-7.85, 3.1, -7.85, -9.1));
    graphics.push(createSilkPin1Dot(-1.5 * pitch, 1.5));
    graphics.push(createReferenceText(0, -10.2));
    graphics.push(createValueText(0, 4.2, params.value || "DHT11_DHT22"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Sensor_Humidity_DHT11_DHT22",
      referencePrefix: ref,
      value: params.value || "DHT11",
      description: "DHT11 / DHT22 Temperature and Humidity Sensor 4-Pin Single-Row",
      tags: ["Sensor", "Temperature", "Humidity", "DHT11", "DHT22", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "sensor",
      generatorParams: params,
    });
  }

  // 2. HC-SR04 Ultrasonic Distance Sensor (4-Pin 2.54mm, dual 16mm transducers)
  if (pkg === "Sensor_HCSR04_Ultrasonic_4Pin") {
    const pitch = 2.54;
    const drill = 1.0;
    const padSize = 1.7;

    for (let i = 0; i < 4; i++) {
      const px = (i - 1.5) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: 8.5, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }

    // Outer PCB 45.0mm x 20.0mm
    graphics.push(...createFabRect(-22.5, -10.0, 22.5, 10.0));
    // Dual 16mm ultrasonic transducers (Transmitter and Receiver)
    graphics.push(createFabCircle(-13.0, 0, 8.0));
    graphics.push(createFabCircle(13.0, 0, 8.0));
    graphics.push(createSilkCircle(-13.0, 0, 8.1));
    graphics.push(createSilkCircle(13.0, 0, 8.1));
    graphics.push(createSilkPin1Dot(-1.5 * pitch, 6.5));
    graphics.push(createReferenceText(0, -11.2));
    graphics.push(createValueText(0, 11.2, params.value || "HC-SR04"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Sensor_Ultrasonic_HC-SR04",
      referencePrefix: ref,
      value: params.value || "HC-SR04",
      description: "HC-SR04 Ultrasonic Distance Sensor Module 4-Pin",
      tags: ["Sensor", "Ultrasonic", "Distance", "HC-SR04", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "sensor",
      generatorParams: params,
    });
  }

  // 3. HC-SR501 PIR Motion Sensor Module (3-Pin 2.54mm)
  if (pkg === "Sensor_HCSR501_PIR_3Pin") {
    const pitch = 2.54;
    const drill = 1.0;
    const padSize = 1.7;

    pads.push(createThtPad({ number: "1", x: -pitch, y: 10.0, width: padSize, height: padSize, shape: "rect", drill })); // VCC
    pads.push(createThtPad({ number: "2", x: 0, y: 10.0, width: padSize, height: padSize, shape: "oval", drill }));      // OUT
    pads.push(createThtPad({ number: "3", x: pitch, y: 10.0, width: padSize, height: padSize, shape: "oval", drill }));  // GND

    // PCB 32.0mm x 24.0mm
    graphics.push(...createFabRect(-16.0, -12.0, 16.0, 12.0));
    // Fresnel lens dome 23mm diameter
    graphics.push(createFabCircle(0, 0, 11.5));
    graphics.push(createSilkCircle(0, 0, 11.6));
    graphics.push(createSilkPin1Dot(-pitch, 8.0));
    graphics.push(createReferenceText(0, -13.2));
    graphics.push(createValueText(0, 13.2, params.value || "HC-SR501_PIR"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Sensor_Motion_PIR_HC-SR501",
      referencePrefix: ref,
      value: params.value || "HC-SR501",
      description: "HC-SR501 Pyroelectric Infrared PIR Motion Sensor Module",
      tags: ["Sensor", "PIR", "Motion", "Infrared", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "sensor",
      generatorParams: params,
    });
  }

  // 4. Hall Effect Sensor TO-92 3-Pin (A3144)
  if (pkg === "Sensor_Hall_Effect_TO92_3Pin") {
    const pitch = 1.27;
    const drill = 0.7;
    const padSize = 1.3;

    pads.push(createThtPad({ number: "1", x: -pitch, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
    pads.push(createThtPad({ number: "2", x: 0, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
    pads.push(createThtPad({ number: "3", x: pitch, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

    graphics.push(...createFabRect(-2.5, -1.8, 2.5, 1.8));
    graphics.push(createSilkPin1Dot(-pitch, -2.5));
    graphics.push(createReferenceText(0, -3.2));
    graphics.push(createValueText(0, 3.2, params.value || "A3144_Hall"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Sensor_Magnetic_Hall_Effect_TO-92",
      referencePrefix: ref,
      value: params.value || "A3144",
      description: "Hall Effect Magnetic Sensor TO-92 Package 3-Pin",
      tags: ["Sensor", "Magnetic", "Hall", "A3144", "TO-92", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "sensor",
      generatorParams: params,
    });
  }

  // 5. BME280 / BMP280 SMD (LGA-8 2.5x2.5mm)
  if (pkg === "Sensor_BME280_BMP280_SMD") {
    const pitch = 0.65;
    const padW = 0.35;
    const padH = 0.5;
    const spanX = 2.1;

    for (let i = 0; i < 4; i++) {
      const py = (i - 1.5) * pitch;
      pads.push(createSmdPad({ number: String(i + 1), x: -spanX / 2, y: py, width: padH, height: padW, shape: "roundrect" }));
      pads.push(createSmdPad({ number: String(8 - i), x: spanX / 2, y: py, width: padH, height: padW, shape: "roundrect" }));
    }

    graphics.push(...createFabRect(-1.25, -1.25, 1.25, 1.25));
    graphics.push(createSilkPin1Dot(-spanX / 2 - 0.7, -1.5 * pitch));
    graphics.push(createReferenceText(0, -2.0));
    graphics.push(createValueText(0, 2.0, params.value || "BME280_SMD"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "Sensor_Pressure_BME280_LGA-8_2.5x2.5mm",
      referencePrefix: ref,
      value: params.value || "BME280",
      description: "Bosch Sensortec BME280 / BMP280 Barometric Pressure Sensor LGA-8",
      tags: ["Sensor", "Pressure", "Barometer", "BME280", "BMP280", "SMD", "LGA"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "sensor",
      generatorParams: params,
    });
  }

  // 6. Sensor BME280 Module 6-Pin Header (VCC, GND, SCL, SDA, CSB, SDO)
  if (pkg === "Sensor_BME280_Module_6Pin") {
    const pitch = 2.54;
    const drill = 1.0;
    const padSize = 1.7;

    for (let i = 0; i < 6; i++) {
      const px = (i - 2.5) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: 0, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }

    graphics.push(...createFabRect(-8.5, -6.5, 8.5, 6.5));
    graphics.push(createSilkPin1Dot(-2.5 * pitch, -2.0));
    graphics.push(createReferenceText(0, -7.5));
    graphics.push(createValueText(0, 7.5, params.value || "BME280_Module"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Sensor_BME280_Breakout_Module_6Pin",
      referencePrefix: ref,
      value: params.value || "BME280_MOD",
      description: "BME280 Environmental Sensor Breakout Module 6-Pin 2.54mm",
      tags: ["Sensor", "BME280", "Breakout", "Module", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "sensor",
      generatorParams: params,
    });
  }

  // 7. Sensor MPU6050 Module 8-Pin Header (6-Axis Gyro/Accelerometer)
  if (pkg === "Sensor_MPU6050_Module_8Pin") {
    const pitch = 2.54;
    const drill = 1.0;
    const padSize = 1.7;

    for (let i = 0; i < 8; i++) {
      const px = (i - 3.5) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: 7.5, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }

    graphics.push(...createFabRect(-10.5, -8.0, 10.5, 8.0));
    graphics.push(createSilkPin1Dot(-3.5 * pitch, 5.5));
    graphics.push(createReferenceText(0, -9.2));
    graphics.push(createValueText(0, 9.5, params.value || "MPU6050_Module"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Sensor_Motion_MPU6050_GY521_Module_8Pin",
      referencePrefix: ref,
      value: params.value || "MPU6050",
      description: "MPU-6050 (GY-521) 6-Axis IMU Sensor Breakout Module 8-Pin",
      tags: ["Sensor", "IMU", "Gyroscope", "Accelerometer", "MPU6050", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "sensor",
      generatorParams: params,
    });
  }

  // Default: LDR 5mm Light Sensor (Radial 2-Pin 5mm pitch)
  const pitch = 5.0;
  const drill = 0.8;
  const padSize = 1.6;
  pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
  pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

  graphics.push(createFabCircle(0, 0, 2.7));
  graphics.push(createSilkCircle(0, 0, 2.8));
  graphics.push(createReferenceText(0, -3.8));
  graphics.push(createValueText(0, 3.8, params.value || "LDR_5mm"));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

  return buildNativeFootprintModel({
    name: "Sensor_Optical_LDR_5mm_Radial",
    referencePrefix: "R",
    value: params.value || "LDR",
    description: "Light Dependent Resistor (Photoresistor) 5mm Diameter",
    tags: ["Sensor", "Optical", "LDR", "Photoresistor", "THT"],
    pads,
    graphics,
    mountingType: "THT",
    generatorFamily: "sensor",
    generatorParams: params,
  });
}
