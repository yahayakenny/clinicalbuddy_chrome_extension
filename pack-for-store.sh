#!/usr/bin/env bash
# Create a zip suitable for Chrome Web Store upload.
# Run from the extension directory: ./pack-for-store.sh

set -e
cd "$(dirname "$0")"
ZIP_NAME="clinicalbuddy-extension.zip"

# Remove old zip if present
rm -f "$ZIP_NAME"

# Files/dirs to include (runtime only). Exclude node_modules, dev sources, docs.
zip -r "$ZIP_NAME" \
  manifest.json \
  background.js \
  content.js \
  content.css \
  sidepanel.html \
  sidepanel.js \
  sidepanel.css \
  images/ \
  -x "*.DS_Store" \
  -x "node_modules/*" \
  -x "src/*" \
  -x "*.md" \
  -x "package*.json" \
  -x "tailwind.config.js" \
  -x ".git/*"

echo "Created $ZIP_NAME ($(du -h "$ZIP_NAME" | cut -f1)). Upload this at https://chrome.google.com/webstore/devconsole"
