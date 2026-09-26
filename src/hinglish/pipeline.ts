import type { LanguageMode } from '../config/config.js';
import { detect, messageLang } from './detector.js';
import { assemble, transliterateTokens } from './mixedLanguageProcessor.js';
import { normalize } from './normalizer.js';
import { normalizeNumbers } from './numbers.js';
import { isSpeakable, preprocess, type MentionResolver } from './preprocess.js';
import { tokenize } from './tokenizer.js';
import type { Transliterator } from './transliterator.js';
import type { ProcessedText } from './types.js';

export interface ProcessOptions {
  mode: LanguageMode;
  transliterator: Transliterator;
  resolver?: MentionResolver;
}

/**
 * The single entry point of the language layer:
 *   raw Discord text → speakable text with Hindi in Devanagari and English kept in Latin.
 */
export async function processMessage(input: string, options: ProcessOptions): Promise<ProcessedText> {
  const cleaned = preprocess(input, { resolver: options.resolver });
  if (!isSpeakable(cleaned)) {
    return {
      text: '',
      lang: 'en',
      skipped: 'empty',
      degraded: false,
      detection: { lang: 'en', hindiWords: 0, englishWords: 0, hindiRatio: 0, confidence: 1 },
    };
  }

  const tokens = tokenize(cleaned);
  const detection = detect(tokens, options.mode);
  normalize(tokens);
  normalizeNumbers(tokens, detection.lang);
  const degraded = detection.lang === 'en' ? false : await transliterateTokens(tokens, options.transliterator);

  return { text: assemble(tokens), lang: messageLang(tokens), detection, degraded };
}

export type { ProcessedText } from './types.js';
export type { Transliterator } from './transliterator.js';
