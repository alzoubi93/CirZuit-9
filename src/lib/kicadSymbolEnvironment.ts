/**
 * Public KiCad Symbol Environment kernel.
 *
 * This is the runtime boundary used by CirZuit. The S-expression reader is
 * deliberately kept behind it; callers work with KiCad-style symbol objects,
 * unit/body-style resolution and diagnostics rather than hand-built symbol
 * definitions.
 */
import {
  createKicadSymbolEnvironment,
  resolveKicadUnit,
  parseKiCadSymbolLib,
  importKiCadSymbolLibrary,
  kicadToSymbolDef,
  registerKiCadSymbol,
  getImportedKiCadSymbols,
  getImportedKiCadSymbol,
  clearImportedKiCadSymbols,
  fetchOfficialKiCadLib,
  fetchOfficialKiCadLibList,
  diagnoseKiCadSymbol,
} from "./kicadSymbol";
import type {
  KicadSymbolEnvironment,
  KiCadParsedSymbol,
  KicadSymbolUnit,
  KiCadPin,
  KiCadGraphic,
  KiCadText,
  KiCadProperty,
  KicadTextEffects,
  KicadTextJustification,
  KicadFont,
  KicadTransform,
  KiCadImportDiagnostic,
} from "./kicadSymbol";
import type { SymbolDef } from "./symbols";
import { renderKiCadSymbol, makeNativeKiCadDrawFn } from "./kicadRenderer";
import type { KiCadRenderOptions } from "./kicadRenderer";

export class KiCadSymbolRuntime {
  private environment: KicadSymbolEnvironment = createKicadSymbolEnvironment([]);
  private libraries = new Map<string, KiCadParsedSymbol[]>();

  loadLibrary(text: string, nickname?: string): { symbols: KiCadParsedSymbol[]; errors: string[] } {
    const result = importKiCadSymbolLibrary(text, nickname);
    if (result.parsed.length) {
      const previous = this.libraries.get(nickname || "__default__") || [];
      const merged = [...previous];
      const seen = new Set(merged.map(s => `${s.libNickname || ""}:${s.name}`));
      for (const symbol of result.parsed) {
        const key = `${symbol.libNickname || ""}:${symbol.name}`;
        if (!seen.has(key)) merged.push(symbol);
      }
      this.libraries.set(nickname || "__default__", merged);
      this.rebuildEnvironment();
    }
    return { symbols: result.parsed, errors: result.errors };
  }

  resolve(name: string, library?: string): KiCadParsedSymbol | undefined {
    return this.environment.resolve(name, library);
  }

  resolveUnit(symbol: KiCadParsedSymbol, unit?: number, bodyStyle?: number) {
    return resolveKicadUnit(symbol, unit, bodyStyle);
  }

  toSymbolDef(symbol: KiCadParsedSymbol, id?: string): SymbolDef {
    return kicadToSymbolDef(symbol, id);
  }

  render(symbol: KiCadParsedSymbol, stroke = "#000", options: KiCadRenderOptions = {}) {
    return renderKiCadSymbol(symbol, stroke, options);
  }

  draw(symbol: KiCadParsedSymbol, options: KiCadRenderOptions = {}) {
    return makeNativeKiCadDrawFn(symbol, options);
  }

  diagnose(symbol: KiCadParsedSymbol): KiCadImportDiagnostic {
    return diagnoseKiCadSymbol(symbol);
  }

  listLoadedSymbols(): KiCadParsedSymbol[] {
    const result: KiCadParsedSymbol[] = [];
    const seen = new Set<string>();
    for (const list of this.libraries.values()) {
      for (const symbol of list) {
        const key = `${symbol.libNickname || ""}:${symbol.name}`;
        if (!seen.has(key)) { seen.add(key); result.push(symbol); }
      }
    }
    return result;
  }

  clear() {
    this.libraries.clear();
    this.environment = createKicadSymbolEnvironment([]);
  }

  private rebuildEnvironment() {
    const all = this.listLoadedSymbols();
    this.environment = createKicadSymbolEnvironment(all);
  }
}

export const kicadSymbolRuntime = new KiCadSymbolRuntime();

export {
  createKicadSymbolEnvironment,
  resolveKicadUnit,
  parseKiCadSymbolLib,
  importKiCadSymbolLibrary,
  kicadToSymbolDef,
  registerKiCadSymbol,
  getImportedKiCadSymbols,
  getImportedKiCadSymbol,
  clearImportedKiCadSymbols,
  fetchOfficialKiCadLib,
  fetchOfficialKiCadLibList,
  diagnoseKiCadSymbol,
  renderKiCadSymbol,
  makeNativeKiCadDrawFn,
};

export type {
  KicadSymbolEnvironment,
  KiCadParsedSymbol,
  KicadSymbolUnit,
  KiCadPin,
  KiCadGraphic,
  KiCadText,
  KiCadProperty,
  KicadTextEffects,
  KicadTextJustification,
  KicadFont,
  KicadTransform,
  KiCadImportDiagnostic,
};
