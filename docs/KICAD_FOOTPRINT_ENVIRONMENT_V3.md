# KiCad Footprint Environment V3

## What changed

V3 fixes the V2 browser architecture and network failure path.

### 1. Official source remains KiCad GitLab

The authoritative source is:

https://gitlab.com/kicad/libraries/kicad-footprints

Project ID: `21601606`

The application does not copy the library into CirZuit. It discovers `.pretty` libraries and loads `.kicad_mod` files on demand.

### 2. Browser transport

The V2 implementation attempted browser-to-GitLab requests directly. In environments that block the cross-origin request this resulted in the unhelpful `Failed to fetch` error.

V3 adds a Vite development proxy:

`/kicad-gitlab/*` → `https://gitlab.com/*`

The client tries the same-origin proxy first and falls back to direct GitLab access when the deployment permits CORS.

For a production deployment, the hosting platform should provide an equivalent same-origin server-side proxy if direct GitLab CORS is unavailable.

### 3. Browser UI

The Footprint Browser is now explicitly divided into three areas:

- Official Libraries
- Footprints in the selected library
- Preview / metadata / actions

The user first chooses a library, then loads/searches its `.kicad_mod` entries, then previews and imports one.

Actions:

- Refresh catalog
- Open official GitLab library
- Load library
- Search selected library
- Preview footprint
- Import & Place
- Generate New Footprint

### 4. Symbol/Footprint separation

Symbol import remains completely independent from Footprint import.

No Footprint is downloaded or assigned during Symbol import.

### 5. Generator integration

The existing CirZuit Footprint Generator remains a separate creation path and is exposed from the Footprint Browser.

Both imported and generated footprints are intended to converge on CirZuit's native PCB Footprint model.

## Important deployment note

A purely static browser cannot guarantee access to GitLab if the hosting environment blocks cross-origin API/raw requests. In that case, the application needs a same-origin server/API proxy. V3 includes the Vite development proxy for the development/preview environment.

Do not replace the official KiCad repository with an unofficial mirror merely to bypass CORS.
