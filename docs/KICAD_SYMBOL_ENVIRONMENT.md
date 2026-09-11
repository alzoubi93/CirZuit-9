# CirZuit KiCad Symbol Environment

## Purpose

CirZuit now treats a KiCad symbol as a structured symbol definition rather than
as a one-time conversion into a hand-drawn `SymbolDef`.

The runtime boundary is:

```text
.kicad_sym
   │
   ▼
S-expression file reader
   │
   ▼
KiCad Symbol Environment
   ├── symbol metadata / properties
   ├── units
   ├── alternate body styles
   ├── pins
   ├── graphics
   ├── text effects
   ├── transforms
   └── derived-symbol inheritance
   │
   ▼
CirZuit renderer / legacy SymbolDef adapter
```

The parser is therefore only the **file I/O layer**. The semantic model is the
KiCad Symbol Environment.

## Important pin rule

KiCad stores a pin's `at` coordinate at the electrical connection point.
The visible pin body extends from that point toward the symbol according to
the pin orientation and length.

For example:

```text
(at -12.7 2.54 0)
(length 7.62)
```

means the connection point is `(-12.7, 2.54)` and the body reaches toward
`(-5.08, 2.54)`.

CirZuit previously subtracted the pin length, which placed the pin body on the
wrong side of the symbol and caused the detached-pin appearance.

## Unit/body-style model

The environment preserves:

```text
unit
body style
common unit 0 graphics
selected electrical unit
```

The source definition is not permanently flattened when an instance is placed.

## Derived symbols

Symbols using KiCad's `extends` mechanism are materialized through the
environment before rendering. The base symbol supplies the shared graphical
and pin definition while the derived symbol's metadata/overrides are retained.

This prevents derived/alias-like symbols from becoming empty symbols.

## Text

Text, properties, pin names and pin numbers preserve:

- X/Y text size;
- font face;
- bold;
- italic;
- thickness;
- justification;
- mirroring;
- visibility;
- rotation.

All of these use the same rendering model.

## Supported graphics

The environment currently handles:

- polyline;
- rectangle;
- circle;
- arc;
- cubic Bézier;
- text;
- pins.

Unsupported future KiCad constructs should be added to the environment model,
not patched into individual symbols.

## KiCad references

The implementation was designed against KiCad's documented symbol model and
current source architecture, including `LIB_SYMBOL`, `LIB_SYMBOL_UNIT`,
`SCH_PIN`, symbol properties and unit/body-style handling.

Official references:

- https://gitlab.com/kicad/code/kicad
- https://dev-docs.kicad.org/en/file-formats/sexpr-intro/
- https://docs.kicad.org/master/en/eeschema/eeschema.html
