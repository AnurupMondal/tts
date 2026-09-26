/**
 * Registers slash commands with Discord.
 *   DEV_GUILD_ID set   → registered to that server only (updates instantly; use while developing)
 *   DEV_GUILD_ID unset → registered globally (can take up to an hour to appear)
 */
import { REST, Routes } from 'discord.js';
import { config, requireConfig } from '../config/config.js';
import { commands } from './commands/index.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID } = requireConfig('DISCORD_TOKEN', 'DISCORD_CLIENT_ID');
const rest = new REST().setToken(DISCORD_TOKEN);
const body = commands.map((c) => c.data.toJSON());

const route = config.DEV_GUILD_ID
  ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, config.DEV_GUILD_ID)
  : Routes.applicationCommands(DISCORD_CLIENT_ID);

await rest.put(route, { body });
console.log(`Registered ${body.length} commands ${config.DEV_GUILD_ID ? `to guild ${config.DEV_GUILD_ID}` : 'globally'}.`);
