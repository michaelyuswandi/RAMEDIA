# RAMEDIA Preset Architecture

RAMEDIA exposes two reusable design systems. They intentionally have different responsibilities.

## 1. Content Themes

A Content Theme defines how content-bound slide layers look. It is classified by `contentType`:

- `song`: lyrics, song title, section label, author, copyright, CCLI, background
- `scripture`: verse text, reference, version, section title, background
- `presentation`: title, body, media, blank and other presentation variants
- `media`: media canvas plus optional caption and decorative overlays

The existing `templates` table remains the storage layer. Existing rows migrate to `song`. New columns are:

- `content_type`
- `variants_data`

`layers_data` remains the default variant for backwards compatibility. `variants_data` stores named variants without invalidating older song references.

The Content Theme editor exposes content-specific dynamic text roles:

- Song: song title, main lyrics and section label
- Scripture: verse text, reference and version
- Presentation: title and body
- Media: media canvas and caption

Changing the content type of a new theme initializes the matching canvas and role set. Static text remains available for decorative labels that must not be rebound at runtime.

## 2. Screen Layouts

A Screen Layout defines how one output is composed. The persisted `outputPresets` key remains readable for backwards compatibility, while the application model calls each entry a `ScreenLayoutPreset`.

A Screen Layout owns:

- purpose: audience, stage, confidence, broadcast or custom
- role and render mode
- content-theme rules for song, scripture, presentation and media
- widgets, widget geometry and widget style
- slide, black and clear transitions
- per-content presentation overrides
- output alerts

An output target owns only routing concerns such as target display/client/NDI, fullscreen, autostart and assigned Screen Layout ID. Runtime renderers resolve the assigned Screen Layout before drawing.

The same content-theme rules are editable both from the Screen Layout library editor and from Output Settings. This prevents layouts created from different entry points from having different capabilities.

## Content-theme policies

Each content type has one policy inside a Screen Layout:

- `follow`: preserve the theme or custom layers attached to the content
- `fallback`: use the selected Content Theme only when the content has no layers/theme
- `force`: rebuild the rendered content with the selected Content Theme

The rule stores the selected theme ID plus a name/layer snapshot. The ID is used by database-backed song generation; the snapshot makes preview, browser and remote renderers deterministic without additional database queries.

## Widget catalogue

The Screen Layout editor supports the complete planned runtime set:

- Slide canvas
- Current lyrics
- Next lyrics
- Previous lyrics
- Section label
- Notes
- Clock
- Timer
- Video countdown
- Show name
- Progress
- Logo
- Alert

Each widget owns x/y/width/height, label, font, scale, text color/alignment/shadow, background color/opacity and frame visibility.

## Built-in Screen Layouts

- Main Screen: rendered audience slide
- Worship Leader Foldback: current/next/previous lyrics, section, notes, clock, timer, show name, progress and video countdown
- Singer Confidence: current/next lyrics, section, clock, show name, progress and video countdown
- Minimal Lyrics: compact lyrics plus logo
- Stage Display Detailed: expanded stage information layout
- Broadcast Hybrid: slide canvas, lower-third lyrics, logo and alert
- NDI Lyrics Overlay — Fixed: transparent song-only lower third with a fixed 64 px font, two-line limit, and no slide canvas

`NDI Lyrics Overlay — Fixed` is designed for OBS camera composition. Assigning a transparent Screen Layout to an NDI output automatically enables alpha and uses the full Screen Layout renderer. The built-in preset emits no placeholder for non-song or empty slides, and fixed typography does not resize between lyric slides.

## Unified preset library

The main Library exposes both preset families under one `Presets` tab:

- Family filter: All Presets, Content Themes, or Screen Layouts
- Content Theme filter: Song, Scripture, Presentation, or Media
- Screen Layout filter: Audience, Stage, Confidence, Broadcast, or Custom

Content Themes remain draggable only when the theme type is Song, because dropping them on a song changes that song's theme. Screen Layouts are edited as reusable output compositions and are never draggable onto schedule content. Built-in Screen Layouts can be edited but not deleted; custom layouts can be deleted, and assigned outputs fall back to the default layout for their role.

Default Content Theme seeds are shared by desktop SQLite and browser storage so both runtimes start with the same library:

- Song — Center Worship
- Song — Broadcast Lower Third
- Scripture — Reading Focus
- Presentation — Sermon Title
- Media — Caption Bar

Stage and confidence compositions are intentionally seeded as Screen Layouts rather than Content Themes.

## Output settings boundary

Output Settings configures delivery only: output name, enabled/primary state, Screen Layout assignment, target technology, display or browser destination, window behavior, and technical NDI transport options.

Visual behavior is owned exclusively by the assigned Screen Layout. Output Settings does not edit or duplicate content-theme policies, widgets, composition, purpose, transitions, alerts, or per-content visual overrides. At runtime every output is resolved through `resolveEffectiveOutputChannel`, which overlays its assigned Screen Layout on the routing channel before rendering. Legacy NDI broadcast-lyrics composition is normalized to the selected Screen Layout pipeline; transparency, source name, resolution, and frame rate remain output-specific.

## Detached preset editor

On Electron desktop, creating or editing a preset opens a native editor window at `/preset-editor` instead of mounting the editor over the controller. The window:

- can be moved to another monitor, resized, maximized, or used beside the controller
- remembers its latest normal bounds and restores safely to an available display
- re-focuses the existing editor when the same preset is opened twice
- loads the latest preset data by ID instead of receiving a stale serialized copy
- notifies the controller after save so the Library, output settings, and preset-driven songs refresh
- uses the native window close control as the detached editor's only close affordance
- shows a native `Keep Editing / Discard Changes` dialog when the title-bar close control is used with unsaved changes

The Library opens the detached editor from both the Edit action and a direct double-click in grid, table, and visual-list views. Browser mode keeps the in-app modal as a fallback because it cannot create an Electron native window.

## Detached workspaces

The desktop application uses the same native-window behavior for other large editing workspaces:

- **Song Editor** opens one window per saved song and one shared draft window for **New Song**.
- **Settings** opens as a singleton window; opening it again focuses the existing window.
- Both report staged changes to Electron. The native title-bar close control shows `Keep Editing / Discard Changes` when changes have not been saved.
- Saving a song or applying settings notifies the controller so its library, rundown, output settings, and preset-driven content can refresh.
- Browser mode retains the existing in-app modal behavior as a fallback.

## Resolution order for songs

```text
Follow
custom slide layers -> song Content Theme -> built-in song style

Fallback
custom slide layers -> song Content Theme -> Screen Layout Content Theme -> built-in song style

Force
Screen Layout Content Theme -> built-in song style
```

## Compatibility

- Existing templates are treated as Song Content Themes.
- Existing `outputPresets` are sanitized into Screen Layouts.
- Existing output routing IDs and settings remain valid.
- Deprecated global/default song fields remain readable during migration but are no longer exposed as the main configuration model.
