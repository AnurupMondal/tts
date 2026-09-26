import { AudioManager } from './audio/guildAudio.js';
import { createClient } from './bot/client.js';
import type { BotContext } from './bot/context.js';
import { GuildSettingsStore } from './bot/guildSettings.js';
import { SpamGuard } from './bot/spamGuard.js';
import { config, requireConfig } from './config/config.js';
import { GoogleInputToolsTransliterator } from './hinglish/transliterator.js';
import { logger } from './logger.js';
import { createTTSProvider } from './tts/index.js';

const { DISCORD_TOKEN } = requireConfig('DISCORD_TOKEN');

const ctx: BotContext = {
  config,
  settings: new GuildSettingsStore(config.DATA_DIR, config.DEFAULT_MODE),
  audio: new AudioManager(config.MAX_QUEUE_SIZE),
  tts: createTTSProvider(),
  transliterator: new GoogleInputToolsTransliterator({ timeoutMs: config.TRANSLIT_TIMEOUT_MS }),
  spam: new SpamGuard({
    userCooldownMs: config.USER_COOLDOWN_MS,
    channelCooldownMs: config.CHANNEL_COOLDOWN_MS,
    duplicateWindowMs: config.DUPLICATE_WINDOW_MS,
    guildRatePerMin: config.GUILD_RATE_PER_MIN,
  }),
};

const client = createClient(ctx);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  ctx.audio.leaveAll();
  ctx.settings.flush();
  await client.destroy();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error({ err: String(reason) }, 'unhandled rejection'));

await client.login(DISCORD_TOKEN);
