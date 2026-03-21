# CONTINUE.md

## Project Overview
This project is a desktop application built with **Tauri** and **Vue 3** (TypeScript) for managing YouTube video downloads using **yt-dlp**. It features a multi-language UI, Pinia state management, and integrates with system-level tools for cross-platform compatibility.

### Key Technologies
- **Frontend**: Vue 3 (Composition API), Vite, TypeScript
- **Backend**: Tauri (Rust)
- **State Management**: Pinia
- **Internationalization**: Vue I18n
- **Build Tools**: Pnpm, ESLint, Prettier
- **Dependencies**: yt-dlp, Deno (optional JS runtime)

## Getting Started
### Prerequisites
- Node.js (>=16.0.0)
- Pnpm (>=7.0.0)
- Rust toolchain (for Tauri)
- Python (for yt-dlp, if needed)

### Installation
```bash
pnpm install
```

### Development
- **Frontend Only**: `pnpm dev` (Vite on port 15688)
- **Full App**: `pnpm tauri dev`
- **Build**: `pnpm build` (frontend) or `pnpm tauri build` (production bundle)

### Testing
- Lint: `pnpm lint:fix`
- Format: `pnpm format`
- Rust checks: `cd src-tauri && cargo check`

## Project Structure
```
src/
├── assets/        # Static assets
├── components/    # Reusable UI components
├── locales/       # Translation files
├── pages/         # Route-level components
├── router/        # Vue Router config
├── stores/        # Pinia stores (download, history, settings)
├── App.vue        # Root component
├── main.ts        # Entry point
src-tauri/         # Rust backend (commands, build)
screenshot/        # UI screenshots
.configs/          # ESLint, Prettier, Vite configs
```

## Development Workflow
### Conventions
- **Auto-imports**: Vue/VueUse composables are auto-imported (no explicit imports needed)
- **Path Alias**: `@` maps to `src/`
- **TypeScript**: Strict mode enabled
- **Commit Style**: Conventional Commits (enforced by Husky)

### Build System
- **Frontend**: Vite + Vue-TSC
- **Backend**: Tauri (Rust) with `src-tauri/src/commands` handling yt-dlp operations
- **Packaging**: Tauri produces platform-specific binaries

## Key Concepts
- **Tauri Commands**: Invoked via `invoke("command_name", args)` from frontend
- **Progress Tracking**: Structured JSON output via `--progress-template`
- **State Persistence**: Pinia stores auto-persisted to localStorage
- **Locale System**: JSON files in `src/locales/` with language codes as keys

## Common Tasks
### Adding a New Component
1. Create component in `src/components/`
2. Use `<script setup>` syntax
3. Export and import in parent component

### Configuring yt-dlp
- Modify command options in `src-tauri/src/commands/download.rs`
- Add new options to `src/types/index.ts` for type safety

### Building for Production
```bash
pnpm tauri build
```

## Troubleshooting
- **Tauri Issues**: Check `src-tauri/Cargo.toml` for dependencies
- **yt-dlp Errors**: Verify binary path in `src/stores/download.ts`
- **TypeScript Errors**: Ensure `tsconfig.json` includes all source files

## References
- [Tauri Documentation](https://tauri.app/docs/)
- [Vue 3 Guide](https://vuejs.org/guide/)
- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [Pinia Docs](https://pinia.vuejs.org/)
```