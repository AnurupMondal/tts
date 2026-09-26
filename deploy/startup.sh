#!/bin/bash
# Compute Engine startup script: runs on every boot of the bot VM.
#
# Reads instance metadata:
#   image       Artifact Registry image to run (set by the deploy workflow)
#   env-secret  Secret Manager secret holding the production .env (default: tts-bot-env)
#   deploy-id   Id of the deploy that triggered this boot (echoed so the workflow can verify it)
#
# Google TTS authenticates as the VM's service account (no key file on the machine).
set -euo pipefail

log() { echo "hinglish-tts: $*"; }
md() { curl -fsS -H 'Metadata-Flavor: Google' "http://metadata.google.internal/computeMetadata/v1/$1"; }

IMAGE="$(md instance/attributes/image 2>/dev/null || true)"
SECRET="$(md instance/attributes/env-secret 2>/dev/null || echo tts-bot-env)"
DEPLOY_ID="$(md instance/attributes/deploy-id 2>/dev/null || echo manual)"
CONTAINER=hinglish-tts

if [[ -z "$IMAGE" ]]; then
  log "no image set in metadata yet; waiting for the first deploy"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  log "installing docker (first boot only)"
  curl -fsSL https://get.docker.com | sh
fi

# Registry host, e.g. us-central1-docker.pkg.dev
gcloud auth configure-docker "${IMAGE%%/*}" --quiet >/dev/null 2>&1

# Production env file from Secret Manager. Key-file and path settings don't apply on the VM.
install -d -m 700 /etc/hinglish-tts
ENV_FILE=/etc/hinglish-tts/env
gcloud secrets versions access latest --secret="$SECRET" \
  | tr -d '\r' \
  | grep -vE '^[[:space:]]*(GOOGLE_APPLICATION_CREDENTIALS|DATA_DIR)=' >"$ENV_FILE.tmp"
chmod 600 "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"

log "pulling $IMAGE"
docker pull --quiet "$IMAGE" >/dev/null

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -e NODE_ENV=production -e DATA_DIR=/app/data \
  -v hinglish-tts-data:/app/data \
  --log-opt max-size=10m --log-opt max-file=3 \
  "$IMAGE" >/dev/null

# Keep the small disk tidy: drop images not used by the running container.
docker image prune -af >/dev/null 2>&1 || true

# Wait until the bot has logged in to Discord, then report the result on the serial console.
for _ in $(seq 1 45); do
  if docker logs "$CONTAINER" 2>&1 | grep -q '"msg":"bot ready"'; then
    log "READY deploy=$DEPLOY_ID image=$IMAGE"
    exit 0
  fi
  if [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]]; then
    break
  fi
  sleep 2
done

log "FAILED deploy=$DEPLOY_ID image=$IMAGE"
docker logs --tail 30 "$CONTAINER" 2>&1 | sed 's/^/hinglish-tts: log: /' || true
exit 1
