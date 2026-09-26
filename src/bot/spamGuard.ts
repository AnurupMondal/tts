export interface SpamGuardOptions {
  userCooldownMs: number;
  channelCooldownMs: number;
  duplicateWindowMs: number;
  /** Token bucket size and refill per minute, per guild. */
  guildRatePerMin: number;
}

export type SpamVerdict = 'ok' | 'user_cooldown' | 'channel_cooldown' | 'duplicate' | 'rate_limited';

/**
 * In-memory spam protection. Duplicate detection stores a short hash of the text, not the text.
 * Maps are pruned lazily so memory stays bounded.
 */
export class SpamGuard {
  private readonly lastByUser = new Map<string, number>();
  private readonly lastByChannel = new Map<string, number>();
  private readonly recent = new Map<string, number>(); // `${user}:${hash}` → time
  private readonly buckets = new Map<string, { tokens: number; updated: number }>();
  private lastPrune = 0;

  constructor(
    private readonly options: SpamGuardOptions,
    private readonly now: () => number = Date.now,
  ) {}

  check(guildId: string, channelId: string, userId: string, text: string): SpamVerdict {
    const t = this.now();
    this.prune(t);
    const o = this.options;

    const lastUser = this.lastByUser.get(userId);
    if (lastUser !== undefined && t - lastUser < o.userCooldownMs) return 'user_cooldown';

    const lastChannel = this.lastByChannel.get(channelId);
    if (lastChannel !== undefined && t - lastChannel < o.channelCooldownMs) return 'channel_cooldown';

    const dupKey = `${userId}:${hash(text.trim().toLowerCase())}`;
    const lastSame = this.recent.get(dupKey);
    if (lastSame !== undefined && t - lastSame < o.duplicateWindowMs) return 'duplicate';

    const bucket = this.buckets.get(guildId) ?? { tokens: o.guildRatePerMin, updated: t };
    bucket.tokens = Math.min(o.guildRatePerMin, bucket.tokens + ((t - bucket.updated) / 60_000) * o.guildRatePerMin);
    bucket.updated = t;
    if (bucket.tokens < 1) {
      this.buckets.set(guildId, bucket);
      return 'rate_limited';
    }
    bucket.tokens -= 1;
    this.buckets.set(guildId, bucket);

    this.lastByUser.set(userId, t);
    this.lastByChannel.set(channelId, t);
    this.recent.set(dupKey, t);
    return 'ok';
  }

  private prune(t: number): void {
    if (t - this.lastPrune < 60_000) return;
    this.lastPrune = t;
    const horizon = Math.max(this.options.userCooldownMs, this.options.channelCooldownMs, this.options.duplicateWindowMs);
    for (const map of [this.lastByUser, this.lastByChannel, this.recent]) {
      for (const [k, v] of map) if (t - v > horizon) map.delete(k);
    }
  }
}

/** FNV-1a 32-bit. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
