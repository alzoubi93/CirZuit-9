import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabRect } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export type DisplayPackageType =
  | "Display_OLED_0.96_I2C_4Pin"
  | "Display_OLED_1.3_SPI_7Pin"
  | "Display_7Segment_1Digit_10Pin"
  | "Display_7Segment_4Digit_12Pin"
  | "Display_LCD1602_Parallel_16Pin"
  | "Display_TFT_2.4_SPI_14Pin"
  | "Display_EPaper_FPC_24Pin";

export interface DisplayParams {
  packageType?: DisplayPackageType;
  reference?: string;
  value?: string;
  [key: string]: any;
}

export function generateDisplay(params: DisplayParams): KicadFootprintModel {
  const pkg = params.packageType || "Display_OLED_0.96_I2C_4Pin";
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const ref = params.reference || "DS";

  // 1. OLED 0.96" I2C 4-Pin Module (GND, VCC, SCL, SDA)
  if (pkg === "Display_OLED_0.96_I2C_4Pin") {
    const pitch = 2.54;
    const drill = 1.0;
    const padSize = 1.7;

    for (let i = 0; i < 4; i++) {
      const px = (i - 1.5) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: -11.5, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }

    // Outer PCB outline: 27.8mm x 27.3mm
    graphics.push(...createFabRect(-13.9, -13.6, 13.9, 13.7));
    // OLED Glass area outline: 24.5mm x 14.0mm
    graphics.push(...createFabRect(-12.2, -4.0, 12.2, 10.0));

    graphics.push(createSilkLine(-14.0, -13.7, 14.0, -13.7));
    graphics.push(createSilkLine(14.0, -13.7, 14.0, 13.8));
    graphics.push(createSilkLine(14.0, 13.8, -14.0, 13.8));
    graphics.push(createSilkLine(-14.0, 13.8, -14.0, -13.7));
    graphics.push(createSilkPin1Dot(-1.5 * pitch, -9.5));

    graphics.push(createReferenceText(0, -15.0));
    graphics.push(createValueText(0, 15.0, params.value || "OLED_0.96_I2C"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Display_OLED_0.96_I2C_128x64",
      referencePrefix: ref,
      value: params.value || "OLED_0.96",
      description: "0.96 inch I2C 128x64 OLED Display Module (SSD1306) 4-Pin Header",
      tags: ["Display", "OLED", "I2C", "SSD1306", "128x64"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "display",
      generatorParams: params,
    });
  }

  // 2. OLED 1.3" SPI 7-Pin Module
  if (pkg === "Display_OLED_1.3_SPI_7Pin") {
    const pitch = 2.54;
    const drill = 1.0;
    const padSize = 1.7;

    for (let i = 0; i < 7; i++) {
      const px = (i - 3.0) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: -14.5, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }

    graphics.push(...createFabRect(-17.5, -17.0, 17.5, 17.0));
    graphics.push(...createFabRect(-15.0, -5.0, 15.0, 14.0));
    graphics.push(createSilkPin1Dot(-3.0 * pitch, -12.5));
    graphics.push(createReferenceText(0, -18.5));
    graphics.push(createValueText(0, 18.5, params.value || "OLED_1.3_SPI"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Display_OLED_1.3_SPI_128x64",
      referencePrefix: ref,
      value: params.value || "OLED_1.3",
      description: "1.3 inch SPI 128x64 OLED Display Module (SH1106) 7-Pin Header",
      tags: ["Display", "OLED", "SPI", "SH1106"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "display",
      generatorParams: params,
    });
  }

  // 3. 7-Segment Display 1-Digit 10-Pin (0.56" THT 15.24mm row spacing)
  if (pkg === "Display_7Segment_1Digit_10Pin") {
    const pitch = 2.54;
    const rowSpacing = 15.24;
    const drill = 0.8;
    const padSize = 1.6;

    // Bottom row pins 1..5
    for (let i = 0; i < 5; i++) {
      const px = (i - 2) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: rowSpacing / 2, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }
    // Top row pins 6..10 (left to right 10 down to 6)
    for (let i = 0; i < 5; i++) {
      const px = (2 - i) * pitch;
      pads.push(createThtPad({ number: String(i + 6), x: px, y: -rowSpacing / 2, width: padSize, height: padSize, shape: "oval", drill }));
    }

    // 12.6mm wide x 19.0mm high body
    graphics.push(...createFabRect(-6.3, -9.5, 6.3, 9.5));
    graphics.push(createSilkPin1Dot(-2 * pitch, rowSpacing / 2 - 1.8));
    graphics.push(createReferenceText(0, -10.8));
    graphics.push(createValueText(0, 10.8, params.value || "7Seg_1Digit_0.56"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Display_7Segment_1Digit_0.56inch_THT",
      referencePrefix: ref,
      value: params.value || "7Seg_1D",
      description: "0.56 inch Single-Digit 7-Segment LED Display 10-Pin DIP",
      tags: ["Display", "LED", "7-Segment", "Single-Digit", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "display",
      generatorParams: params,
    });
  }

  // 4. 7-Segment Display 4-Digit 12-Pin (0.56" THT 15.24mm row spacing)
  if (pkg === "Display_7Segment_4Digit_12Pin") {
    const pitch = 2.54;
    const rowSpacing = 15.24;
    const drill = 0.8;
    const padSize = 1.6;

    for (let i = 0; i < 6; i++) {
      const px = (i - 2.5) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: rowSpacing / 2, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }
    for (let i = 0; i < 6; i++) {
      const px = (2.5 - i) * pitch;
      pads.push(createThtPad({ number: String(i + 7), x: px, y: -rowSpacing / 2, width: padSize, height: padSize, shape: "oval", drill }));
    }

    // 50.3mm wide x 19.0mm high body
    graphics.push(...createFabRect(-25.2, -9.5, 25.2, 9.5));
    graphics.push(createSilkPin1Dot(-2.5 * pitch, rowSpacing / 2 - 1.8));
    graphics.push(createReferenceText(0, -10.8));
    graphics.push(createValueText(0, 10.8, params.value || "7Seg_4Digit_0.56"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Display_7Segment_4Digit_0.56inch_THT",
      referencePrefix: ref,
      value: params.value || "7Seg_4D",
      description: "0.56 inch 4-Digit 7-Segment LED Display 12-Pin DIP",
      tags: ["Display", "LED", "7-Segment", "4-Digit", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "display",
      generatorParams: params,
    });
  }

  // 5. LCD1602 Parallel 16-Pin Header (80x36mm module outline)
  if (pkg === "Display_LCD1602_Parallel_16Pin") {
    const pitch = 2.54;
    const drill = 1.0;
    const padSize = 1.7;

    for (let i = 0; i < 16; i++) {
      const px = (i - 7.5) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: -15.5, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }

    // 80mm x 36mm outer board outline
    graphics.push(...createFabRect(-40.0, -18.0, 40.0, 18.0));
    // 71.3mm x 26.3mm metal bezel
    graphics.push(...createFabRect(-35.6, -10.0, 35.6, 16.0));
    graphics.push(createSilkPin1Dot(-7.5 * pitch, -13.5));
    graphics.push(createReferenceText(0, -19.5));
    graphics.push(createValueText(0, 19.5, params.value || "LCD1602_Parallel"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Display_LCD_1602_Parallel_80x36mm",
      referencePrefix: ref,
      value: params.value || "LCD1602",
      description: "Standard 16x2 Character LCD Module 16-Pin Single-Row Header",
      tags: ["Display", "LCD", "1602", "HD44780", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "display",
      generatorParams: params,
    });
  }

  // Default: TFT 2.4" SPI 14-Pin Header
  const pitch = 2.54;
  const drill = 1.0;
  const padSize = 1.7;
  for (let i = 0; i < 14; i++) {
    const px = (i - 6.5) * pitch;
    pads.push(createThtPad({ number: String(i + 1), x: px, y: -25.0, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
  }

  graphics.push(...createFabRect(-22.0, -28.0, 22.0, 28.0));
  graphics.push(createSilkPin1Dot(-6.5 * pitch, -23.0));
  graphics.push(createReferenceText(0, -30.0));
  graphics.push(createValueText(0, 30.0, params.value || "TFT_2.4_SPI"));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

  return buildNativeFootprintModel({
    name: "Display_TFT_2.4inch_SPI_14Pin",
    referencePrefix: ref,
    value: params.value || "TFT_2.4",
    description: "2.4 inch SPI TFT LCD Display Module ILI9341 14-Pin Header",
    tags: ["Display", "TFT", "SPI", "ILI9341", "THT"],
    pads,
    graphics,
    mountingType: "THT",
    generatorFamily: "display",
    generatorParams: params,
  });
}
