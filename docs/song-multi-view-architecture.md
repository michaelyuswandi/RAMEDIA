# RAMEDIA Song Multi-View Architecture

## Purpose

RAMEDIA should support **one master song** that can be rendered into **multiple view styles** for different screens.

Example:

- `Audience / Projector` view
- `Singer / WL` view
- `Confidence / Stage` view

The key idea is:

> do not duplicate the song  
> do not maintain separate copies of the same lyrics  
> render the same master song differently per output target

---

## Why This Matters

For live worship operation, one song often needs more than one presentation style at the same time:

- congregation needs large cinematic lyrics
- singer / worship leader needs easier reading, cues, maybe next section
- stage display may need notes, section labels, or upcoming lines

If each output requires a separate song copy, the workflow becomes fragile:

- edits drift out of sync
- corrections must be repeated
- service prep becomes slow
- operator can easily load the wrong version

So the system should be:

```txt
1 Master Song
   -> many Slides
   -> many Layers
   -> many View Profiles
   -> many Outputs
```

---

## Core Principle

The architecture should separate **content**, **visual layers**, and **view rendering rules**.

### 1. Master Song

This is the source of truth:

- title
- author
- raw lyrics
- parsed sections
- slide order
- optional metadata like key, tempo, tags, default theme

The master song should not care whether it is shown to:

- congregation
- singer
- worship leader
- stage confidence monitor

It only contains canonical content.

### 2. Slide Layers

Each slide can already have layered visual content:

- `base`
- `background`
- `media`
- `overlay`
- `text`

This is good and should remain.

But fixed layers alone are not enough for multi-view output.

### 3. View Profiles

A `View Profile` defines **how the same slide should look for one target use case**.

Examples:

- `Audience`
- `Singer`
- `Worship Leader`
- `Confidence`

Each profile can control:

- which layers are visible
- text position
- font size / emphasis
- whether section labels are shown
- whether notes are shown
- whether next line / next section is shown
- whether chords are shown
- whether background media is used

### 4. Output Targets

An output target is a real destination:

- main projector
- stage monitor
- confidence screen
- side screen

Each output target should be assigned a view profile.

Example:

```txt
Main Projector   -> Audience View
Stage Left       -> Singer View
Center Monitor   -> Worship Leader View
```

---

## Proposed Mental Model

Use this stack:

```txt
Song Master
  -> Slides
    -> Layers
      -> View Profile Rules
        -> Output Window / Screen
```

Or visually:

```txt
┌──────────────────────────────┐
│ MASTER SONG                  │
│ title, author, raw lyrics    │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ CANONICAL SLIDES             │
│ V1, V2, Chorus, Bridge       │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ SLIDE LAYERS                 │
│ text / overlay / media / bg  │
└───────┬───────────┬──────────┘
        │           │
        v           v
┌──────────────┐  ┌──────────────┐
│ Audience     │  │ Singer/WL    │
│ View Profile │  │ View Profile │
└──────┬───────┘  └──────┬───────┘
       │                 │
       v                 v
┌──────────────┐  ┌──────────────┐
│ Projector    │  │ Stage Screen │
└──────────────┘  └──────────────┘
```

---

## Important Distinction

There are **two different concepts** that should not be mixed:

### A. Slide Layers

These define what visual ingredients exist on the slide.

Examples:

- text layer with lyrics
- background image
- overlay logo
- lower-third accent

### B. View Profiles

These define how a target output consumes those ingredients.

Examples:

- audience view uses large center lyrics + full background
- singer view hides decorative overlays and shows section label
- worship leader view shows lyrics smaller and adds cue metadata

So:

> layers are the assets  
> view profiles are the rules

This is the right model for multi-view.

---

## Example: Same Song, Different Views

Master slide content:

```txt
[VERSE 1]
Amazing grace how sweet the sound
That saved a wretch like me
```

### Audience View

- text centered
- large cinematic type
- background media visible
- no metadata
- no notes
- no next section

### Singer View

- text slightly higher or lower for easier reading
- stronger line spacing
- section label visible
- optional chord display
- optional next section cue
- less decorative background

### Worship Leader View

- current section label
- current lyrics
- next section / next line preview
- optional notes or arrangement cues
- optional time / service cue

Same song, same master content, different rendering.

---

## What The Current System Already Has

Based on current code and docs:

- songs table exists
- slides table exists
- `slide_layers` already exists
- output window already exists
- `SlideRenderer` already renders layers

This is a strong foundation.

Current reality:

- layer model already exists
- only one real output window is currently active
- no real `view profile` abstraction exists yet
- song editor is not yet fully aligned with the database / output pipeline

So multi-view should be built **on top of** the current layer system, not by replacing it.

---

## Recommended Architecture

## Level 1: Master Song Model

Keep one master song record:

```ts
interface SongMaster {
  id: string;
  title: string;
  author?: string | null;
  rawLyrics?: string | null;
  tags?: string[] | null;
  songKey?: string | null;
  defaultThemeId?: string | null;
}
```

Slides remain canonical:

```ts
interface MasterSlide {
  id: string;
  songId: string;
  orderIndex: number;
  sectionType?: string | null;
  sectionNumber?: number | null;
  content: string;
}
```

---

## Level 2: View Profiles

Add a reusable profile layer above slide rendering:

```ts
interface ViewProfile {
  id: string;
  name: string;
  type: 'audience' | 'singer' | 'worship-leader' | 'confidence' | 'custom';
  showSectionLabel: boolean;
  showNotes: boolean;
  showNextCue: boolean;
  showChords: boolean;
  backgroundMode: 'full' | 'dimmed' | 'hidden';
  textAnchor: 'top' | 'center' | 'bottom';
  textScale: number;
}
```

