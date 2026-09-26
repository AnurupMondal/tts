import { config, requireConfig } from '../config/config.js';
import { CachedTTSProvider } from './cache.js';
import { GoogleTTSProvider } from './google.js';
import type { TTSProvider } from './provider.js';
import { SarvamTTSProvider } from './sarvam.js';

export function createTTSProvider(name = config.TTS_PROVIDER): TTSProvider {
  let provider: TTSProvider;
  if (name === 'sarvam') {
    const { SARVAM_API_KEY } = requireConfig('SARVAM_API_KEY');
    provider = new SarvamTTSProvider({
      apiKey: SARVAM_API_KEY,
      model: config.SARVAM_MODEL,
      speaker: config.SARVAM_SPEAKER,
      pace: config.SARVAM_PACE,
    });
  } else {
    provider = new GoogleTTSProvider({
      voiceHi: config.GOOGLE_VOICE_HI,
      voiceEn: config.GOOGLE_VOICE_EN,
      speakingRate: config.GOOGLE_SPEAKING_RATE,
    });
  }
  return new CachedTTSProvider(provider, { max: config.TTS_CACHE_MAX, ttlMs: config.TTS_CACHE_TTL_MS });
}

export type { AudioResult, TTSOptions, TTSProvider, VoiceInfo } from './provider.js';
