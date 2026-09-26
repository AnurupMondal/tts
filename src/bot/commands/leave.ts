import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';

export const leave: Command = {
  data: new SlashCommandBuilder().setName('leave').setDescription('Leave the voice channel'),

  async execute(interaction, ctx) {
    const audio = ctx.audio.get(interaction.guildId);
    if (!audio?.channelId) {
      await interaction.reply({ content: "I'm not in a voice channel.", flags: MessageFlags.Ephemeral });
      return;
    }
    audio.leave();
    await interaction.reply('Left the voice channel. 👋');
  },
};
