import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSettingsStore } from './core/stores/useSettingsStore';
import { ToastContainer } from './components/common/Toast';
import ControllerView from './views/ControllerView';
import OutputView from './views/OutputView';
import StageView from './views/StageView';
import ControllerLiveMockupView from './views/ControllerLiveMockupView';
import LivePreviewMockupView from './views/LivePreviewMockupView';
import BrowserOutputView from './views/BrowserOutputView';
import WebrtcHostView from './views/WebrtcHostView';
import LibraryViewMockupView from './views/LibraryViewMockupView';
import RemoteView from './views/RemoteView';
import PresetEditorView from './views/PresetEditorView';
import SongEditorView from './views/SongEditorView';
import SettingsView from './views/SettingsView';
import BibleSettingsView from './views/BibleSettingsView';
import { I18nProvider } from './i18n';


function App() {
  const { appTheme, primaryColor, locale, hydrateSettings } = useSettingsStore();
  const Router = window.api ? HashRouter : BrowserRouter;

  useEffect(() => {
    // Verify IPC
    if (window.api) {
      window.api.getAppVersion().then(version => {
        console.log('Running on Electron v' + version);
      }).catch(err => console.error('IPC Error:', err));
    }

    hydrateSettings().catch((err) => {
      console.error('Failed to hydrate settings:', err);
    });
  }, []);

  // Theme Sync
  useEffect(() => {
    if (appTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }

    if (primaryColor) {
      document.documentElement.style.setProperty('--color-primary', primaryColor);
      // Convert hex to RGB for Tailwind opacity support
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primaryColor);
      if (result) {
        const rgbValue = `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
        document.documentElement.style.setProperty('--color-primary-rgb', rgbValue);
      }
    }
  }, [appTheme, primaryColor]);

  return (
    <>
      <I18nProvider locale={locale}>
        <Router>
          <Routes>
            <Route path="/controller" element={<ControllerView />} />
            <Route path="/controller-live-mockup" element={<ControllerLiveMockupView />} />
            <Route path="/live-preview-mockup" element={<LivePreviewMockupView />} />
            <Route path="/library-view-mockup" element={<LibraryViewMockupView />} />
            <Route path="/output" element={<OutputView />} />
            <Route path="/browser-output/:pairingCode" element={<BrowserOutputView />} />
            <Route path="/webrtc-host" element={<WebrtcHostView />} />
            <Route path="/stage" element={<StageView />} />
            <Route path="/remote" element={<RemoteView />} />
            <Route path="/preset-editor" element={<PresetEditorView />} />
            <Route path="/song-editor" element={<SongEditorView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/bible-settings" element={<BibleSettingsView />} />
            <Route path="/" element={<Navigate to="/controller" replace />} />

          </Routes>
        </Router>
      </I18nProvider>
      
      {/* Global Toast Notifications */}
      <ToastContainer />
    </>
  );
}

export default App;
