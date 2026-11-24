# Release test checklist

Every item is linked to an automated smoke test (SMK id). The runner
(`npm run checklist -- <env>`) fills in pass/fail from the Playwright report.

## Deployment
- [ ] CHK-01 | SMK-01 | Health endpoint answers "ok" and reports the version that was deployed
- [ ] CHK-02 | SMK-14 | Content API refuses anonymous requests (401)

## Login
- [ ] CHK-03 | SMK-02 | Anonymous visitors are sent to the sign in page
- [ ] CHK-04 | SMK-03 | Wrong password is rejected with a clear message
- [ ] CHK-05 | SMK-04 | Editor account can sign in and sees its name
- [ ] CHK-06 | SMK-13 | Logout ends the session

## Content
- [ ] CHK-07 | SMK-05 | Content list is complete and sorted by title
- [ ] CHK-08 | SMK-06 | A learning unit opens with title and text
- [ ] CHK-09 | SMK-07 | Unknown content shows a 404 page, not a server error

## Search
- [ ] CHK-10 | SMK-08 | Search ignores upper and lower case
- [ ] CHK-11 | SMK-09 | Search returns all matches and finds words with umlauts
- [ ] CHK-12 | SMK-10 | Empty search shows a validation message

## Editor
- [ ] CHK-13 | SMK-11 | Edit and save persists the change and increments the revision
- [ ] CHK-14 | SMK-12 | Saving with an empty title is rejected
