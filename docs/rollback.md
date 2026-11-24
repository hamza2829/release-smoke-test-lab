# Guide: roll back

Use when production smoke tests fail or users report a regression after a deployment.

1. `npm run envs:status` and note `current` and `history` of production.
2. `npm run rollback -- production` stops the current process and starts the most recent previous release. The rolled back version is removed from the history.
3. Confirm with `curl -s http://127.0.0.1:4102/api/health` that the old version answers.
4. `SMOKE_ENV=production EXPECTED_VERSION=<old version> npx playwright test`
5. `npm run checklist -- production` and attach the report to the incident ticket.

Rollback does not touch data. If the faulty version damaged data, restore a backup afterwards.
The CI pipeline runs this exact rollback (1.1.0 back to 1.0.0) on every push.
