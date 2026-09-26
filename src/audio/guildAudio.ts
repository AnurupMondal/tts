import { Readable } from 'node:stream';
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  type AudioPlayer,
  type DiscordGatewayAdapterCreator,
  type VoiceConnection,
} from '@discordjs/voice';
import { logger } from '../logger.js';

/**
 * Produces Ogg/Opus audio for one queued message (text processing + TTS), or null if there is
 * nothing to say. Started lazily so only a few are generated ahead, and in queue order.
 */
export type AudioJob = () => Promise<Buffer | null>;

interface QueueItem {
  job: AudioJob;
  audio?: Promise<Buffer | null>;
  meta: { userId: string; length: number };
}

export interface JoinTarget {
  guildId: string;
  channelId: string;
  adapterCreator: DiscordGatewayAdapterCreator;
}

/** How many queued messages have TTS generated ahead of playback (includes the one about to play). */
const PREFETCH = 2;

/**
 * One voice connection + player + FIFO speech queue per guild.
 * Speech is never interrupted by new messages; only /tts skip stops the current clip.
 */
export class GuildAudio {
  readonly player: AudioPlayer;
  private connection?: VoiceConnection;
  private queue: QueueItem[] = [];
  private playing = false;
  private paused = false;
  /** Bumped by clear()/destroy() so in-flight generations for dropped items are ignored. */
  private generation = 0;

  constructor(
    readonly guildId: string,
    private readonly maxQueueSize: number,
    private readonly onDestroyed: () => void,
  ) {
    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    this.player.on(AudioPlayerStatus.Idle, () => {
      this.playing = false;
      void this.playNext();
    });
    this.player.on('error', (err) => {
      logger.warn({ guild: this.guildId, err: err.message }, 'audio player error');
      this.playing = false;
      void this.playNext();
    });
  }

  get channelId(): string | undefined {
    return this.connection?.joinConfig.channelId ?? undefined;
  }

  get length(): number {
    return this.queue.length + (this.playing ? 1 : 0);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  async join(target: JoinTarget): Promise<void> {
    if (this.connection && this.connection.joinConfig.channelId === target.channelId) return;
    this.connection?.destroy();

    const connection = joinVoiceChannel({
      guildId: target.guildId,
      channelId: target.channelId,
      adapterCreator: target.adapterCreator,
      selfDeaf: true,
    });
    this.connection = connection;

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // Moved to another channel or a brief network blip: wait for reconnection.
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        connection.destroy(); // kicked or channel deleted
      }
    });
    connection.on(VoiceConnectionStatus.Destroyed, () => {
      if (this.connection === connection) {
        this.connection = undefined;
        this.clear();
        this.player.stop(true);
        this.onDestroyed();
      }
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (err) {
      connection.destroy();
      throw new Error('Could not connect to the voice channel within 20 seconds', { cause: err });
    }
    connection.subscribe(this.player);
  }

  leave(): void {
    this.connection?.destroy();
  }

  /** Adds a message to the queue. Returns false (message dropped) when the queue is full. */
  enqueue(job: AudioJob, meta: QueueItem['meta']): boolean {
    if (this.queue.length >= this.maxQueueSize) return false;
    this.queue.push({ job, meta });
    this.prefetch();
    void this.playNext();
    return true;
  }

  skip(): boolean {
    if (!this.playing) return false;
    this.player.stop(true); // Idle → playNext
    return true;
  }

  clear(): number {
    const dropped = this.queue.length;
    this.queue = [];
    this.generation++;
    return dropped;
  }

  pause(): boolean {
    this.paused = true;
    return this.player.pause(true);
  }

  resume(): boolean {
    this.paused = false;
    const resumed = this.player.unpause();
    void this.playNext();
    return resumed;
  }

  private start(item: QueueItem): Promise<Buffer | null> {
    item.audio ??= item.job().catch((err: Error) => {
      logger.warn({ guild: this.guildId, user: item.meta.userId, err: err.message }, 'tts generation failed');
      return null;
    });
    return item.audio;
  }

  private prefetch(): void {
    const ahead = this.playing ? PREFETCH - 1 : PREFETCH;
    this.queue.slice(0, Math.max(ahead, 1)).forEach((item) => void this.start(item));
  }

  private async playNext(): Promise<void> {
    if (this.playing || this.paused || !this.connection) return;
    const item = this.queue.shift();
    if (!item) return;

    this.playing = true;
    const generation = this.generation;
    const audio = await this.start(item);
    this.prefetch();

    if (generation !== this.generation || !audio || !this.connection) {
      this.playing = false;
      return void this.playNext();
    }
    const resource = createAudioResource(Readable.from([audio]), { inputType: StreamType.OggOpus });
    this.player.play(resource);
    logger.debug({ guild: this.guildId, user: item.meta.userId, length: item.meta.length }, 'playing');
  }
}

/** Registry of per-guild audio state. */
export class AudioManager {
  private readonly guilds = new Map<string, GuildAudio>();

  constructor(private readonly maxQueueSize: number) {}

  get(guildId: string): GuildAudio | undefined {
    return this.guilds.get(guildId);
  }

  getOrCreate(guildId: string): GuildAudio {
    let audio = this.guilds.get(guildId);
    if (!audio) {
      audio = new GuildAudio(guildId, this.maxQueueSize, () => this.guilds.delete(guildId));
      this.guilds.set(guildId, audio);
    }
    return audio;
  }

  leaveAll(): void {
    for (const audio of this.guilds.values()) audio.leave();
  }
}
