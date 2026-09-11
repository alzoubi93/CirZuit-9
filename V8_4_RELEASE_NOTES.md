# V8.4 Release Notes

## Schematic ↔ PCB Integration

V8.4 extends the V8.3 Component Linking foundation into an electrical synchronization layer.

### New

- Persistent PCB net registry.
- Stable schematic net keys.
- Pin → Pad → Net propagation.
- Track and via net annotation.
- Schematic/PCB validation API.
- ECO net change detection.
- Multi-unit metadata and validation foundation.
- PCB synchronization metadata.
- Assignment reconciliation helper.

### Important behavior

KiCad and CirZuit Footprints continue to use the same Component Link system and the same CirZuit PCB rendering environment.

Electrical connectivity is represented independently from visual Footprint geometry.

### Safety change

PCB tracks are no longer automatically removed solely because a schematic synchronization pass detects a mismatch. The mismatch is recorded so the user can review it.
