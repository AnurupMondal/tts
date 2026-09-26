import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { BotContext } from '../context.js';

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(interaction: ChatInputCommandInteraction<'cached'>, ctx: BotContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction<'cached'>, ctx: BotContext): Promise<void>;
}
