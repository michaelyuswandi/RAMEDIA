# RAMEDIA Phase 2: Screens / Outputs Foundation

## Purpose

Phase 2 is not a song-editing feature.

Phase 2 is a **screen and output management feature**.

The goal is to prepare RAMEDIA for:

- `Audience` output
- `Singer` screen
- `Worship Leader` screen
- `Confidence` screen

without polluting the song editor.

---

## Core Rule

`Song Editor` manages:

- song metadata
- master lyrics
- slide generation
- master preview

`Screens / Outputs` manages:

- output targets
- screen profiles
- assignment of profiles to outputs
- future stage / confidence layouts

This separation should remain strict.

---

## Mental Model

```txt
MASTER SONG
  -> master slides
  -> live state

SCREENS / OUTPUTS
  -> Output A = Audience
  -> Output B = Singer
  -> Output C = Worship Leader
  -> Output D = Confidence
```

The screen system consumes live content.
It does not own the song content.

---

## What Phase 2 Should Deliver

## 1. Dedicated Screens Panel

The `Screens` menu should open its own panel, not fallback to the library.

This panel becomes the home for:

- output window status
- connected display summary
- profile presets
- future routing controls

---

## 2. Screen Profiles

The first version should define profiles conceptually:

- `Audience`
- `Singer`
- `Worship Leader`
- `Confidence`

At this stage, these do not need full rendering differences yet.
They need to exist as product objects and UI choices.

---

## 3. Output Assignment Model

The app should eventually assign:

```txt
Physical Output -> Screen Profile
```

Examples:

```txt
Projector     -> Audience
Stage Left    -> Singer
Stage Center  -> Worship Leader
Confidence    -> Confidence
```

For Phase 2 foundation, the UI can still be simple:

- one real output window
- profile cards showing intended behavior
- one selected default profile

---

## Recommended UI Structure

Use the `Screens` tab in the lower panel area.

### Initial Layout

```txt
┌──────────────────────────────────────────────────────────────────────┐
│ Screens / Outputs                                                   │
├───────────────────────────────┬──────────────────────────────────────┤
│ Left                          │ Right                                │
│                               │                                      │
│ Output Status                 │ Screen Profiles                      │
│ - Output window open/closed   │ [Audience] [Singer] [WL] [Conf.]    │
│ - Fullscreen state            │                                      │
│ - Resolution                  │ Profile details                      │
│                               │ - intent                             │
│ Connected Displays            │ - what it shows                      │
│ - Primary display             │ - what it hides                      │
│ - Future external screens     │                                      │
│                               │ Future Routing                       │
│ Quick Actions                 │ - assign output to profile           │
│ - Open Output                 │ - add more screens later             │
│ - Fullscreen                  │                                      │
└───────────────────────────────┴──────────────────────────────────────┘
```

---

## Recommended Interaction Flow

### Current Phase 2 Flow

1. User opens `Screens`
2. User sees current output state
3. User sees available profiles
4. User selects default profile for the active output
5. Future versions can add more output targets

### Not in Phase 2

- no per-song multi-view editing here yet
- no advanced screen layout builder yet
- no multiple Electron output windows yet

Those belong to later phases.

---

## Profile Definitions

## Audience

Purpose:

- congregation-facing lyrics
- large type
- clean and cinematic
- minimal metadata

## Singer

Purpose:

- easier reading on stage
- cleaner contrast
- can later include simpler cues

## Worship Leader

Purpose:

- may later show cues / notes / upcoming section
- more informational than audience view

## Confidence

Purpose:

- technical or presenter support
- can later show upcoming content / timing / notes

---

## Data Direction

Phase 2 does not need the full final schema, but it should establish the concept of:

```ts
type ScreenProfileId =
  | 'audience'
  | 'singer'
  | 'worship-leader'
  | 'confidence';
```

Later phases can add:

- persistent screen profile storage
- output target storage
- routing assignments

---

## Phase 2 Deliverables

### UI

- dedicated `ScreensPanel`
- output state summary
- profile cards
- persisted selected default profile state

### Architecture

- `screen profile` concept exists in the app
- default profile storage exists in `app_settings`
- phase docs point multi-view to screens/output domain

### Not Yet

- advanced stage layout
- custom profile editor
- true multi-window routing
- per-song output overrides

---

## Recommendation

Build Phase 2 in this order:

1. dedicated `ScreensPanel`
2. output status block
3. screen profile cards
4. default selected profile state
5. future routing placeholders

This keeps the product direction clear and avoids turning the song editor into a control-room dashboard.
