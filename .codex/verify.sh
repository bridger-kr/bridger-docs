#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

node --check scripts/build-presets.mjs
node --check scripts/build-api-reference.mjs
npm exec --no -- mintlify validate
npm run lint
