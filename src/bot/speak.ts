import { toOggOpus } from '../audio/converter.js';
import type { AudioJob } from '../audio/guildAudio.js';
import type { LanguageMode } from '../config/config.js';
import type { MentionResolver } from '../hinglish/preprocess.js';
import { processMessage } from '../hinglish/pipeline.js';
import type { Transliterator } from '../hinglish/transliterator.js';
import { logger } from '../logger.js';
import type { TTSProvider } from '../tts/provider.js';

export interface SpeakJobOptions {
  text: string;
  mode: LanguageMode;
  voice?: string;
  /** Author name to say before the message ("Rahul says, ..."); omitted for back-to-back messages. */
  speaker?: string;
  resolver?: MentionResolver;
  tts: TTSProvider;
  transliterator: Transliterator;
  log: { guild: string; user: string };
}

/**
 * A display name as it should be spoken: fancy Unicode letters folded ("𝓡𝓪𝓱𝓾𝓵" → "Rahul"),
 * "riya_09" → "riya 09", emoji and symbols dropped. Returns undefined if nothing speakable is left.
 */
export function speakableName(name: string): string | undefined {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[_.]+/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32)
    .trim();
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : undefined;
}

/**
 * Builds the queued job: Hinglish processing → TTS → Ogg/Opus.
 * The message text lives only in this closure and is released once the job has run.
 */
export function createSpeakJob(options: SpeakJobOptions): AudioJob {
  let text: string | undefined = options.text;
  return async () => {
    const input = text ?? '';
    text = undefined;
    const started = performance.now();

    const processed = await processMessage(input, {
      mode: options.mode,
      transliterator: options.transliterator,
      resolver: options.resolver,
    });
    if (processed.skipped || !processed.text) return null;
    const processedAt = performance.now();

    // A guild-selected voice applies to Hindi/mixed; providers map English-only text to a matching voice.
    const speech = options.speaker ? `${options.speaker} says, ${processed.text}` : processed.text;
    const audio = await options.tts.synthesize(speech, { lang: processed.lang, voice: options.voice });
    const ogg = await toOggOpus(audio);

    logger.info(
      {
        ...options.log,
        length: input.length,
        lang: processed.lang,
        degraded: processed.degraded || undefined,
        processMs: Math.round(processedAt - started),
        ttsMs: Math.round(performance.now() - processedAt),
      },
      'tts ready',
    );
    return ogg;
  };
}
