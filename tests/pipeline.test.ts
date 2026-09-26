import { describe, expect, it } from 'vitest';
import { canonicalForCompare } from '../src/cli/compare.js';
import { convert, FixtureTransliterator, loadJson, type DatasetCase } from './helpers.js';

const dataset = loadJson<DatasetCase[]>('./data/hinglish-dataset.json');

describe('Hinglish dataset (recorded engine responses)', () => {
  it('has at least 200 cases across all spec categories', () => {
    expect(dataset.length).toBeGreaterThanOrEqual(200);
    const categories = new Set(dataset.map((c) => c.category));
    for (const c of [
      'Normal Hinglish', 'Abbreviated Hinglish', 'Gaming Hinglish', 'Hindi + English', 'Slang', 'Numbers', 'Names',
      'Discord mentions', 'Emojis', 'Very short', 'Long', 'Pure English', 'Pure Hindi', 'Ambiguous',
    ]) {
      expect(categories, c).toContain(c);
    }
  });

  const engine = new FixtureTransliterator();
  it.each(dataset.map((c) => [c.input, c] as const))('%s', async (_, c) => {
    const result = await convert(c.input, 'auto', engine);
    const targets = [c.expected, ...(c.accept ?? [])].map(canonicalForCompare);
    if (engine.misses.length > 0) {
      throw new Error(`Fixture has no recording for ${JSON.stringify(engine.misses)}. Run \`npm run eval -- --record\`.`);
    }
    expect(targets).toContain(canonicalForCompare(result.text));
  });
});

describe('spec §26 end-to-end cases', () => {
  it.each([
    ['bhai tu kal aa raha hai kya', 'भाई तू कल आ रहा है क्या', 'hi'],
    ['mai abhi Valorant khel raha hu', 'मैं अभी Valorant खेल रहा हूँ', 'mixed'],
    ['ruk 2 min mai aa rha hu', 'रुक दो मिनट मैं आ रहा हूँ', 'hi'],
    ['bro what are you doing', 'bro what are you doing', 'en'],
    ['bhai what are you kr rha', 'भाई what are you कर रहा', 'mixed'],
  ])('%s', async (input, expected, lang) => {
    const result = await convert(input);
    expect(result.text).toBe(expected);
    expect(result.lang).toBe(lang);
  });
});

describe('modes', () => {
  it('english mode never transliterates', async () => {
    const result = await convert('bhai tu kaha hai', 'english');
    expect(result.text).toBe('bhai tu kaha hai');
    expect(result.lang).toBe('en');
  });

  it('auto mode leaves a lone Hindi-looking word in English text alone', async () => {
    const result = await convert('ok so what is the plan for tonight');
    expect(result.lang).toBe('en');
  });
});

describe('degradation', () => {
  it('passes Roman text through when the engine fails, keeping pinned words', async () => {
    const failing = { name: 'down', transliterate: async () => null };
    const result = await convert('bhai kal khelenge', 'auto', failing);
    expect(result.degraded).toBe(true);
    expect(result.text).toBe('भाई kal khelenge');
  });

  it('skips messages with nothing speakable', async () => {
    const result = await convert('https://example.com ```code```');
    expect(result.skipped).toBe('empty');
  });
});
