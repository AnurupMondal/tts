/**
 * Runs the Hinglish test dataset through the real pipeline (live Google Input Tools) and reports
 * accuracy and latency. Unit tests use a mocked engine; this measures real-world quality.
 *
 *   npm run eval                 summary + failures
 *   npm run eval -- --all        print every case
 *   npm run eval -- --category Gaming
 *   npm run eval -- --holdout    run the held-out set (never used for tuning rules)
 *   npm run eval -- --record     also save engine responses to tests/fixtures (replayed by unit tests)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { processMessage } from '../hinglish/pipeline.js';
import type { MentionResolver } from '../hinglish/preprocess.js';
import { GoogleInputToolsTransliterator, type Transliterator } from '../hinglish/transliterator.js';
import { canonicalForCompare as canonical, levenshtein } from './compare.js';

interface Case {
  category: string;
  input: string;
  expected: string;
  /** Other acceptable outputs (spelling variants that sound the same). */
  accept?: string[];
}

const { values } = parseArgs({
  options: { all: { type: 'boolean', default: false }, category: { type: 'string' }, record: { type: 'boolean', default: false }, holdout: { type: 'boolean', default: false } },
});

const file = values.holdout ? 'hinglish-holdout.json' : 'hinglish-dataset.json';
const dataset = JSON.parse(readFileSync(new URL(`../../tests/data/${file}`, import.meta.url), 'utf8')) as Case[];
const cases = values.category ? dataset.filter((c) => c.category.toLowerCase() === values.category!.toLowerCase()) : dataset;
const google = new GoogleInputToolsTransliterator();

/** Stand-in for Discord mention lookups (dataset uses these names). */
export const DATASET_RESOLVER: MentionResolver = { user: () => 'Rahul', channel: () => 'general', role: () => 'Admins' };

const recorded: Record<string, string | null> = {};
const engine: Transliterator = {
  name: google.name,
  async transliterate(phrase) {
    const result = await google.transliterate(phrase);
    recorded[phrase.trim().toLowerCase()] = result;
    return result;
  },
};

const byCategory = new Map<string, { total: number; exact: number; charSim: number }>();
const latencies: number[] = [];
const failures: string[] = [];

// Sequential on purpose: realistic per-message latency, and polite to the endpoint.
for (const c of cases) {
  const t0 = performance.now();
  const result = await processMessage(c.input, { mode: 'auto', transliterator: engine, resolver: DATASET_RESOLVER });
  latencies.push(performance.now() - t0);

  const got = canonical(result.text);
  const targets = [c.expected, ...(c.accept ?? [])].map(canonical);
  const exact = targets.includes(got);
  const sim = Math.max(...targets.map((t) => 1 - levenshtein(got, t) / Math.max(got.length, t.length, 1)));

  const stats = byCategory.get(c.category) ?? { total: 0, exact: 0, charSim: 0 };
  stats.total++;
  stats.exact += exact ? 1 : 0;
  stats.charSim += sim;
  byCategory.set(c.category, stats);

  const line = `${exact ? 'PASS' : 'FAIL'} [${c.category}] ${c.input}\n     got:      ${result.text}\n     expected: ${c.expected}`;
  if (!exact) failures.push(line);
  else if (values.all) console.log(line);
}

if (failures.length) console.log(`\n${failures.join('\n')}\n`);

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
let total = 0;
let exact = 0;
let sim = 0;
console.log('Category                  Cases   Exact    CharSim');
for (const [cat, s] of [...byCategory].sort()) {
  total += s.total;
  exact += s.exact;
  sim += s.charSim;
  console.log(`${cat.padEnd(24)} ${String(s.total).padStart(6)}  ${pct(s.exact / s.total).padStart(6)}  ${pct(s.charSim / s.total).padStart(8)}`);
}
latencies.sort((a, b) => a - b);
const q = (p: number) => Math.round(latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] ?? 0);
console.log(`${'TOTAL'.padEnd(24)} ${String(total).padStart(6)}  ${pct(exact / total).padStart(6)}  ${pct(sim / total).padStart(8)}`);
console.log(`\nLatency (processing incl. transliteration, cold cache): p50=${q(0.5)} ms  p95=${q(0.95)} ms  max=${q(1)} ms`);

if (values.record && !values.holdout) {
  const dir = new URL('../../tests/fixtures/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  const sorted = Object.fromEntries(Object.entries(recorded).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(new URL('google-input-tools.json', dir), `${JSON.stringify(sorted, null, 2)}
`);
  console.log(`Recorded ${Object.keys(sorted).length} engine responses to tests/fixtures/google-input-tools.json`);
}
