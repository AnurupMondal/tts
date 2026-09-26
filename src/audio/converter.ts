import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import type { AudioResult } from '../tts/provider.js';

/** System ffmpeg (FFMPEG_PATH, e.g. in Docker) wins over the bundled ffmpeg-static binary. */
const FFMPEG = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string | null) || 'ffmpeg';

const isOgg = (data: Buffer) => data.subarray(0, 4).toString('ascii') === 'OggS';

/**
 * Returns Ogg/Opus audio that @discordjs/voice can stream without a JS opus encoder.
 * Ogg input is passed through untouched; anything else is transcoded with ffmpeg.
 */
export async function toOggOpus(audio: AudioResult): Promise<Buffer> {
  if (audio.format === 'ogg_opus' || isOgg(audio.data)) return audio.data;
  return transcode(audio.data);
}

function transcode(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      FFMPEG,
      ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', '-ac', '2', '-f', 'ogg', 'pipe:1'],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on('data', (d: Buffer) => out.push(d));
    proc.stderr.on('data', (d: Buffer) => err.push(d));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`ffmpeg exited with ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`));
    });
    proc.stdin.on('error', () => {}); // ffmpeg may close stdin early on bad input; 'close' reports it
    proc.stdin.end(input);
  });
}
