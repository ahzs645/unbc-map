# Working in this repository

The NHHR Atlas and the original UNBC Campus Explorer. Read
[README.md](README.md) first, then [manifest/README.md](manifest/README.md) for
what the published site contains and [docs/story-maps.md](docs/story-maps.md)
before touching the guided stories or their maps.

## Commands

- `npm ci`, then `npm run dev` (the published manifest) or `npm run dev:all`
  (every story, page and dataset).
- `npm run build:all && npm test` runs the browser suite against a complete
  build. `npm run build && npm run test:production` checks the published
  manifest.
- `npm run toolkit:build` builds the `packages/geo-toolkit` submodule; every
  `build` runs it first.

## Before pushing

- Run `npm run build:all`, then the Playwright specs for what you changed
  (`--workers=3`). A change to maps, stories or shared layout runs the full
  suite. A change to `manifest/` also runs `npm run build && npm run test:production`.
- Under heavy parallelism a few basemap-readiness checks can time out on
  software WebGL. Rerun a failure alone and compare with `main` at the same
  parallelism before calling it a regression; never raise timeouts to hide one.
- Pushing `main` deploys GitHub Pages in about two minutes; the browser checks
  run separately and do not hold the deploy.

## Data

- Snapshots in `public/data/nhhr/` and their `src/` mirrors are generated.
  Never edit them by hand: change and rerun the `scripts/prepare-nhhr-*`
  script, which verifies original hashes (`--check` for a read-only check),
  and keep the source and public copies byte-identical.
- Missing, suppressed or unmatched values stay missing; they never become
  zero. Keep source periods, estimate/projection labels and grain explicit.
- Story text and takeaways compute their numbers from the reviewed rows.

## The shared toolkit

`packages/geo-toolkit` is `@pgmaps/geo-toolkit`
(https://github.com/ahzs645/geo-toolkit), also used by PGMaps
(https://github.com/ahzs645/PGMaps).

- Put reusable mechanisms there (map behaviour, scales, story components,
  loaders); keep NHHR datasets, crosswalks, wording and UNBC branding here.
- Change the toolkit first: follow its AGENTS.md (check, lint, format, test),
  commit and push it, then update the submodule pointer here. Update PGMaps'
  pointer too once its `toolkit:build`, `toolkit:check`, `toolkit:test` and
  `build` pass.
- Its API.md records the map and story performance rules; keep them in step
  with [docs/story-maps.md](docs/story-maps.md).

## Documentation

Update the docs in the same change as the behaviour:

- README story tables, counts and routes when stories or datasets change.
- [docs/story-maps.md](docs/story-maps.md) when the reader, evidence views or
  their transition rules change.
- [manifest/README.md](manifest/README.md) when a manifest switch is added or
  changes meaning.
- Provenance and README files beside a data release when its sources change.

## Code and commits

- Match the surrounding code; CSS and code comments say why, not what.
- Phones are `max-width: 700px` throughout the Atlas.
- Commit messages: an imperative summary line, then why the change was made.
  Keep `.claude/` out of commits.
