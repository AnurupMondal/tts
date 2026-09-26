import { LRUCache } from 'lru-cache';

/**
 * Roman Hindi → Devanagari engine. Implementations receive a *phrase* (a run of consecutive
 * Hindi words, already normalised) so that engines able to use context can do so.
 * Return null on failure; the pipeline then falls back to the Roman text.
 */
export interface Transliterator {
  readonly name: string;
  transliterate(phrase: string): Promise<string | null>;
}

export interface GoogleInputToolsOptions {
  timeoutMs?: number;
  /** Number of candidates requested; lower-ranked ones are used when the top one is malformed. */
  candidates?: number;
  fetchImpl?: typeof fetch;
}

const ENDPOINT = 'https://inputtools.google.com/request';

/**
 * Malformed engine output (e.g. "ाचा"): a vowel sign (matra) at word start or after an independent
 * vowel/another matra, or a nasal/visarga sign at word start. "खेलेंगे" (anusvara after matra) is fine.
 */
const MALFORMED = /(?:^|\s)[\u0901-\u0903\u093E-\u094C]|[\u0904-\u0914\u093E-\u094C][\u093E-\u094C]/u;
const NON_DEVANAGARI_LETTER = /[\p{L}--\p{Script=Devanagari}]/v;

export function isWellFormedDevanagari(text: string): boolean {
  return text.trim().length > 0 && !MALFORMED.test(text) && !NON_DEVANAGARI_LETTER.test(text);
}

/**
 * Uses Google's public Input Tools transliteration endpoint (the one behind Google Input Tools / Gboard web).
 * Undocumented and without an SLA: guarded by a timeout, one retry, a circuit breaker and caches.
 */
export class GoogleInputToolsTransliterator implements Transliterator {
  readonly name = 'google-input-tools';
  private readonly timeoutMs: number;
  private readonly candidates: number;
  private readonly fetchImpl: typeof fetch;
  /** word → Devanagari, filled when a phrase's output splits 1:1 into words. Words, not messages. */
  private readonly wordCache = new LRUCache<string, string>({ max: 20_000 });
  /** phrase → Devanagari. Short-lived because phrases are message fragments. */
  private readonly phraseCache = new LRUCache<string, string>({ max: 2_000, ttl: 30 * 60 * 1000 });
  private consecutiveFailures = 0;
  private openUntil = 0;

  constructor(options: GoogleInputToolsOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.candidates = options.candidates ?? 5;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async transliterate(phrase: string): Promise<string | null> {
    const key = phrase.trim().toLowerCase();
    if (!key) return '';

    const cached = this.phraseCache.get(key);
    if (cached) return cached;

    const words = key.split(/\s+/);
    const fromWords = words.map((w) => this.wordCache.get(w));
    if (fromWords.every((w): w is string => w !== undefined)) return fromWords.join(' ');

    if (Date.now() < this.openUntil) return null; // circuit open: engine recently failing

    let result = await this.request(key);
    // Malformed or unusable phrase output: retry word by word, which is more robust.
    if (result === null && words.length > 1) {
      const perWord = await Promise.all(words.map((w) => this.wordCache.get(w) ?? this.request(w)));
      result = perWord.every((w): w is string => w !== null) ? perWord.join(' ') : null;
    }
    if (result === null) return null;

    this.phraseCache.set(key, result);
    const outWords = result.split(/\s+/);
    if (outWords.length === words.length) words.forEach((w, i) => this.wordCache.set(w, outWords[i]!));
    return result;
  }

  private async request(text: string, attempt = 0): Promise<string | null> {
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({
      text,
      itc: 'hi-t-i0-und',
      num: String(this.candidates),
      cp: '0',
      cs: '1',
      ie: 'utf-8',
      oe: 'utf-8',
      app: 'demopage',
    }).toString();

    try {
      const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as unknown;
      this.consecutiveFailures = 0;
      return pickCandidate(body);
    } catch (err) {
      if (attempt === 0) return this.request(text, 1);
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= 5) {
        this.openUntil = Date.now() + 60_000;
        this.consecutiveFailures = 0;
      }
      return null;
    }
  }
}

/** Parses `["SUCCESS", [[input, [cand1, cand2...], ...]]]` and returns the first well-formed candidate. */
export function pickCandidate(body: unknown): string | null {
  if (!Array.isArray(body) || body[0] !== 'SUCCESS') return null;
  const entry = (body[1] as unknown[] | undefined)?.[0];
  const candidates = Array.isArray(entry) ? entry[1] : undefined;
  if (!Array.isArray(candidates)) return null;
  for (const c of candidates) {
    if (typeof c === 'string' && isWellFormedDevanagari(c)) return c;
  }
  return null;
}

/** Offline transliterator backed by a fixed table; used in tests and as a no-network fallback. */
export class TableTransliterator implements Transliterator {
  readonly name = 'table';
  constructor(private readonly table: Readonly<Record<string, string>>) {}

  async transliterate(phrase: string): Promise<string | null> {
    const words = phrase.trim().toLowerCase().split(/\s+/);
    const out = words.map((w) => this.table[w]);
    return out.every((w): w is string => w !== undefined) ? out.join(' ') : null;
  }
}
