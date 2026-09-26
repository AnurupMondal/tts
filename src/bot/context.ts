import type { AudioManager } from '../audio/guildAudio.js';
import type { Config } from '../config/config.js';
import type { Transliterator } from '../hinglish/transliterator.js';
import type { TTSProvider } from '../tts/provider.js';
import type { GuildSettingsStore } from './guildSettings.js';
import type { SpamGuard } from './spamGuard.js';

/** Services shared by the command and message handlers. */
export interface BotContext {
  config: Config;
  settings: GuildSettingsStore;
  audio: AudioManager;
  tts: TTSProvider;
  transliterator: Transliterator;
  spam: SpamGuard;
}
