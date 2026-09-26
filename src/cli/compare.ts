/** Helpers for scoring transliteration output against the dataset (eval + tests). */

/** Compare ignoring punctuation, whitespace and nukta/chandrabindu spelling variation. */
export function canonicalForCompare(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\u093C/g, '') // nukta: ज़ vs ज
    .replace(/\u0901/g, '\u0902') // chandrabindu vs anusvara: हूँ vs हूं
    .replace(/[.,!?।…'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}