These should be reusable templates, not duplicated per song.

---

## Level 3: Per-View Overrides

Some songs may need view-specific adjustments.

Example:

- one song may need singer text lower
- another may need no background on stage screen
- one bridge may need cue notes only in WL view

So the system should allow optional overrides:

```ts
interface SlideViewOverride {
  slideId: string;
  viewProfileId: string;
  hiddenLayerTypes?: string[];
  textStyleOverride?: Record<string, unknown>;
  extraFields?: {
    notes?: string;
    nextCue?: string;
    chordLine?: string;
  };
}
```

Important:

- default behavior should come from the global profile
- per-song or per-slide overrides should be optional

This keeps the system manageable.

---

## Output Routing Model

At runtime, the presentation engine should not duplicate the song.

Instead, it should broadcast one live state:

```txt
Current Song: Amazing Grace
Current Slide: Verse 2
```

Then each output window renders that state through its assigned view profile.

Example:

```txt
Live State
  songId = song_001
  slideId = slide_004

Renderer A: Audience Profile
Renderer B: Singer Profile
Renderer C: Worship Leader Profile
```

This is the cleanest approach for sync.

---

## Editor Implications

The song editor should stay focused on **master song authoring**.

Multi-view should not be introduced as a crowded control set inside `New Song / Edit Song`.
That concern belongs to `Screens / Outputs / Stage Layouts`.

### Recommended Editor Structure

```txt
┌──────────────────────────────────────────────────────────────────────┐
│ Back | Song Editor                                  Save | Close    │
├──────────────────────────────────────────────────────────────────────┤
│ Metadata: Title | Author | Key | Tags | Theme                       │
├──────────────────────────────────────────────────────────────────────┤
│ Easy Mode | Advanced Mode                                            │
├───────────────────────────────┬──────────────────────────────────────┤
│ Content / Slide Tools         │ Master Preview                       │
└───────────────────────────────┴──────────────────────────────────────┘
```

### Editing Rules

- `Easy Mode` edits master lyrics and slide structure
- `Advanced Mode` edits slide layers
- song editor shows one truthful master preview
- screen-specific behavior should be configured later in the output/screen system

If a screen profile needs special behavior:

- configure it in `Screens / Outputs`
- keep master content shared

---

## Recommended Product Scope

To keep the product sane, use this order of responsibility:

### Global Profile

Defines the standard look of a view:

- singer view usually lower-third
- audience view usually center cinematic
- worship leader view usually cue-oriented

### Per-Song Override

Only used when a song needs something special:

- custom notes
- custom cue text
- custom text position for one specific song

### Per-Slide Override

Only used for exceptional cases:

- bridge notes
- one-off cue
- hide background on a specific slide

This prevents over-editing.

---

## Suggested Database Direction

Not for immediate implementation, but this is the likely structure:

### Existing

- `songs`
- `slides`
- `slide_layers`

### New

- `view_profiles`
- `output_targets`
- `output_target_assignments`
- `slide_view_overrides`

Possible shape:

```txt
songs
  -> slides
    -> slide_layers
    -> slide_view_overrides

view_profiles
  -> assigned to output_targets
```

---

## Minimal Viable Version

The first version does not need full complexity.

### MVP

1. Keep one master song
2. Keep current slide layers
3. Add predefined view profiles:
   - Audience
   - Singer
   - Worship Leader
4. Add view switcher in preview/editor
5. Add output assignment:
   - Output A -> Audience
   - Output B -> Singer
6. Same live slide index drives all outputs

This already unlocks real multi-view value.

---

## Example MVP Behavior

Operator loads one song.

```txt
Amazing Grace
```

System renders:

- `Audience View` on projector
- `Singer View` on stage monitor

When operator advances from Verse 1 to Chorus:

- both outputs advance together
- styling differs by profile
- content remains from the same master song

No duplication required.

---

## What Should Not Happen

Avoid these anti-patterns:

### 1. Duplicate Song Per Screen

Bad:

- `Amazing Grace - Audience`
- `Amazing Grace - Singer`
- `Amazing Grace - WL`

This will become unmaintainable.

### 2. Mix Output Routing Into Song Content

The song should not store hardcoded monitor identities.

Bad example:

- slide content directly tied to `Monitor 2`

Routing should remain separate from content.

### 3. Overload Layer System Alone

Layers solve composition, but not output intent.

Trying to do multi-view only by adding more layers will become messy.

You still need the `view profile` abstraction.

---

## Recommended Implementation Order

### Phase 1

- make song editor fullscreen and stable
- unify editor save/load path with database / IPC
- make easy mode solid

### Phase 2

- add `View Profile` concept in the editor preview
- support `Audience`, `Singer`, `Worship Leader`
- no extra output yet, preview only

### Phase 3

- add multiple output targets
- assign each output a view profile
- same live state renders to multiple windows

### Phase 4

- add per-song overrides
- add per-slide cue overrides
- add WL-specific helpers such as next cue and notes

---

## Recommendation

Yes, RAMEDIA should support this.

The right direction is:

> one master song  
> one canonical set of slides  
> one shared live state  
> multiple view profiles  
> multiple outputs

This is cleaner for:

- editing
- operations
- synchronization
- future stage display support

It also matches how worship presentation software should behave in real service conditions.

---

## Immediate Next Step

Before implementing multi-view output, the product should first stabilize:

1. fullscreen song editor
2. unified save/load path for songs
3. proper easy / advanced editor structure

After that, add:

4. screen profile management in `Screens / Outputs`

That is the correct foundation for multi-view.
