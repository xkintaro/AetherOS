# AetherOS

A desktop environment for the browser, built with Next.js 16, React, TypeScript and Zustand.

Local development only. Do not upload or deploy this project without an explicit user request.

The taskbar contains Start and four functional applications: Files, Text Editor, Terminal and Settings. Start opens the shared app/search panel above the taskbar, showing every app before a query is entered. Ctrl/Cmd+K opens the same panel. The desktop has no welcome window, promotional cards, duplicate search entry, or simulated network and volume controls.

Search results use one row per item. An empty query starts without a selection, so Enter does nothing until an item is selected. Up/Down moves through apps and files; Enter opens the highlighted result. Typing highlights the first match; clearing the query clears selection. Escape closes the panel and returns focus to Start.

## Development

Node.js 20.9 or newer is required.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Use `npm run check` for types, regression tests and formatting, and `npm run build` to verify the static export. Run `npm run format` after editing source files. Production builds export to `out/`; serve that directory with a local static server. `next start` is not supported with static exports, so this project has no `start` script. Remove `output: 'export'` from `next.config.ts` if adding server-side capabilities later.

## Working capabilities

- Draggable, resizable, minimizable and maximizable windows; two workspaces.
- Files and text editor share one root, `aether/`, containing `aether/desktop`, `aether/documents` and `aether/downloads`.
- File/folder creation, rename, drag-and-drop moves, Ctrl/Cmd+X/V, Trash and restore; explicit editor saves.
- The desktop shows real folder contents. Move items between the desktop and Files, into folders, onto sidebar locations, and onto breadcrumb ancestors. Desktop icon placement persists.
- Desktop, Documents and Downloads are fixed system folders: they cannot be moved, renamed or trashed. Upgrading restores previously moved system folders to `aether/` while preserving their contents.
- Minimal terminal with an `aether:\>` prompt. `help` reports development status; `clear` clears terminal output.
- Search apps/files with Ctrl/Cmd+K; Alt+backtick cycles windows; Ctrl+Alt+1/2 changes workspace.
- Dark and Light interface themes with independent preset/custom accent colors, a theme wallpaper, solid/custom backgrounds, local image wallpapers with fill/fit controls, notification center, local session persistence and JSON backup import/export.

## Architecture

`src/lib/filesystem.ts` owns paths, availability, move validation, backup validation and legacy-to-aether migration. IDs survive folder moves, so editors and descendants remain connected. Moves reject name collisions, cycles, unavailable targets and protected system-folder moves. Trash hides the entire subtree; restoring its parent restores the visible tree. `src/lib/terminal.ts` handles the help and clear commands; `src/lib/store.ts` owns the shared workspace actions. `src/lib/window-state.ts` defines the independent application/window model, `src/lib/session.ts` validates and migrates saved sessions, and `src/lib/storage.ts` handles storage-write failures. Saved data cannot override store actions. Filesystem lookups reuse an index per immutable file array; callers must replace arrays and changed entries instead of mutating them. Desktop and Files use shared drag/drop, file items and naming dialogs. Each application loads on demand and runs inside its own error boundary.

## Current boundaries

Desktop first. Files live in this browser's localStorage, which is quota-limited and not encrypted. Custom wallpaper images are validated and stored separately in IndexedDB (JPEG, PNG, WebP, AVIF or GIF, up to 20 MB). Theme, accent, background preferences and the selected image survive reloads. Changing the interface theme or accent does not replace a custom background. Legacy Sage, Dusk and Graphite sessions migrate to Dark with Green, Rose and Slate accents respectively. `src/app/theme.css` owns the semantic surface palette; `src/lib/theme.ts` validates and migrates preferences and derives readable accent text. Theme variables live on the document root so portaled menus follow the same theme. JSON backups contain workspace files; they do not include wallpaper images or appearance preferences. Clearing site data removes the workspace; export backups for important content. There is no account, cloud synchronization, native process execution, arbitrary website embedding or simulated CPU/battery telemetry. This initial implementation does not yet include filesystem copy, a full POSIX shell, or rich media applications. Saved files, appearance and window layouts persist; unsaved editor buffers and terminal output are session-only.

## Design system

The interface uses the MIT-licensed [Aether theme](https://github.com/xkintaro/aether) semantic tokens, vendored in `src/app/aether-tokens.css`, with Tailwind v4 mappings in `aether-tailwind.css`. License attribution is in `AETHER-LICENSE`. Desktop aliases live in `theme.css`. User accents use `--user-accent` so shadcn's `--accent` keeps its semantic meaning.

shadcn is configured in `components.json` (base-nova, Base UI). Reusable Button, Input and Textarea sources live in `src/components/ui`; Appearance uses Button and Input. Use these components for subsequent interface work.

The original design is preserved on GitHub under the `design-before-shadcn` tag.
