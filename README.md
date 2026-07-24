# RAMEDIA 🎵

> Modern Church Multimedia Presentation System

A next-generation worship presentation application designed for small to medium churches. Built with modern web technologies, RAMEDIA delivers professional-grade multimedia presentations with an intuitive, easy-to-use interface.

## ✨ Features

### Core Capabilities

- **Song Lyrics Display** - Beautiful typography with customizable styles
- **Bible Presentation** - Multiple translations with instant verse lookup
- **Media Backgrounds** - 4K video, images, and animated backgrounds
- **Layer System** - Professional compositing with multiple overlay layers
- **Multi-Output** - Support for multiple displays/projectors

### User Experience

- **Easy Song Import** - Paste lyrics, auto-detect verses with double-enter
- **Live Preview** - See exactly what will display before going live
- **Quick Edit** - Customize slides on-the-fly during service
- **Drag & Drop** - Intuitive media management

### Technical Excellence

- **4K Support** - Hardware-accelerated rendering
- **Cross-Platform** - Windows & macOS
- **Offline-First** - SQLite database, no internet required
- **Web-First Dev** - Easy debugging in browser

## 🏗️ Architecture

```
Controller Window          Output Window (4K)
┌─────────────────┐       ┌─────────────────┐
│  Preview Live   │  Sync │                 │
│  ┌─────┬─────┐  │ ────► │   STAGE VIEW    │
│  │Next │Live │  │  IPC  │   (Fullscreen)  │
│  └─────┴─────┘  │       │                 │
│  Library/Editor │       │   Layer Stack   │
└─────────────────┘       └─────────────────┘
```

## 🛠️ Tech Stack

| Component | Technology                   |
| --------- | ---------------------------- |
| Framework | Electron 28+                 |
| UI        | React 18 + TypeScript        |
| Styling   | Tailwind CSS + Framer Motion |
| Database  | SQLite (better-sqlite3)      |
| ORM       | Drizzle ORM                  |
| Video     | Native HTML5 Video           |
| Build     | Vite + electron-builder      |

## 📁 Project Structure

```
rumedia/
├── docs/              # Documentation
├── src/
│   ├── core/          # Shared business logic
│   ├── components/    # React components
│   ├── controller/    # Controller window
│   ├── output/        # Output/Stage window
│   ├── sync/          # Cross-window sync
│   └── platform/      # Platform-specific code
├── electron/          # Electron main process
└── public/            # Static assets
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- VS Code (recommended)
- macOS or Windows

### Development

```bash
# Install dependencies
npm install

# Start in web mode (recommended for development)
npm run dev

# Start in Electron mode
npm run electron:dev

# Build for production
npm run build
```

### Web Development Mode

Open two browser tabs:

- Controller: `http://localhost:5173/controller`
- Output: `http://localhost:5173/output`

## 📖 Documentation

- [Architecture](docs/architecture.md)
- [Features](docs/features.md)
- [Database Schema](docs/database-schema.md)
- [UI Concept](docs/ui-concept.md)

## 📄 License

MIT License - Created for the church community

---

**RAMEDIA** - Making worship presentation beautiful and effortless 🙏
