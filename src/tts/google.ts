import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { MessageLang } from '../hinglish/types.js';
import type { AudioResult, TTSOptions, TTSProvider, VoiceInfo } from './provider.js';

export interface GoogleTTSOptions {
  voiceHi: string;
  voiceEn: string;
  speakingRate: number;
}

/** "hi-IN-Chirp3-HD-Charon" → "hi-IN". */
const localeOf = (voice: string) => voice.split('-').slice(0, 2).join('-');

/**
 * Google Cloud Text-to-Speech. Returns OGG_OPUS, which Discord can play without re-encoding.
 * Hindi and mixed text use the hi-IN voice (it reads embedded Latin-script English words);
 * pure English uses the en-IN voice so it keeps an Indian accent.
 */
export class GoogleTTSProvider implements TTSProvider {
  readonly name = 'google';
  private readonly client = new TextToSpeechClient();
  private voicesCache?: VoiceInfo[];

  constructor(private readonly options: GoogleTTSOptions) {}

  defaultVoice(lang: MessageLang): string {
    return lang === 'en' ? this.options.voiceEn : this.options.voiceHi;
  }

  async synthesize(text: string, { lang, voice }: TTSOptions): Promise<AudioResult> {
    // A guild-selected voice is Hindi; English-only messages still use the English voice of the same family.
    let name = voice ?? this.defaultVoice(lang);
    if (lang === 'en' && voice && localeOf(voice) === 'hi-IN') {
      const family = voice.slice('hi-IN-'.length);
      name = `en-IN-${family}`;
    }

    const [response] = await this.client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: localeOf(name), name },
      audioConfig: {
        audioEncoding: 'OGG_OPUS',
        sampleRateHertz: 48000,
        ...(this.options.speakingRate !== 1 ? { speakingRate: this.options.speakingRate } : {}),
      },
    });
    if (!response.audioContent) throw new Error('Google TTS returned no audio');
    return { data: Buffer.from(response.audioContent as Uint8Array), format: 'ogg_opus' };
  }

  async listVoices(): Promise<VoiceInfo[]> {
    if (this.voicesCache) return this.voicesCache;
    const [response] = await this.client.listVoices({ languageCode: 'hi-IN' });
    const voices = (response.voices ?? [])
      .filter((v) => v.name && v.languageCodes?.includes('hi-IN'))
      .map((v) => ({
        id: v.name!,
        label: `${v.name!.replace('hi-IN-', '')} (${String(v.ssmlGender ?? '').toLowerCase()})`,
      }))
      .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
    this.voicesCache = voices;
    return voices;
  }
}

/** Show the most natural voice families first. */
function rank(id: string): number {
  if (id.includes('Chirp3-HD')) return 0;
  if (id.includes('Neural2')) return 1;
  if (id.includes('Wavenet')) return 2;
  return 3;
}
