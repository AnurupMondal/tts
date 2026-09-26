import { describe, expect, it } from 'vitest';
import type { LanguageMode } from '../src/config/config.js';
import { detect } from '../src/hinglish/detector.js';
import { preprocess } from '../src/hinglish/preprocess.js';
import { tokenize } from '../src/hinglish/tokenizer.js';

function labels(text: string, mode: LanguageMode = 'auto') {
  const tokens = tokenize(preprocess(text));
  const detection = detect(tokens, mode);
  return { detection, map: Object.fromEntries(tokens.filter((t) => t.kind !== 'punct').map((t) => [t.raw, t.lang])) };
}

describe('detector', () => {
  it('labels pure English as English', () => {
    const { detection } = labels('this is completely English');
    expect(detection.lang).toBe('en');
    expect(detection.hindiWords).toBe(0);
  });

  it('labels Hinglish words and keeps English words English', () => {
    const { map, detection } = labels('bhai what are you kr rha');
    expect(map).toMatchObject({ bhai: 'hi', what: 'en', are: 'en', you: 'en', kr: 'hi', rha: 'hi' });
    expect(detection.lang).toBe('mixed');
  });

  it('keeps names, brands and acronyms verbatim', () => {
    expect(labels('mai abhi Valorant khel raha hu').map.Valorant).not.toBe('hi');
    expect(labels('iPhone le liya').map.iPhone).toBe('neutral');
    expect(labels('mera RTX aa gaya').map.RTX).toBe('neutral');
    expect(labels('Priya ne kaha tha').map.Priya).toBe('neutral');
  });

  it('treats shouted Hindi as Hindi, not an acronym', () => {
    expect(labels('BHAI ruk').map.BHAI).toBe('hi');
  });

  it('keeps English verbs before "kar" English, even ones that are also Hindi words', () => {
    expect(labels('bhai tu game throw kr rha hai').map.throw).toBe('en');
    expect(labels('lag kr rha hai net').map.lag).toBe('en');
    expect(labels('tu feed kyu kr rha hai').map.feed).toBe('en');
  });

  it('resolves "me" by context', () => {
    expect(labels('game me aa').map.me).toBe('hi');
    expect(labels('let me check').map.me).toBe('en');
    expect(labels('can you hear me').map.me).toBe('en');
  });

  it('resolves ambiguous words from their neighbours', () => {
    expect(labels('main character energy hai').map.main).toBe('en');
    expect(labels('to kya hua').map.to).toBe('hi');
    expect(labels('the game was fun').map.the).toBe('en');
    expect(labels('wo log the waha').map.the).toBe('hi');
    expect(labels('hi bhai').map.hi).toBe('en');
  });

  it('uses word shape for unknown words', () => {
    expect(labels('movie dekhne chalein kya').map.chalein).toBe('hi');
  });

  it('respects the language mode', () => {
    expect(labels('bhai tu kaha hai', 'english').detection.lang).toBe('en');
    expect(labels('ok bhai', 'hinglish').map.bhai).toBe('hi');
    const hindi = labels('bhai game khel', 'hindi').map;
    expect(hindi.game).toBe('en'); // gaming terms stay English even in hindi mode
  });

  it('reports lower confidence for ambiguous messages', () => {
    expect(labels('to me so').detection.confidence).toBeLessThan(labels('bhai kya haal hai').detection.confidence);
  });
});
