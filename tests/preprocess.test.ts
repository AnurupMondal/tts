import { describe, expect, it } from 'vitest';
import { isSpeakable, preprocess } from '../src/hinglish/preprocess.js';
import { tokenize } from '../src/hinglish/tokenizer.js';

const resolver = { user: (id: string) => (id === '1' ? 'Rahul' : undefined), channel: () => 'general', role: () => 'Mods' };
const spokenNames = (text: string) => tokenize(preprocess(text, { resolver })).filter((t) => t.kind === 'protected').map((t) => t.raw);

describe('preprocess', () => {
  it('resolves user, channel and role mentions to protected names', () => {
    expect(spokenNames('<@1> aa <#2> me, <@&3> sun')).toEqual(['Rahul', 'general', 'Mods']);
    expect(spokenNames('<@!1> bhai')).toEqual(['Rahul']);
  });

  it('drops unresolvable mentions and @everyone/@here', () => {
    expect(preprocess('<@999> @everyone @here bhai aa', { resolver })).toBe('bhai aa');
  });

  it('speaks hand-typed @names, reading underscores as spaces', () => {
    expect(spokenNames('@Riya_09 kidhar ho')).toEqual(['Riya 09']);
  });

  it('removes URLs, code, spoilers, timestamps and custom emoji', () => {
    expect(preprocess('dekh https://x.com/a ye `code` ```js\nlet a\n``` ||secret|| <t:1700000000:R> <:pepe:123> <a:dance:456>')).toBe('dekh ye');
  });

  it('strips markdown emphasis but keeps snake_case words', () => {
    expect(preprocess('**bhai** _sun_ ~~na~~ my_name')).toBe('bhai sun na my_name');
  });

  it('speaks a few mapped emoji once and drops the rest', () => {
    const tokens = tokenize(preprocess('bhai 😂😂😂 🚀 🔥'));
    expect(tokens.map((t) => t.raw)).toEqual(['bhai', 'haha', 'fire']);
  });

  it('limits spoken emoji per message', () => {
    expect(tokenize(preprocess('😂 🔥 💀 👍')).filter((t) => t.kind === 'protected')).toHaveLength(2);
  });

  it('collapses punctuation runs and newlines', () => {
    expect(preprocess('kya???\nsach!!!')).toBe('kya?. sach!');
  });

  it('detects unspeakable content', () => {
    expect(isSpeakable(preprocess('https://example.com'))).toBe(false);
    expect(isSpeakable(preprocess('🚀🚀'))).toBe(false);
    expect(isSpeakable(preprocess('ok'))).toBe(true);
  });
});

describe('tokenize', () => {
  it('splits number+unit and squashes repeated letters', () => {
    const tokens = tokenize('bhaiiii 2min ruk yaaaar');
    expect(tokens.map((t) => [t.kind, t.lower])).toEqual([
      ['word', 'bhai'],
      ['number', '2'],
      ['word', 'min'],
      ['word', 'ruk'],
      ['word', 'yar'],
    ]);
  });

  it('keeps alphanumeric identifiers as single words', () => {
    expect(tokenize('gta5 aur 4070ti').map((t) => t.raw)).toEqual(['gta5', 'aur', '4070ti']);
  });

  it('marks sentence starts after terminal punctuation', () => {
    const tokens = tokenize('haan. Rahul aa');
    expect(tokens.filter((t) => t.sentenceStart).map((t) => t.raw)).toEqual(['haan', 'Rahul']);
  });
});
