# Official KiCad Symbol Library Source

CirZuit uses the official KiCad symbol library repository as its authoritative external source:

https://gitlab.com/kicad/libraries/kicad-symbols.git

The current `master` branch is the official KiCad 10.x library layout. Libraries are stored as
`<Library>.kicad_symdir/` directories containing individual `.kicad_sym` files. Older KiCad 9/8/7
packed `.kicad_sym` layouts are supported as a compatibility fallback.

## Runtime loading strategy

1. Query the official GitLab repository API for the selected `.kicad_symdir`.
2. Discover every `.kicad_sym` file without an artificial 10-page limit.
3. Fetch symbol files in small concurrent batches.
4. Parse the original KiCad S-expression without rewriting individual symbol geometry.
5. Render the native KiCad object model in CirZuit's KiCad renderer.

If the network/API is unavailable, the application falls back to its built-in library-name list;
it does not silently fabricate symbol geometry.

## License

The official KiCad symbol libraries are published under CC BY-SA 4.0. CirZuit's use of the
library source must preserve the applicable attribution and share-alike requirements.
