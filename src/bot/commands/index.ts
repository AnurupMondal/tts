import { join } from './join.js';
import { leave } from './leave.js';
import { tts } from './tts.js';
import type { Command } from './types.js';

export const commands: readonly Command[] = [join, leave, tts];
export const commandMap: ReadonlyMap<string, Command> = new Map(commands.map((c) => [c.data.name, c]));
export type { Command } from './types.js';
