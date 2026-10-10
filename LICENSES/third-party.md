# Third-party assets

## Phosphor Icons — MIT

Copyright (c) 2023 Phosphor Icons. Source: [phosphor-icons/core](https://github.com/phosphor-icons/core), pinned to commit `2b75f3ad12b420c9504ef05df8d2564a28f8500e`.

The category duotone SVG path sets in `src/icons.js` come from `assets/duotone/{name}-duotone.svg`: `lock-key-open`, `sliders`, `package`, `lock`, `code`, `arrows-clockwise`, `fingerprint`, `file-arrow-down`, `bell-slash`, and `warning`.

The upstream outline paths are unchanged. Secondary layers use category accent fills in place of the upstream opacity; a neutral rounded tile and inset transform are added by this project. Only these paths are vendored; there is no icon runtime dependency. The original MIT notice is preserved in [phosphor-icons-MIT.txt](phosphor-icons-MIT.txt). Builds copy this directory into the static distribution.

Attack diagrams and educational examples are authored for this project. Their category definitions and prevention guidance link to the official OWASP Web (2013–2025) and GenAI/LLM (2025–2026) sources in `src/data.js`.

Additional duotone paths in `src/icons.js`, from the same pinned upstream commit: `arrow-left`, `arrow-right`, `arrows-in`, `arrows-out`, `bell-slash`, `browser`, `code`, `database`, `detective`, `download-simple`, `file-arrow-down`, `globe`, `keyboard`, `layout`, `link`, `lock`, `package`, `robot`, `shield-check`, `shopping-cart`, `sidebar-simple`, `user`, `user-circle`, `users`, `warning`, `x`. These icons represent diagram actors, services and panel actions.

The compact detail toolbar also uses the primary outlines for `caret-left`, `caret-right`, `check`, and `dots-three` from Phosphor Icons under the same MIT license.

The support utility uses the `coffee` duotone paths from the same pinned upstream commit, with a neutral secondary fill.
