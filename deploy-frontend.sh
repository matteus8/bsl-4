#!/usr/bin/env bash
# ==============================================================================
# BSL-4 Frontend Build & Deploy Automation Script
# Usage: ./deploy-frontend.sh [optional-bucket-name] [optional-distribution-id]
# ==============================================================================

set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

BUCKET_NAME="${1:-$S3_BUCKET_NAME}"
DISTRIBUTION_ID="${2:-$CLOUDFRONT_DIST_ID}"

if [ -z "$BUCKET_NAME" ]; then
  echo "Error: S3_BUCKET_NAME is not set. Provide it as an argument or in .env."
  echo "Usage: ./deploy-frontend.sh <s3-bucket-name> [cloudfront-distribution-id]"
  exit 1
fi

echo "=================================================="
echo "1. Building Next.js Static Export..."
echo "=================================================="
cd frontend
NEXT_PUBLIC_API_URL="" npm run build
cd ..

echo ""
echo "=================================================="
echo "2. Syncing static assets to s3://${BUCKET_NAME}..."
echo "=================================================="
aws s3 sync frontend/out/ "s3://${BUCKET_NAME}" --delete --exclude "api/*" --exclude "data/*"

if [ -n "$DISTRIBUTION_ID" ]; then
  echo ""
  echo "=================================================="
  echo "3. Invalidating CloudFront Cache (${DISTRIBUTION_ID})..."
  echo "=================================================="
  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*"
  echo "CloudFront invalidation created successfully."
else
  echo ""
  echo "CLOUDFRONT_DIST_ID not specified; skipping edge cache invalidation."
fi

echo ""
echo "Deployment completed successfully."
