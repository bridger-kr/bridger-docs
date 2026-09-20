#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

node --version
git submodule update --init --recursive vendor/spec
npm install --no-audit --no-fund
