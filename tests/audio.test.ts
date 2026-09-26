import { describe, expect, it } from 'vitest';
import { toOggOpus } from '../src/audio/converter.js';

/** 0.2 s of a 440 Hz mono 16-bit sine wave as a WAV file. */
function sineWav(seconds = 0.2, rate = 24000): Buffer {
  const samples = Math.floor(seconds * rate);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe('toOggOpus', () => {
  it('passes Ogg input through untouched', async () => {
    const ogg = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(10)]);
    expect(await toOggOpus({ data: ogg, format: 'ogg_opus' })).toBe(ogg);
  });

  it('transcodes WAV to Ogg/Opus with ffmpeg', async () => {
    const out = await toOggOpus({ data: sineWav(), format: 'wav' });
    expect(out.subarray(0, 4).toString('ascii')).toBe('OggS');
    expect(out.includes(Buffer.from('OpusHead'))).toBe(true);
  });

  it('rejects garbage input', async () => {
    await expect(toOggOpus({ data: Buffer.from('not audio'), format: 'mp3' })).rejects.toThrow(/ffmpeg/);
  });
});
