# RAMEDIA Google Stitch Design Brief

Use this file as the single source of truth when generating the GUI in Google Stitch.

The goal is to generate a **modern broadcast-style control interface** for a church multimedia presentation app, not a generic SaaS dashboard.

---

## 1. Product Context

**Product name:** RAMEDIA

**What it does:**  
A worship presentation and multimedia control app for churches. The operator manages songs, schedule, media, preview, and live output during a service.

**Main app modes:**

- `Controller View`: operator workspace
- `Output View`: audience/projector screen

**Primary user:**

- Church multimedia operator
- Needs fast visual scanning
- Works under time pressure during live service

**Main UX goal:**  
The operator must understand in seconds:

1. what is currently live
2. what is queued in preview
3. what comes next in the service schedule
4. what action to take next

---

## 2. Design Direction

Design this like a **premium broadcast control console**.

Do **not** make it look like:

- a startup analytics dashboard
- a generic admin panel
- a soft glassmorphism UI
- a purple neon template

The interface should feel:

- modern
- precise
- premium
- calm
- fast
- operational

Keywords:

- broadcast console
- live production
- control surface
- worship media software
- dark cinematic operator UI

---

## 3. Visual Style

### Color Palette

Use this direction:

- Background: very dark charcoal `#080C12`
- Surface: layered dark graphite `#111720`
- Raised panel: `#18212D`
- Primary accent: signal amber `#F59E0B`
- Secondary accent: cool cyan `#58D5F7`
- Success: emerald `#10B981`
- Error / blackout: red `#EF4444`
- Main text: `#F4F7FB`
- Muted text: `#94A3B8`

### Styling Rules

- dark UI by default
- thin borders
- subtle top-light on panels
- restrained rounded corners
- minimal gradients, only for depth and atmosphere
- very small amount of glow on live/active states

### Typography

Use this typographic direction:

- UI font: `Manrope` or a similar modern geometric grotesk
- Technical labels / timers / shortcuts: `JetBrains Mono`
- Clear hierarchy with compact uppercase labels and bold section titles

---

## 4. Motion Direction

The UI must feel **fast**.

Use:

- hover feedback: `120ms - 140ms`
- panel transitions: `160ms - 180ms`
- emphasis transitions: `200ms - 220ms`

Motion rules:

- quick, clean, deliberate
- no floaty dashboard animation
- no slow modal drift
- no oversized spring motion
- buttons should feel tactile and immediate
- live state changes may use subtle pulse or glow, but only when meaningful

---

## 5. Main Screen to Generate

Generate the **Controller View** as the primary screen.

This is the most important UI in the product.

### Main layout

Create a wide desktop application layout with:

1. `Left column`: service rundown / schedule rail
2. `Center main area`: preview monitor and slide workspace
3. `Right column`: live monitor and immediate live controls
4. `Bottom area`: library / asset browser for songs, media, bible content

The layout should feel like a professional live operation console.

---

## 6. Controller View Structure

### A. Schedule Panel

Purpose: show service order and next items

Needs:

- current schedule name
- clock/time
- total duration / estimated end time
- vertical list of rundown items
- each item shows:
  - type badge
  - title
  - duration
  - current / selected state

Design notes:

- should feel like a production rundown, not a to-do list
- selected/current item should be obvious
- cards compact but readable

### B. Preview Workspace

Purpose: review slides before pushing live

Needs:

- a large `Preview` monitor
- output aspect ratio preserved
- preview slide shown clearly
- a strong `Push to Live` or `Go Live` action near preview
- below it, a grid or strip of song slides
- slide cards should show labels like `Verse 1`, `Chorus`, etc.

Design notes:

- preview area should feel focused and controlled
- selected preview slide should use cyan/info accent
- preview must be visually distinct from live

### C. Live Panel

Purpose: monitor what the audience currently sees

Needs:

- large `Live` or `On Air` header
- live monitor with stage/output frame
- current slide content visible
- state overlays like:
  - `ON AIR`
  - `BLACKOUT`
  - `CLEARED`
- live context list:
  - previous
  - current
  - next
- control buttons:
  - `Go Live`
  - `Previous`
  - `Next`
  - `Black`
  - `Clear`

Design notes:

- live panel should feel slightly more intense than preview
- live accent should use amber or red intelligently
- controls should feel like hardware buttons on a control desk

