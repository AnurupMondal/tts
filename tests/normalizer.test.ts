import { describe, expect, it } from 'vitest';
import { detect } from '../src/hinglish/detector.js';
import { normalize } from '../src/hinglish/normalizer.js';
import { normalizeNumbers, toHindiNumber } from '../src/hinglish/numbers.js';
import { preprocess } from '../src/hinglish/preprocess.js';
import { tokenize } from '../src/hinglish/tokenizer.js';

function norms(text: string) {
  const tokens = tokenize(preprocess(text));
  const detection = detect(tokens, 'auto');
  normalize(tokens);
  normalizeNumbers(tokens, detection.lang);
  return tokens.filter((t) => t.kind !== 'punct').map((t) => t.out ?? t.norm ?? t.raw);
}

describe('normalizer', () => {
  it('expands abbreviations and spelling variants', () => {
    expect(norms('mai nhi aa rha hu')).toEqual(['main', 'nahi', 'aa', 'raha', 'hoon']);
    expect(norms('kch mtlb nhi pgl')).toEqual(['kuch', 'matlab', 'nahi', 'pagal']);
    expect(norms('tu kya kr rha h')).toEqual(['tu', 'kya', 'kar', 'raha', 'hai']);
  });

  it('does not expand English words that look like abbreviations', () => {
    expect(norms('bro what are you doing')).toEqual(['bro', 'what', 'are', 'you', 'doing']);
  });

  it('expands English chat abbreviations for speech', () => {
    expect(norms('brb')).toEqual(['be right back']);
    expect(norms('gg bhai')).toEqual(['G G', 'bhai']);
  });

  it('distinguishes मैं from में', () => {
    expect(norms('mai 2 min me aa rha hu')[0]).toBe('main');
    expect(norms('mai 2 min me aa rha hu')[3]).toBe('mein');
    expect(norms('ruk 2 min mai aa rha hu')[3]).toBe('main');
    expect(norms('game me aa')[1]).toBe('mein');
    expect(norms('me bhi aa rha hu')[0]).toBe('main');
    expect(norms('mai thodi der me aata hu')[3]).toBe('mein');
  });

  it('distinguishes कहाँ (where) from कहा (said)', () => {
    expect(norms('tu kaha hai')[1]).toBe('kahaan');
    expect(norms('maine kaha tha')[1]).toBe('kaha');
  });

  it('distinguishes the conjunction कि from the possessive की', () => {
    expect(norms('mujhe lagta hai ki hume jana chahiye')[3]).toBe('ki-conj');
    expect(norms('exam ki tension hai')[1]).toBe('ki');
  });

  it('expands bt only where it means baat', () => {
    expect(norms('ek bt sun')[1]).toBe('baat');
  });
});

describe('numbers', () => {
  it('converts numbers to Hindi words', () => {
    expect(toHindiNumber(0)).toBe('शून्य');
    expect(toHindiNumber(2)).toBe('दो');
    expect(toHindiNumber(45)).toBe('पैंतालीस');
    expect(toHindiNumber(100)).toBe('सौ');
    expect(toHindiNumber(204)).toBe('दो सौ चार');
    expect(toHindiNumber(1500)).toBe('एक हज़ार पाँच सौ');
    expect(toHindiNumber(100000)).toBeUndefined();
  });

  it('converts quantities with units', () => {
    expect(norms('2 min ruk')).toEqual(['दो', 'मिनट', 'ruk']);
    expect(norms('bhai 2 sec')).toEqual(['bhai', 'दो', 'सेकंड']);
    expect(norms('1 hour lagega')).toEqual(['एक', 'घंटा', 'lagega']);
    expect(norms('2min ruk')).toEqual(['दो', 'मिनट', 'ruk']);
    expect(norms('bhai 5k de')).toEqual(['bhai', 'पाँच हज़ार', '', 'de']);
    expect(norms('bhai do min ruk')).toEqual(['bhai', 'do', 'मिनट', 'ruk']);
  });

  it('preserves identifiers', () => {
    expect(norms('room 204 me aa')).toContain('204');
    expect(norms('mera RTX 4070 aa gaya')).toContain('4070');
    expect(norms('iPhone 17 le liya')).toContain('17');
    expect(norms('level 50 ho gaya')).toContain('50');
  });

  it('leaves numbers alone in English messages', () => {
    expect(norms('see you in 5 min')).toEqual(['see', 'you', 'in', '5', 'min']);
  });

  it('leaves decimals, times and long numbers as digits', () => {
    expect(norms('bhai 5:30 baje aa')).toContain('5:30');
    expect(norms('bhai 2.5 ghante')).toContain('2.5');
    expect(norms('bhai 123456 aa gaya')).toContain('123456');
  });
});
