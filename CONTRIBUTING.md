# Contributing to MoodSort

Bug reports and pull requests are welcome on [GitHub](https://github.com/Semche95/MoodSort/issues).

Before changing anything, read [docs/BEHAVIOR.md](docs/BEHAVIOR.md) (what the app does and the rules every change must keep) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (how it is built).

## Development setup

Requires Node.js and pnpm.

```bash
pnpm install
pnpm dev
```

The dev server runs at `http://localhost:5170`.

`pnpm dev` and `pnpm build` regenerate two things before starting: the card spritesheet atlas (one `atlas.<locale>.<theme>.webp` per language in `LANGUAGES` and per theme, `light` and `dark`, plus a single shared `atlas.json` manifest, since the frame layout never depends on locale or theme, all in `scripts/generate-atlas.mjs`, built from `src/cards/`) and the app icons (`src/assets/icons/`, rasterized from `lucide-static`). Both outputs are git-ignored. Atlas generation is cached per locale/theme combination for the images and once for the shared manifest (keyed on the source card images and labels), so a rebuild only regenerates what actually changed.

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Type-check and build for production |
| `pnpm preview` | Preview the production build |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:quiet` | Run tests with compact output |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm lint` / `pnpm lint:fix` | Lint |
| `pnpm atlas` | Regenerate the card atlas |
| `pnpm icons` | Regenerate the app icons |

Run `pnpm typecheck`, `pnpm lint` and `pnpm test` before opening a pull request. Commits follow [Conventional Commits](https://www.conventionalcommits.org), which the release notes are built from.

## Project structure

```
docs/          # Behavior and architecture docs, README images
scripts/       # Atlas and icon generation
src/
  cards/        # 85 source card images
  logo/         # Logo and wordmark SVGs, loaded as is (the logo is also the favicon)
  assets/       # Generated atlas + icons (git-ignored)
  app/          # Composition root: entry point, canvas scene
  features/     # One folder per feature: card, drag, stack, history,
                # toolbar, onboarding, settings, footer, screen-share, theme,
                # screen-size, fullscreen, background
  shared/       # Cross-feature UI widgets and utilities: icons (used app-wide),
                # inline Lucide SVGs and shared chrome for DOM modals, tooltip,
                # loading overlay, geometry, localStorage wrapper,
                # reduced-motion and Ctrl/Cmd key checks
  types/        # One file per domain type (card, drag, stack, history, etc.)
  __tests__/
```

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request. The `verify` job installs dependencies, then caches the card atlas between runs (the key hashes the contents of `scripts/generate-atlas.mjs`, `src/cards/`, `src/i18n/locales/`, and `scripts/fonts/`, so it's only regenerated when that content changes), regenerates the icons, typechecks, lints, and runs the test suite. A `dependabot` job, which depends on `verify` (`needs: [verify]`), then auto-approves and auto-merges non-major Dependabot PRs.

## Releases

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which fails if the tag doesn't match the `package.json` version, then creates a draft GitHub release whose notes list the Conventional Commits since the previous tag, grouped by `cliff.toml` (features, fixes, performance, then build and refactor; dependency bumps and other types are left out). Rewrite the notes if needed, then publish the draft.

Publishing the release triggers two workflows:

- `.github/workflows/docker-publish.yml` builds and pushes the image to `ghcr.io/semche95/moodsort`, tagged `latest`, the release's semver and the short SHA (also runnable manually via `workflow_dispatch`).
- `.github/workflows/deploy.yml` builds the app and uploads `dist/` to an OVH mutualized hosting account over SFTP (also runnable manually from the Actions tab). It needs the repo secrets `OVH_SFTP_HOST`, `OVH_SFTP_USERNAME` and `OVH_SFTP_PASSWORD` (`Settings -> Secrets and variables -> Actions`); see the comments at the top of `deploy.yml` for the one-time bootstrap step needed before the first release.
