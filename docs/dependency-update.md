# Guide: update dependencies

1. `npm outdated` lists available updates.
2. Update one group at a time (for example test tools, then TypeScript) with an exact version in `package.json`; this project pins exact versions.
3. `npm install`, then commit `package.json` and `package-lock.json` together.
4. `npm run typecheck && npm test && npm run testcases:validate`
5. If Playwright changed: `npx playwright install chromium`.
6. Run the full flow: `npm run pipeline`. It deploys to staging, runs smoke tests and only promotes if every check passes.
7. `npm run verify` re-tests all fixed tickets to catch regressions.
8. Push; CI repeats all steps on a clean runner.
