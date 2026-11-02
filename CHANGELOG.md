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

- Static theme validation and regression tests for associations, SVG XML, and folder states.
- Automatic linting, validation, and tests before packaging.
