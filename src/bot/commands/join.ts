import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logger } from '../../logger.js';
import type { Command } from './types.js';

export const join: Command = {
  data: new SlashCommandBuilder().setName('join').setDescription('Join your voice channel and start reading chat aloud'),

  async execute(interaction, ctx) {
    const channel = interaction.member.voice.channel;
    if (!channel) {
      await interaction.reply({ content: 'Join a voice channel first, then use `/join`.', flags: MessageFlags.Ephemeral });
      return;
    }
    const me = interaction.guild.members.me;
    const perms = me ? channel.permissionsFor(me) : null;
    if (!perms?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
      await interaction.reply({ content: `I need **Connect** and **Speak** permissions in ${channel}.`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();
    try {
      await ctx.audio.getOrCreate(interaction.guildId).join({
        guildId: interaction.guildId,
        channelId: channel.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });
    } catch (err) {
      logger.warn({ guild: interaction.guildId, err: (err as Error).message }, 'voice join failed');
      await interaction.editReply('Could not connect to the voice channel. Check my permissions and try again.');
      return;
    }

    // First-time convenience: start reading the channel where /join was used.
    const settings = ctx.settings.get(interaction.guildId);
    let note = '';
    if (settings.enabledChannels.length === 0) {
      ctx.settings.update(interaction.guildId, (s) => s.enabledChannels.push(interaction.channelId));
      note = `\nTTS is now **on** for <#${interaction.channelId}>. Use \`/tts on\` in other channels to add them.`;
    } else if (!settings.enabledChannels.includes(interaction.channelId)) {
      note = `\nTTS is not enabled here. Use \`/tts on\` to read this channel.`;
    }
    await interaction.editReply(`Joined ${channel}. Type normally, e.g. \`bhai ruk mai abhi aa raha hu\`.${note}`);
  },
};
