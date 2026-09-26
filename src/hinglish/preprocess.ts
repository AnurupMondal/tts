import { EMOJI_REGEX, EMOJI_SPEECH } from './lexicon/emoji.js';

/** Private-use sentinels wrapping text that must be spoken verbatim (names, channel names). */
export const PROTECT_OPEN = '\uE000';
export const PROTECT_CLOSE = '\uE001';

/** Resolves Discord ids to display names. Kept abstract so this module has no discord.js dependency. */
export interface MentionResolver {
  user?(id: string): string | undefined;
  channel?(id: string): string | undefined;
  role?(id: string): string | undefined;
}

export interface PreprocessOptions {
  resolver?: MentionResolver;
  /** Maximum number of emoji that get spoken per message. */
  maxSpokenEmoji?: number;
}

/** Wraps a name so it is spoken verbatim; "riya_09" is read as "riya 09". */
const protect = (name: string) =>
  `${PROTECT_OPEN}${name.split(PROTECT_OPEN).join('').split(PROTECT_CLOSE).join('').replace(/[_.]+/g, ' ').trim()}${PROTECT_CLOSE}`;

/**
 * Turns a raw Discord message into plain speakable text:
 * drops code, URLs, spoilers, markdown and custom emoji; resolves mentions to names;
 * converts a few emoji to words. Returns '' when nothing speakable remains.
 */
export function preprocess(input: string, options: PreprocessOptions = {}): string {
  const { resolver, maxSpokenEmoji = 2 } = options;
  let text = input;

  text = text.replace(/```[\s\S]*?```/g, ' '); // code blocks
  text = text.replace(/```[\s\S]*$/g, ' '); // unterminated code block
  text = text.replace(/`[^`]*`/g, ' '); // inline code
  text = text.replace(/\|\|[\s\S]*?\|\|/g, ' '); // spoilers are not read aloud
  text = text.replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' '); // URLs
  text = text.replace(/<t:\d+(?::[tTdDfFR])?>/g, ' '); // timestamps
  text = text.replace(/<a?:\w+:\d+>/g, ' '); // custom emoji
  text = text.replace(/<@!?(\d+)>/g, (_, id: string) => {
    const name = resolver?.user?.(id);
    return name ? ` ${protect(name)} ` : ' ';
  });
  text = text.replace(/<@&(\d+)>/g, (_, id: string) => {
    const name = resolver?.role?.(id);
    return name ? ` ${protect(name)} ` : ' ';
  });
  text = text.replace(/<#(\d+)>/g, (_, id: string) => {
    const name = resolver?.channel?.(id);
    return name ? ` ${protect(name)} ` : ' ';
  });
  text = text.replace(/@(?:everyone|here)\b/g, ' ');
  // Plain "@name" typed by hand: speak the name.
  text = text.replace(/(^|\s)@([\p{L}\p{N}_.]{2,32})/gu, (_, pre: string, name: string) => `${pre}${protect(name)}`);

  // Markdown: headings, quotes, list bullets, emphasis markers.
  text = text.replace(/^\s*(?:#{1,3}|>{1,3}|-#|[-*])\s+/gm, ' ');
  text = text.replace(/[*~]{1,3}/g, '');
  text = text.replace(/(^|\s)_{1,2}([^_\s][^_]*?)_{1,2}(?=\s|$)/g, '$1$2'); // _emphasis_, not snake_case

  // Emoji: speak at most `maxSpokenEmoji` mapped ones, collapse repeats, drop the rest.
  let spoken = 0;
  let last = '';
  text = text.replace(EMOJI_REGEX, (emoji) => {
    const base = emoji.replace(/[\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, '');
    const word = EMOJI_SPEECH[emoji] ?? EMOJI_SPEECH[base];
    if (!word || spoken >= maxSpokenEmoji || word === last) return ' ';
    spoken++;
    last = word;
    return ` ${protect(word)} `;
  });
  text = text.replace(/[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]/gu, '');

  // Punctuation runs: "???" → "?", "!!!" → "!", "....." → "...".
  text = text.replace(/([?!])[?!]+/g, '$1');
  text = text.replace(/\.{4,}/g, '...');
  text = text.replace(/[\r\n]+/g, '. ');

  return text.replace(/\s+/g, ' ').trim();
}

/** True if the preprocessed text contains anything worth speaking. */
export function isSpeakable(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}
