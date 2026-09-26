import { pino } from 'pino';
import { config } from './config/config.js';

/**
 * Privacy rule: never pass message text to the logger. Log ids, lengths and timings only,
 * e.g. logger.info({ guild, user, length }, 'tts queued').
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
});
