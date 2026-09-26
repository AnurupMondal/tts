/**
 * Try the pipeline without Discord.
 *
 *   npm run say -- "bhai mai abhi Valorant khel raha hu"
 *   npm run say -- "ruk 2 min" --audio out.ogg [--provider sarvam] [--voice hi-IN-Chirp3-HD-Kore] [--mode hinglish]
 *
 * Without --audio only the converted text is printed (no TTS credentials needed).
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { toOggOpus } from '../audio/converter.js';
import { LANGUAGE_MODES, TTS_PROVIDERS, type LanguageMode, type TTSProviderName } from '../config/config.js';
import { processMessage } from '../hinglish/pipeline.js';
import { GoogleInputToolsTransliterator } from '../hinglish/transliterator.js';
import { createTTSProvider } from '../tts/index.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    audio: { type: 'string' },
    provider: { type: 'string' },
    voice: { type: 'string' },
    mode: { type: 'string', default: 'auto' },
  },
});

const text = positionals.join(' ');
if (!text) {
  console.error('Usage: npm run say -- "<message>" [--audio out.ogg] [--provider google|sarvam] [--voice id] [--mode auto|hinglish|hindi|english]');
  process.exit(1);
}
if (!LANGUAGE_MODES.includes(values.mode as LanguageMode)) throw new Error(`--mode must be one of ${LANGUAGE_MODES.join(', ')}`);
if (values.provider && !TTS_PROVIDERS.includes(values.provider as TTSProviderName)) throw new Error(`--provider must be one of ${TTS_PROVIDERS.join(', ')}`);

const t0 = performance.now();
const result = await processMessage(text, { mode: values.mode as LanguageMode, transliterator: new GoogleInputToolsTransliterator() });
const t1 = performance.now();

console.log(`input : ${text}`);
console.log(`output: ${result.text || '(nothing to say)'}`);
console.log(
  `lang=${result.lang} hindi=${result.detection.hindiWords} english=${result.detection.englishWords} ` +
    `confidence=${result.detection.confidence.toFixed(2)}${result.degraded ? ' DEGRADED' : ''} (${Math.round(t1 - t0)} ms)`,
);

if (values.audio && result.text) {
  try {
    const provider = createTTSProvider(values.provider as TTSProviderName | undefined);
    const audio = await provider.synthesize(result.text, { lang: result.lang, voice: values.voice });
    const ogg = await toOggOpus(audio);
    writeFileSync(values.audio, ogg);
    console.log(`audio : ${values.audio} (${provider.name}, ${Math.round(performance.now() - t1)} ms, ${ogg.length} bytes)`);
  } catch (err) {
    const [firstLine] = (err as Error).message.split(/\r?\n/);
    console.error(`TTS failed: ${firstLine}`);
    console.error('Check the provider credentials in .env (see README "Google Cloud setup" / "Sarvam setup").');
    process.exit(1);
  }
}
