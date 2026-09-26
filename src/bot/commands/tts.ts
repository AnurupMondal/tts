import { ChannelType, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { LANGUAGE_MODES, type LanguageMode } from '../../config/config.js';
import { processMessage } from '../../hinglish/pipeline.js';
import { GuildSettingsStore } from '../guildSettings.js';
import type { Command } from './types.js';

const MODE_HELP: Record<LanguageMode, string> = {
  auto: 'Auto: Hinglish is converted, plain English is left alone',
  hinglish: 'Hinglish: always convert Hindi words, keep English words',
  hindi: 'Hindi: convert everything except names and gaming terms',
  english: 'English: never convert',
};

const data = new SlashCommandBuilder()
  .setName('tts')
  .setDescription('Text-to-speech settings')
  .addSubcommand((s) => s.setName('on').setDescription('Read messages from this channel aloud'))
  .addSubcommand((s) => s.setName('off').setDescription('Stop reading messages from this channel'))
  .addSubcommand((s) =>
    s
      .setName('mode')
      .setDescription('How messages are interpreted')
      .addStringOption((o) =>
        o
          .setName('mode')
          .setDescription('Language mode')
          .setRequired(true)
          .addChoices(...LANGUAGE_MODES.map((m) => ({ name: MODE_HELP[m], value: m }))),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('voice')
      .setDescription('Choose the voice')
      .addStringOption((o) => o.setName('voice').setDescription('Voice (type to search, or "default")').setRequired(true).setAutocomplete(true)),
  )
  .addSubcommand((s) => s.setName('status').setDescription('Show TTS status for this server'))
  .addSubcommand((s) =>
    s
      .setName('preview')
      .setDescription('Show how a message would be converted (only you see it)')
      .addStringOption((o) => o.setName('text').setDescription('e.g. bhai mai abhi aa rha hu').setRequired(true).setMaxLength(300)),
  )
  .addSubcommand((s) => s.setName('skip').setDescription('Skip the message being spoken'))
  .addSubcommand((s) => s.setName('clear').setDescription('Clear the speech queue'))
  .addSubcommand((s) => s.setName('pause').setDescription('Pause speech'))
  .addSubcommand((s) => s.setName('resume').setDescription('Resume speech'))
  .addSubcommandGroup((g) =>
    g
      .setName('ignore')
      .setDescription('Ignore (or stop ignoring) a user or channel')
      .addSubcommand((s) =>
        s
          .setName('user')
          .setDescription('Toggle ignoring a user')
          .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('channel')
          .setDescription('Toggle ignoring a channel')
          .addChannelOption((o) =>
            o
              .setName('channel')
              .setDescription('Channel')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice, ChannelType.PublicThread, ChannelType.PrivateThread),
          ),
      ),
  );

const ephemeral = (interaction: ChatInputCommandInteraction, content: string) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

export const tts: Command = {
  data,

  async autocomplete(interaction, ctx) {
    const query = interaction.options.getFocused().toLowerCase();
    let voices: { id: string; label: string }[] = [];
    try {
      voices = await ctx.tts.listVoices();
    } catch {
      // Provider unreachable: offer only the default.
    }
    const options = [{ id: 'default', label: `default (${ctx.tts.defaultVoice('hi')})` }, ...voices]
      .filter((v) => v.id.toLowerCase().includes(query) || v.label.toLowerCase().includes(query))
      .slice(0, 25)
      .map((v) => ({ name: v.label.slice(0, 100), value: v.id }));
    await interaction.respond(options);
  },

  async execute(interaction, ctx) {
    const guildId = interaction.guildId;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const audio = ctx.audio.get(guildId);

    if (group === 'ignore') {
      if (sub === 'user') {
        const user = interaction.options.getUser('user', true);
        let ignored = false;
        ctx.settings.update(guildId, (s) => (ignored = GuildSettingsStore.toggle(s.ignoredUsers, user.id)));
        await interaction.reply(ignored ? `Ignoring messages from ${user}.` : `No longer ignoring ${user}.`);
      } else {
        const channel = interaction.options.getChannel('channel', true);
        let ignored = false;
        ctx.settings.update(guildId, (s) => (ignored = GuildSettingsStore.toggle(s.ignoredChannels, channel.id)));
        await interaction.reply(ignored ? `Ignoring <#${channel.id}>.` : `No longer ignoring <#${channel.id}>.`);
      }
      return;
    }

    switch (sub) {
      case 'on': {
        ctx.settings.update(guildId, (s) => {
          if (!s.enabledChannels.includes(interaction.channelId)) s.enabledChannels.push(interaction.channelId);
        });
        const hint = audio?.channelId ? '' : ' Use `/join` to bring me into your voice channel.';
        await interaction.reply(`TTS is **on** for <#${interaction.channelId}>.${hint}`);
        return;
      }
      case 'off': {
        ctx.settings.update(guildId, (s) => {
          s.enabledChannels = s.enabledChannels.filter((id) => id !== interaction.channelId);
        });
        await interaction.reply(`TTS is **off** for <#${interaction.channelId}>.`);
        return;
      }
      case 'mode': {
        const mode = interaction.options.getString('mode', true) as LanguageMode;
        ctx.settings.update(guildId, (s) => (s.mode = mode));
        await interaction.reply(`Language mode set to **${mode}**. ${MODE_HELP[mode]}.`);
        return;
      }
      case 'voice': {
        const id = interaction.options.getString('voice', true).trim();
        if (id === 'default') {
          ctx.settings.update(guildId, (s) => delete s.voice);
          await interaction.reply(`Voice reset to the default (**${ctx.tts.defaultVoice('hi')}**).`);
          return;
        }
        const voices = await ctx.tts.listVoices().catch(() => []);
        if (voices.length > 0 && !voices.some((v) => v.id === id)) {
          await ephemeral(interaction, `Unknown voice \`${id}\`. Pick one from the suggestions.`);
          return;
        }
        ctx.settings.update(guildId, (s) => (s.voice = { provider: ctx.tts.name, id }));
        await interaction.reply(`Voice set to **${id}**.`);
        return;
      }
      case 'status': {
        const s = ctx.settings.get(guildId);
        const lines = [
          `**TTS here:** ${s.enabledChannels.includes(interaction.channelId) ? 'on' : 'off'}`,
          `**Enabled channels:** ${s.enabledChannels.map((id) => `<#${id}>`).join(', ') || 'none'}`,
          `**Voice channel:** ${audio?.channelId ? `<#${audio.channelId}>` : 'not connected'}`,
          `**Provider:** ${ctx.tts.name}`,
          `**Voice:** ${ctx.settings.voiceFor(guildId, ctx.tts.name) ?? `${ctx.tts.defaultVoice('hi')} (default)`}`,
          `**Mode:** ${s.mode}`,
          `**Queue:** ${audio?.length ?? 0}/${ctx.config.MAX_QUEUE_SIZE}${audio?.isPaused ? ' (paused)' : ''}`,
          `**Transliteration:** ${ctx.transliterator.name}`,
        ];
        if (s.ignoredUsers.length) lines.push(`**Ignored users:** ${s.ignoredUsers.map((id) => `<@${id}>`).join(', ')}`);
        if (s.ignoredChannels.length) lines.push(`**Ignored channels:** ${s.ignoredChannels.map((id) => `<#${id}>`).join(', ')}`);
        await interaction.reply({ content: lines.join('\n'), allowedMentions: { parse: [] } });
        return;
      }
      case 'preview': {
        const text = interaction.options.getString('text', true);
        const result = await processMessage(text, { mode: ctx.settings.get(guildId).mode, transliterator: ctx.transliterator });
        const d = result.detection;
        await ephemeral(
          interaction,
          result.skipped
            ? 'Nothing speakable in that message.'
            : `**Spoken as:** ${result.text}\n-# lang=${result.lang} · hindi=${d.hindiWords} english=${d.englishWords} · confidence=${d.confidence.toFixed(2)}${result.degraded ? ' · transliteration unavailable' : ''}`,
        );
        return;
      }
      case 'skip':
        await ephemeral(interaction, audio?.skip() ? 'Skipped.' : 'Nothing is playing.');
        return;
      case 'clear':
        await ephemeral(interaction, audio ? `Cleared ${audio.clear()} queued message(s).` : 'Queue is empty.');
        return;
      case 'pause':
        if (!audio) return void (await ephemeral(interaction, "I'm not in a voice channel."));
        audio.pause();
        await interaction.reply('Paused. Use `/tts resume` to continue.');
        return;
      case 'resume':
        if (!audio) return void (await ephemeral(interaction, "I'm not in a voice channel."));
        audio.resume();
        await interaction.reply('Resumed.');
        return;
    }
  },
};
