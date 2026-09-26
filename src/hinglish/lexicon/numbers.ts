/** Hindi number words 0–100 (irregular in Hindi, so a table is the only correct approach). */
export const HINDI_NUMBERS: readonly string[] = [
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरेसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर',
  'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी',
  'नब्बे', 'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे',
  'सौ',
];

/**
 * Units that make a preceding number "spoken quantity" rather than an identifier.
 * Value = Devanagari rendering of the unit (null = unit is Hindi and goes through the engine).
 */
export const NUMBER_UNITS: Readonly<Record<string, string | null>> = {
  min: 'मिनट', mins: 'मिनट', minute: 'मिनट', minutes: 'मिनट', mint: 'मिनट', mnt: 'मिनट', m: 'मिनट',
  sec: 'सेकंड', secs: 'सेकंड', second: 'सेकंड', seconds: 'सेकंड', s: 'सेकंड',
  hr: 'घंटे', hrs: 'घंटे', hour: 'घंटे', hours: 'घंटे',
  ghanta: null, ghante: null, ghnte: null, baje: null, bje: null, din: null, dino: null, mahine: null, saal: null,
  log: null, logo: null, bande: null, banda: null, baar: null, bar: null, rupay: null, rupaye: null, paise: null,
  rs: 'रुपये', rupees: 'रुपये', k: 'हज़ार',
  kill: null, kills: null, round: null, rounds: null, match: null, matches: null, game: null, games: null,
};

/** Words that mark the following number as an identifier/model/version: keep digits as-is. */
export const IDENTIFIER_WORDS: ReadonlySet<string> = new Set([
  'room', 'rtx', 'gtx', 'rx', 'iphone', 'galaxy', 'pixel', 'ps', 'ps4', 'ps5', 'xbox', 'level', 'lvl', 'lv', 'version', 'ver', 'v',
  'season', 'episode', 'ep', 'chapter', 'act', 'no', 'number', 'id', 'code', 'otp', 'pin', 'flat', 'house', 'sector', 'block',
  'gta', 'fifa', 'windows', 'win', 'android', 'ios', 'ryzen', 'i3', 'i5', 'i7', 'i9', 'core', 'class', 'standard', 'roll', 'model',
]);
