#!/bin/bash
# FIXIT SLM — GCS Upload Script
# ================================
# [GCP PLACEHOLDER] — Run this script after training is complete locally
# to upload all artifacts to Google Cloud Storage.
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated
#   2. GCS bucket created: gs://fixit-slm-artifacts
#   3. Training complete locally
#
# Usage:
#   chmod +x gcp/upload_to_gcs.sh
#   ./gcp/upload_to_gcs.sh

set -e

# ─────────────────────────────────────────────────────────────────────────────
# Configuration — UPDATE THESE
# ─────────────────────────────────────────────────────────────────────────────
GCS_BUCKET="fixit-slm-artifacts"        # TODO: Update to your bucket name
GCP_PROJECT="YOUR_PROJECT_ID"           # TODO: Update to your GCP project ID
REGION="us-central1"

# Local paths
DATASET_PATH="./dataset/fixit_train.jsonl"
LORA_PATH="./checkpoints/fixit-lora-final"
MERGED_PATH="./merged"
GGUF_PATH="./gguf/fixit-slm-Q4_K_M.gguf"

# ─────────────────────────────────────────────────────────────────────────────
# Preflight checks
# ─────────────────────────────────────────────────────────────────────────────
echo "FIXIT SLM — GCS Upload"
echo "======================"
echo "Project:  $GCP_PROJECT"
echo "Bucket:   gs://$GCS_BUCKET"
echo ""

# Check gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "ERROR: gcloud CLI not found."
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check gsutil is available
if ! command -v gsutil &> /dev/null; then
    echo "ERROR: gsutil not found. Run: gcloud components install gsutil"
    exit 1
fi

# Set project
gcloud config set project $GCP_PROJECT

# ─────────────────────────────────────────────────────────────────────────────
# Create bucket if it doesn't exist
# ─────────────────────────────────────────────────────────────────────────────
echo "Checking GCS bucket..."
if ! gsutil ls "gs://$GCS_BUCKET" &> /dev/null; then
    echo "Creating bucket: gs://$GCS_BUCKET"
    gsutil mb -l $REGION "gs://$GCS_BUCKET"
    echo "Bucket created."
else
    echo "Bucket exists: gs://$GCS_BUCKET"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Upload dataset
# ─────────────────────────────────────────────────────────────────────────────
if [ -f "$DATASET_PATH" ]; then
    echo ""
    echo "[1/4] Uploading dataset..."
    gsutil cp "$DATASET_PATH" "gs://$GCS_BUCKET/dataset/fixit_train.jsonl"
    echo "Dataset uploaded."
else
    echo "[1/4] Dataset not found at $DATASET_PATH — skipping."
fi

# ─────────────────────────────────────────────────────────────────────────────
# Upload LoRA adapter
# ─────────────────────────────────────────────────────────────────────────────
if [ -d "$LORA_PATH" ]; then
    echo ""
    echo "[2/4] Uploading LoRA adapter..."
    gsutil -m cp -r "$LORA_PATH" "gs://$GCS_BUCKET/lora/"
    echo "LoRA adapter uploaded."
else
    echo "[2/4] LoRA adapter not found at $LORA_PATH — skipping (run train.py first)."
fi

# ─────────────────────────────────────────────────────────────────────────────
# Upload merged model
# ─────────────────────────────────────────────────────────────────────────────
if [ -d "$MERGED_PATH" ]; then
    echo ""
    echo "[3/4] Uploading merged model (this may take several minutes — ~7GB)..."
    gsutil -m cp -r "$MERGED_PATH" "gs://$GCS_BUCKET/merged/"
    echo "Merged model uploaded."
else
    echo "[3/4] Merged model not found at $MERGED_PATH — skipping (run merge_model.py first)."
fi

# ─────────────────────────────────────────────────────────────────────────────
# Upload GGUF
# ─────────────────────────────────────────────────────────────────────────────
if [ -f "$GGUF_PATH" ]; then
    echo ""
    echo "[4/4] Uploading GGUF model (~2.2GB)..."
    gsutil cp "$GGUF_PATH" "gs://$GCS_BUCKET/gguf/fixit-slm-Q4_K_M.gguf"
    echo "GGUF uploaded."
else
    echo "[4/4] GGUF not found at $GGUF_PATH — skipping (run merge_model.py first)."
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "Upload complete. Bucket contents:"
gsutil ls -lh "gs://$GCS_BUCKET/"
echo ""
echo "Next steps:"
echo "  1. Submit Vertex AI training job: see gcp/vertex_training_config.yaml"
echo "  2. Deploy inference server: see gcp/cloudbuild.yaml"
