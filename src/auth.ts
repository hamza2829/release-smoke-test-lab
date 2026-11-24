import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Faults } from "./faults.js";

export interface User {
  username: string;
  displayName: string;
  role: "editor" | "viewer";
  salt: string;
  hash: string;
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): { salt: string; hash: string } {
  return { salt, hash: scryptSync(password, salt, 32).toString("hex") };
}

/** Demo accounts of the simulated platform (documented in the README, not secrets). */
export function demoUsers(): User[] {
  return [
    { username: "editor", displayName: "Erika Editor", role: "editor", ...hashPassword("editor-pass", "7f1c2a9e0b3d4c5a") },
    { username: "viewer", displayName: "Viktor Viewer", role: "viewer", ...hashPassword("viewer-pass", "a1b2c3d4e5f60718") },
  ];
}

export class Auth {
  private readonly users: Map<string, User>;
  private readonly sessions = new Map<string, { username: string; created: number }>();

  constructor(users: User[] = demoUsers(), private readonly faults: Faults = new Faults()) {
    this.users = new Map(users.map((u) => [u.username, u]));
  }

  login(username: string, password: string): string | null {
    const user = this.users.get(username);
    if (!user) return null;
    if (!this.faults.has("login-any-password")) {
      const candidate = Buffer.from(hashPassword(password, user.salt).hash, "hex");
      const stored = Buffer.from(user.hash, "hex");
      if (!timingSafeEqual(candidate, stored)) return null;
    }
    const token = randomBytes(24).toString("hex");
    this.sessions.set(token, { username, created: Date.now() });
    return token;
  }

  logout(token: string | undefined): void {
    if (!token || this.faults.has("logout-keeps-session")) return;
    this.sessions.delete(token);
  }

  userFor(token: string | undefined): User | null {
    if (!token) return null;
    const s = this.sessions.get(token);
    return s ? (this.users.get(s.username) ?? null) : null;
  }

  activeSessions(): number {
    return this.sessions.size;
  }
}
