import { describe, expect, it } from "vitest";
import { applyDeploy, applyRollback, checkGate, compareVersions, EMPTY_STATE, isValidVersion } from "../envs/state.js";

describe("release state", () => {
  it("validates and compares semantic versions", () => {
    expect(isValidVersion("1.2.3")).toBe(true);
    expect(isValidVersion("1.2")).toBe(false);
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBeLessThan(0);
  });

  it("records the previous version on deploy", () => {
    const s = applyDeploy(applyDeploy(EMPTY_STATE, "1.0.0"), "1.1.0");
    expect(s).toEqual({ current: "1.1.0", history: ["1.0.0"] });
  });

  it("keeps history unchanged when the same version is redeployed", () => {
    const s = applyDeploy(EMPTY_STATE, "1.0.0");
    expect(applyDeploy(s, "1.0.0")).toBe(s);
  });

  it("rolls back to the previous version (TC-005)", () => {
    const s = applyDeploy(applyDeploy(EMPTY_STATE, "1.0.0"), "1.1.0");
    const r = applyRollback(s);
    expect(r.target).toBe("1.0.0");
    expect(r.state).toEqual({ current: "1.0.0", history: [] });
    expect(() => applyRollback(r.state)).toThrow("Nothing to roll back to");
  });

  it("keeps at most 10 previous versions", () => {
    let s = EMPTY_STATE;
    for (let i = 0; i < 15; i++) s = applyDeploy(s, `1.0.${i}`);
    expect(s.history).toHaveLength(10);
    expect(s.history[0]).toBe("1.0.4");
  });

  it("blocks promotion without a matching green gate (TC-004)", () => {
    const gate = { env: "staging", version: "1.1.0", passed: 14, failed: 0, skipped: 0 };
    expect(checkGate(null, "1.1.0").ok).toBe(false);
    expect(checkGate(gate, null).ok).toBe(false);
    expect(checkGate(gate, "1.2.0").reason).toContain("gate report is for 1.1.0");
    expect(checkGate({ ...gate, failed: 1 }, "1.1.0").ok).toBe(false);
    expect(checkGate({ ...gate, passed: 0 }, "1.1.0").ok).toBe(false);
    expect(checkGate(gate, "1.1.0").ok).toBe(true);
  });
});
