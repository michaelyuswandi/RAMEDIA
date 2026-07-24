# RAMEDIA Capture / Screen Share Module

## Purpose

The capture module lets the operator send a live external source to the RAMEDIA output window.

The first supported source is screen sharing from the controller machine. The same module should later support HDMI input through a capture card, camera input, and other live video devices.

This module belongs to `Screens / Outputs`, not to the song editor or media library. It is a temporary live source, not a stored media asset.

---

## Product Model

RAMEDIA should treat live capture as another live output source:

```txt
Live Output Source
  -> Slide / Song / Bible / Media
  -> Screen Capture
  -> HDMI Capture
  -> Camera Capture
```

Only one primary live source should own the audience output at a time. Existing controls still apply:

- `Black` hides all live output.
- `Clear` hides content from the output surface.
- `Stop Capture` returns output to the previous slide-ready state.
- Output window routing remains controlled by `Screens / Outputs`.

---

## Initial Scope

### Phase 1: Screen Share

Deliver a stable video-only screen share path:

- choose a screen or app window from the controller
- show it fullscreen on the output window
- preserve output aspect handling
- allow stop from the controller
- recover cleanly if the captured source ends
- show clear status in the `Screens / Outputs` panel

Audio sharing is intentionally not part of Phase 1. It can be added after video behavior is stable.

### Phase 2: HDMI / Capture Card Input

Support external inputs such as:

- HDMI capture card
- USB camera
- NDI/virtual camera, if exposed as a standard video input

This should reuse the same live capture state and output renderer. The only difference is source acquisition.

---

## Why This Is Not Media Library

Captured input is live and temporary:

- it should not create media records
- it should not be imported into SQLite
- it should not appear as a reusable library item by default
- it should not depend on schedule items

If recording is added later, that should be a separate feature: `Record Capture`.

---

## Recommended Architecture

```txt
Controller Window
  -> ScreensPanel
  -> asks Electron main for available sources
  -> selects source
  -> broadcasts CAPTURE_START

Electron Main Process
  -> desktopCapturer / media device access
  -> stores selected capture source
  -> grants display media requests
  -> forwards capture state snapshots to output windows

Output Window
  -> receives CAPTURE_START
  -> requests stream locally
  -> renders stream as fullscreen video
```

The output window should acquire the stream itself. The controller should not send raw video frames through IPC.

Reason:

- `MediaStream` is not a normal serializable IPC payload.
- sending frames manually through IPC would increase CPU use and latency
- Electron already supports granting a chosen display source to `getDisplayMedia`
- output-side capture keeps rendering smooth and closer to native browser behavior

---

## Electron Screen Capture Flow

For screen sharing, use Electron APIs:

- `desktopCapturer.getSources()` to list screens and windows
- `session.defaultSession.setDisplayMediaRequestHandler()` to grant the selected source
- `navigator.mediaDevices.getDisplayMedia()` inside the output renderer to receive the stream

Recommended flow:

1. Controller opens `Screens / Outputs`.
2. User clicks `Share Screen`.
3. Controller calls `window.api.capture.getScreenSources()`.
4. UI shows source names and thumbnails.
5. User selects one source.
6. Controller calls `window.api.capture.setActiveSource(sourceId)`.
7. Controller broadcasts `CAPTURE_START`.
8. Output receives `CAPTURE_START`.
9. Output calls `getDisplayMedia()`.
10. Electron main grants the selected source.
11. Output renders the stream.
12. When stopped, controller broadcasts `CAPTURE_STOP`.

---

## HDMI / Capture Card Flow

For HDMI input through a capture card, the OS usually exposes the device as a camera/video input. Use browser media device APIs:

- `navigator.mediaDevices.enumerateDevices()`
- `navigator.mediaDevices.getUserMedia()`

Recommended flow:

1. Controller opens `Screens / Outputs`.
2. User selects `Capture Input`.
3. Controller lists available `videoinput` devices.
4. User selects an HDMI capture card or camera.
5. Controller stores the selected device id through Electron IPC.
6. Controller broadcasts `CAPTURE_START` with source type `device`.
7. Output calls `getUserMedia()` with the selected device id.
8. Output renders the stream.

For some capture cards, audio may appear as a separate `audioinput` device. Add this only after video input is stable.

