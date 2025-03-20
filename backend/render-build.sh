#!/usr/bin/env bash
# Exit on error
set -o errexit

# Build the Next.js application
npm run build

# Log completion
echo "Build script completed"

