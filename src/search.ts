import type { ContentItem } from "./store.js";
import { Faults } from "./faults.js";

export class EmptyQueryError extends Error {}

/** Lower case, strip accents (ä -> a, ß -> ss) so "uebung", "Ubung" and "Übung" behave sensibly. */
export function normalize(text: string, faults: Faults = new Faults()): string {
  const lower = text.toLowerCase();
  if (faults.has("search-umlaut")) return lower.replace(/[^\x00-\x7f]/g, "");
  return lower
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function tokenize(text: string, faults: Faults = new Faults()): string[] {
  return normalize(text, faults)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

export interface SearchHit {
  item: ContentItem;
  score: number;
}

/**
 * Simple ranked search: every query token must occur (as prefix) in title,
 * subject or body. Title matches weigh 3, subject 2, body 1.
 */
export function search(items: ContentItem[], query: string, faults: Faults = new Faults()): SearchHit[] {
  if (query.trim().length === 0) {
    if (faults.has("search-empty-500")) throw new Error("query.split is not a function");
    throw new EmptyQueryError("Please enter a search term");
  }
  const caseSensitive = faults.has("search-case-sensitive");
  const q = caseSensitive ? query.split(/\s+/).filter(Boolean) : tokenize(query, faults);
  const hits: SearchHit[] = [];
  for (const item of items) {
    const fields: Array<[string, number]> = [
      [item.title, 3],
      [item.subject, 2],
      [item.body, 1],
    ];
    let score = 0;
    let allMatched = q.length > 0;
    for (const token of q) {
      let tokenScore = 0;
      for (const [text, weight] of fields) {
        const words = caseSensitive ? text.split(/[^\p{L}0-9]+/u) : tokenize(text, faults);
        if (words.some((w) => w.startsWith(token))) tokenScore += weight;
      }
      if (tokenScore === 0) allMatched = false;
      score += tokenScore;
    }
    if (allMatched) hits.push({ item, score });
  }
  hits.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return faults.has("search-single-result") ? hits.slice(0, 1) : hits;
}
