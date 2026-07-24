import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutTemplate, X } from 'lucide-react';
import SongPresetEditorModal from '../components/modals/SongPresetEditorModal';
import { ipcOutputSettingsService } from '../core/services/ipcOutputSettingsService';
import { ipcTemplateService } from '../core/services/ipcTemplateService';
import { useSettingsStore } from '../core/stores/useSettingsStore';
import type { PresetEditorKind } from '../core/presets/presetEditorWindow';
import type { ScreenLayoutPreset } from '../core/models/outputSettings';
import type { Template } from '../electron/database/schema';

function resolveEditorKind(value: string | null): PresetEditorKind {
  if (value === 'screen-layout' || value === 'choose') return value;
  return 'content-theme';
}

export default function PresetEditorView() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const kind = resolveEditorKind(params.get('kind'));
  const id = params.get('id');
  const [template, setTemplate] = useState<Template | null>(null);
  const [screenLayout, setScreenLayout] = useState<ScreenLayoutPreset | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPreset = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        if (kind === 'screen-layout') {
          const settings = await ipcOutputSettingsService.getSettings();
          if (cancelled) return;
          useSettingsStore.getState().setSettings(settings);
          const layout = settings.outputPresets.find((item) => item.id === id) || null;
          if (!layout) throw new Error('Screen Layout could not be found. It may have been deleted.');
          setScreenLayout(layout);
          document.title = `${layout.name} — RAMEDIA Editor`;
        } else {
          const nextTemplate = await ipcTemplateService.getById(id);
          if (cancelled) return;
          if (!nextTemplate) throw new Error('Content Theme could not be found. It may have been deleted.');
          setTemplate(nextTemplate);
          document.title = `${nextTemplate.name} — RAMEDIA Editor`;
        }
      } catch (loadError) {
        if (!cancelled) setError((loadError as Error).message || 'Failed to open preset.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadPreset();
    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  const closeWindow = () => {
    if (window.api?.presetEditor) {
      window.api.presetEditor.close();
      return;
    }
    window.close();
  };

  if (isLoading) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-slate-950 px-6 text-slate-200">
        <div className="w-full max-w-md space-y-4">
          <div className="h-3 w-28 animate-pulse rounded bg-slate-800" />
          <div className="h-8 w-72 animate-pulse rounded bg-slate-800" />
          <div className="h-44 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
          <p className="text-xs font-medium text-slate-500">Loading preset editor…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-slate-950 px-6 text-slate-200">
        <section className="w-full max-w-lg border-t border-rose-500/45 pt-6">
          <LayoutTemplate size={28} className="text-rose-400" />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Preset editor unavailable</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{error}</p>
          <button type="button" onClick={closeWindow} className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 active:scale-[0.98]">
            <X size={15} /> Close editor
          </button>
        </section>
      </main>
    );
  }

  return (
    <SongPresetEditorModal
      template={template}
      outputPreset={screenLayout}
      initialPresetType={kind === 'screen-layout' ? 'output' : kind === 'content-theme' ? 'song' : undefined}
      standalone
      onDirtyChange={(dirty) => window.api?.presetEditor?.setDirty(dirty)}
      onClose={closeWindow}
      onSaved={(savedLayout) => {
        const savedKind = savedLayout || kind === 'screen-layout' ? 'screen-layout' : 'content-theme';
        window.api?.presetEditor?.notifySaved({
          kind: savedKind,
          id: savedLayout?.id || id,
        });
      }}
    />
  );
}
