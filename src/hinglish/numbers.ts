import { HINDI_NUMBERS, IDENTIFIER_WORDS, NUMBER_UNITS } from './lexicon/numbers.js';
import type { MessageLang, Token } from './types.js';

/** 0..99999 → Hindi words; undefined when out of range. */
export function toHindiNumber(n: number): string | undefined {
  if (!Number.isInteger(n) || n < 0 || n > 99999) return undefined;
  if (n <= 100) return HINDI_NUMBERS[n];
  const parts: string[] = [];
  const thousands = Math.floor(n / 1000);
  const hundreds = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (thousands > 0) parts.push(`${HINDI_NUMBERS[thousands]} हज़ार`);
  if (hundreds > 0) parts.push(`${HINDI_NUMBERS[hundreds]} सौ`);
  if (rest > 0) parts.push(HINDI_NUMBERS[rest]!);
  return parts.join(' ');
}

function prevWord(tokens: Token[], i: number): Token | undefined {
  for (let j = i - 1; j >= 0; j--) if (tokens[j]!.kind !== 'punct') return tokens[j];
  return undefined;
}

/**
 * Converts spoken quantities to Hindi words in Hindi/mixed messages:
 *   "2 min" → "दो मिनट", "5 baje" → "पाँच baje"(→ engine), "10 tak" → "दस tak".
 * Identifiers are left as digits: "room 204", "RTX 4070", "iPhone 17", "5:30", "2.5", "123456".
 */
const HINDI_NUMBER_WORDS = new Set(['ek', 'do', 'teen', 'char', 'chaar', 'paanch', 'panch', 'chhe', 'che', 'saat', 'aath', 'nau', 'das', 'bees', 'pachas', 'sau']);

export function normalizeNumbers(tokens: Token[], lang: MessageLang): void {
  if (lang === 'en') return;

  // "do min ruk" → unit after a Hindi number word is rendered in Hindi too.
  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    if (t.kind !== 'word' || t.lang !== 'hi' || !HINDI_NUMBER_WORDS.has(t.lower) || next?.kind !== 'word') return;
    const unit = NUMBER_UNITS[next.lower];
    if (unit && next.lower.length > 1 && next.lower !== 'rs') {
      next.out = t.lower === 'ek' && unit === 'घंटे' ? 'घंटा' : unit;
      next.lang = 'hi';
    }
  });

  tokens.forEach((t, i) => {
    if (t.kind !== 'number') return;
    if (!/^\d{1,5}$/.test(t.raw)) return; // decimals, times, long numbers: let TTS read digits

    const prev = prevWord(tokens, i);
    if (prev) {
      const p = prev.lower;
      const isIdentifierWord = IDENTIFIER_WORDS.has(p);
      const isBrandLike = prev.kind === 'protected' || /\d/.test(p) || (prev.raw !== p && prev.lang !== 'hi');
      if (isIdentifierWord || isBrandLike) return;
    }

    const next = tokens[i + 1];
    const unitKey = next?.kind === 'word' ? next.lower : undefined;
    const hasUnit = unitKey !== undefined && unitKey in NUMBER_UNITS;
    const n = Number(t.raw);

    if (hasUnit) {
      const unit = unitKey === 'k' ? undefined : NUMBER_UNITS[unitKey];
      if (unitKey === 'k') {
        const words = toHindiNumber(n * 1000);
        if (!words) return;
        t.out = words;
        next!.out = '';
        next!.lang = 'neutral';
        return;
      }
      const words = toHindiNumber(n);
      if (!words) return;
      t.out = words;
      if (unit) {
        // "1 hour" → "एक घंटा" (singular), otherwise plural form from the table.
        next!.out = n === 1 && unit === 'घंटे' ? 'घंटा' : unit;
        next!.lang = 'hi';
      }
      return;
    }

    // Standalone small number inside a Hindi sentence ("10 tak aa jaunga").
    if (t.raw.length <= 3) {
      const words = toHindiNumber(n);
      if (words) t.out = words;
    }
  });
}
