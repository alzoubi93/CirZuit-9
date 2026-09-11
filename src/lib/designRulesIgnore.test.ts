import { describe, it, expect } from "vitest";
import { runDesignChecks } from "./designRules";
import { emptyPcbDoc } from "./pcb";
import type { SchematicDoc } from "./schematic";

describe("ERC / DRC Ignore Functionality", () => {
  const sampleDoc: SchematicDoc = {
    nodes: [
      {
        id: "node-1",
        symbol: "resistor",
        x: 100,
        y: 100,
        rotation: 0,
        reference: "R1",
        value: "10k",
        unitIndex: 1,
      },
      {
        id: "node-2",
        symbol: "resistor",
        x: 300,
        y: 100,
        rotation: 0,
        reference: "R1", // Duplicate reference creates ERC error
        value: "10k",
        unitIndex: 1,
      },
    ],
    wires: [],
  };

  it("identifies ERC issues and provides deterministic IDs", () => {
    const res = runDesignChecks(sampleDoc, emptyPcbDoc());
    expect(res.allErc.length).toBeGreaterThan(0);
    expect(res.erc.length).toBeGreaterThan(0);
    expect(res.passed).toBe(false);

    const firstIssue = res.erc[0];
    expect(firstIssue.id).toBeDefined();
    expect(typeof firstIssue.id).toBe("string");
  });

  it("filters out ignored issue IDs and calculates passed status correctly", () => {
    const initialRes = runDesignChecks(sampleDoc, emptyPcbDoc());
    const allIssueIds = initialRes.allErc.map((i) => i.id);

    // Ignore all issues
    const ignoredRes = runDesignChecks(sampleDoc, emptyPcbDoc(), allIssueIds);
    expect(ignoredRes.erc.length).toBe(0);
    expect(ignoredRes.ignoredErc.length).toBe(allIssueIds.length);
    expect(ignoredRes.passed).toBe(true);
  });

  it("supports single-issue ignore and unignore", () => {
    const initialRes = runDesignChecks(sampleDoc, emptyPcbDoc());
    const firstIssueId = initialRes.erc[0].id;

    // Ignore only the first issue
    const partialRes = runDesignChecks(sampleDoc, emptyPcbDoc(), [firstIssueId]);
    expect(partialRes.erc.some((i) => i.id === firstIssueId)).toBe(false);
    expect(partialRes.ignoredErc.some((i) => i.id === firstIssueId)).toBe(true);
    expect(partialRes.allErc.length).toBe(initialRes.allErc.length);

    // Unignore
    const restoredRes = runDesignChecks(sampleDoc, emptyPcbDoc(), []);
    expect(restoredRes.erc.some((i) => i.id === firstIssueId)).toBe(true);
    expect(restoredRes.ignoredErc.length).toBe(0);
  });
});
