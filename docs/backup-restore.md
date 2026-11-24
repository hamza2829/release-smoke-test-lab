# Guide: backup and restore

## Backup
`npx tsx envs/cli.ts backup production` copies `.deploy/envs/production/data` to
`.deploy/backups/production-<timestamp>/` and prints the backup name.
Take a backup before every production deployment.

## Restore
1. `npx tsx envs/cli.ts restore production <backup-name>`
2. The command stops production, replaces the data directory with the backup and starts the current release again.
3. Check `/api/health` and run the production smoke tests.

The pipeline proves this on every run: it backs up production, changes a page
(revision goes up by one), restores and checks that the revision is back to the backup value
(`reports/restore-check.json`).
