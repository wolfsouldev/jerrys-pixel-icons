# Change Log

All notable changes to the "Jerry's Pixel Icons" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Fixed

- Correct routing associations to reference the existing `router` icon.
- Replace unsupported wildcard mappings with exact filenames and compound extensions.
- Add expanded icons for the `views`, `contents`, and `example` folder aliases.
- Remove redundant case-insensitive filename aliases without changing their behavior.
- Replace TypeScript scaffold tasks that referenced a nonexistent `src` directory.

### Added

- Ten native pixel-art SVGs: PDF, compressed archives, fonts, Jupyter Notebook,
  Angular, Nuxt, Vitest, Playwright, Kubernetes and Terraform.
- Specific file/extension associations for the new pack, preserving generic
  JSON/YAML/TypeScript mappings and unrelated existing icons.
- Artwork attribution/license notices distributed with the gallery and VSIX.

- A same-repository static icon gallery, generated from the canonical catalog,
  with search, type filters, sorting, open-folder previews, light/dark appearance,
  association details, original SVG downloads and URL-persisted search state.
- Optional catalog presentation labels and search tags without changing theme output.
- Standalone gallery build/local-preview commands and desktop/mobile browser tests.
- Gallery build artifacts and Chromium browser checks in CI.
- Gated GitHub Pages deployment from `master` after the complete test matrix and
  browser checks, with job-scoped permissions and a protected deployment environment.
- Post-deployment HTTP verification of every published gallery file against the
  tested commit, with bounded concurrency, timeouts and CDN-propagation retries.
- Regression tests for publication guards, permissions and stale/missing public assets.
- Pages activation, deployment troubleshooting and optional custom-domain documentation.

- Static theme validation and regression tests for associations, SVG XML, and folder states.
- Automatic linting, validation, and tests before packaging.
- A single source catalog and editor schema, with deterministic theme generation
  and a read-only stale-output check.
- Automatic closed/open folder definitions and aliases from one catalog entry.
- GitHub Actions validation and VSIX packaging checks on Node.js 22 and 24, with
  downloadable build artifacts and no automatic Marketplace publication.
- Verification of actual VSIX contents against the source theme and icon files.
- A contributor guide covering palette references, logical grid, SVG export,
  naming, catalog edits, and manual visual checks.
- An icon-request issue form and a pull-request checklist.

### Changed

- The generated theme normalizes case-insensitive association names and sorts
  output deterministically, preserving all existing icon definitions and mappings.
- Pin the development package manager to pnpm 12.15.0.

## [0.3.0] - 2026-02-04

- Historical version recorded by repository commit `515ab8e` (`v0.3.0`). This entry
  records repository history; a Marketplace publication date has not been verified.
