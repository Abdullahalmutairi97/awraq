#!/usr/bin/env bash
# Publish to GitHub Pages: commit everything, push, Pages rebuilds automatically.
set -euo pipefail
cd "$(dirname "$0")"
msg="${1:-تحديث}"
git add -A
git commit -q -m "$msg" 2>/dev/null || echo "لا تغييرات جديدة"
git push -q origin main
echo "مدفوع — https://abdullahalmutairi97.github.io/awraq/"
