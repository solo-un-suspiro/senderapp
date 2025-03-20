#!/usr/bin/env bash
# Exit on error
set -o errexit

# Build the Next.js application
npm run build

# Copy the WhatsApp session data to the build directory
mkdir -p .next/whatsapp-sessions
cp -r whatsapp-sessions/* .next/whatsapp-sessions/ || true

# Log completion
echo "Build script completed"

