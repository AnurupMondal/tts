import { DEVANAGARI_OVERRIDES } from './lexicon/overrides.js';
import type { Transliterator } from './transliterator.js';
import type { Token } from './types.js';

/**
 * Transliterates Hindi runs and stitches the message back together with English words,
 * names and punctuation preserved. Mutates `token.out`. Returns true if the engine failed
 * for any run (Roman text was passed through).
 */
export async function transliterateTokens(tokens: Token[], engine: Transliterator): Promise<boolean> {
  // 1. Pinned words from the correction layer.
  for (const t of tokens) {
    if (t.lang === 'hi' && t.out === undefined && t.norm !== undefined) {
      const pinned = DEVANAGARI_OVERRIDES[t.norm];
      if (pinned) t.out = pinned;
    }
  }

  // 2. Group the remaining Hindi words into runs of consecutive tokens and send each run as one phrase.
  const runs: Token[][] = [];
  let current: Token[] = [];
  for (const t of tokens) {
    if (t.lang === 'hi' && t.out === undefined) {
      current.push(t);
    } else if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length > 0) runs.push(current);

  let degraded = false;
  await Promise.all(
    runs.map(async (run) => {
      const phrase = run.map((t) => t.norm ?? t.lower).join(' ');
      const result = await engine.transliterate(phrase);
      if (result === null) {
        degraded = true;
        run.forEach((t) => (t.out = t.norm ?? t.raw));
        return;
      }
      const parts = result.split(/\s+/);
      if (parts.length === run.length) {
        run.forEach((t, i) => (t.out = parts[i]));
      } else {
        // Word counts differ (engine merged/split words): put the whole phrase on the first token.
        run.forEach((t, i) => (t.out = i === 0 ? result : ''));
      }
    }),
  );
  return degraded;
}

/** Joins tokens into the final TTS string. */
export function assemble(tokens: Token[]): string {
  let out = '';
  for (const t of tokens) {
    const text = t.out ?? (t.kind === 'word' && t.lang === 'en' && t.norm ? t.norm : t.raw);
    if (!text) continue;
    if (out && (t.spaceBefore || t.kind !== 'punct') && !out.endsWith(' ')) out += ' ';
    out += text;
  }
  return out
    .replace(/\s+([,.!?।…])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
