// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";

// Mock canvas and window APIs
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    strokeRect: () => {},
    scale: () => {},
    translate: () => {},
    rotate: () => {},
    measureText: () => ({ width: 0 }),
  })) as any;
}

if (typeof window !== "undefined") {
  window.matchMedia = window.matchMedia || function() {
    return {
      matches: false,
      addListener: function() {},
      removeListener: function() {},
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return false; },
    };
  } as any;
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
  window.requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
  window.cancelAnimationFrame = (id: any) => clearTimeout(id);
}

// Let's import the components
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import Editor from "./pages/Editor";
import { SimulationModule } from "./components/editor/SimulationModule";
import { Canvas } from "./components/editor/Canvas";
import { PcbEditor } from "./components/editor/PcbEditor";
import { SchematicDoc } from "./lib/schematic";
import { emptyPcbDoc } from "./lib/pcb";
import * as db from "./lib/db";

vi.spyOn(db, "getProject").mockResolvedValue({
  id: "test-id",
  name: "Test Project",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  doc: {
    nodes: [
      { id: "node-1", symbol: "resistor", x: 100, y: 100, rotation: 0, reference: "R1", value: "1k", pins: [] },
    ],
    wires: [],
    canvasColor: "white",
    defaultWireColor: "black",
    defaultElementColor: "black",
    netLabels: [],
    pcb: emptyPcbDoc(),
  },
});

describe("Reproduce Maximum update depth exceeded", () => {
  it("renders Canvas without error", () => {
    const doc: SchematicDoc = {
      nodes: [
        { id: "node-1", symbol: "resistor", x: 100, y: 100, rotation: 0, reference: "R1", value: "1k", pins: [] },
      ],
      wires: [],
      canvasColor: "white",
      defaultWireColor: "black",
      defaultElementColor: "black",
      netLabels: [],
      pcb: emptyPcbDoc(),
    };

    const { unmount } = render(
      <Canvas
        doc={doc}
        setDoc={() => {}}
        commitHistory={() => {}}
        tool="select"
        setTool={() => {}}
        selectedIds={[]}
        setSelectedIds={() => {}}
        selectedWireIds={[]}
        setSelectedWireIds={() => {}}
        wireColor="black"
        clipboard={null}
        setClipboard={() => {}}
        selectedTrackId={null}
        setSelectedTrackId={() => {}}
        selectedPin={null}
        setSelectedPin={() => {}}
        highlightedNetIds={[]}
        placement={{ symbol: "resistor", rotation: 0 }}
        setPlacement={() => {}}
      />
    );
    unmount();
  });

  it("renders SimulationModule without error", () => {
    const doc: SchematicDoc = {
      nodes: [
        { id: "node-1", symbol: "resistor", x: 100, y: 100, rotation: 0, reference: "R1", value: "1k", pins: [] },
        { id: "node-2", symbol: "dc_voltage", x: 200, y: 100, rotation: 0, reference: "V1", value: "5V", pins: [] },
      ],
      wires: [],
      canvasColor: "white",
      defaultWireColor: "black",
      defaultElementColor: "black",
      netLabels: [],
      pcb: emptyPcbDoc(),
    };

    const { unmount } = render(
      <SimulationModule
        open={true}
        onClose={() => {}}
        doc={doc}
        schematic={doc}
        lang="ar"
      />
    );
    unmount();
  });

  it("renders PcbEditor without error", () => {
    const doc: SchematicDoc = {
      nodes: [],
      wires: [],
      canvasColor: "white",
      defaultWireColor: "black",
      defaultElementColor: "black",
      netLabels: [],
      pcb: emptyPcbDoc(),
    };

    const { unmount } = render(
      <PcbEditor
        pcb={doc.pcb!}
        schematic={doc}
        setPcb={() => {}}
        setMode={() => {}}
        commitHistory={() => {}}
      />
    );
    unmount();
  });

  it("renders Editor page with a project", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/editor/test-id`]}>
        <Routes>
          <Route path="/editor/:id" element={<Editor />} />
        </Routes>
      </MemoryRouter>
    );
    unmount();
  });
});
