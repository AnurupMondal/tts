/**
 * Emoji that are worth speaking. Everything else is dropped silently.
 * Values are spoken verbatim as protected tokens (never transliterated).
 */
export const EMOJI_SPEECH: Readonly<Record<string, string>> = {
  '😂': 'haha',
  '🤣': 'haha',
  '😆': 'haha',
  '😹': 'haha',
  '😅': 'hehe',
  '😁': 'hehe',
  '😄': 'haha',
  '💀': 'dead',
  '🔥': 'fire',
  '👍': 'ok',
  '👌': 'nice',
  '🙏': 'please',
  '❤\uFE0F': 'love',
  '❤': 'love',
  '😡': 'angry',
  '🤡': 'clown',
  '🥲': 'sad',
  '😭': 'crying',
  '🤔': 'hmm',
  '😴': 'sleepy',
  '🎉': 'party',
  '💯': 'hundred percent',
  '🤝': 'deal',
  '👀': 'eyes',
};

/** Matches emoji clusters, including ZWJ sequences, skin tones and variation selectors. */
export const EMOJI_REGEX = /(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)|[\u{1F1E6}-\u{1F1FF}]{2}/gu;
