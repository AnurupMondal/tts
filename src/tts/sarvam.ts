import type { MessageLang } from '../hinglish/types.js';
import type { AudioResult, TTSOptions, TTSProvider, VoiceInfo } from './provider.js';

export interface SarvamTTSOptions {
  apiKey: string;
  model: string;
  speaker: string;
  pace: number;
  fetchImpl?: typeof fetch;
}

const ENDPOINT = 'https://api.sarvam.ai/text-to-speech';
const MAX_CHARS = 2500;

/** Bulbul v3 speakers (lowercase ids required by the API). */
const V3_SPEAKERS = {
  male: ['shubh', 'aditya', 'rahul', 'rohan', 'amit', 'dev', 'ratan', 'varun', 'manan', 'sumit', 'kabir', 'aayan', 'ashutosh', 'advait', 'anand', 'tarun', 'sunny', 'mani', 'gokul', 'vijay', 'mohit', 'rehan', 'soham'],
  female: ['ritu', 'priya', 'neha', 'pooja', 'simran', 'kavya', 'ishita', 'shreya', 'roopa', 'tanya', 'shruti', 'suhani', 'kavitha', 'rupali'],
};

/** Splits on sentence/word boundaries so each chunk fits the API limit. */
export function chunkText(text: string, max = MAX_CHARS): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(window.lastIndexOf('। '), window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
    const at = cut > max / 2 ? cut + 1 : window.lastIndexOf(' ') > 0 ? window.lastIndexOf(' ') : max;
    chunks.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/**
 * Sarvam AI Bulbul. Built for Indian languages and code-mixed Hindi/English in a single voice,
 * so mixed text like "मैं अभी Valorant खेल रहा हूँ" is spoken without switching voices.
 */
export class SarvamTTSProvider implements TTSProvider {
  readonly name = 'sarvam';
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SarvamTTSOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  defaultVoice(): string {
    return this.options.speaker;
  }

  async synthesize(text: string, { lang, voice }: TTSOptions): Promise<AudioResult> {
    const parts: Buffer[] = [];
    for (const chunk of chunkText(text)) {
      const res = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'api-subscription-key': this.options.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          text: chunk,
          language_code: lang === 'en' ? 'en-IN' : 'hi-IN',
          model: this.options.model,
          speaker: voice ?? this.options.speaker,
          pace: this.options.pace,
          speech_sample_rate: 48000,
          output_audio_codec: 'mp3',
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Sarvam TTS HTTP ${res.status}: ${detail.slice(0, 200)}`);
      }
      const body = (await res.json()) as { audios?: string[] };
      for (const audio of body.audios ?? []) parts.push(Buffer.from(audio, 'base64'));
    }
    if (parts.length === 0) throw new Error('Sarvam TTS returned no audio');
    // MP3 frames can be concatenated directly.
    return { data: Buffer.concat(parts), format: 'mp3' };
  }

  async listVoices(): Promise<VoiceInfo[]> {
    return [
      ...V3_SPEAKERS.male.map((id) => ({ id, label: `${id} (male)` })),
      ...V3_SPEAKERS.female.map((id) => ({ id, label: `${id} (female)` })),
    ];
  }
}
