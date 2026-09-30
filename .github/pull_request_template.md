## What this changes

<!-- One or two sentences, and the issue it closes ("Closes #n"). -->

## Why

## How to review

<!-- Where to look first; what you ran (`npm run check`). -->

- [ ] `npm run check` passes (typecheck, lint, tests, build)
- [ ] A behaviour change has a test, and a line in `CHANGELOG.md`
- [ ] No secret, no file read, no `process.env` in `src/` (the library never reads them)
