# RAMEDIA Architecture

## Overview

RAMEDIA uses a modern, web-first architecture that enables development in browser while maintaining native desktop capabilities through Electron.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          RAMEDIA SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     PRESENTATION LAYER                          │    │
│  │  ┌─────────────────────┐    ┌─────────────────────────────┐    │    │
│  │  │   Controller App    │    │      Output App             │    │    │
│  │  │                     │    │                             │    │    │
│  │  │  • Library Panel    │    │  ┌─────────────────────┐   │    │    │
│  │  │  • Preview Panel    │    │  │    Layer Stack      │   │    │    │
│  │  │  • Live Panel       │    │  │  ┌───────────────┐  │   │    │    │
│  │  │  • Schedule Panel   │    │  │  │ Text Layer    │  │   │    │    │
│  │  │  • Editor Modal     │    │  │  ├───────────────┤  │   │    │    │
│  │  │                     │    │  │  │ Overlay Layer │  │   │    │    │
│  │  └──────────┬──────────┘    │  │  ├───────────────┤  │   │    │    │
│  │             │               │  │  │ Media Layer   │  │   │    │    │
│  │             │               │  │  ├───────────────┤  │   │    │    │
│  │             └───────────────┼──┤  │ Background    │  │   │    │    │
│  │                   Sync      │  │  └───────────────┘  │   │    │    │
│  │                             │  └─────────────────────┘   │    │    │
│  │                             └─────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      BUSINESS LAYER                             │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │    │
│  │  │ Song Service│  │Bible Service│  │  Presentation Service   │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │    │
│  │  │Media Service│  │Theme Service│  │   Schedule Service      │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       DATA LAYER                                │    │
│  │  ┌───────────────────────────────────────────────────────────┐ │    │
│  │  │                    SQLite Database                         │ │    │
│  │  │  songs | slides | media | themes | schedules | settings   │ │    │
│  │  └───────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Multi-Window Architecture

### Controller Window

The main interface for the operator, containing:

- **Library Panel** - Songs, media, presentations
- **Preview Panel** - Shows next slide before going live
- **Live Panel** - Current display with controls
- **Schedule Panel** - Service rundown
- **Editor** - Song and slide editing

### Output Window

Fullscreen display for projection:

- **Layer Stack Renderer** - Composites all layers
- **Transition Engine** - Smooth animations
- **4K Optimized** - Hardware-accelerated rendering

## Layer System

```
┌─────────────────────────────────────────────────┐
│              OUTPUT COMPOSITION                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  Layer 4: TEXT CONTENT         (z-index: 400)   │
│  ├── Lyrics text                                │
│  ├── Scripture text                             │
│  └── Custom text overlays                       │
│                                                  │
│  Layer 3: OVERLAYS             (z-index: 300)   │
│  ├── Lower thirds                               │
│  ├── Logos/watermarks                           │
│  └── Countdown timers                           │
│                                                  │
│  Layer 2: MEDIA CONTENT        (z-index: 200)   │
│  ├── Images                                     │
│  ├── Videos                                     │
│  └── PDF slides                                 │
│                                                  │
│  Layer 1: BACKGROUND           (z-index: 100)   │
│  ├── Solid colors                               │
│  ├── Gradients                                  │
│  ├── Background videos (loops)                  │
│  └── Background images                          │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Sync Mechanism

### Web Mode (Development)

```typescript
// Uses BroadcastChannel API
const channel = new BroadcastChannel("rumedia-sync");

// Controller sends
channel.postMessage({ type: "GO_LIVE", payload: slideData });

// Output receives
channel.onmessage = (e) => handleSync(e.data);
```

### Electron Mode (Production)

```typescript
// Uses IPC (Inter-Process Communication)
// Main process bridges windows
ipcMain.on("sync", (event, data) => {
  outputWindow.webContents.send("sync", data);
});
```

### Abstraction Layer

```typescript
// src/sync/index.ts
export interface SyncProvider {
  broadcast(event: string, data: any): void;
  subscribe(event: string, handler: Function): void;
}

// Auto-detect environment
export const sync: SyncProvider = isElectron
  ? new ElectronSync()
  : new WebSync();
```

## State Management

Using Zustand for lightweight, performant state:

```typescript
// Presentation Store
interface PresentationState {
  currentSlide: Slide | null;
  nextSlide: Slide | null;
  layers: LayerState[];
  schedule: ScheduleItem[];

  // Actions
  goLive: (slide: Slide) => void;
  updateLayer: (id: string, props: LayerProps) => void;
  clearAll: () => void;
}
```

## Performance Optimizations

### Video Rendering

- Hardware acceleration enabled
- Video preloading for smooth transitions
- Background throttling disabled for output window

### Memory Management

- Lazy loading of media assets
- LRU cache for frequently used media
- Cleanup of unused resources

### Rendering

- CSS transforms for GPU compositing
- will-change hints for animated elements
- RequestAnimationFrame for smooth animations

## Development Workflow

```
┌────────────────────────────────────────────────────────┐
│                 DEVELOPMENT FLOW                        │
├────────────────────────────────────────────────────────┤
│                                                         │
│  WEB MODE (npm run dev)                                │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Vite Dev Server (:5173)                        │  │
│  │  ├── /controller  →  Controller App             │  │
│  │  └── /output      →  Output App                 │  │
│  │                                                  │  │
│  │  Benefits:                                       │  │
│  │  • Hot Module Replacement                        │  │
│  │  • Chrome DevTools                               │  │
│  │  • React DevTools                                │  │
│  │  • Fast iteration                                │  │
│  └─────────────────────────────────────────────────┘  │
│                          ↓                             │
│  ELECTRON MODE (npm run electron:dev)                  │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Electron + Vite                                │  │
│  │  ├── Main Process (Node.js)                     │  │
│  │  ├── Controller Window                          │  │
│  │  └── Output Window                              │  │
│  │                                                  │  │
│  │  Benefits:                                       │  │
│  │  • Native file system                            │  │
│  │  • True multi-monitor                            │  │
│  │  • System integration                            │  │
│  └─────────────────────────────────────────────────┘  │
│                          ↓                             │
│  PRODUCTION (npm run build)                            │
│  ┌─────────────────────────────────────────────────┐  │
│  │  electron-builder                               │  │
│  │  ├── rumedia-setup.exe (Windows)                │  │
│  │  └── rumedia.dmg (macOS)                        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└────────────────────────────────────────────────────────┘
```
