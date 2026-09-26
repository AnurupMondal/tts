import { NUMBER_UNITS } from './lexicon/numbers.js';
import { PROTECT_CLOSE, PROTECT_OPEN } from './preprocess.js';
import type { Token, TokenKind } from './types.js';

const TOKEN_REGEX = new RegExp(
  [
    `${PROTECT_OPEN}([^${PROTECT_CLOSE}]*)${PROTECT_CLOSE}`, // 1: protected name
    `(\\d+(?:[.,:]\\d+)*)(?![\\p{L}\\d])`, // 2: pure number (not followed by letters)
    `([\\p{L}\\p{M}\\p{N}]+(?:['’][\\p{L}]+)*)`, // 3: word (may contain digits: gta5, 4070ti, 2min)
    `([^\\s\\p{L}\\p{M}\\p{N}]+)`, // 4: punctuation / symbols
  ].join('|'),
  'gu',
);

const SENTENCE_END = /[.!?।]$/;

/** Collapse 3+ repeats of a character: "bhaiiii" → "bhai", "yaaaar" → "yar", "nooo" → "no". */
export function squashRepeats(word: string): string {
  return word.replace(/(\p{L})\1{2,}/gu, '$1');
}

/** Greetings stretched by a single letter, which squashRepeats leaves alone: "hii", "heyy", "helloo", "byee". */
const STRETCHED_GREETINGS: [RegExp, string][] = [
  [/^h+i+$/, 'hi'],
  [/^h+e+y+$/, 'hey'],
  [/^h+e+l+o+$/, 'hello'],
  [/^b+y+e+$/, 'bye'],
];

/** Lookup form of a word: lower-cased, repeats squashed, stretched greetings restored. */
function lookupForm(raw: string): string {
  const lower = squashRepeats(raw.toLowerCase());
  return STRETCHED_GREETINGS.find(([re]) => re.test(lower))?.[1] ?? lower;
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastEnd = 0;
  let sentenceStart = true;

  for (const m of text.matchAll(TOKEN_REGEX)) {
    const index = m.index ?? 0;
    const spaceBefore = index > lastEnd && /\s/.test(text.slice(lastEnd, index));
    lastEnd = index + m[0].length;

    const push = (kind: TokenKind, raw: string, space: boolean) => {
      tokens.push({
        kind,
        raw,
        lower: kind === 'word' ? lookupForm(raw) : raw.toLowerCase(),
        spaceBefore: space,
        sentenceStart: sentenceStart && kind !== 'punct',
        lang: kind === 'word' ? 'en' : 'neutral',
      });
      if (kind !== 'punct') sentenceStart = false;
    };

    if (m[1] !== undefined) {
      if (m[1].trim()) push('protected', m[1].trim(), spaceBefore);
    } else if (m[2] !== undefined) {
      push('number', m[2], spaceBefore);
    } else if (m[3] !== undefined) {
      // "2min", "5mins", "10sec", "5k" → number + unit.
      const split = /^(\d+)([a-z]+)$/i.exec(m[3]);
      if (split && split[2]!.toLowerCase() in NUMBER_UNITS) {
        push('number', split[1]!, spaceBefore);
        push('word', split[2]!, false);
      } else {
        push('word', m[3], spaceBefore);
      }
    } else if (m[4] !== undefined) {
      push('punct', m[4], spaceBefore);
      if (SENTENCE_END.test(m[4])) sentenceStart = true;
    }
  }
  return tokens;
}
