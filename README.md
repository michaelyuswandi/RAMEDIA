# RAMEDIA 🎵

> **Modern Church & Event Multimedia Presentation System**

RAMEDIA is a next-generation worship presentation software designed for churches, conferences, and event productions. Built with Electron, React, TypeScript, and Tailwind CSS, RAMEDIA delivers professional-grade multi-display presentations, online media streaming, Bible verse lookup, song preset management, and stage monitor controls with a sleek, ultra-responsive UI.

---

## ✨ Key Features

### 🎤 Song Lyrics & Multi-View Presets
- **Interactive Song Library**: Quick search, tag/favorite management, and playlist organization.
- **Easy Song Import & Parsing**: Supports direct import from EasyWorship databases/RTF files, as well as auto-detecting verse labels (Verse, Chorus, Bridge, Tag, Chorus 2, etc.) from plain text.
- **Song View Profiles**: Configure customized display presets tailored for Main Screen, Stage Display, or Online Live Streaming lower-thirds.
- **On-The-Fly Song Editor**: Interactive canvas editor for positioning, font styling, shadow effects, and background media pairing.

### 📖 Bible Presentation Engine
- **Multi-Translation Support**: Download and display offline Bible versions easily.
- **API & Cloud Integration**: Search and download translations directly via BibleBrain & cloud services.
- **Instant Verse Lookup**: Quick search by book, chapter, and verse with instant live preview.
- **Dual Display Modes**: Render verses as full-screen overlays or lower-thirds with customizable themes.

### 🎥 Media & Online Streaming
- **4K Video & Image Rendering**: Hardware-accelerated background playback with smooth crossfade transitions.
- **YouTube & Online Media Integration**: Stream YouTube videos directly into presentation slides with custom playback controls.
- **Audio Deck & BGM Manager**: Integrated background audio player for playback during services and breaks.
- **Screen Share & Capture Inputs**: Seamless WebRTC display and window capture layer.

### 🖥️ Multi-Display & Stage Monitor
- **Multi-Screen Support**: Route distinct outputs to Audience Display, Stage Display (Confidence Monitor), and OBS/Web Stream.
- **Stage View Customization**: Dedicated stage monitor layouts displaying current slide, next slide preview, clocks, countdown timers, and service alerts.
- **Quick Alerts & Lower-Third Popovers**: Send instant ticker/banner messages to live outputs without interrupting presentations.
- **Web Remote Control**: Built-in HTTP/WebRTC server enabling control of presentation slides from tablets, smartphones, or remote browsers.

---

## 🏗️ Architecture

```
                 ┌──────────────────────────────────────┐
                 │      RAMEDIA Controller Window       │
                 │   (React 18 + Tailwind + Zustand)    │
                 └──────────────────┬───────────────────┘
                                    │
                         IPC / Broadcast Channel
                                    │
      ┌─────────────────────────────┼─────────────────────────────┐
      ▼                             ▼                             ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Audience Output  │      │  Stage Display   │      │ Web/OBS Output   │
│   (Fullscreen)   │      │ (Confidence Mon) │      │   (WebRTC/HTTP)  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
```

---

## 🛠️ Tech Stack

| Component | Technology |
| --------- | ---------- |
| **Framework** | Electron 28+ |
| **Frontend** | React 18 + TypeScript |
| **Styling** | Tailwind CSS + Framer Motion + Lucide Icons |
| **State Management** | Zustand |
| **Database** | SQLite (`better-sqlite3` + Drizzle ORM) |
| **Build System** | Vite + `electron-builder` |
| **Internationalization** | i18next (English & Indonesian support) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20.x or higher
- **npm**: v9.x or higher
- **Operating System**: macOS (ARM64 / x64) or Windows 10/11

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/michaelyuswandi/RAMEDIA.git
   cd RAMEDIA
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in Web Development Mode:**
   ```bash
   npm run dev
   ```
   - Controller Interface: `http://localhost:5173/controller`
   - Audience Output: `http://localhost:5173/output`

4. **Run in Electron Desktop App Mode:**
   ```bash
   npm run electron:dev
   ```

---

## 📦 Building & Distribution

Build production binaries for macOS or Windows:

```bash
# Package for macOS (ARM64)
npm run pack:mac

# Create Installer for macOS (.dmg / .zip)
npm run dist:mac

# Package & Create Installer for Windows (.exe / portable)
npm run dist:win
```

Target output installers will be generated under the `release/` directory.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**.  
See the [LICENSE](LICENSE) file for full legal details.

---

<p center align="center">
  <b>RAMEDIA</b> — Elevating Worship & Event Multimedia Experiences 🙏
</p>
