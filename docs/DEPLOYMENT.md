# Deploying to Google Cloud

The bot runs as a Docker container on a free-tier Compute Engine VM. GitHub Actions builds and deploys it automatically.

```text
dev  ──push──▶  CI: typecheck · unit tests · Docker build
 │
 └─ PR ──▶ main ──push──▶  Deploy: CI → build image → push to Artifact Registry
                                 → set VM metadata (image tag) → restart VM
                                 → VM boots, pulls the image, reads secrets, starts the bot
                                 → workflow waits for "bot ready" on the VM's serial log
```

- **Branches.** All work happens on `dev`. `main` is only for deployment: merging into it ships to production.
- **No keys anywhere.**
  - GitHub authenticates to GCP with Workload Identity Federation. Google trusts only the `main` branch of `AnurupMondal/tts`.
  - The VM calls Google Text-to-Speech as its own service account, so no JSON key file is involved.
- **Secrets.** The production `.env` is one Secret Manager secret, `tts-bot-env`. The VM reads it at every boot. It is never in Git, GitHub or the image.

---

## One-time setup

### 1. Prepare the production env file

On your PC, copy `.env` to `.env.production`. That name is git-ignored. Then edit the copy:

- Keep `TTS_PROVIDER=google`, `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` and your tuning values.
- **Delete** the `GOOGLE_APPLICATION_CREDENTIALS` line. The VM authenticates without a key.
- Don't wrap values in quotes. Docker's env-file format keeps them literally.

> **Two copies of one bot.** If `npm run dev` on your PC uses the same `DISCORD_TOKEN` as production, both copies answer every message.
> Stop the local one while production runs, or create a second Discord application ("Hinglish TTS Dev") for local work and use its token in `.env`.

### 2. Run the setup script in Cloud Shell

1. Open <https://shell.cloud.google.com> and select the **same project you use for TTS**.
2. Clone the repo:

   ```bash
   git clone https://github.com/AnurupMondal/tts.git
   cd tts
   git checkout dev
   ```

   If the repo is private, Git will ask for a username and a password. Use a GitHub **personal access token** as the password: GitHub → Settings → Developer settings → Tokens, with *Contents: read* access.

3. Upload the env file: in the Cloud Shell toolbar, click **⋮ → Upload**, choose `.env.production`, and move it into the repo folder:

   ```bash
   mv ~/.env.production .
   ```

4. Run the script, then delete the uploaded copy:

   ```bash
   gcloud config set project YOUR_PROJECT_ID
   chmod +x deploy/gcp-setup.sh
   ./deploy/gcp-setup.sh .env.production
   rm .env.production
   ```

   It takes a few minutes. It enables APIs and creates:
   - the Artifact Registry repo `bots`;
   - the secret `tts-bot-env`;
   - the VM `hinglish-tts-bot` (`e2-micro`, `us-central1-a`);
   - two service accounts;
   - the GitHub trust.

   It is safe to run again.

### 3. Add the GitHub variables

The script ends by printing seven values. Add each one at **github.com/AnurupMondal/tts → Settings → Secrets and variables → Actions → Variables tab → New repository variable**:

| Name | Example |
|---|---|
| `GCP_PROJECT_ID` | `my-tts-project` |
| `GCP_REGION` | `us-central1` |
| `GCP_ZONE` | `us-central1-a` |
| `GCP_ARTIFACT_REPO` | `bots` |
| `GCP_VM` | `hinglish-tts-bot` |
| `GCP_WIF_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/github/providers/github` |
| `GCP_DEPLOY_SA` | `tts-bot-deployer@my-tts-project.iam.gserviceaccount.com` |

These go in **Variables**, not *Secrets*: none of them is sensitive. The Deploy workflow is skipped until `GCP_PROJECT_ID` exists.

### 4. Protect `main` (recommended)

Go to **Settings → Branches → Add branch ruleset** (or *Add rule*) for `main` and turn on:

