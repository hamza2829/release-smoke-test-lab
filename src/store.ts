import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Faults } from "./faults.js";

export interface ContentItem {
  id: string;
  title: string;
  subject: string;
  body: string;
  revision: number;
  updatedAt: string;
}

export interface ContentUpdate {
  title: string;
  body: string;
}

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

export const SEED_CONTENT: ContentItem[] = [
  { id: "fractions-basics", title: "Fractions: the basics", subject: "Maths", body: "A fraction has a numerator and a denominator. Practice adding fractions with the same denominator first.", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "photosynthesis", title: "Photosynthesis in five steps", subject: "Biology", body: "Plants turn light, water and carbon dioxide into glucose and oxygen.", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "uebungen-bruchrechnung", title: "Übungen zur Bruchrechnung", subject: "Mathe", body: "Zehn Übungen zum Kürzen und Erweitern von Brüchen.", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "essay-structure", title: "How to structure an essay", subject: "English", body: "Introduction, three body paragraphs and a conclusion. Each paragraph starts with a topic sentence.", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "linear-equations", title: "Solving linear equations", subject: "Maths", body: "Isolate the variable. Whatever you do on one side you do on the other side.", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "french-revolution", title: "The French Revolution", subject: "History", body: "Causes, key events from 1789 and the consequences for Europe.", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "geometrie-dreiecke", title: "Geometrie: Dreiecke", subject: "Mathe", body: "Winkelsumme im Dreieck beträgt 180 Grad. Übungen mit Lösungen.", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "smoke-test-note", title: "Smoke test note", subject: "Internal", body: "This page is edited by the automated smoke tests after every deployment.", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
];

/** JSON file backed content store. Writes are atomic (temp file + rename). */
export class ContentStore {
  private items: Map<string, ContentItem>;

  constructor(
    private readonly file: string | null,
    private readonly faults: Faults = new Faults(),
    seed: ContentItem[] = SEED_CONTENT,
  ) {
    if (file && existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as ContentItem[];
      this.items = new Map(parsed.map((i) => [i.id, i]));
    } else {
      this.items = new Map(seed.map((i) => [i.id, { ...i }]));
      this.persist();
    }
  }

  list(): ContentItem[] {
    const all = [...this.items.values()];
    if (this.faults.has("list-unsorted")) return all.reverse();
    return all.sort((a, b) => a.title.localeCompare(b.title, "en"));
  }

  get(id: string): ContentItem {
    const item = this.items.get(id);
    if (!item) {
      if (this.faults.has("content-missing-500")) {
        // simulated null dereference
        throw new TypeError("Cannot read properties of undefined (reading 'title')");
      }
      throw new NotFoundError(`Content ${id} not found`);
    }
    return item;
  }

  update(id: string, change: ContentUpdate): ContentItem {
    const current = this.get(id);
    const title = this.faults.has("save-empty-title") ? change.title : change.title.trim();
    const body = change.body.replace(/\r\n/g, "\n");
    if (!this.faults.has("save-empty-title")) {
      if (title.length === 0) throw new ValidationError("Title must not be empty");
      if (title.length > 120) throw new ValidationError("Title must be at most 120 characters");
    }
    if (body.length > 20000) throw new ValidationError("Body must be at most 20000 characters");
    const next: ContentItem = {
      ...current,
      title,
      body: this.faults.has("save-drops-body") ? current.body : body,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, next);
    this.persist();
    return next;
  }

  private persist(): void {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify([...this.items.values()], null, 2));
    renameSync(tmp, this.file);
  }
}
