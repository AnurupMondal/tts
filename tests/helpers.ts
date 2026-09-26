import { readFileSync } from 'node:fs';
import type { Transliterator } from '../src/hinglish/transliterator.js';
import { processMessage } from '../src/hinglish/pipeline.js';
import type { LanguageMode } from '../src/config/config.js';

export interface DatasetCase {
  category: string;
  input: string;
  expected: string;
  accept?: string[];
}

export function loadJson<T>(relative: string): T {
  return JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8')) as T;
}

/**
 * Replays Google Input Tools responses recorded by `npm run eval -- --record`, so tests are
 * deterministic and offline. Unknown phrases return null (the pipeline then degrades to Roman text).
 */
export class FixtureTransliterator implements Transliterator {
  readonly name = 'fixture';
  readonly misses: string[] = [];
  private readonly table: Record<string, string | null>;

  constructor() {
    this.table = loadJson<Record<string, string | null>>('./fixtures/google-input-tools.json');
  }

  async transliterate(phrase: string): Promise<string | null> {
    const key = phrase.trim().toLowerCase();
    if (!(key in this.table)) {
      this.misses.push(key);
      return null;
    }
    return this.table[key] ?? null;
  }
}

export const RESOLVER = { user: () => 'Rahul', channel: () => 'general', role: () => 'Admins' };

export async function convert(text: string, mode: LanguageMode = 'auto', transliterator: Transliterator = new FixtureTransliterator()) {
  return processMessage(text, { mode, transliterator, resolver: RESOLVER });
}