- **Require a pull request before merging.**
- **Require status checks to pass**, and pick *Typecheck and test* and *Docker build*.
- **Block force pushes.**

### 5. Register slash commands for production

Commands registered with `DEV_GUILD_ID` exist only in that one server. To make them available in every server the bot joins, run this once on your PC with `DEV_GUILD_ID` empty:

```bash
npm run deploy-commands
```

Global commands can take up to an hour to appear. Re-run it only when commands change.

### 6. First deploy

Open a pull request from `dev` to `main` on GitHub, wait for CI, and merge. Then watch **Actions → Deploy**.
- The first boot installs Docker, so expect about 5 minutes.
- Later deploys take about 2–3 minutes: build, push, then a VM restart of about 40 seconds.
- The job goes green only after the bot has logged in to Discord.

---

## Day to day

```bash
git checkout dev
# ...edit, npm test...
git commit -am "..." && git push      # CI runs
# open PR dev → main, merge            # Deploy runs
```

## Operations

All commands below work from Cloud Shell, or from any machine with `gcloud` installed.

**View live logs.** They contain metadata only, never message text:

```bash
gcloud compute ssh hinglish-tts-bot --zone us-central1-a -- sudo docker logs -f --tail 100 hinglish-tts
```

**View startup/deploy output:**

```bash
gcloud compute instances get-serial-port-output hinglish-tts-bot --zone us-central1-a | grep hinglish-tts:
```

**Change a setting or rotate the Discord token:**

```bash
gcloud secrets versions add tts-bot-env --data-file=.env.production
gcloud compute instances reset hinglish-tts-bot --zone us-central1-a
```

**Roll back to an earlier version.** Images are tagged with the commit SHA; the newest 5 are kept.

```bash
gcloud artifacts docker images list us-central1-docker.pkg.dev/PROJECT_ID/bots/hinglish-tts --include-tags
gcloud compute instances add-metadata hinglish-tts-bot --zone us-central1-a \
  --metadata image=us-central1-docker.pkg.dev/PROJECT_ID/bots/hinglish-tts:OLD_SHA
gcloud compute instances reset hinglish-tts-bot --zone us-central1-a
```

For a permanent rollback, revert the commit on `dev` and merge it to `main`.

**Stop or start the bot:**

```bash
gcloud compute instances stop hinglish-tts-bot --zone us-central1-a
gcloud compute instances start hinglish-tts-bot --zone us-central1-a
```

## Cost

- **Compute Engine:** one `e2-micro` VM with a 30 GB standard disk in `us-central1`, `us-west1` or `us-east1` is covered by the GCP free tier.
- **External IP address:** Google may charge a small amount for the VM's public IP. Check **Billing → Reports** after the first month.
- **Artifact Registry:** 0.5 GB of storage is free. Five images may go slightly over, which costs cents.
- **Secret Manager:** effectively free at this usage.
- **Text-to-Speech:** billed per character as before. The VM changes nothing there.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Deploy job skipped | `GCP_PROJECT_ID` variable not set (step 3) |
| `auth` step: *Permission denied / unable to acquire impersonated credentials* | Variables have typos, or the run wasn't on `main`: the trust only accepts `refs/heads/main`. Re-run the setup script if the `GITHUB_REPO` name changed. |
| *Permission 'iam.serviceAccounts.actAs' denied* | Re-run `deploy/gcp-setup.sh`; it grants `serviceAccountUser` on the VM account |
| Deploy times out, log shows `no image set` | The metadata update failed; check the "Point the VM" step output |
| `FAILED` with `Missing required environment variable(s): DISCORD_TOKEN` | The secret is empty or malformed. Add a version (see *Operations*). |
| `FAILED` with Google TTS `PERMISSION_DENIED` | Text-to-Speech API not enabled in this project, or the VM was created without `--scopes=cloud-platform` |
| Bot answers twice | A second copy is running with the same token (your PC). See step 1. |
| Hindi words read with an English accent, `degraded` in logs | Google Input Tools is rate-limiting the VM's IP; it recovers automatically after 60 s |
