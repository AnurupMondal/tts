import { Client, Events, GatewayIntentBits, MessageFlags, type VoiceState } from 'discord.js';
import { logger } from '../logger.js';
import { commandMap } from './commands/index.js';
import type { BotContext } from './context.js';
import { handleMessage } from './messageHandler.js';

/** Leave a voice channel this long after the last human leaves it. */
const EMPTY_CHANNEL_GRACE_MS = 30_000;

export function createClient(ctx: BotContext): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, // privileged: enable in the Developer Portal
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    logger.info({ user: c.user.tag, guilds: c.guilds.cache.size, provider: ctx.tts.name }, 'bot ready');
  });

  client.on(Events.MessageCreate, (message) => {
    handleMessage(message, ctx).catch((err: Error) => logger.error({ err: err.message }, 'message handler failed'));
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.inCachedGuild()) {
      if (interaction.isRepliable()) await interaction.reply({ content: 'Use me inside a server.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }
    try {
      if (interaction.isAutocomplete()) {
        await commandMap.get(interaction.commandName)?.autocomplete?.(interaction, ctx);
      } else if (interaction.isChatInputCommand()) {
        await commandMap.get(interaction.commandName)?.execute(interaction, ctx);
      }
    } catch (err) {
      logger.error({ command: 'commandName' in interaction ? interaction.commandName : undefined, err: (err as Error).message }, 'command failed');
      if (interaction.isRepliable()) {
        const reply = { content: 'Something went wrong running that command.', flags: MessageFlags.Ephemeral } as const;
        await (interaction.deferred || interaction.replied ? interaction.followUp(reply) : interaction.reply(reply)).catch(() => {});
      }
    }
  });

  const leaveTimers = new Map<string, NodeJS.Timeout>();
  client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
    const guildId = newState.guild.id;
    const audio = ctx.audio.get(guildId);
    if (!audio?.channelId) return;
    if (oldState.channelId !== audio.channelId && newState.channelId !== audio.channelId) return;

    const channel = newState.guild.channels.cache.get(audio.channelId);
    const humans = channel?.isVoiceBased() ? channel.members.filter((m) => !m.user.bot).size : 0;
    clearTimeout(leaveTimers.get(guildId));
    leaveTimers.delete(guildId);
    if (humans === 0) {
      leaveTimers.set(
        guildId,
        setTimeout(() => {
          leaveTimers.delete(guildId);
          logger.info({ guild: guildId }, 'voice channel empty, leaving');
          ctx.audio.get(guildId)?.leave();
        }, EMPTY_CHANNEL_GRACE_MS),
      );
    }
  });

  return client;
}
