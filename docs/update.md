# Guide: roll out a new version

1. Raise the version in `package.json` (semantic versioning).
2. `npm ci && npm run typecheck && npm test` must be green.
3. `npm run build`
4. `npm run release -- <version>` packages `dist/` into `.deploy/releases/<version>/`.
5. `npm run deploy -- staging <version>` stops the old staging process, starts the new release and waits until `/api/health` reports the new version.
6. `SMOKE_ENV=staging EXPECTED_VERSION=<version> npx playwright test`
7. `npm run checklist -- staging` writes the checklist report and the gate file `reports/gate-staging.json`.
8. `npm run promote` deploys the same release to production. It refuses if the gate is missing, belongs to another version, or contains a failure.
9. `SMOKE_ENV=production EXPECTED_VERSION=<version> npx playwright test` and `npm run checklist -- production`.
10. Keep the checklist reports with the release notes.

Data stays in `.deploy/envs/<env>/data`, outside the release folder, so an update never overwrites content.
