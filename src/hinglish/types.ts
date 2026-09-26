export type TokenKind = 'word' | 'number' | 'punct' | 'protected';

/** Per-token language label. `neutral` = keep verbatim (names, punctuation, emoji words). */
export type TokenLang = 'hi' | 'en' | 'neutral';

export interface Token {
  kind: TokenKind;
  /** Original text of the token. */
  raw: string;
  /** Lower-cased, repeated-letter-squashed form used for lookups. */
  lower: string;
  /** Whitespace preceded this token in the source. */
  spaceBefore: boolean;
  /** Starts a sentence (first token, or after . ! ? ।). */
  sentenceStart: boolean;
  lang: TokenLang;
  /** Canonical romanisation after normalisation (Hindi tokens only). */
  norm?: string;
  /** Final rendered text, when already decided (overrides, numbers, Devanagari input). */
  out?: string;
}

/** Outcome of message-level detection. */
export type MessageLang = 'hi' | 'en' | 'mixed';

export interface Detection {
  lang: MessageLang;
  hindiWords: number;
  englishWords: number;
  /** Share of Hindi among language-bearing words, 0..1. */
  hindiRatio: number;
  /** Rough confidence in the per-token labelling, 0..1 (low = ambiguous; hook for an LLM tier later). */
  confidence: number;
}

export interface ProcessedText {
  /** Text to send to TTS, e.g. "भाई मैं अभी Valorant खेल रहा हूँ". */
  text: string;
  lang: MessageLang;
  detection: Detection;
  /** Set when the message should not be spoken at all. */
  skipped?: 'empty';
  /** True when the transliteration engine failed and Roman text was passed through. */
  degraded: boolean;
}
