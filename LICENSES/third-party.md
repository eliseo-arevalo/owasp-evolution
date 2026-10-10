# Third-party assets

## Phosphor Icons — MIT

Copyright (c) 2023 Phosphor Icons. Source: [phosphor-icons/core](https://github.com/phosphor-icons/core), pinned to commit `2b75f3ad12b420c9504ef05df8d2564a28f8500e`.

The ten duotone SVG path sets in `src/visuals.js` come from `assets/duotone/{name}-duotone.svg`: `lock-key-open`, `sliders`, `package`, `lock`, `code`, `arrows-clockwise`, `fingerprint`, `file-arrow-down`, `bell-slash`, and `warning`.

The upstream outline paths are unchanged. Secondary layers use category accent fills in place of the upstream opacity; a neutral rounded tile and inset transform are added by this project. Only these paths are vendored; there is no icon runtime dependency. The original MIT notice is preserved in [phosphor-icons-MIT.txt](phosphor-icons-MIT.txt). Builds copy this directory into the static distribution.

Attack diagrams and educational examples are authored for this project. Their category definitions and prevention guidance link to the official OWASP Top 10:2025 pages in `src/data.js`.