### D. Library Panel

Purpose: browse and load songs/media

Needs:

- segmented tabs like:
  - Songs
  - Media
  - Bible
- strong search bar
- asset cards / list items
- quick add button
- drag-and-drop friendly visual language

Design notes:

- this should feel like an asset browser, not a spreadsheet
- cards should be clean and modern

---

## 7. Output View to Generate as Secondary Screen

Also generate a secondary screen for `Output View`.

Purpose:

- audience-facing projected output

Needs:

- cinematic full-screen presentation
- large readable lyrics
- minimal chrome
- background media support feeling
- optional lower-third/logo space

Design notes:

- must feel clean, elegant, readable
- do not leak controller UI styling into output screen
- this screen is for the congregation, not the operator

---

## 8. Interaction Style

The operator should feel in control at all times.

Important interactions to support visually:

- single click to select preview
- double click or primary CTA to push live
- drag song into schedule
- reorder schedule items
- open song editor
- search assets quickly
- switch between songs/media/bible instantly

---

## 9. Component Style Guidance

### Buttons

- primary actions should be high contrast and obvious
- destructive actions should be red but controlled
- default controls should feel tactile

### Panels

- use layered dark surfaces
- slight inner highlight is okay
- avoid overdecorating

### Status Chips

Use compact uppercase chips for:

- Preview
- On Air
- Live
- Cleared
- Blackout
- Sync

### Cards

- compact
- structured
- bold headings
- muted metadata
- strong selected state

---

## 10. Layout and Responsiveness

Assume desktop-first.

Recommended working size:

- controller: `1440x900` or `1600x1000`

Design for resizable panels, but prioritize the desktop operator layout first.

Do not optimize for a generic mobile dashboard.

---

## 11. What to Avoid

Avoid these patterns:

- purple + blue AI-template gradients
- oversized glass cards
- generic SaaS dashboard widgets
- soft pastel UI
- playful consumer-app tone
- huge corner radius everywhere
- slow decorative motion

---

## 12. Ready-to-Paste Prompt for Google Stitch

Use the prompt below in Google Stitch:

```text
Design a modern desktop GUI for a church multimedia presentation app called RAMEDIA.

This app is used by a live operator during worship services to control songs, schedule, preview slides, and live output to the projector.

The design should feel like a premium broadcast control console, not a generic SaaS dashboard.

Use a dark cinematic interface with charcoal and graphite surfaces. Use signal amber for primary live actions, cool cyan for preview and informational states, emerald for success, and red for blackout/destructive actions.

The main screen is the Controller View with this layout:
- left column: service schedule / rundown rail
- center area: preview monitor and slide workspace
- right column: live monitor and live controls
- bottom area: library / asset browser for songs, media, and bible content

The schedule panel should feel like a production rundown, with item type badges, durations, selected state, and current item emphasis.

The preview workspace should contain a large preview monitor with a preserved output aspect ratio, clear selected slide state, and a strong Push to Live action. Below it, show a slide grid with verse and chorus cards.

The live panel should feel slightly more intense than preview. Include an On Air label, a live monitor, live context for previous/current/next slides, and tactile control buttons for Go Live, Previous, Next, Black, and Clear.

The bottom library should feel like an asset browser, with tabs for Songs, Media, and Bible, a large search field, clean asset cards, and drag-and-drop friendly presentation.

Typography should feel editorial and precise. Use a font direction like Manrope for UI and JetBrains Mono for timing and technical labels.

Motion should feel fast and operational:
- hover feedback around 120ms to 140ms
- panel transitions around 160ms to 180ms
- emphasis transitions around 200ms to 220ms
- avoid floaty dashboard motion and avoid heavy glassmorphism

Also generate a secondary Output View screen for the audience display:
- cinematic full-screen lyrics presentation
- minimal UI chrome
- elegant readable text
- background media support
- optional lower third or logo area

Do not use generic startup dashboard patterns, purple neon aesthetics, oversized glass cards, or playful consumer app styling.
```

---

## 13. Expected Deliverables from Stitch

Ask Stitch to generate:

1. Controller View desktop screen
2. Output View presentation screen
3. Reusable component style direction for:
   - schedule item
   - slide card
   - live panel
   - library card
   - command button

