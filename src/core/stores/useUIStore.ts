import { create } from 'zustand';
import { getInitialControllerView, rememberControllerView, type ControllerStartView } from './useGeneralSettingsStore';

type ViewMode = 'dashboard' | 'songs' | 'bible' | 'media' | 'audio' | 'prd' | 'capture';

interface UIState {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  isScreensPanelOpen: boolean;
  openScreensPanel: () => void;
  closeScreensPanel: () => void;
  toggleScreensPanel: () => void;
  
  // Potential future UI states
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: getInitialControllerView(),
  setActiveView: (view) => {
    if (view !== 'dashboard' && view !== 'media') rememberControllerView(view as ControllerStartView);
    set({ activeView: view });
  },
  isSettingsOpen: false,
  openSettings: () => {
    if (window.api?.workspaceWindow) {
      void window.api.workspaceWindow.open({ kind: 'settings' }).catch(() => set({ isSettingsOpen: true }));
      return;
    }
    set({ isSettingsOpen: true });
  },
  closeSettings: () => set({ isSettingsOpen: false }),
  isScreensPanelOpen: false,
  openScreensPanel: () => set({ isScreensPanelOpen: true }),
  closeScreensPanel: () => set({ isScreensPanelOpen: false }),
  toggleScreensPanel: () => set((state) => ({ isScreensPanelOpen: !state.isScreensPanelOpen })),
  
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));
