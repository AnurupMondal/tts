import type { LanguageMode } from '../config/config.js';
import { ENGLISH_COMMON, ENGLISH_SUFFIXES } from './lexicon/englishCommon.js';
import { GAMING_TERMS } from './lexicon/gaming.js';
import { HINDI_ROMAN } from './lexicon/hindiRoman.js';
import { VARIANTS } from './lexicon/overrides.js';
import type { Detection, MessageLang, Token } from './types.js';

type Label = 'hi' | 'en' | 'amb' | 'unk' | 'keep';

const DEVANAGARI = /\p{Script=Devanagari}/u;
const LATIN_WORD = /^[a-z']+$/;

/** "<English word> kar" is the standard way to use an English verb in Hindi ("throw kar", "lag kar raha"). */
const KAR_VERBS = new Set([
  'kar', 'kr', 'karo', 'kro', 'karna', 'krna', 'karne', 'krne', 'karke', 'krke', 'karta', 'krta', 'karti', 'krti', 'karte', 'krte',
  'karega', 'krega', 'karenge', 'krenge', 'karunga', 'krunga', 'kardo', 'krdo', 'kiya', 'kia', 'kiye',
]);
/** Other light verbs; only used for words that are not also Hindi ("hang ho gaya", "headshot maar"). */
const LIGHT_VERBS = new Set([...KAR_VERBS, 'ho', 'hua', 'hui', 'hoga', 'hogi', 'hota', 'maar', 'mar', 'maara', 'mara', 'de', 'diya', 'dena', 'lagao', 'laga']);
/** Hindi function words that collide with English and must never be forced English by the kar rule. */
const FUNCTION_WORDS = new Set(['to', 'is', 'me', 'main', 'the', 'so', 'do', 'are', 'hi', 'par', 'or', 'us', 'he', 'ho', 'na', 'mat', 'bus']);
/** English verbs that take "me" as object ("let me", "help me"); otherwise "me" is Hindi में/मैं. */
const ENGLISH_ME_VERBS = new Set([
  'let', 'tell', 'give', 'help', 'call', 'hear', 'send', 'show', 'text', 'ping', 'dm', 'see', 'ask', 'told', 'gave', 'sent', 'pay', 'teach',
  'trust', 'love', 'hate', 'miss', 'follow', 'add', 'invite', 'kill', 'carry', 'pick', 'join', 'like', 'believe', 'remind', 'excuse', 'wake', 'for', 'with', 'to', 'about',
]);
/** Words that follow a name: "Priya ne", "Rohit kaha", "Arjun bhai". */
const NAME_FOLLOWERS = new Set(['ne', 'ko', 'ka', 'ki', 'ke', 'se', 'bhai', 'bhaiya', 'kaha', 'kahan', 'kidhar', 'aa', 'aaja', 'sun', 'bol', 'tu', 'aur']);

/** Strong romanised-Hindi morphology for words missing from the lexicon (khelenge, bataunga, dekhoge). */
const HINDI_SUFFIX = /(?:enge|egi|ega|unga|ungi|oge|ogi|iye|iyo|wala|wali|wale|aao|aaya|aayi|aaye|ogey|kar|karo|karna|oon|aan|ein|ain|hne|lne|aa|ii)$/;
const HINDI_CLUSTERS = /(?:bh|kh|gh|jh|dh|chh|aa|ii)/;
const ENGLISH_SUFFIX = new RegExp(`(?:${ENGLISH_SUFFIXES.join('|')})$`);
const ENGLISH_CLUSTERS = /(?:x|q[^y]|ck|tch|ght|wh|ph|[bcdfgklmnprstvz]{3})/;


/** Message language from the final token labels (after number/unit conversion). */
export function messageLang(tokens: Token[]): MessageLang {
  const words = tokens.filter((t) => t.kind !== 'punct' && t.out !== '');
  const hi = words.some((t) => t.lang === 'hi');
  const en = words.some((t) => t.lang === 'en');
  return hi ? (en ? 'mixed' : 'hi') : 'en';
}

export function isEnglishWord(lower: string): boolean {
  return ENGLISH_COMMON.has(lower) || GAMING_TERMS.has(lower);
}

export function isHindiWord(lower: string): boolean {
  if (HINDI_ROMAN.has(lower)) return true;
  const variant = VARIANTS[lower];
  return variant !== undefined && HINDI_ROMAN.has(variant.split(' ')[0]!);
}

function initialLabel(t: Token): Label {
  if (t.kind === 'protected' || t.kind === 'punct' || t.kind === 'number') return 'keep';
  if (DEVANAGARI.test(t.raw)) return 'hi';
  const w = t.lower;
  if (/\d/.test(w) || !LATIN_WORD.test(w)) return 'keep'; // gta5, 4070ti, other scripts
  const hi = isHindiWord(w);
  const en = isEnglishWord(w);
  // Acronyms (GG, OP, RTX) stay English unless they are just shouted Hindi ("BHAI").
  if (t.raw.length >= 2 && t.raw === t.raw.toUpperCase() && !hi) return 'keep';
  if (hi && en) return 'amb';
  if (hi) return 'hi';
  if (en) return 'en';
  // CamelCase brands (iPhone, YouTube) and capitalised mid-sentence unknowns (Rahul, Valorant): keep verbatim.
  if (/\p{Ll}\p{Lu}/u.test(t.raw)) return 'keep';
  if (!t.sentenceStart && /^\p{Lu}/u.test(t.raw)) return 'keep';
  return 'unk';
}

/** > 0 looks like romanised Hindi, < 0 looks English, 0 = no signal. */
function morphologyScore(w: string): number {
  let score = 0;
  if (HINDI_SUFFIX.test(w)) score += 2;
  else if (HINDI_CLUSTERS.test(w)) score += 1;
  if (ENGLISH_SUFFIX.test(w)) score -= 2;
  if (ENGLISH_CLUSTERS.test(w)) score -= 1;
  return score;
}

/**
 * Labels every word token as hi / en / neutral in place and returns message-level detection.
 * Hindi tokens will be transliterated; English and neutral tokens stay in Latin script.
 */
export function detect(tokens: Token[], mode: LanguageMode): Detection {
  const words = tokens.filter((t) => t.kind !== 'punct');
  const labels: Label[] = words.map(initialLabel);
  let ambiguous = 0;

  const definite = (i: number): 'hi' | 'en' | undefined => {
    const l = labels[i];
    return l === 'hi' || l === 'en' ? l : undefined;
  };
  const vote = (i: number, radius: number) => {
    let hi = 0;
    let en = 0;
    for (let j = i - radius; j <= i + radius; j++) {
      if (j === i || j < 0 || j >= words.length) continue;
      const weight = Math.abs(j - i) === 1 ? 2 : 1;
      const l = definite(j);
      if (l === 'hi') hi += weight;
      else if (l === 'en') en += weight;
    }
    return hi - en;
  };
  const totals = () => {
    let hi = 0;
    let en = 0;
    labels.forEach((l) => (l === 'hi' ? hi++ : l === 'en' ? en++ : 0));
    return hi - en;
  };

  // Capitalised unknown first word followed by a postposition/address is a name: "Priya ne kaha", "Arjun bhai".
  words.forEach((t, i) => {
    const next = words[i + 1]?.lower;
    if (labels[i] === 'unk' && t.sentenceStart && /^\p{Lu}\p{Ll}/u.test(t.raw) && next && NAME_FOLLOWERS.has(next)) labels[i] = 'keep';
  });

  // Resolve ambiguous and unknown words from context; two passes so resolutions propagate.
  for (let pass = 0; pass < 2; pass++) {
    words.forEach((t, i) => {
      const label = labels[i];
      if (label !== 'amb' && label !== 'unk') return;
      const next = words[i + 1]?.lower;
      const isFinalPass = pass === 1;

      if (label === 'amb') {
        // "me": English only as the object of an English verb ("let me check"); else में/मैं ("vc me", "me start").
        if (t.lower === 'me') {
          const prev = words[i - 1];
          labels[i] = prev && ENGLISH_ME_VERBS.has(prev.lower) ? 'en' : 'hi';
          return;
        }
        // "hi bhai" is a greeting, not the Hindi emphatic ही.
        if (i === 0 && t.lower === 'hi') {
          labels[i] = 'en';
          return;
        }
        // "lag kar raha", "push karna": English verb + kar, even when the word is also Hindi.
        if (next && KAR_VERBS.has(next) && isEnglishWord(t.lower) && !FUNCTION_WORDS.has(t.lower)) {
          labels[i] = 'en';
          return;
        }
        if (next && LIGHT_VERBS.has(next) && isEnglishWord(t.lower) && !HINDI_ROMAN.has(t.lower)) {
          labels[i] = 'en';
          return;
        }
      } else if (next && LIGHT_VERBS.has(next) && t.lower.length > 3 && morphologyScore(t.lower) <= 0) {
        labels[i] = 'en'; // "bhai tu feed kar raha": unknown English verb + kar
        return;
      }

      // Context vote, plus word-shape evidence for unknown words ("dekhne", "chalein" look Hindi).
      const context = vote(i, 2) || vote(i, 4);
      const score = label === 'unk' ? context + 1.5 * morphologyScore(t.lower) : context;
      if (score > 0) labels[i] = 'hi';
      else if (score < 0) labels[i] = 'en';
      else if (isFinalPass) {
        // Tie: Hindi is head-final, so the following word is the best cue ("game me aa" → में).
        const global = totals();
        labels[i] =
          definite(i + 1) ?? definite(i - 1) ?? (global > 0 ? 'hi' : global < 0 ? 'en' : label === 'unk' ? 'hi' : 'en');
      }
      if (label === 'amb' && isFinalPass) ambiguous++;
    });
  }

  // Apply mode.
  let hindiWords = labels.filter((l) => l === 'hi').length;
  let englishWords = labels.filter((l) => l === 'en').length;
  const langBearing = hindiWords + englishWords;
  const ratio = langBearing === 0 ? 0 : hindiWords / langBearing;

  const forceEnglish = mode === 'english' || (mode === 'auto' && (hindiWords === 0 || (ratio < 0.2 && hindiWords <= 1)));
  words.forEach((t, i) => {
    const l = labels[i];
    if (DEVANAGARI.test(t.raw)) {
      t.lang = 'hi';
      t.out = t.raw;
      return;
    }
    if (l === 'keep') {
      t.lang = 'neutral';
      return;
    }
    if (forceEnglish) t.lang = 'en';
    else if (mode === 'hindi') t.lang = GAMING_TERMS.has(t.lower) ? 'en' : 'hi';
    else t.lang = l === 'hi' ? 'hi' : 'en';
  });

  hindiWords = words.filter((t) => t.lang === 'hi').length;
  englishWords = words.filter((t) => t.lang === 'en').length;
  const hindiRatio = hindiWords + englishWords === 0 ? 0 : hindiWords / (hindiWords + englishWords);
  const lang = hindiWords === 0 ? 'en' : englishWords === 0 ? 'hi' : 'mixed';
  const confidence = langBearing === 0 ? 1 : 1 - ambiguous / langBearing;

  return { lang, hindiWords, englishWords, hindiRatio, confidence };
}
