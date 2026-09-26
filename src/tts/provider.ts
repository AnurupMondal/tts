import type { MessageLang } from '../hinglish/types.js';

export type AudioFormat = 'ogg_opus' | 'mp3' | 'wav';

export interface AudioResult {
  data: Buffer;
  format: AudioFormat;
}

export interface TTSOptions {
  /** Detected message language; providers pick a Hindi or English voice/locale from it. */
  lang: MessageLang;
  /** Provider-specific voice id; falls back to the provider default. */
  voice?: string;
}

export interface VoiceInfo {
  id: string;
  label: string;
}

export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, options: TTSOptions): Promise<AudioResult>;
  /** Voices selectable with /tts voice. */
  listVoices(): Promise<VoiceInfo[]>;
  /** Voice used when the guild hasn't chosen one. */
  defaultVoice(lang: MessageLang): string;
}
