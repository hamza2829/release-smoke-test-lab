import { describe, expect, it } from "vitest";
import { FAULT_IDS, Faults } from "../src/faults.js";

describe("Faults", () => {
  it("defines 12 unique fault ids", () => {
    expect(FAULT_IDS).toHaveLength(12);
    expect(new Set(FAULT_IDS).size).toBe(12);
  });

  it("parses the FAULTS env value and ignores blanks", () => {
    const f = Faults.fromEnv(" list-unsorted, ,search-umlaut ");
    expect(f.list()).toEqual(["list-unsorted", "search-umlaut"]);
    expect(f.has("save-drops-body")).toBe(false);
  });

  it("is empty by default and rejects unknown ids", () => {
    expect(Faults.fromEnv(undefined).list()).toEqual([]);
    expect(() => new Faults(["typo"])).toThrow("Unknown fault id");
  });
});
