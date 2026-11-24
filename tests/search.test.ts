import { describe, expect, it } from "vitest";
import { Faults } from "../src/faults.js";
import { EmptyQueryError, normalize, search, tokenize } from "../src/search.js";
import { SEED_CONTENT } from "../src/store.js";

const titles = (q: string, f?: Faults) => search(SEED_CONTENT, q, f).map((h) => h.item.title);

describe("search", () => {
  it("normalises umlauts and ß", () => {
    expect(normalize("Übungen Straße")).toBe("ubungen strasse");
    expect(tokenize("Geometrie: Dreiecke!")).toEqual(["geometrie", "dreiecke"]);
  });

  it("is case insensitive (TC-022)", () => {
    expect(titles("FRACTIONS")).toContain("Fractions: the basics");
  });

  it("finds umlaut content with plain spelling (TC-023)", () => {
    expect(titles("ubungen")).toContain("Übungen zur Bruchrechnung");
  });

  it("returns every match (TC-024)", () => {
    expect(titles("maths")).toHaveLength(2);
  });

  it("ranks title matches above body matches (TC-026)", () => {
    expect(titles("fractions")[0]).toBe("Fractions: the basics");
  });

  it("requires all words of a multi word query (TC-027)", () => {
    expect(titles("linear equations")).toEqual(["Solving linear equations"]);
  });

  it("matches word prefixes", () => {
    expect(titles("photo")).toEqual(["Photosynthesis in five steps"]);
  });

  it("rejects an empty query with EmptyQueryError", () => {
    expect(() => search(SEED_CONTENT, "  ")).toThrow(EmptyQueryError);
  });

  it("seeded faults change the behaviour", () => {
    expect(titles("FRACTIONS", new Faults(["search-case-sensitive"]))).toHaveLength(0);
    expect(titles("maths", new Faults(["search-single-result"]))).toHaveLength(1);
    expect(() => search(SEED_CONTENT, "", new Faults(["search-empty-500"]))).toThrow("query.split is not a function");
  });
});
