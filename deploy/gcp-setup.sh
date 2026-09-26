#!/usr/bin/env bash
# One-time Google Cloud setup for deploying the bot from GitHub Actions.
# Safe to re-run: every step skips what already exists.
#
# Run in Cloud Shell (https://shell.cloud.google.com) from the repo root:
#   gcloud config set project YOUR_PROJECT_ID
#   ./deploy/gcp-setup.sh [path/to/.env.production]
#
# Creates:
#   - Artifact Registry repo for the Docker image (keeps the 5 newest images)
#   - Secret Manager secret holding the production .env
#   - e2-micro VM (free tier) that runs the image on boot, as a service account that can call Google TTS
#   - Deployer service account + Workload Identity Federation so only main of the GitHub repo can deploy
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-a}"
REPO="${REPO:-bots}"
VM="${VM:-hinglish-tts-bot}"
SECRET="${SECRET:-tts-bot-env}"
GITHUB_REPO="${GITHUB_REPO:-AnurupMondal/tts}"
ENV_FILE="${1:-}"

POOL=github
PROVIDER=github
VM_SA="tts-bot-vm@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SA="tts-bot-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

step() { printf '\n==> %s\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

[[ -n "$PROJECT_ID" ]] || { echo "Set a project first: gcloud config set project YOUR_PROJECT_ID"; exit 1; }
[[ -f deploy/startup.sh ]] || { echo "Run this from the repo root."; exit 1; }
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
echo "Project: $PROJECT_ID ($PROJECT_NUMBER)  region: $REGION  zone: $ZONE  repo: $GITHUB_REPO"

step "Enabling APIs"
gcloud services enable compute.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  texttospeech.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com

step "Service accounts"
exists gcloud iam service-accounts describe "$VM_SA" ||
  gcloud iam service-accounts create tts-bot-vm --display-name="Hinglish TTS bot (VM runtime)"
exists gcloud iam service-accounts describe "$DEPLOY_SA" ||
  gcloud iam service-accounts create tts-bot-deployer --display-name="Hinglish TTS bot (GitHub deployer)"

step "Artifact Registry repository '$REPO'"
exists gcloud artifacts repositories describe "$REPO" --location="$REGION" ||
  gcloud artifacts repositories create "$REPO" --location="$REGION" --repository-format=docker \
    --description="Hinglish TTS bot images"
POLICY="$(mktemp)"
cat >"$POLICY" <<'JSON'
[
  { "name": "keep-5-newest", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 5 } },
  { "name": "delete-older", "action": { "type": "Delete" }, "condition": { "tagState": "any", "olderThan": "1d" } }
]
JSON
gcloud artifacts repositories set-cleanup-policies "$REPO" --location="$REGION" --policy="$POLICY" --no-dry-run >/dev/null
rm -f "$POLICY"
gcloud artifacts repositories add-iam-policy-binding "$REPO" --location="$REGION" \
  --member="serviceAccount:$VM_SA" --role=roles/artifactregistry.reader >/dev/null
gcloud artifacts repositories add-iam-policy-binding "$REPO" --location="$REGION" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/artifactregistry.writer >/dev/null

step "Secret '$SECRET' (production .env)"
exists gcloud secrets describe "$SECRET" ||
  gcloud secrets create "$SECRET" --replication-policy=automatic
if [[ -n "$ENV_FILE" ]]; then
  grep -q '^DISCORD_TOKEN=.\+' "$ENV_FILE" || { echo "$ENV_FILE has no DISCORD_TOKEN value"; exit 1; }
  gcloud secrets versions add "$SECRET" --data-file="$ENV_FILE" >/dev/null
  echo "Uploaded a new version from $ENV_FILE"
elif ! exists gcloud secrets versions access latest --secret="$SECRET"; then
  echo "NOTE: the secret has no value yet. Add one (see docs/DEPLOYMENT.md) before the first deploy."
fi
gcloud secrets add-iam-policy-binding "$SECRET" \
  --member="serviceAccount:$VM_SA" --role=roles/secretmanager.secretAccessor >/dev/null

step "VM '$VM' (e2-micro, free tier in us-central1/us-west1/us-east1)"
if ! exists gcloud compute instances describe "$VM" --zone="$ZONE"; then
  gcloud compute instances create "$VM" --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=debian-12 --image-project=debian-cloud \
    --boot-disk-size=30GB --boot-disk-type=pd-standard \
    --service-account="$VM_SA" --scopes=cloud-platform \
    --metadata=env-secret="$SECRET" \
    --metadata-from-file=startup-script=deploy/startup.sh
fi

step "Deployer permissions"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/compute.instanceAdmin.v1 --condition=None >/dev/null
# Changing metadata / resetting a VM that runs as a service account requires actAs on that account.
gcloud iam service-accounts add-iam-policy-binding "$VM_SA" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/iam.serviceAccountUser >/dev/null

step "Workload Identity Federation for GitHub Actions (main branch of $GITHUB_REPO only)"
exists gcloud iam workload-identity-pools describe "$POOL" --location=global ||
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"
if ! exists gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global --workload-identity-pool="$POOL"; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location=global \
    --workload-identity-pool="$POOL" --display-name="GitHub" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${GITHUB_REPO}' && assertion.ref=='refs/heads/main'"
fi
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" >/dev/null

cat <<EOF

============================================================
Done. Add these as GitHub repository *variables*
(github.com/${GITHUB_REPO} → Settings → Secrets and variables → Actions → Variables):

  GCP_PROJECT_ID     ${PROJECT_ID}
  GCP_REGION         ${REGION}
  GCP_ZONE           ${ZONE}
  GCP_ARTIFACT_REPO  ${REPO}
  GCP_VM             ${VM}
  GCP_WIF_PROVIDER   projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}
  GCP_DEPLOY_SA      ${DEPLOY_SA}

Then merge dev into main (or re-run the Deploy workflow) to ship.
============================================================
EOF
