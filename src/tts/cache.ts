import { LRUCache } from 'lru-cache';
import type { AudioResult, TTSOptions, TTSProvider, VoiceInfo } from './provider.js';

/**
 * Short-lived in-memory audio cache so repeated phrases ("bhai", "haan", "ruk", "gg") don't
 * cost an API call each time. Nothing is written to disk.
 */
export class CachedTTSProvider implements TTSProvider {
  private readonly cache: LRUCache<string, AudioResult>;
  private readonly inflight = new Map<string, Promise<AudioResult>>();

  constructor(
    private readonly inner: TTSProvider,
    options: { max: number; ttlMs: number },
  ) {
    this.cache = new LRUCache({ max: options.max, ttl: options.ttlMs });
  }

  get name(): string {
    return this.inner.name;
  }

  defaultVoice(lang: TTSOptions['lang']): string {
    return this.inner.defaultVoice(lang);
  }

  listVoices(): Promise<VoiceInfo[]> {
    return this.inner.listVoices();
  }

  async synthesize(text: string, options: TTSOptions): Promise<AudioResult> {
    const key = `${options.voice ?? this.inner.defaultVoice(options.lang)}|${options.lang}|${text}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    // Coalesce identical concurrent requests (several people typing "gg").
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = this.inner
      .synthesize(text, options)
      .then((audio) => {
        this.cache.set(key, audio);
        return audio;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}
