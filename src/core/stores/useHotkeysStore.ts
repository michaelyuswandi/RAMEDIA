import { create } from 'zustand';

export interface HotkeyCommand {
  id: string;
  name: string;
  category: string;
  defaultKeybinding: string;
  keybinding: string;
}

interface HotkeysState {
  commands: HotkeyCommand[];
  updateKeybinding: (commandId: string, keybinding: string) => void;
  resetToDefaults: () => void;
}

const DEFAULT_COMMANDS: HotkeyCommand[] = [
  { id: 'next-slide', name: 'Next Slide', category: 'Presentation', defaultKeybinding: 'ArrowRight', keybinding: 'ArrowRight' },
  { id: 'prev-slide', name: 'Previous Slide', category: 'Presentation', defaultKeybinding: 'ArrowLeft', keybinding: 'ArrowLeft' },
  { id: 'go-live', name: 'Go Live / Send to Stage', category: 'Presentation', defaultKeybinding: 'Enter', keybinding: 'Enter' },
  { id: 'toggle-black', name: 'Toggle Black Screen', category: 'Stage Output', defaultKeybinding: 'B', keybinding: 'B' },
  { id: 'toggle-clear', name: 'Toggle Clear Text', category: 'Stage Output', defaultKeybinding: 'C', keybinding: 'C' },
  { id: 'toggle-logo', name: 'Toggle Logo Output', category: 'Stage Output', defaultKeybinding: 'L', keybinding: 'L' },
  { id: 'next-item', name: 'Next Rundown Item', category: 'Rundown', defaultKeybinding: 'ArrowDown', keybinding: 'ArrowDown' },
  { id: 'prev-item', name: 'Previous Rundown Item', category: 'Rundown', defaultKeybinding: 'ArrowUp', keybinding: 'ArrowUp' },
  { id: 'live-next-slide', name: 'Next Live Slide', category: 'Live Control', defaultKeybinding: 'Space', keybinding: 'Space' },
  { id: 'live-prev-slide', name: 'Previous Live Slide', category: 'Live Control', defaultKeybinding: 'Backspace', keybinding: 'Backspace' },
];

function loadSavedHotkeys(): HotkeyCommand[] {
  try {
    const saved = localStorage.getItem('rumedia_hotkeys');
    if (!saved) return DEFAULT_COMMANDS;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_COMMANDS;
    
    // Merge saved settings with default commands to handle any new commands
    return DEFAULT_COMMANDS.map((cmd) => {
      const match = parsed.find((p: any) => p.id === cmd.id);
      return match ? { ...cmd, keybinding: match.keybinding } : cmd;
    });
  } catch {
    return DEFAULT_COMMANDS;
  }
}

export const useHotkeysStore = create<HotkeysState>((set) => ({
  commands: loadSavedHotkeys(),
  
  updateKeybinding: (commandId, keybinding) => {
    set((state) => {
      const nextCommands = state.commands.map((cmd) =>
        cmd.id === commandId ? { ...cmd, keybinding } : cmd
      );
      localStorage.setItem('rumedia_hotkeys', JSON.stringify(nextCommands));
      return { commands: nextCommands };
    });
  },

  resetToDefaults: () => {
    set(() => {
      localStorage.setItem('rumedia_hotkeys', JSON.stringify(DEFAULT_COMMANDS));
      return { commands: DEFAULT_COMMANDS };
    });
  },
}));
