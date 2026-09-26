import { MessageType, type Message } from 'discord.js';
import type { MentionResolver } from '../hinglish/preprocess.js';
import { logger } from '../logger.js';
import type { BotContext } from './context.js';
import { createSpeakJob } from './speak.js';

/** Text commands for other bots ("!play", ".help", "?rank", "$bal"). */
const OTHER_BOT_COMMAND = /^[!/.?$%;>~=+-][\p{L}]/u;

function mentionResolver(message: Message<true>): MentionResolver {
  return {
    user: (id) => message.mentions.members?.get(id)?.displayName ?? message.mentions.users.get(id)?.displayName,
    channel: (id) => {
      const channel = message.mentions.channels.get(id);
      return channel && 'name' in channel ? (channel.name ?? undefined) : undefined;
    },
    role: (id) => message.mentions.roles.get(id)?.name,
  };
}

export async function handleMessage(message: Message, ctx: BotContext): Promise<void> {
  if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
  if (message.type !== MessageType.Default && message.type !== MessageType.Reply) return;

  const content = message.content;
  if (!content.trim()) return; // attachments/stickers without text
  if (OTHER_BOT_COMMAND.test(content)) return;

  const guildId = message.guildId;
  const settings = ctx.settings.get(guildId);
  if (!settings.enabledChannels.includes(message.channelId)) return;
  if (settings.ignoredChannels.includes(message.channelId) || settings.ignoredUsers.includes(message.author.id)) return;

  const audio = ctx.audio.get(guildId);
  if (!audio?.channelId) return; // not connected to voice in this guild

  const log = { guild: guildId, user: message.author.id };
  if (content.length > ctx.config.MAX_MESSAGE_LENGTH) {
    logger.debug({ ...log, length: content.length }, 'skipped: too long');
    return;
  }

  const verdict = ctx.spam.check(guildId, message.channelId, message.author.id, content);
  if (verdict !== 'ok') {
    logger.debug({ ...log, reason: verdict }, 'skipped: spam guard');
    return;
  }

  const job = createSpeakJob({
    text: content,
    mode: settings.mode,
    voice: ctx.settings.voiceFor(guildId, ctx.tts.name),
    resolver: mentionResolver(message),
    tts: ctx.tts,
    transliterator: ctx.transliterator,
    log,
  });

  if (!audio.enqueue(job, { userId: message.author.id, length: content.length })) {
    logger.debug(log, 'skipped: queue full');
    return;
  }
  logger.debug({ ...log, length: content.length, queue: audio.length }, 'tts queued');
}
