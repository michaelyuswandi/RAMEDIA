# RAMEDIA UI Concept

## Core Direction

RAMEDIA should feel like a **modern broadcast console for live worship**, not a generic admin dashboard.

The interface needs to communicate three things immediately:

1. What is live right now
2. What will go live next
3. What the operator can change in one fast action

The design language should feel:

- precise
- premium
- calm under pressure
- fast in motion
- low-distraction during service

## Visual Identity

### Look and Feel

- Base mood: charcoal / graphite control surface
- Accent: warm signal amber for critical actions and active live state
- Secondary accent: cool cyan for preview, informational states, and sync/status
- Error/destructive: hard red with high clarity
- Surfaces: layered dark panels with subtle light edges, not heavy glassmorphism
- Depth: controlled shadows and panel separation, not floating cards everywhere

### Color Palette

```txt
Background:   #080C12
Surface:      #111720
Raised:       #18212D
Border:       rgba(255,255,255,0.08)

Primary:      #F59E0B   (signal amber)
Info:         #58D5F7   (preview cyan)
Success:      #10B981   (valid / safe)
Warning:      #F59E0B   (caution)
Error:        #EF4444   (blackout / destructive)

Text:         #F4F7FB
Text Muted:   #94A3B8
Text Faint:   rgba(244,247,251,0.45)
```

### Typography

- UI font: `Manrope`
- Utility / timing / shortcuts: `JetBrains Mono`
- Output lyrics: configurable per theme, but preview UI should remain editorial and clean

Use stronger hierarchy than the previous concept:

- labels: tiny, uppercase, spaced
- section titles: bold and compact
- primary actions: high contrast and very obvious

## Layout Principles

### 1. Preview and Live are the anchors

The operator must identify `Preview` and `Live` faster than any library or editor element.

- Live monitor should be visually dominant
- Preview should feel one step behind live, never equal in emphasis
- Both must preserve the output aspect ratio consistently

### 2. Library should feel like an asset browser

Do not style the lower library like a CRUD table.

- large search
- category toggles
- strong card rhythm
- easy drag-to-schedule and drag-to-preview behavior

### 3. Schedule should feel like a rundown

The schedule is not just a list. It is a timed execution rail.

- clear current item state
- visible sequence rhythm
- compact duration and type chips
- easy reorder behavior

### 4. Critical controls should feel hardware-like

`GO LIVE`, `BLACK`, and `CLEAR` should feel like control-surface actions.

- larger hit areas
- stronger contrast
- faster interaction feedback
- immediate pressed state

## Motion System

Motion should be **fast, deliberate, and operational**.

Avoid floaty SaaS motion. Avoid long fade-ins.

### Motion Timing

- hover response: `120ms - 140ms`
- panel/action transitions: `160ms - 180ms`
- emphasis transitions: `200ms - 220ms`
- output transition default: `180ms - 240ms`

### Motion Rules

- hover: slight border shift, slight brightness lift
- press: quick compression, no bounce
- panel transitions: short and clean
- status pulses: subtle and purposeful
- live switch: fade or soft zoom only

### Do Not Use

- slow modal drift
- exaggerated spring motion
- decorative stagger everywhere
- long blur-heavy transitions

## Controller Window

### Layout

```txt
┌─────────────────────────────────────────────────────────────────────┐
│ Rundown        Preview Workspace                     Live Output    │
│ rail           asset + slides                        on-air state   │
├─────────────────────────────────────────────────────────────────────┤
│ Library / Songs / Media / Bible / Search / Quick Add               │
└─────────────────────────────────────────────────────────────────────┘
```

### Panel Styling

- dark panel shells with subtle top highlight
- thin borders
- mild inner glow only for active/live states
- rounded corners should be restrained, not playful

### Status Labels

Use small chips with strong semantics:

- `ON AIR`
- `PREVIEW`
- `CLEARED`
- `BLACKOUT`
- `SYNC`

These should read like control-room labels, not product tags.

## Output Window

The audience-facing output should remain cinematic and simple.

- prioritize readable text over UI styling
- transitions should be smooth but fast
- overlays should be minimal and themeable
- no decorative chrome from operator UI should leak into the output

## Stitch / Figma Prompt Guidance

When generating mocks, instruct the model/designer with these constraints:

- design a premium dark broadcast control interface for church presentation software
- avoid startup dashboard patterns
- use charcoal surfaces, amber live accents, cyan preview accents
- keep preview and live monitors dominant
- make schedule feel like a timed rundown
- make controls feel like hardware buttons
- use fast motion language, not soft floating motion

## Anti-Patterns

Do not revert to:

- purple-on-navy template aesthetics
- oversized glass cards
- generic rounded dashboard widgets
- pastel gradients as the main look
- slow motion or heavy easing
