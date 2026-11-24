# release-smoke-test-lab

Maintenance and testing kit for a simulated education platform ("LernWerk": learning content
editor, login and search). Two local instances, **staging** and **production**, receive versioned
releases; every deployment is followed by Playwright smoke tests and a release checklist, promotion
is gated on a green staging run, and rollback and backup/restore are scripted and exercised in CI.

Results are filled in after the CI run.
