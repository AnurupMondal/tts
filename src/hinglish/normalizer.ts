import { NUMBER_UNITS } from './lexicon/numbers.js';
import { VARIANTS } from './lexicon/overrides.js';
import type { Token } from './types.js';

/** Words after which "mai/main/me" is the pronoun मैं (addressing someone, interjections, conjunctions). */
const PRONOUN_CONTEXT_BEFORE = new Set([
  'bhai', 'bro', 'yaar', 'yar', 'arre', 'arey', 'are', 'abe', 'abey', 'haan', 'han', 'ha', 'nahi', 'nhi', 'ok', 'okay', 'accha', 'acha',
  'ruk', 'ruko', 'chal', 'chalo', 'sun', 'suno', 'dekh', 'dekho', 'toh', 'to', 'aur', 'or', 'lekin', 'par', 'phir', 'fir', 'kyunki', 'kyuki',
  'ki', 'jab', 'agar', 'bas', 'hmm', 'sorry', 'bruh', 'dude', 'please', 'plz', 'pls', 'jo', 'bhi', 'kal', 'aaj', 'abhi',
]);

/** Words after "mai/main" that indicate the pronoun (मैं भी, मैं नहीं, मैं अभी...). */
const PRONOUN_CONTEXT_AFTER = new Set([
  'bhi', 'toh', 'to', 'nahi', 'nhi', 'abhi', 'abi', 'kal', 'aaj', 'hi', 'khud', 'bas', 'pehle', 'ek', 'akela', 'kya', 'kaise', 'kab', 'jaa',
  'ja', 'aa', 'aata', 'aaunga', 'jaunga', 'kar', 'kr', 'sochta', 'bolta', 'bol', 'soch', 'tujhe', 'tumhe', 'aapko', 'usko', 'isko', 'bhai',
]);

/** Nouns commonly followed by the postposition में ("ghar me", "game me"). */
const LOCATIVE_NOUNS = new Set([
  'ghar', 'room', 'game', 'match', 'vc', 'discord', 'server', 'lobby', 'school', 'college', 'office', 'class', 'raat', 'din', 'saal',
  'time', 'dimaag', 'dimag', 'dil', 'beech', 'bich', 'andar', 'phone', 'car', 'bus', 'train', 'group', 'chat', 'channel', 'team', 'round',
  'baat', 'life', 'duniya', 'india', 'city', 'sheher', 'gaon', 'party', 'movie', 'video', 'kitchen', 'bed', 'bathroom', 'market', 'mall',
]);

/** English chat abbreviations expanded so TTS doesn't spell them out. */
const ENGLISH_EXPANSIONS: Readonly<Record<string, string>> = {
  plz: 'please', pls: 'please', plss: 'please', thx: 'thanks', ty: 'thank you', sry: 'sorry',
  bcoz: 'because', bcz: 'because', coz: 'because', cuz: 'because', u: 'you', ur: 'your', r: 'are',
  gn: 'good night', gm: 'good morning', idk: "I don't know", btw: 'by the way', nvm: 'never mind',
  brb: 'be right back', np: 'no problem', omg: 'oh my god', tbh: 'to be honest', imo: 'in my opinion',
  ngl: 'not gonna lie', fr: 'for real', wp: 'well played', gg: 'G G', ez: 'easy', nt: 'nice try',
};

/** "ki" after a clause-ending verb, or before a new clause, is the conjunction कि ("socha ki", "hai ki hum"). */
const CLAUSE_VERBS = new Set([
  'tha', 'thi', 'the', 'hai', 'hain', 'h', 'raha', 'rha', 'rahi', 'rhi', 'lagta', 'lagti', 'laga', 'lagi', 'socha', 'soch', 'bola', 'boli', 'kaha',
  'pata', 'dekha', 'suna', 'khela', 'maana', 'chahta', 'chahti', 'batao', 'bata', 'bol', 'sun', 'dekh', 'yaad',
]);
const CLAUSE_STARTS = new Set([
  'mai', 'main', 'me', 'hum', 'hume', 'tu', 'tum', 'aap', 'wo', 'woh', 'vo', 'ye', 'yeh', 'sab', 'aaj', 'kal', 'abhi', 'agar', 'koi', 'kuch',
  'mujhe', 'tujhe', 'usko', 'isko', 'ab',
]);

