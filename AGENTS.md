# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build/Lint/Test Commands
- `pnpm dev` - Frontend only (Vite dev server on port 15688, NOT 5688 as in CLAUDE.md)
- `pnpm tauri dev` - Full app (Vite + Rust backend)
- `pnpm build` - Frontend build (vue-tsc + vite)
- `pnpm tauri build` - Production app bundle
- `pnpm lint:fix` - ESLint with auto-fix
- `pnpm format` - Prettier formatting
- For Rust checking: `cd src-tauri && cargo check`

## Project-Specific Conventions
- **Auto-imports**: Vue, Vue Router, VueUse, and Naive UI composables are auto-imported (see vite.config.ts) - no explicit imports needed
- **Path alias**: `@` maps to `src/` (configured in tsconfig.json and vite.config.ts)
- **State management**: Pinia with persistedstate plugin - stores auto-persist to localStorage
- **Tauri commands**: Backend functions in `src-tauri/src/commands/` are invoked via `invoke<T>("command_name", args)`
- **Progress tracking**: Uses `--progress-template` for structured JSON output instead of parsing stdout
- **Cookie handling**: Supports both Netscape format files and direct file paths
- **Windows builds**: Uses `CREATE_NO_WINDOW` flag (0x08000000) to hide console windows
- **Environment**: All yt-dlp commands set `PYTHONUTF8=1` and use `--ignore-config --color never`

## Key Architectural Notes
- Binaries (yt-dlp, Deno) downloaded to Tauri app data directory at runtime, not bundled
- Final output path retrieved via `--print-to-file after_move:filepath` to avoid Windows GBK encoding issues
- Shared types in `src/types/index.ts` mirror Rust structs in `src-tauri/src/commands/mod.rs`
- Deno is optional JS runtime for yt-dlp when installed (`--js-runtimes` flag)

## File Structure Notes
- Components use `<script setup>` SFCs
- Locales in `src/locales/` - UI is primarily in Chinese
- Styles use SCSS with global `main.scss` and transition-specific `transitions.scss`