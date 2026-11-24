/**
 * Seeded faults. Each fault re-introduces one realistic bug into the platform so
 * that the ticket generator and the regression verifier have something real to
 * reproduce. Faults are switched on with the FAULTS environment variable
 * (comma separated ids) and are never active by default.
 */
export const FAULT_IDS = [
  "search-case-sensitive",
  "search-empty-500",
  "search-single-result",
  "search-umlaut",
  "save-drops-body",
  "save-title-unescaped",
  "save-empty-title",
  "login-any-password",
  "logout-keeps-session",
  "health-wrong-version",
  "content-missing-500",
  "list-unsorted",
] as const;

export type FaultId = (typeof FAULT_IDS)[number];

export class Faults {
  private readonly active: Set<FaultId>;

  constructor(ids: Iterable<string> = []) {
    const set = new Set<FaultId>();
    for (const raw of ids) {
      const id = raw.trim();
      if (!id) continue;
      if (!(FAULT_IDS as readonly string[]).includes(id)) {
        throw new Error(`Unknown fault id: ${id}`);
      }
      set.add(id as FaultId);
    }
    this.active = set;
  }

  static fromEnv(value: string | undefined): Faults {
    return new Faults((value ?? "").split(","));
  }

  has(id: FaultId): boolean {
    return this.active.has(id);
  }

  list(): FaultId[] {
    return [...this.active].sort();
  }
}
