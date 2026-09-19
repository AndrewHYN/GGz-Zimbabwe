#!/usr/bin/env bash
set -euo pipefail

echo "GGz 2.0 frontend deployment"
echo "installing frontend dependencies"
cd "$(dirname "$0")/../frontend"
npm ci

echo "building Next.js frontend"
npm run build
