import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Faults } from "../src/faults.js";
import { ContentStore, NotFoundError, SEED_CONTENT, ValidationError } from "../src/store.js";

const tmpFile = () => join(mkdtempSync(join(tmpdir(), "store-")), "content.json");

describe("ContentStore", () => {
  it("seeds all items and lists them sorted by title", () => {
    const s = new ContentStore(null);
    const titles = s.list().map((i) => i.title);
    expect(titles).toHaveLength(SEED_CONTENT.length);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("throws NotFoundError for unknown ids", () => {
    expect(() => new ContentStore(null).get("nope")).toThrow(NotFoundError);
  });

  it("updates title and body and increments the revision", () => {
    const s = new ContentStore(null);
    const next = s.update("photosynthesis", { title: "Photosynthesis", body: "new" });
    expect(next.revision).toBe(2);
    expect(s.get("photosynthesis").body).toBe("new");
  });

  it("trims the title (TC-033)", () => {
    const s = new ContentStore(null);
    expect(s.update("photosynthesis", { title: "  Fractions  ", body: "x" }).title).toBe("Fractions");
  });

  it("rejects empty and too long titles (TC-031, TC-032)", () => {
    const s = new ContentStore(null);
    expect(() => s.update("photosynthesis", { title: "   ", body: "x" })).toThrow("Title must not be empty");
    expect(() => s.update("photosynthesis", { title: "a".repeat(121), body: "x" })).toThrow(ValidationError);
    expect(s.get("photosynthesis").revision).toBe(1);
  });

  it("persists to disk and reloads after a restart (TC-034)", () => {
    const f = tmpFile();
    new ContentStore(f).update("essay-structure", { title: "Essay", body: "kept" });
    const reloaded = new ContentStore(f);
    expect(reloaded.get("essay-structure").body).toBe("kept");
    expect(JSON.parse(readFileSync(f, "utf8"))).toHaveLength(SEED_CONTENT.length);
  });

  it("normalises Windows line endings in the body", () => {
    const s = new ContentStore(null);
    expect(s.update("photosynthesis", { title: "P", body: "a\r\nb" }).body).toBe("a\nb");
  });

  it("seeded fault save-drops-body keeps the old body", () => {
    const s = new ContentStore(null, new Faults(["save-drops-body"]));
    expect(s.update("photosynthesis", { title: "P", body: "new" }).body).not.toBe("new");
  });
});