---

## State Shape

The live state should describe the capture intent, not the stream object.

```ts
type CaptureSourceType = 'screen' | 'window' | 'device';

interface LiveCaptureState {
  active: boolean;
  sourceType: CaptureSourceType | null;
  sourceId: string | null;
  sourceName: string | null;
  includeAudio: boolean;
  startedAt: string | null;
  error: string | null;
}
```

This can live inside `usePresentationStore` at first, because it affects output composition. If the feature grows, move it to a dedicated `useCaptureStore` while keeping output-facing state synchronized through the existing sync layer.

---

## Sync Events

Use the existing `STATE_UPDATE` channel first, so output snapshots keep working with the current architecture.

Recommended event types:

```txt
CAPTURE_START
CAPTURE_STOP
CAPTURE_ERROR
CAPTURE_SOURCE_CHANGED
```

Snapshot behavior must include capture state. If the output window opens while capture is active, it should immediately request and render the active source.

---

## Output Rendering Rules

Capture should be rendered by the output surface as a primary source:

```txt
if isBlack:
  render black
else if isClear:
  render cleared state
else if capture.active:
  render capture video
else:
  render current slide
```

The video should:

- fill the output surface
- default to `object-fit: contain` for safety
- optionally support `cover` later
- show a clear error state if permissions fail
- stop all tracks when capture ends

---

## Controller UI

The home for this feature should be `ScreensPanel`.

Recommended UI sections:

- Output window status
- Screen profiles
- Capture status
- Capture source picker
- Start / Stop capture action

Initial controls:

- `Share Screen`
- source list: screens and windows
- `Start`
- `Stop`
- active source label

Later controls:

- source type segmented control: `Screen`, `HDMI`, `Camera`
- device selector
- audio input selector
- fit mode: `Contain`, `Cover`
- low-latency toggle

---

## Safety Rules

Avoid capturing the output window or projector screen when possible.

The source picker should mark risky sources:

- the RAMEDIA output window
- the display currently assigned as audience output
- the controller window itself, if it creates confusing recursion

Do not block those choices completely in Phase 1, but show a warning if practical.

---

## macOS Permission Notes

On macOS, screen capture requires Screen Recording permission.

If permission is missing, the user may see:

- a black capture
- an empty source list
- a failed `getDisplayMedia()` request

The app should display a practical error message:

```txt
Screen capture permission is required. Enable Screen Recording for RAMEDIA in macOS System Settings, then restart the app.
```

For HDMI capture cards, camera permission may also be required.

---

## Implementation Files

Likely files to touch:

- `src/electron/main.ts`
- `src/electron/preload.ts`
- `src/vite-env.d.ts`
- `src/core/stores/usePresentationStore.ts`
- `src/views/OutputView.tsx`
- `src/components/common/LiveOutputSurface.tsx`
- `src/components/controller/ScreensPanel.tsx`

Optional new files:

- `src/core/stores/useCaptureStore.ts`
- `src/components/common/CaptureVideoSurface.tsx`
- `src/components/controller/CapturePanel.tsx`
- `src/core/models/capture.ts`

---

## Suggested Delivery Plan

### Milestone 1

- define capture state types
- add IPC for screen source listing
- add selected source storage in Electron main
- add `CAPTURE_START` / `CAPTURE_STOP` sync handling

### Milestone 2

- render output-side screen capture video
- add stop and cleanup behavior
- include capture state in output snapshot

### Milestone 3

- add source picker UI in `ScreensPanel`
- show capture status in controller
- handle permission and ended-track errors

### Milestone 4

- add `videoinput` device support for HDMI capture cards
- reuse the same output video surface
- add capture source type selector

### Milestone 5

- add audio capture options
- add fit mode options
- add warnings for recursive capture sources

---

## Open Decisions

- Should `Clear` hide capture, or only hide slide overlays? Current recommendation: hide capture for consistency.
- Should capture replace the current slide permanently, or overlay on top of it? Current recommendation: replace current slide while active.
- Should capture source selection be remembered across app sessions? Current recommendation: no for Phase 1.
- Should HDMI capture be selectable even when output window is closed? Current recommendation: yes, but starting capture should open or prompt for output.

