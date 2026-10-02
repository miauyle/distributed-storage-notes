#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
deps_dir="${SITE_DEPS_DIR:-${RUNNER_TEMP:-/tmp}/distributed-storage-site-deps}"
npm install --prefix "$deps_dir" --no-audit --no-fund --ignore-scripts katex@0.16.22 mermaid@11.6.0 playwright@1.51.1
mkdir -p assets/vendor/katex assets/vendor/mermaid
cp "$deps_dir/node_modules/katex/dist/katex.min.js" "$deps_dir/node_modules/katex/dist/katex.min.css" assets/vendor/katex/
cp -r "$deps_dir/node_modules/katex/dist/fonts" assets/vendor/katex/
cp -r "$deps_dir/node_modules/mermaid/dist/." assets/vendor/mermaid/
