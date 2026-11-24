#!/usr/bin/env bash
# Full release flow, used by CI and runnable locally:
#   1.0.0 -> staging -> smoke -> checklist -> promote -> production -> smoke -> checklist
#   1.1.0 -> staging -> smoke -> checklist -> promote -> production -> smoke
#   rollback production -> 1.0.0 -> smoke
#   backup + restore production data
set -euo pipefail
cd "$(dirname "$0")/.."
cli() { npx tsx envs/cli.ts "$@"; }
smoke() { SMOKE_ENV="$1" EXPECTED_VERSION="$2" npx playwright test; cp "reports/smoke-$1.json" "reports/smoke-$1-$2-$3.json"; npx tsx checklists/run.ts "$1"; cp "reports/checklist-$1.md" "reports/checklist-$1-$2-$3.md"; }

trap 'cli stop all >/dev/null 2>&1 || true' EXIT

echo "== release 1.0.0"; cli release 1.0.0
cli deploy staging 1.0.0;   smoke staging 1.0.0 deploy
cli promote production;     smoke production 1.0.0 promote

echo "== release 1.1.0"; cli release 1.1.0
cli deploy staging 1.1.0;   smoke staging 1.1.0 deploy
cli promote production;     smoke production 1.1.0 promote

echo "== rollback production"
cli rollback production;    smoke production 1.0.0 rollback

echo "== backup and restore production data"
jar=$(mktemp)
login() { curl -s -o /dev/null -c "$jar" -d "username=editor&password=editor-pass" http://127.0.0.1:4102/login; }
rev() { curl -s -b "$jar" http://127.0.0.1:4102/api/content/smoke-test-note | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).revision))'; }
login; rev_backup=$(rev)
name=$(cli backup production | tail -1)
curl -s -o /dev/null -b "$jar" -d "title=Changed after backup&body=to be undone" http://127.0.0.1:4102/content/smoke-test-note
rev_changed=$(rev)
cli restore production "$name"
login; rev_restored=$(rev)
echo "restore check: revision at backup=$rev_backup, after change=$rev_changed, after restore=$rev_restored"
[ "$rev_restored" = "$rev_backup" ] && [ "$rev_changed" != "$rev_backup" ] || { echo "restore check FAILED"; exit 1; }
echo "{\"revisionAtBackup\": $rev_backup, \"revisionAfterChange\": $rev_changed, \"revisionAfterRestore\": $rev_restored}" > reports/restore-check.json

echo "== deployment history"
cp .deploy/history.jsonl reports/deploy-history.jsonl
cli status
