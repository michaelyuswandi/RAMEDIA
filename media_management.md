# RAMEDIA Media Management Documentation

## Overview
RAMEDIA provides a professional-grade media management system designed for church environments. It supports images and videos with non-destructive editing, playback customization, and seamless integration into the presentation rundown.

## Media Library
The Media Library (accessible via the "Media" tab in the bottom panel) stores all imported assets.

### Features
- **Centralized Storage**: All media is managed and stored in `~/.ramedia/assets_media/` to ensure reliability.
- **Importing**: Supports drag-and-drop or file selection for `mp4`, `webm`, `mov`, `jpg`, `jpeg`, and `png`.
- **Automatic Thumbnails**: (New) Generates preview thumbnails for quick visual identification.
- **Cleanup Utility**: Identifies and removes orphaned files that are no longer referenced in the database to save disk space.
- **Library Interaction**:
  - Single click on a media item arms it into the **Preview Queue**.
  - Double click on a media item sends it directly to **Live**.
  - Media preview in the queue uses a dedicated large-format preview instead of a slide grid.

## Preview Queue Behavior
Media items behave differently from songs in the operator workspace:

- **Images**: Shown as a large still preview with the full asset emphasized.
- **Videos**: Shown as a large video preview with inline transport controls.
- **Video Controls in Queue**:
  - Play / pause button
  - Timeline scrubber
  - Volume slider

This follows the common media-preview pattern used by photo and video applications, where still images are presented edge-to-edge and videos expose immediate playback controls directly in the preview surface.

## Media Inspector (Editing)
Double-clicking any media item opens the **Media Inspector**. All edits are **non-destructive** (the original file remains untouched).

### Trimming (Videos)
- **In Point**: Set the start time for the clip.
- **Out Point**: Set the end time for the clip.
- *Logic*: The player will jump to the In point on start and react (loop/stop/hold) when reaching the Out point.

### Playback Behavior
- **Loop**: Restarts from the In point (or 0) infinitely.
- **Stop**: Pauses at the Out point and fades out.
- **Hold**: Pauses and stays on the last frame (useful for still-frame endings).

### Visual Configuration
- **Sizing Mode**: Choose between "Cover" (fill screen) or "Contain" (show entire frame).
- **Volume**: Individual volume control for video assets (stored in dB or percentage).

## Presentation Flow
Media items can be used in two ways:

1. **Standalone (Rundown)**: Drag a media item into the Schedule. It becomes a dedicated item in the rundown.
   - *Preview*: Showing the media item in the "Operator Queue" creates a single virtual slide representing the media.
   - *Live*: Pushing it live renders the media across the full output surface.
2. **Layer-based (Advanced Editor)**: Assign media to a specific layer within a Song Slide. Great for motion backgrounds or picture-in-picture.

## Rendering Pipeline
- **SlideRenderer**: The core rendering engine that handles both text layers and media layers.
- **LiveOutputSurface**: Provides the final output with transitions, black-out, and clear-text logic.
- **File Protocols**: Uses `file://` protocols for local media access, with automatic physical path resolution for background tasks.
