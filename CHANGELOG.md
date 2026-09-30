# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.1] - 2026-10-01

### Changed
- The README and the npm description say where the library comes from: it was created for Florian Rosinski's art project *Un art voulu voyant* (uavv.fr).

## [0.2.0] - 2026-09-30

### Changed
- Published as compiled ESM with type declarations (`dist/`), built by tsup: no `transpilePackages` needed anymore.
- A root entry point (`import { skyRecap } from "astralmanach"`) re-exports the most used functions and types.

### Fixed
- `fireballs`: a `forEach` callback no longer returns a value.

## [0.1.0] - 2026-09-30

### Added
- First release, extracted from the Astralmanach tools: civil time and IANA zones (`time`), result cards (`cards`), the
  fetcher and the query runner with injected key, cache and User-Agent (`fetcher`, `run`), three sources (`skyEvents`,
  `issPasses`, `fireballs`), the celestial vault (`voute`: `skyAt`, `skyMap`) and `skyRecap`. Published as TypeScript source.

[Unreleased]: https://github.com/Ismaouste/astralmanach/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Ismaouste/astralmanach/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ismaouste/astralmanach/releases/tag/v0.1.0