const ERGATIVE = new Set(['ne', 'maine', 'mene', 'tune', 'usne', 'aapne', 'apne', 'humne', 'tumne', 'sabne', 'unhone', 'isne']);
const BAAT_CONTEXT = new Set(['hai', 'h', 'kar', 'kr', 'karo', 'kro', 'ho', 'hui', 'sun', 'suno', 'bata', 'batao', 'kya', 'ek', 'meri', 'teri', 'uski', 'ki', 'wali', 'alag']);

function wordAt(tokens: Token[], i: number, dir: -1 | 1): Token | undefined {
  for (let j = i + dir; j >= 0 && j < tokens.length; j += dir) {
    const t = tokens[j]!;
    if (t.kind === 'punct') return /[.!?।,]/.test(t.raw) ? undefined : wordAt(tokens, j, dir);
    return t;
  }
  return undefined;
}

/** Decide between मैं (pronoun) and में (postposition) for mai/main/me/mein/mei. */
function resolveMainMein(tokens: Token[], i: number, w: string): 'main' | 'mein' {
  const prev = wordAt(tokens, i, -1);
  const next = wordAt(tokens, i, 1);
  const p = prev?.lower;
  const n = next?.lower;

  if (!prev || PRONOUN_CONTEXT_BEFORE.has(p!)) return 'main';
  // After a quantity the typed spelling decides: "2 min me aa" (में) vs "ruk 2 min mai aa rha hu" (मैं).
  if (prev.kind === 'number' || (p && p in NUMBER_UNITS)) {
    return (w === 'mai' || w === 'main') && n && PRONOUN_CONTEXT_AFTER.has(n) ? 'main' : 'mein';
  }
  // Postposition after English nouns, names and known locative nouns: "2 min me", "game me", "Rahul ke ghar me".
  if ((p && LOCATIVE_NOUNS.has(p)) || prev.lang === 'en' || prev.kind === 'protected') {
    return (w === 'mai' || w === 'main') && n && PRONOUN_CONTEXT_AFTER.has(n) && prev.lang !== 'en' ? 'main' : 'mein';
  }
  // With a preceding word, the typed spelling decides: "der me aata" (में) vs "phir mai aata" (मैं).
  if ((w === 'mai' || w === 'main') && n && PRONOUN_CONTEXT_AFTER.has(n)) return 'main';
  return w === 'mai' || w === 'main' ? 'main' : 'mein';
}

/**
 * Rewrites Hindi-labelled tokens to a canonical romanisation (sets `token.norm`).
 * English tokens are untouched, so "kr" is only expanded when the detector already decided it is Hindi.
 */
export function normalize(tokens: Token[]): void {
  tokens.forEach((t, i) => {
    if (t.out !== undefined) return;
    const w = t.lower;
    if (t.kind === 'word' && t.lang !== 'hi') {
      const expansion = ENGLISH_EXPANSIONS[w];
      if (expansion) t.norm = expansion;
      return;
    }
    if (t.lang !== 'hi') return;
    const prev = wordAt(tokens, i, -1);
    const next = wordAt(tokens, i, 1);

    switch (w) {
      case 'mai':
      case 'main':
      case 'me':
      case 'mein':
      case 'mei':
        t.norm = resolveMainMein(tokens, i, w);
        return;
      case 'kaha':
      case 'kahan':
      case 'kahaan':
        // "maine kaha" = said (कहा); otherwise "where" (कहाँ).
        t.norm = w === 'kaha' && prev && ERGATIVE.has(prev.lower) ? 'kaha' : 'kahaan';
        return;
      case 'h':
        t.norm = prev ? 'hai' : 'haan';
        return;
      case 'hn':
        t.norm = prev && ['raha', 'rahe', 'rhe', 'rha', 'gaye', 'gye', 'hi'].includes(prev.lower) ? 'hain' : 'haan';
        return;
      case 'bt':
        t.norm = (next && BAAT_CONTEXT.has(next.lower)) || (prev && BAAT_CONTEXT.has(prev.lower)) ? 'baat' : 'but';
        return;
      case 'ki':
        t.norm = (prev && CLAUSE_VERBS.has(prev.lower)) || (next && CLAUSE_STARTS.has(next.lower)) ? 'ki-conj' : 'ki';
        return;
      case 'ha':
      case 'haa':
        t.norm = 'haan';
        return;
    }

    let canonical = VARIANTS[w];
    if (canonical === undefined && /(\p{L})\1$/u.test(w)) {
      // Trailing doubled letter: "bhaii" → "bhai", "yaarr" → "yaar".
      canonical = VARIANTS[w.slice(0, -1)] ?? undefined;
    }
    t.norm = canonical ?? w;
  });
}
