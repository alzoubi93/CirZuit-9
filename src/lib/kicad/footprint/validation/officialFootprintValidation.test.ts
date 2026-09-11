import { describe, expect, it } from "vitest";
import { validateOfficialFootprintText } from "./officialFootprintValidation";

const cpAxial=`(footprint "CP_Axial_L11.0mm_D6.0mm_P18.00mm_Horizontal" (version 20241229) (generator "kicad-footprint-generator") (layer "F.Cu") (pad "1" thru_hole roundrect (at 0 0) (size 2.4 2.4) (drill 1.2) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.104167)) (pad "2" thru_hole roundrect (at 18 0) (size 2.4 2.4) (drill 1.2) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.104167)) (model "Capacitor_THT.3dshapes/CP.step"))`;
const soic=`(footprint "SOIC-8_3.9x4.9mm_P1.27mm" (version 20260206) (generator "kicad-footprint-generator") (layer "F.Cu") (pad "1" smd roundrect (at -2.475 -1.905) (size 1.95 0.6) (layers "F.Cu" "F.Mask" "F.Paste") (roundrect_rratio 0.25)) (pad "8" smd roundrect (at 2.475 -1.905) (size 1.95 0.6) (layers "F.Cu" "F.Mask" "F.Paste") (roundrect_rratio 0.25)) (model "Package_SO.3dshapes/SOIC.step"))`;

describe("V8 official footprint validation",()=>{
 it("validates CP_Axial pad spacing",()=>{const r=validateOfficialFootprintText(cpAxial,{name:"Capacitor_THT:CP_Axial_L11.0mm_D6.0mm_P18.00mm_Horizontal",padCount:2,requiredPadCoordinates:[{number:"1",x:0,y:0},{number:"2",x:18,y:0}],requiredShapes:["roundrect"],requiredLayerTokens:["*.Cu","*.Mask"],requires3DModel:true});expect(r.ok).toBe(true);});
 it("validates SOIC roundrect semantics",()=>{const r=validateOfficialFootprintText(soic,{name:"Package_SO:SOIC-8_3.9x4.9mm_P1.27mm",padCount:2,requiredShapes:["roundrect"],requiredLayerTokens:["F.Cu","F.Mask","F.Paste"],requires3DModel:true});expect(r.ok).toBe(true);});
});
