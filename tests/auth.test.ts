import { describe, expect, it } from "vitest";
import { Auth, hashPassword } from "../src/auth.js";
import { Faults } from "../src/faults.js";

describe("Auth", () => {
  it("hashes deterministically for a given salt", () => {
    expect(hashPassword("x", "s1").hash).toBe(hashPassword("x", "s1").hash);
    expect(hashPassword("x", "s1").hash).not.toBe(hashPassword("x", "s2").hash);
  });

  it("accepts the right password and returns a session", () => {
    const a = new Auth();
    const sid = a.login("editor", "editor-pass");
    expect(sid).toMatch(/^[0-9a-f]{48}$/);
    expect(a.userFor(sid!)?.displayName).toBe("Erika Editor");
  });

  it("rejects wrong passwords and unknown users the same way (TC-009, TC-010)", () => {
    const a = new Auth();
    expect(a.login("editor", "wrong")).toBeNull();
    expect(a.login("nobody", "editor-pass")).toBeNull();
  });

  it("invalidates the token on logout (TC-014)", () => {
    const a = new Auth();
    const sid = a.login("viewer", "viewer-pass")!;
    a.logout(sid);
    expect(a.userFor(sid)).toBeNull();
    expect(a.activeSessions()).toBe(0);
  });

  it("seeded faults weaken login and logout", () => {
    const a = new Auth(undefined, new Faults(["login-any-password", "logout-keeps-session"]));
    const sid = a.login("editor", "anything")!;
    expect(sid).not.toBeNull();
    a.logout(sid);
    expect(a.userFor(sid)).not.toBeNull();
  });
});
