---
name: rumedia-electron-layout
description: Use when debugging or implementing RUMEDIA panel sizing, drag resizing, visibility toggles, or layout behavior that must work reliably in Electron and not just in browser assumptions.
---

# RUMEDIA Electron Layout Skill

Use this skill when a layout issue is tied to runtime behavior, resizing, panel measurement, or Electron-specific rendering.

## Focus areas

- Panel height/width bugs
- Resizable split areas
- Elements disappearing because of flex, grid, aspect ratio, or measured size
- Behavior that differs between browser-style assumptions and Electron runtime
- Controller window layout stability after hide/show or drag interactions

## First files to inspect

1. `src/views/ControllerView.tsx`
2. `src/components/controller/RightPanel.tsx`
3. `src/components/controller/CenterPanel.tsx`
4. `src/hooks/useElementSize.ts`
5. `src/components/common/LiveOutputSurface.tsx`
6. `src/electron/main.ts`
7. `src/electron/preload.ts`

## Working rules

- Prefer deterministic layout primitives over clever nested resizers.
- If something disappears, inspect parent height and min-height before blaming the child.
- Be careful with nested `react-resizable-panels`; confirm that each wrapper has a real height.
- For drag resizing, favor the simplest structure that clearly owns the measured dimension.
- Place show/hide controls inside the panel they affect whenever possible.
- Verify Electron behavior after build/run, not only from code inspection.

## Debug order

1. Confirm which element owns height or width.
2. Check `min-h-0`, `flex-1`, `shrink-0`, and explicit grid/flex row sizing.
3. Check whether `useElementSize` is measuring the expected node.
4. Check whether aspect-ratio logic depends on a zero-height or zero-width parent.
5. Only then change the resize interaction itself.

## Preferred patterns

- For simple vertical splits: explicit CSS grid rows plus a drag handle that updates one row height.
- For simple horizontal hide/show: conditionally render the panel and keep the controlling button near the affected boundary.
- For live monitor scaling: compute the display box from the measured container, not from assumptions.

## Anti-patterns

- Adding overlay buttons that cover status chips
- Deeply nesting resizable systems just to get one splitter
- Using percentage sizing without confirming the parent has stable dimensions
- Mixing large interaction changes and layout engine changes in the same edit unless required

## Validation checklist

- Does the panel still render correctly after hide/show?
- Does drag resizing visibly change layout in Electron, not only in theory?
- Does the live monitor remain visible while resizing?
- Are controls still reachable after the layout change?

