# KiCad Environment V5 Fixes

- Fixed official-library discovery for the current KiCad 10.x `.kicad_symdir` layout.
- Removed the previous ten-page discovery cap for large libraries.
- Added request timeouts and API/raw fallbacks with useful error messages.
- Prefers current official `master` libraries before historical KiCad 9/8/7 packed libraries.
- Added native `text_box` parsing and rendering, which is present in real KiCad symbol libraries.
- Kept KiCad millimetre coordinates and the native renderer as the source of truth.
- `SymbolDef` remains only a legacy compatibility adapter for the existing CirZuit placement layer.
