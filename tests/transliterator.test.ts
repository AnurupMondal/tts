import { describe, expect, it, vi } from 'vitest';
import {
  GoogleInputToolsTransliterator,
  isWellFormedDevanagari,
  pickCandidate,
  TableTransliterator,
} from '../src/hinglish/transliterator.js';

const response = (...candidates: string[]) => ['SUCCESS', [['x', candidates, [], { candidate_type: [] }]]];

function mockFetch(handler: (text: string) => unknown) {
  return vi.fn(async (url: URL | string) => {
    const text = new URL(url.toString()).searchParams.get('text') ?? '';
    return new Response(JSON.stringify(handler(text)), { status: 200 });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('candidate validation', () => {
  it('rejects malformed Devanagari', () => {
    expect(isWellFormedDevanagari('ाचा')).toBe(false); // starts with a vowel sign
    expect(isWellFormedDevanagari('मुझे नहीं पता ीार')).toBe(false); // vowel sign at word start
    expect(isWellFormedDevanagari('bhai')).toBe(false); // Latin
    expect(isWellFormedDevanagari('')).toBe(false);
  });

  it('accepts valid words including nasal marks after vowel signs', () => {
    expect(isWellFormedDevanagari('खेलेंगे')).toBe(true);
    expect(isWellFormedDevanagari('हूँ')).toBe(true);
    expect(isWellFormedDevanagari('भाई तू कल आ रहा है')).toBe(true);
  });

  it('picks the first well-formed candidate', () => {
    expect(pickCandidate(response('ाचा', 'अच्छा'))).toBe('अच्छा');
    expect(pickCandidate(['FAILED'])).toBeNull();
    expect(pickCandidate({})).toBeNull();
  });
});

describe('GoogleInputToolsTransliterator', () => {
  it('requests the Hindi input method and caches phrases and words', async () => {
    const fetchImpl = mockFetch((text) => response(text === 'khel raha' ? 'खेल रहा' : 'खेल'));
    const engine = new GoogleInputToolsTransliterator({ fetchImpl });

    expect(await engine.transliterate('khel raha')).toBe('खेल रहा');
    expect(await engine.transliterate('KHEL RAHA')).toBe('खेल रहा');
    expect(await engine.transliterate('khel')).toBe('खेल'); // filled from the phrase's word split
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.searchParams.get('itc')).toBe('hi-t-i0-und');
  });

  it('falls back to word-by-word when the phrase result is unusable', async () => {
    const fetchImpl = mockFetch((text) => (text.includes(' ') ? response('ाबाद') : response(text === 'aa' ? 'आ' : 'जा')));
    const engine = new GoogleInputToolsTransliterator({ fetchImpl });
    expect(await engine.transliterate('aa ja')).toBe('आ जा');
  });

  it('retries once, then returns null and opens the circuit after repeated failures', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    const engine = new GoogleInputToolsTransliterator({ fetchImpl });

    expect(await engine.transliterate('kal')).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    for (const w of ['a', 'b', 'c', 'd']) await engine.transliterate(w);
    const calls = fetchImpl.mock.calls.length;
    expect(await engine.transliterate('open')).toBeNull();
    expect(fetchImpl.mock.calls.length).toBe(calls); // circuit open: no request made
  });
});

describe('TableTransliterator', () => {
  it('maps known words and fails on unknown ones', async () => {
    const engine = new TableTransliterator({ bhai: 'भाई', aa: 'आ' });
    expect(await engine.transliterate('bhai aa')).toBe('भाई आ');
    expect(await engine.transliterate('bhai xyz')).toBeNull();
  });
});
