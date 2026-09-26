import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuildSettingsStore } from '../src/bot/guildSettings.js';
import { SpamGuard } from '../src/bot/spamGuard.js';
import { CachedTTSProvider } from '../src/tts/cache.js';
import type { TTSProvider } from '../src/tts/provider.js';
import { chunkText, SarvamTTSProvider } from '../src/tts/sarvam.js';

describe('SpamGuard', () => {
  const options = { userCooldownMs: 1000, channelCooldownMs: 300, duplicateWindowMs: 15000, guildRatePerMin: 3 };

  it('enforces user and channel cooldowns', () => {
    let now = 0;
    const guard = new SpamGuard(options, () => now);
    expect(guard.check('g', 'c', 'u1', 'a')).toBe('ok');
    now = 100;
    expect(guard.check('g', 'c', 'u1', 'b')).toBe('user_cooldown');
    expect(guard.check('g', 'c', 'u2', 'b')).toBe('channel_cooldown');
    now = 400;
    expect(guard.check('g', 'c', 'u2', 'b')).toBe('ok');
  });

  it('suppresses duplicates from the same user', () => {
    let now = 0;
    const guard = new SpamGuard(options, () => now);
    expect(guard.check('g', 'c', 'u', 'gg')).toBe('ok');
    now = 5000;
    expect(guard.check('g', 'c', 'u', ' GG ')).toBe('duplicate');
    now = 20000;
    expect(guard.check('g', 'c', 'u', 'gg')).toBe('ok');
  });

  it('rate-limits a guild with a token bucket', () => {
    let now = 0;
    const guard = new SpamGuard({ ...options, userCooldownMs: 0, channelCooldownMs: 0 }, () => now);
    expect(['a', 'b', 'c', 'd'].map((t) => guard.check('g', 'c', `u${t}`, t))).toEqual(['ok', 'ok', 'ok', 'rate_limited']);
    now = 20_000; // refills 1 token per 20 s at 3/min
    expect(guard.check('g', 'c', 'u5', 'e')).toBe('ok');
  });
});

describe('GuildSettingsStore', () => {
  let dir: string | undefined;
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it('persists settings (ids only) and reloads them', () => {
    dir = mkdtempSync(join(tmpdir(), 'tts-settings-'));
    const store = new GuildSettingsStore(dir, 'auto');
    store.update('g1', (s) => {
      s.enabledChannels.push('c1');
      s.mode = 'hinglish';
      s.voice = { provider: 'google', id: 'hi-IN-Chirp3-HD-Kore' };
    });
    store.flush();

    const reloaded = new GuildSettingsStore(dir, 'auto');
    expect(reloaded.get('g1')).toMatchObject({ enabledChannels: ['c1'], mode: 'hinglish' });
    expect(reloaded.voiceFor('g1', 'google')).toBe('hi-IN-Chirp3-HD-Kore');
    expect(reloaded.voiceFor('g1', 'sarvam')).toBeUndefined();
    expect(reloaded.get('g2').mode).toBe('auto');
    expect(Object.keys(JSON.parse(readFileSync(join(dir, 'guilds.json'), 'utf8')))).toEqual(['g1']);
  });

  it('toggles list membership', () => {
    const list: string[] = [];
    expect(GuildSettingsStore.toggle(list, 'u')).toBe(true);
    expect(GuildSettingsStore.toggle(list, 'u')).toBe(false);
    expect(list).toEqual([]);
  });
});

describe('CachedTTSProvider', () => {
  it('caches by voice, language and text and coalesces concurrent requests', async () => {
    const synthesize = vi.fn(async (text: string) => ({ data: Buffer.from(text), format: 'mp3' as const }));
    const inner: TTSProvider = { name: 'fake', synthesize, listVoices: async () => [], defaultVoice: () => 'v' };
    const cached = new CachedTTSProvider(inner, { max: 10, ttlMs: 60_000 });

    await Promise.all([cached.synthesize('bhai', { lang: 'hi' }), cached.synthesize('bhai', { lang: 'hi' })]);
    await cached.synthesize('bhai', { lang: 'hi' });
    expect(synthesize).toHaveBeenCalledTimes(1);

    await cached.synthesize('bhai', { lang: 'hi', voice: 'other' });
    expect(synthesize).toHaveBeenCalledTimes(2);
  });
});

describe('SarvamTTSProvider', () => {
  it('chunks long text on sentence boundaries under the API limit', () => {
    const text = 'एक दो तीन। '.repeat(400);
    const chunks = chunkText(text, 2500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 2500)).toBe(true);
    expect(chunks.join(' ').replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim());
  });

  it('sends the documented request and decodes base64 audio', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ request_id: 'r', audios: [Buffer.from('mp3data').toString('base64')] })));
    const provider = new SarvamTTSProvider({ apiKey: 'key', model: 'bulbul:v3', speaker: 'shubh', pace: 1, fetchImpl: fetchImpl as unknown as typeof fetch });

    const audio = await provider.synthesize('भाई Valorant खेल', { lang: 'mixed' });
    expect(audio).toEqual({ data: Buffer.from('mp3data'), format: 'mp3' });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.sarvam.ai/text-to-speech');
    expect((init.headers as Record<string, string>)['api-subscription-key']).toBe('key');
    expect(JSON.parse(String(init.body))).toMatchObject({
      text: 'भाई Valorant खेल',
      language_code: 'hi-IN',
      model: 'bulbul:v3',
      speaker: 'shubh',
      output_audio_codec: 'mp3',
    });
  });

  it('uses the en-IN locale for English-only messages', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ audios: ['AA=='] })));
    const provider = new SarvamTTSProvider({ apiKey: 'k', model: 'bulbul:v3', speaker: 'shubh', pace: 1, fetchImpl: fetchImpl as unknown as typeof fetch });
    await provider.synthesize('hello', { lang: 'en' });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).language_code).toBe('en-IN');
  });

  it('surfaces API errors', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":"bad key"}', { status: 403 }));
    const provider = new SarvamTTSProvider({ apiKey: 'k', model: 'bulbul:v3', speaker: 'shubh', pace: 1, fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(provider.synthesize('x', { lang: 'hi' })).rejects.toThrow(/403/);
  });
});
