---
name: rumedia-design-ui
description: Use when refining the RUMEDIA controller and operator UX, especially panel hierarchy, preview/live emphasis, hide-show behavior, density, and fast interaction design for live service operation.
---

# RUMEDIA Design UI Skill

Use this skill when the task is primarily about controller-window usability and layout decisions.

## Focus areas

- Operator speed under pressure
- Visual hierarchy between `schedule`, `workspace`, and `live`
- Whether a panel should be primary, secondary, hidden by default, or collapsible
- Interaction rules such as single click, double click, preview, and push/live actions
- Avoiding decorative UI that makes live operation slower

## Default design rules

- `Live` must stay visually dominant.
- `Preview` is optional and should earn its space.
- `Schedule` should read as a rundown rail, not a generic list.
- Any control used during service should be obvious, fast, and low-friction.
- If a panel is not needed all the time, prefer `hide/show`, drawer, or compact status over a permanent large column.

## First files to inspect

1. `src/views/ControllerView.tsx`
2. `src/components/controller/CenterPanel.tsx`
3. `src/components/controller/RightPanel.tsx`
4. `src/components/controller/SchedulePanel.tsx`
5. `src/components/controller/LibraryPanel.tsx`
6. `docs/ui-concept.md`

## Working method

1. Identify the real operator workflow first, not the aspirational layout.
2. Check whether the current UI supports that workflow with the fewest gestures.
3. Prefer moving secondary features out of the main scan path instead of shrinking everything equally.
4. Preserve existing content and controls unless the task explicitly removes them.
5. When proposing layout changes, describe the mental model in plain terms:
   `what is live`, `what is armed`, `what comes next`.

## Anti-patterns

- Giving equal emphasis to `preview` and `live`
- Hiding critical actions behind non-obvious gestures
- Adding overlay buttons that block important status labels
- Making resizable panels without checking whether the resulting proportions still make operational sense
- Changing interaction rules and layout hierarchy in the same patch unless necessary

## Validation checklist

- Can the operator identify `live` in under a second?
- Is the default layout still usable with `preview` closed?
- Are hide/show controls placed near the panel they affect?
- Does the UI reduce clicks instead of adding configuration burden?

