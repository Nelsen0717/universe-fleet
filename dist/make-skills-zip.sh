#!/bin/bash
# 重新打包艦隊 skills 成 folder-drop zip。skills 有更動時重跑。
set -e
cd "$(dirname "$0")/.."
find skills -name '.DS_Store' -delete 2>/dev/null || true
rm -f dist/universe-fleet-skills.zip
cd skills
zip -r -X ../dist/universe-fleet-skills.zip \
  coach navigator ghostwriter brand-guard threads-setup art-director analyst \
  -x '*.DS_Store' -x '*.bak' -x '*.bak-*' -x '*.bak2-*' -x '*/config/banned-words.json'
echo "✓ dist/universe-fleet-skills.zip 已重建"
