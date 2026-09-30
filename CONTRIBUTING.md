# Contributing

Thank you for helping. Issues and pull requests are welcome, in English or in French.

## Setup

```sh
npm install
npm run check   # typecheck, lint, tests, build — what CI runs
npm run smoke   # imports the built package by its name and subpaths
```

Node 20 or later. The code comments are in French; the public API and this repository's docs are in English.

## The rules of the codebase

- **No secrets, no disk.** Nothing reads `process.env`, `.env` or the file system. Keys, User-Agent and cache are
  parameters. A new module keeps it that way.
- **Never throw from a query.** `normalize` returns `[]` for an unknown shape; errors become a result status.
- **Pure first.** Anything computable (positions, events, the map) stays local and synchronous; only data that truly lives
  elsewhere (TLEs, fireballs) is fetched.
- **Test the sky, not a copy of it.** Prefer tests that compare two independent computations, or a known event (an
  eclipse, a fireball) to its published record, over values pasted from the code's own output.
- **A new source**: a `Query` (`build`, `normalize`, `coverage`) in `src/queries/`, its test with a recorded response, its
  subpath in `package.json` `exports` and in `tsup.config.ts`.
- **A new public subpath**: add it to `exports`, to `tsup.config.ts`, and to the Modules table of the README.

## Commits and releases

Commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:` followed by a short sentence. Every user-visible change gets a line in
`CHANGELOG.md` under *Unreleased*. A release is a version bump, the changelog section dated, and a `vX.Y.Z` tag: the
release workflow runs the checks and publishes to npm with provenance.
