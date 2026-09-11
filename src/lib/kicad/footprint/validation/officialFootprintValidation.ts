import { readKicadFootprintDefinition } from "../kicadFootprintReader";
import type { KicadFootprintModel } from "../kicadFootprint";

export interface FootprintValidationIssue { code: string; message: string; }
export interface FootprintValidationReport { ok:boolean; footprint:string; pads:number; graphics:number; models3D:number; issues:FootprintValidationIssue[]; }
export interface FootprintExpectation {
  name:string; padCount?:number; requiredPadNumbers?:string[]; requiredShapes?:string[];
  requiredPadCoordinates?:Array<{number:string;x:number;y:number;tolerance?:number}>;
  requiredLayerTokens?:string[]; requiredGraphicsKinds?:string[]; requires3DModel?:boolean;
}

export function validateFootprintModel(model:KicadFootprintModel, expectation?:FootprintExpectation):FootprintValidationReport {
  const issues:FootprintValidationIssue[]=[];
  if(expectation){
    if(expectation.padCount!==undefined&&model.pads.length!==expectation.padCount)issues.push({code:"PAD_COUNT",message:`Expected ${expectation.padCount} pads, got ${model.pads.length}.`});
    for(const n of expectation.requiredPadNumbers??[])if(!model.pads.some(p=>p.number===n))issues.push({code:"PAD_NUMBER",message:`Missing pad ${n}.`});
    for(const shape of expectation.requiredShapes??[])if(!model.pads.some(p=>p.shape===shape))issues.push({code:"PAD_SHAPE",message:`Missing pad shape ${shape}.`});
    for(const e of expectation.requiredPadCoordinates??[]){const p=model.pads.find(x=>x.number===e.number);if(!p)continue;const t=e.tolerance??1e-6;if(Math.abs(p.position.x-e.x)>t||Math.abs(p.position.y-e.y)>t)issues.push({code:"PAD_POSITION",message:`Pad ${e.number} expected (${e.x},${e.y}), got (${p.position.x},${p.position.y}).`});}
    for(const layer of expectation.requiredLayerTokens??[])if(!model.pads.some(p=>p.layers.includes(layer)))issues.push({code:"PAD_LAYER",message:`No pad contains layer token ${layer}.`});
    for(const kind of expectation.requiredGraphicsKinds??[])if(!model.graphics.some(g=>g.kind===kind))issues.push({code:"GRAPHIC_KIND",message:`Missing graphic kind ${kind}.`});
    if(expectation.requires3DModel&&model.models.length===0)issues.push({code:"MODEL_3D",message:"Expected a 3D model reference."});
  }
  return {ok:issues.length===0,footprint:model.fullName,pads:model.pads.length,graphics:model.graphics.length,models3D:model.models.length,issues};
}
export function validateOfficialFootprintText(text:string, expectation?:FootprintExpectation){return validateFootprintModel(readKicadFootprintDefinition(text,{type:"kicad-official"}),expectation);}

export const OFFICIAL_FOOTPRINT_PROFILES:FootprintExpectation[]=[
 {name:"Package_DIP:DIP-8_W7.62mm",padCount:8,requiredPadNumbers:["1","8"],requiredShapes:["rect"],requiredLayerTokens:["*.Cu","*.Mask"],requires3DModel:true},
 {name:"Package_SO:SOIC-8_3.9x4.9mm_P1.27mm",padCount:8,requiredPadNumbers:["1","8"],requiredShapes:["roundrect"],requiredLayerTokens:["F.Cu","F.Mask","F.Paste"],requires3DModel:true},
 {name:"Capacitor_THT:CP_Axial_L11.0mm_D6.0mm_P18.00mm_Horizontal",padCount:2,requiredPadNumbers:["1","2"],requiredPadCoordinates:[{number:"1",x:0,y:0},{number:"2",x:18,y:0}],requiredLayerTokens:["*.Cu","*.Mask"],requires3DModel:true},
];
