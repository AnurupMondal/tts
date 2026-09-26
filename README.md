# Hinglish TTS Bot

A Discord text-to-speech bot that reads messages the way Indian Discord users actually type them.

You type `bhai ruk mai abhi aa raha hu` and the bot says **"भाई रुक मैं अभी आ रहा हूँ"** in a natural Hindi voice. An English engine would read the Roman letters as English instead.

- **Hindi words** are converted to Devanagari so a Hindi voice pronounces them properly.
- **English words, names, brands and gaming terms** stay in Latin script: `mai abhi Valorant khel raha hu` → `मैं अभी Valorant खेल रहा हूँ`.
- **Nothing is translated.** `bhai tu kal aa raha hai kya` never becomes "bro are you coming tomorrow".
- Informal spelling works: `nhi`, `rha`, `kr`, `mtlb`, `h`, `bhaiiii`, `2min`, `me` / `mai` / `main`…

---

## Contents

1. [How it works](#how-it-works)
2. [Technology choices](#technology-choices)
3. [Discord setup](#discord-setup)
4. [TTS provider setup](#tts-provider-setup)
5. [Environment variables](#environment-variables)
6. [Running locally](#running-locally)
7. [Docker deployment](#docker-deployment)
8. [Using the bot](#using-the-bot)
9. [Privacy](#privacy)
10. [Testing and accuracy](#testing-and-accuracy)
11. [Troubleshooting](#troubleshooting)
12. [Project layout](#project-layout)
13. [Limitations and next steps](#limitations-and-next-steps)

---

## How it works

```text
Discord message
  → filters        bot/system messages, other bots' commands, ignored users/channels, length, spam guard
  → queue          per-server FIFO; the steps below run inside the queued job, so order is preserved
  → preprocess     mentions → display names, drop URLs/code/spoilers/custom emoji, emoji → words
  → tokenize       words, numbers, punctuation, protected names; "bhaiiii" → "bhai", "2min" → "2 min"
  → detect         label each word Hindi / English / keep, using lexicons + context + word shape
  → normalize      Hindi words only: nhi→nahi, kr→kar, mai→मैं vs me→में, kaha→कहाँ vs कहा, ki→कि vs की
  → numbers        "2 min" → "दो मिनट"; "RTX 4070", "room 204", "iPhone 17" keep their digits
  → transliterate  correction layer for ~100 high-frequency words, then Google Input Tools
                   for everything else, one request per run of consecutive Hindi words
  → assemble       "भाई मैं अभी Valorant खेल रहा हूँ"
  → TTS            Google Chirp 3 HD or Sarvam Bulbul v3 (cached for repeated phrases)
  → voice          Ogg/Opus straight into the Discord voice connection
```

Discord handling, language processing and TTS are separate layers:

- The language layer's only entry point is `processMessage()` in [src/hinglish/pipeline.ts](src/hinglish/pipeline.ts).
- The TTS layer's only contract is the `TTSProvider` interface in [src/tts/provider.ts](src/tts/provider.ts).
- The transliteration engine sits behind the `Transliterator` interface, so it can be replaced (for example with a local model or an LLM tier) without touching the other layers.

## Technology choices

These were chosen after comparing the available options in September 2026:

| Area | Choice | Why | Alternatives considered |
|---|---|---|---|
| Roman → Devanagari | **Google Input Tools** endpoint (`inputtools.google.com`, `hi-t-i0-und`) | Handles informal spellings (`rha`, `nhi`) with phrase context, free, ~50 ms | **AI4Bharat IndicXlit**: unmaintained since 2022, needs fairseq + PyTorch, no Python 3.12+ support. **sanscript**: only understands formal schemes like ITRANS. **Google Cloud Translation**: only converts the other way (Devanagari → Latin). **LLM** (e.g. Claude Haiku): best at context, but about 1 s and ~$0.40 per 1,000 messages. Kept as a future tier. |
| TTS | **Google Cloud TTS Chirp 3 HD** (`hi-IN`) or **Sarvam AI Bulbul v3**, set with `TTS_PROVIDER` | Google: Ogg/Opus output plays in Discord without re-encoding, ~$30 per 1M characters, free tier. Sarvam: designed for mixed Hindi-English in a single voice, ~$34 per 1M characters. | **Azure hi-IN Neural**: a good option for a third provider. **ElevenLabs**: 3–6× the cost. **Edge read-aloud**: unofficial and gets blocked. **Local** (Piper, Indic Parler-TTS): robotic, or needs a GPU. |
| Runtime | Node.js 24, TypeScript, discord.js 14, @discordjs/voice 0.19 (with DAVE end-to-end encryption via `@snazzah/davey`) | Single language, no Python sidecar | — |

> **Google Input Tools caveat:** this endpoint is public but undocumented, with no SLA or published rate limits.
> The bot protects itself with a 2 s timeout, one retry, a circuit breaker, and phrase/word caches.
> If the endpoint fails, the message is still spoken: the ~100 pinned words stay in Devanagari and the rest is read from the Roman text.

## Discord setup

1. **Create the application.** Go to <https://discord.com/developers/applications>, click **New Application**, and name it.
2. **Get the client ID.** Under **General Information**, copy the **Application ID** into `DISCORD_CLIENT_ID`.
3. **Configure the bot.** Under **Bot**:
   - Click **Reset Token** and copy the token into `DISCORD_TOKEN`. Keep it secret.
   - Under **Privileged Gateway Intents**, enable **Message Content Intent**. Without it the bot can't read messages.
   - Optionally, turn off **Public Bot** if only you should be able to invite it.
4. **Invite the bot.** Open this URL, with your Application ID in place of `YOUR_CLIENT_ID`:

   ```text
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=3214336
   ```

   `3214336` grants: View Channels, Send Messages, Read Message History, Connect, and Speak.

5. **Register the slash commands** (see [Running locally](#running-locally)).
   - Set `DEV_GUILD_ID` to your server's ID for instant registration while developing. To copy the ID, turn on Developer Mode, then right-click the server.
   - Without `DEV_GUILD_ID`, commands are registered globally and can take up to an hour to appear.

## TTS provider setup

### Google Cloud setup (`TTS_PROVIDER=google`)

1. Create or pick a project at <https://console.cloud.google.com/> and **enable billing**. Chirp 3 HD has a monthly free tier; check current pricing.
2. Enable the **Cloud Text-to-Speech API**: *APIs & Services → Library → "Cloud Text-to-Speech API" → Enable*.
3. Create a service account and key:
   - Go to *IAM & Admin → Service Accounts → Create service account*. No role is needed just to call Text-to-Speech.
   - Open the account, then *Keys → Add key → JSON*.
4. Save the key as `credentials/google-credentials.json`. This path is git-ignored.
5. Set the variables:

   ```env
   TTS_PROVIDER=google
   GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-credentials.json
   ```

The defaults are `hi-IN-Chirp3-HD-Charon` for Hindi and mixed messages, and `en-IN-Chirp3-HD-Charon` for English-only messages. `/tts voice` lists every hi-IN voice your project can use.

### Sarvam setup (`TTS_PROVIDER=sarvam`)

1. Sign up at <https://dashboard.sarvam.ai> and create an API key. New accounts get free credit.
2. Set the variables:

   ```env
   TTS_PROVIDER=sarvam
   SARVAM_API_KEY=...
   SARVAM_SPEAKER=shubh   # or aditya, rahul, priya, neha, kavya, ritu... (see /tts voice)
   ```

Bulbul is designed for mixed Hindi-English, so a single voice reads `मैं अभी Valorant खेल रहा हूँ` without switching accents. Try both providers with `npm run say` (below) and keep the one you prefer.

## Environment variables

See [.env.example](.env.example) for all of them. The main ones:

| Variable | Default | Meaning |
|---|---|---|
| `DISCORD_TOKEN` | — | Bot token (required to run the bot) |
| `DISCORD_CLIENT_ID` | — | Application ID (required to register commands) |
| `DEV_GUILD_ID` | — | Register commands to this server only (instant) |
| `TTS_PROVIDER` | `google` | `google` or `sarvam` |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Path to the service-account JSON |
| `GOOGLE_VOICE_HI` / `GOOGLE_VOICE_EN` | `hi-IN-Chirp3-HD-Charon` / `en-IN-Chirp3-HD-Charon` | Default voices |
| `GOOGLE_SPEAKING_RATE` | `0.75` | 0.25–2.0 |
| `SARVAM_API_KEY` | — | Sarvam key |
| `SARVAM_SPEAKER` / `SARVAM_PACE` | `shubh` / `0.75` | Bulbul v3 speaker and pace (0.5–2.0) |
| `DEFAULT_MODE` | `auto` | Default language mode for new servers |
| `MAX_QUEUE_SIZE` | `20` | Messages waiting per server; extra messages are dropped |
| `MAX_MESSAGE_LENGTH` | `300` | Longer messages are not read |
| `USER_COOLDOWN_MS` | `0` | Minimum gap between one user's spoken messages (messages inside the gap are dropped, not delayed) |
| `CHANNEL_COOLDOWN_MS` | `0` | Minimum gap per channel (same: dropped) |
| `DUPLICATE_WINDOW_MS` | `15000` | Same user and same text within this window is ignored |
| `GUILD_RATE_PER_MIN` | `40` | Per-server token bucket |
| `TRANSLIT_TIMEOUT_MS` | `2000` | Transliteration request timeout |
| `TTS_CACHE_TTL_MS` / `TTS_CACHE_MAX` | `600000` / `300` | In-memory audio cache |
| `DATA_DIR` | `./data` | Where `guilds.json` (per-server settings) is stored |
| `LOG_LEVEL` | `info` | `debug` shows skipped-message reasons |

## Running locally

Requirements: **Node.js 24+**. FFmpeg is bundled via `ffmpeg-static`, so there's nothing else to install.

```bash
npm install
cp .env.example .env            # then fill it in
npm run deploy-commands         # register /join, /leave, /tts
npm run dev                     # start with auto-reload
```

If npm reports install scripts "not yet covered by allowScripts", run `npm install-scripts approve ffmpeg-static esbuild protobufjs`.

**Try the language pipeline without Discord:**

```bash
npm run say -- "bhai mai abhi Valorant khel raha hu"
# input : bhai mai abhi Valorant khel raha hu
# output: भाई मैं अभी Valorant खेल रहा हूँ
# lang=mixed hindi=6 english=1 confidence=1.00 (316 ms)

npm run say -- "ruk 2 min mai aa rha hu" --audio out.ogg              # uses TTS_PROVIDER
npm run say -- "ruk 2 min mai aa rha hu" --audio out.ogg --provider sarvam
```

Plain `say` needs no credentials. `--audio` writes an Ogg/Opus file that most media players can open.

**Production build:**

```bash
npm run build
npm start
```

## Docker deployment

> **Production runs on Google Cloud, deployed by GitHub Actions** (push to `main` → build → deploy).
> See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the one-time setup and day-to-day operations.
> The steps below are for running the container on any other Docker host.

The image uses Node 24 with the system FFmpeg and runs as a non-root user. Secrets are supplied at runtime, never baked in.

```bash
cp .env.example .env                      # fill in DISCORD_TOKEN etc.
mkdir -p credentials                      # Google only:
cp ~/Downloads/key.json credentials/google-credentials.json

docker compose build
docker compose run --rm bot node dist/bot/deployCommands.js   # register slash commands (once)
docker compose up -d
docker compose logs -f
```

- Per-server settings are kept in the `bot-data` volume, so they survive restarts and rebuilds.
- The Google key is mounted read-only at `/run/secrets/google-credentials.json` as a Compose secret.
- **Using only Sarvam?** Remove the two `secrets:` blocks and the `GOOGLE_APPLICATION_CREDENTIALS` line from [docker-compose.yml](docker-compose.yml).
- **Any host works** as long as it can make outbound HTTPS and UDP connections (for Discord voice): a VPS, Railway, Fly.io, or a home server.

## Using the bot

1. Join a voice channel.
2. Run `/join`. The bot joins your channel and, the first time, turns on TTS for the text channel where you ran the command.
3. Type normally. The most convenient place is the voice channel's own chat.

| Command | What it does |
|---|---|
| `/join` | Join your voice channel |
| `/leave` | Leave the voice channel. The bot also leaves 30 s after everyone else has left. |
| `/tts on` / `/tts off` | Read, or stop reading, messages from the current channel |
| `/tts mode <auto\|hinglish\|hindi\|english>` | **auto** (default): Hinglish is converted and plain English is left alone. **hinglish**: always convert Hindi words. **hindi**: convert everything except names and gaming terms. **english**: never convert. |
| `/tts voice <voice>` | Pick a voice (autocomplete lists the provider's voices; `default` resets) |
| `/tts names <true\|false>` | Say who wrote a message ("Rahul says, ...") when the speaker changes or after 30 s of quiet. On by default. |
| `/tts status` | Show on/off state, voice channel, provider, voice, mode, names and queue length |
| `/tts preview <text>` | Show privately how a message would be converted, without speaking it |
| `/tts skip` / `clear` / `pause` / `resume` | Queue controls. New messages never interrupt the one being spoken. |
| `/tts ignore user <@user>` / `/tts ignore channel <#channel>` | Toggle ignoring a user or channel |

**Not read aloud:**
- bot and system messages
- other bots' commands (`!play`, `.help`…)
- URLs, code blocks and spoilers
- attachments with no text
- messages over 300 characters
- the same message repeated by the same user within 15 s

To limit who can change settings, use *Server Settings → Integrations → (bot) → Command permissions*.

## Privacy

- **Message text is never stored.** It exists only in memory while one message is processed. The per-server `guilds.json` holds channel/user ids and preferences only.
- **Logs contain metadata only**, for example `tts ready guild=… user=… length=42 lang=mixed processMs=48 ttsMs=610`. They never include message content.
- **Short-lived memory caches.** Audio is cached for up to 10 minutes and transliterated phrases for up to 30 minutes, in memory only, so repeated phrases skip API calls.
- **Third parties.** Message text is sent to:
  - **Google Input Tools**, for the Hindi words only;
  - **Google Cloud Text-to-Speech** or **Sarvam AI**, for the final text.

  Their privacy terms apply. Tell your server members.

## Testing and accuracy

```bash
npm test                 # 313 unit tests, offline (replays recorded engine responses)
npm run eval             # live accuracy + latency on the 249-message dataset
npm run eval -- --holdout
npm run eval -- --record # refresh tests/fixtures after changing rules
```

- **[tests/data/hinglish-dataset.json](tests/data/hinglish-dataset.json)** has 249 messages across 14 categories: normal, abbreviated, gaming, mixed, slang, numbers, names, mentions, emoji, very short, long, pure English, pure Hindi, and ambiguous.
- **[tests/data/hinglish-holdout.json](tests/data/hinglish-holdout.json)** has 40 more messages written separately.
- Scoring ignores punctuation and differences that sound the same: nukta (ज़/ज) and chandrabindu/anusvara (हूँ/हूं).

**Honest numbers.** The rules were tuned on the main dataset, so its 100% score is optimistic.
- The first blind run on the held-out set scored **87.5% exact match, 98.1% character similarity**. That is a fair estimate for new text.
- After fixing the general rules those misses exposed, the held-out set also passes, so it is no longer blind. Add fresh messages to measure again.
- Processing latency with a cold cache is about 50 ms p50 and 220 ms p95. Cached phrases are near 0 ms. TTS adds roughly 0.3–1 s depending on the provider.

When the bot mispronounces something, add the message to the dataset. Then fix it in the lexicons or the normalizer in [src/hinglish/](src/hinglish/), and re-run `npm run eval`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Bot is online but ignores messages | Check that **Message Content Intent** is enabled, `/tts on` was run in that channel, and the bot is in voice (`/tts status`). Set `LOG_LEVEL=debug` to see why a message was skipped. |
| Slash commands don't appear | Run `npm run deploy-commands`. Global commands take up to an hour; set `DEV_GUILD_ID` for instant ones. |
| `/join` says it can't connect | The bot needs **Connect** and **Speak** in that channel. Firewalls must allow outbound UDP. |
| Joins voice but no sound | Run `/tts status` to check the queue isn't paused, then check the logs for `tts generation failed` (usually credentials or quota). |
| `Could not load the default credentials` | Google: `GOOGLE_APPLICATION_CREDENTIALS` must point to the JSON key. In Docker, check the secret file exists. |
| Google error about the voice | That voice doesn't exist for your project or locale. Pick one from `/tts voice`, or set `GOOGLE_VOICE_HI`. |
| Sarvam `HTTP 401/403` | Wrong or expired `SARVAM_API_KEY`, or no credit left |
| Words read in Roman / English accent, `DEGRADED` in `npm run say` | Google Input Tools is unreachable or rate-limited. The bot keeps working in degraded mode and retries after 60 s. |
| A word is converted wrongly | Try `/tts preview`. Add the word to the lexicons in [src/hinglish/lexicon/](src/hinglish/lexicon/), or to the correction layer in `overrides.ts`. |
| Voice join fails with close code 4017 | DAVE encryption library missing. Run `npm ls @snazzah/davey`; it must be installed. |
| `npm install` warns about install scripts | `npm install-scripts approve ffmpeg-static esbuild protobufjs` |

## Project layout

```text
src/
├── index.ts                  entry point: wires config, services and the Discord client
├── config/config.ts          validated environment variables
├── logger.ts                 pino (metadata-only logging)
├── bot/                      Discord layer
│   ├── client.ts             intents, event routing, leave-when-empty
│   ├── messageHandler.ts     filtering, spam guard, queueing
│   ├── speak.ts              queued job: pipeline → TTS → Ogg/Opus
│   ├── commands/             /join, /leave, /tts
│   ├── guildSettings.ts      per-server settings (data/guilds.json)
│   ├── spamGuard.ts          cooldowns, duplicates, rate limit
│   └── deployCommands.ts     slash-command registration
├── hinglish/                 language layer (no Discord imports)
│   ├── pipeline.ts           processMessage()
│   ├── preprocess.ts         mentions, URLs, code, emoji
│   ├── tokenizer.ts
│   ├── detector.ts           per-word Hindi/English labels + message language
│   ├── normalizer.ts         informal spelling → canonical, context rules
│   ├── numbers.ts            digits → Hindi words where spoken
│   ├── transliterator.ts     Transliterator interface + Google Input Tools
│   ├── mixedLanguageProcessor.ts   correction layer, run batching, assembly
│   └── lexicon/              Hindi, English, gaming, overrides, emoji, numbers
├── tts/                      provider interface, Google, Sarvam, cache
├── audio/                    per-server voice queue, ffmpeg conversion
└── cli/                      say (try it), eval (accuracy), compare helpers
tests/                        vitest unit tests, dataset, recorded fixtures
```

## Limitations and next steps

- **Word-level language ID is heuristic.** It combines lexicons, neighbour voting and word shape. An English word missing from the lexicons, inside a Hindi sentence, can come out in Devanagari (like टेंशन for "tension"). That usually still sounds right, just in a Hindi accent. The fix is adding the word to `englishCommon.ts`.
- **No LLM tier yet.** `Detection.confidence` is already returned. Routing low-confidence messages to a small LLM is the planned upgrade (spec §25), and plugs in behind `Transliterator`.
- **Single-voice synthesis.** Mixed text goes to one voice. If Google's Hindi voice reads English words poorly for you, try Sarvam. Splitting mixed text into per-language segments is possible, but not built yet.
- **Settings live in a JSON file.** Fine for one instance; move to a database if you shard.
- **Docker image is built by CI, not locally.** Docker wasn't available on the development machine; the CI workflow's *Docker build* job is the first real build.
