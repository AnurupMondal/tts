import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { LanguageMode } from '../config/config.js';
import { logger } from '../logger.js';

/** Per-guild settings. Contains ids and preferences only, never message content. */
export interface GuildSettings {
  /** Text channels (including voice-channel chats) whose messages are read aloud. */
  enabledChannels: string[];
  mode: LanguageMode;
  /** Chosen voice; only used while that provider is active (voice ids are provider-specific). */
  voice?: { provider: string; id: string };
  ignoredUsers: string[];
  ignoredChannels: string[];
  /** Say who wrote a message ("Rahul says, ...") when the speaker changes. Unset means on. */
  announceNames?: boolean;
}

export class GuildSettingsStore {
  private readonly file: string;
  private data: Record<string, GuildSettings> = {};
  private saveTimer?: NodeJS.Timeout;

  constructor(
    dataDir: string,
    private readonly defaultMode: LanguageMode,
  ) {
    this.file = join(dataDir, 'guilds.json');
    try {
      this.data = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, GuildSettings>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') logger.warn({ err: (err as Error).message }, 'could not read guild settings, starting fresh');
    }
  }

  get(guildId: string): GuildSettings {
    return (this.data[guildId] ??= {
      enabledChannels: [],
      mode: this.defaultMode,
      ignoredUsers: [],
      ignoredChannels: [],
    });
  }

  /** The guild's voice for the given provider, or undefined for the provider default. */
  voiceFor(guildId: string, provider: string): string | undefined {
    const voice = this.get(guildId).voice;
    return voice?.provider === provider ? voice.id : undefined;
  }

  update(guildId: string, change: (settings: GuildSettings) => void): GuildSettings {
    const settings = this.get(guildId);
    change(settings);
    this.scheduleSave();
    return settings;
  }

  /** Adds the id if absent, removes it if present. Returns true if it is now in the list. */
  static toggle(list: string[], id: string): boolean {
    const i = list.indexOf(id);
    if (i >= 0) {
      list.splice(i, 1);
      return false;
    }
    list.push(id);
    return true;
  }

  flush(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      renameSync(tmp, this.file);
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'failed to save guild settings');
    }
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 500);
  }
}
