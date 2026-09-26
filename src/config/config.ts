import 'dotenv/config';
import { z } from 'zod';

export const LANGUAGE_MODES = ['auto', 'hinglish', 'hindi', 'english'] as const;
export type LanguageMode = (typeof LANGUAGE_MODES)[number];

export const TTS_PROVIDERS = ['google', 'sarvam'] as const;
export type TTSProviderName = (typeof TTS_PROVIDERS)[number];

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const schema = z.object({
  DISCORD_TOKEN: optionalString,
  DISCORD_CLIENT_ID: optionalString,
  DEV_GUILD_ID: optionalString,

  TTS_PROVIDER: z.enum(TTS_PROVIDERS).default('google'),

  GOOGLE_APPLICATION_CREDENTIALS: optionalString,
  GOOGLE_VOICE_HI: z.string().default('hi-IN-Chirp3-HD-Charon'),
  GOOGLE_VOICE_EN: z.string().default('en-IN-Chirp3-HD-Charon'),
  GOOGLE_SPEAKING_RATE: z.coerce.number().min(0.25).max(4).default(0.75),

  SARVAM_API_KEY: optionalString,
  SARVAM_MODEL: z.string().default('bulbul:v3'),
  SARVAM_SPEAKER: z.string().default('shubh'),
  SARVAM_PACE: z.coerce.number().min(0.3).max(3).default(0.75),

  DEFAULT_MODE: z.enum(LANGUAGE_MODES).default('auto'),
  MAX_QUEUE_SIZE: z.coerce.number().int().positive().default(20),
  MAX_MESSAGE_LENGTH: z.coerce.number().int().positive().default(300),
  USER_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(0),
  CHANNEL_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(0),
  DUPLICATE_WINDOW_MS: z.coerce.number().int().nonnegative().default(15000),
  GUILD_RATE_PER_MIN: z.coerce.number().int().positive().default(40),

  TRANSLIT_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  TTS_CACHE_TTL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  TTS_CACHE_MAX: z.coerce.number().int().positive().default(300),

  DATA_DIR: z.string().default('./data'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
});

export type Config = z.infer<typeof schema>;

function load(): Config {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  return parsed.data;
}

export const config: Config = load();

/** Throws a readable error if a value needed for the current entry point is missing. */
export function requireConfig<K extends keyof Config>(...keys: K[]): { [P in K]-?: NonNullable<Config[P]> } {
  const missing = keys.filter((k) => config[k] === undefined || config[k] === '');
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')} (see .env.example)`);
  }
  return config as unknown as { [P in K]-?: NonNullable<Config[P]> };
}
