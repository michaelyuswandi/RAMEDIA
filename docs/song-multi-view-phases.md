# RAMEDIA Song Multi-View Phases

## Goal

Build the song system in a stable order so multi-view support grows from a solid editor and data model, not from temporary UI hacks.

This roadmap follows [song-multi-view-architecture.md](/Users/michaelsebastian/Documents/AMIN/RAMEDIA/docs/song-multi-view-architecture.md).

---

## Phase 1: Master Song Editor Foundation

### Objective

Stabilize `New Song / Edit Song` around one reliable master-song workflow.

### Scope

- make song editor fullscreen and fixed
- remove floating / draggable modal behavior
- unify editor save/load path through IPC + database
- make `Easy Mode` the stable primary workflow
- ensure editing lyrics updates slides in the database
- show a truthful state for advanced mode instead of pretending it is complete

### Result

After Phase 1:

- new song creation is reliable
- existing song editing is reliable
- one master song is the source of truth
- editor is ready to host view profiles later

---

## Phase 2: Screen Profile Foundation

### Objective

Move multi-view concerns into the future `Screens / Outputs` domain instead of the song editor.

### Scope

- define predefined output profiles:
  - `Audience`
  - `Singer`
  - `Worship Leader`
  - `Confidence`
- keep song editor focused on:
  - metadata
  - master lyrics
  - slide generation
  - one truthful master preview
- prepare the screen/output architecture so profiles can be assigned later
- keep profiles reusable and not hardcoded per song copy

### Result

After Phase 2:

- song editor stays clean
- multi-view is treated as an output concern, not an authoring concern
- the concept of `screen profile` becomes real in the architecture

---

## Phase 3: Advanced Editor Integration

### Objective

Reconnect the advanced visual editor to the real database workflow.

### Scope

- make advanced editor read/write real slide + layer data
- preserve data when switching between easy and advanced
- support layer editing as song-level composition, not isolated mock state
- ensure preview uses the same renderer logic as output

### Result

After Phase 3:

- advanced editing becomes production-capable
- slide layers become a reliable part of the song system

---

## Phase 4: Multi-Output Routing

### Objective

Drive multiple output windows from one shared live state.

### Scope

- support more than one output target
- assign one `screen profile` per output target
- keep one live song / slide state
- render each output using its assigned profile

### Result

After Phase 4:

- audience, singer, and confidence views can run together
- the operator still controls one master song flow

---

## Phase 5: Per-Song and Per-Slide Overrides

### Objective

Allow controlled exceptions without breaking the master-song model.

### Scope

- per-song view overrides
- per-slide cue overrides
- WL notes / next cue / section-specific hints
- optional chord visibility rules

### Result

After Phase 5:

- songs can adapt to special ministry needs
- overrides remain structured and manageable

---

## Implementation Rule

Always build in this order:

1. master content
2. rendering rules
3. output routing
4. overrides

Do not duplicate songs per screen.
