---
name: rumedia-project
description: Use when working in the RUMEDIA codebase to orient quickly, trace features across React, Electron IPC, Zustand stores, and SQLite services, and avoid assuming that aspirational docs match the current implementation.
---

# RUMEDIA Project Skill

Use this skill when the task is inside the RUMEDIA workspace.

## Quick orientation

- Stack: Electron + React + TypeScript + Vite.
- UI routes live in `src/App.tsx` with `/controller` and `/output`.
- Electron entry points are `src/electron/main.ts` and `src/electron/preload.ts`.
- Shared app state uses Zustand in `src/core/stores/`.
- Local persistence uses `better-sqlite3` + Drizzle schema in `src/electron/database/`.
- Product and architecture docs are in `docs/`, but verify against current code before relying on them.

## First files to inspect

Read these first unless the request is already narrowly scoped:

1. `package.json`
2. `src/App.tsx`
3. `src/views/ControllerView.tsx`
4. `src/views/OutputView.tsx`
5. `src/electron/main.ts`
6. `src/electron/preload.ts`

Then branch based on the task:

- Presentation/live output: `src/core/stores/usePresentationStore.ts`, `src/core/sync/index.ts`
- Songs: `src/components/controller/LibraryPanel.tsx`, `src/core/services/ipcSongService.ts`, `src/electron/database/songService.ts`
- Schedule: `src/core/stores/useScheduleStore.ts`, `src/electron/database/scheduleService.ts`
- Themes/media: `src/core/services/ipcThemeService.ts`, `src/core/services/ipcMediaService.ts`, `src/electron/database/themeService.ts`, `src/electron/database/mediaService.ts`
- Data model: `src/electron/database/schema.ts`

## Working rules for this codebase

- Do not trust documentation alone. This repo contains aspirational docs and partially implemented features.
- Distinguish web-mode behavior from Electron behavior before changing service code.
- Check whether a component is using live data or mock data before wiring new behavior.
- Prefer following existing store and IPC patterns rather than introducing a new data flow.
- When touching persistence, inspect both the Drizzle schema and the raw SQL initialization in `src/electron/database/index.ts`.

## Known implementation realities

- `src/core/sync/index.ts` uses `BroadcastChannel` in web mode, but Electron sync is still stubbed.
- Some UI is real and database-backed, while some areas still use placeholders or mock values.
- `ipcSongService` has a web fallback using `localStorage`; Electron uses `window.api`.
- Built output exists in `dist/` and `dist-electron/`; avoid editing generated files.

## Default approach

1. Confirm whether the task is web-only, Electron-only, or shared.
2. Trace the request from component to store/service to database or IPC.
3. Change the smallest layer that resolves the issue cleanly.
4. Verify behavior with the nearest available command, test, or manual trace.

## Files to ignore unless needed

- `dist/`
- `dist-electron/`
- `node_modules/`
- `refrensi/` unless the task explicitly asks to compare or reuse it
