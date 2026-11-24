# Run book

Operational reference for the two LernWerk instances.

| Environment | Port | Data directory | Log |
|---|---|---|---|
| staging | 4101 | `.deploy/envs/staging/data` | `.deploy/envs/staging/app.log` |
| production | 4102 | `.deploy/envs/production/data` | `.deploy/envs/production/app.log` |

Releases live in `.deploy/releases/<version>/` and are never changed after creation.
Every action (release, deploy, promote, rollback, backup, restore, blocked promotion)
is appended to `.deploy/history.jsonl`.

## Daily check
1. `npm run envs:status` shows both environments with `live.status = ok`.
2. `SMOKE_ENV=production npx playwright test` runs the 14 smoke tests against production.
3. `npm run checklist -- production` writes `reports/checklist-production.md`.

## Symptoms and actions

| Symptom | First check | Action |
|---|---|---|
| Health endpoint does not answer | `app.log` of the environment | Redeploy the current version: `npm run deploy -- <env> <version>` |
| Health reports an unexpected version | `state.json` of the environment, `history.jsonl` | Redeploy or roll back, see [rollback.md](rollback.md) |
| Smoke test fails after a production deployment | Checklist report, Playwright output | Roll back production, open a ticket with `tickets/TEMPLATE.md` |
| Content lost or corrupted | Latest backup in `.deploy/backups/` | Restore, see [backup-restore.md](backup-restore.md) |
| Promotion is blocked | `reports/gate-staging.json` | Fix and redeploy staging, rerun smoke tests and the checklist |

## Escalation
Write a bug report from the template, attach the checklist report and screenshot,
and link the ticket in the release notes. After the fix, run `npm run verify`.
