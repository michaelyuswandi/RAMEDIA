import { useEffect, useMemo, useRef, useState } from 'react';
import { Edit3, LayoutTemplate, Plus, Search, Trash2 } from 'lucide-react';
import { ipcTemplateService } from '../../core/services/ipcTemplateService';
import { ipcPresetPreviewService } from '../../core/services/ipcPresetPreviewService';
import { renderContentThemeThumbnail } from '../../core/presets/presetThumbnailRenderer';
import { toRenderableMediaUrl } from '../../core/utils/mediaUrl';
import type { Template } from '../../electron/database/schema';
import SongPresetEditorModal from '../modals/SongPresetEditorModal';
import { useI18n } from '../../i18n';

interface SongPresetLibraryPanelProps {
  searchQuery: string;
  refreshToken?: number;
}

export default function SongPresetLibraryPanel({ searchQuery, refreshToken = 0 }: SongPresetLibraryPanelProps) {
  const { t } = useI18n();
  const [presets, setPresets] = useState<Template[]>([]);
  const [editingPreset, setEditingPreset] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const mountedRef = useRef(true);
  const refreshGenerationRef = useRef(0);

  const refreshPresets = async () => {
    const generation = ++refreshGenerationRef.current;
    const nextPresets = await ipcTemplateService.getAll();
    if (!mountedRef.current || generation !== refreshGenerationRef.current) return;
    setPresets(nextPresets);

    const missingPreviews = nextPresets.filter((preset) => !preset.previewUrl);
    for (const preset of missingPreviews) {
      if (!mountedRef.current || generation !== refreshGenerationRef.current) return;
      try {
        const dataUrl = await renderContentThemeThumbnail(preset.layersData, preset.contentType || 'song');
        const previewUrl = await ipcPresetPreviewService.save(`content-${preset.id}`, dataUrl, null);
        await ipcTemplateService.updatePreview(preset.id, previewUrl);
        if (mountedRef.current && generation === refreshGenerationRef.current) setPresets((current) => current.map((item) => item.id === preset.id ? { ...item, previewUrl } : item));
      } catch (previewError) {
        console.warn(`[Preset Preview] Unable to generate thumbnail for ${preset.name}.`, previewError);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void refreshPresets();
    return () => {
      mountedRef.current = false;
      refreshGenerationRef.current += 1;
    };
  }, [refreshToken]);

  const filteredPresets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return presets;
    return presets.filter((preset) => (
      preset.name.toLowerCase().includes(query)
      || (preset.category || '').toLowerCase().includes(query)
    ));
  }, [presets, searchQuery]);

  const handleDelete = async (preset: Template) => {
    if (!confirm(t('library.deletePresetConfirm', { name: preset.name }))) return;
    await ipcTemplateService.delete(preset.id);
    await refreshPresets();
  };

  return (
    <>
      <div className="flex h-full flex-col bg-white/[0.02]">
        <div className="flex h-12 items-center gap-3 border-b border-text/5 bg-black/10 px-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-text/45">
            <LayoutTemplate size={16} /> {t('library.contentThemes')}
          </div>

          <div className="ml-3 flex max-w-md flex-1 items-center rounded-xl border border-text/10 bg-white/[0.03] px-3 transition-colors duration-150 focus-within:border-info/40">
            <Search size={14} className="text-text/30" />
            <input
              className="w-full border-none bg-transparent px-3 py-3 text-sm text-text placeholder:text-text/30 focus:outline-none"
              placeholder={t('library.searchContentThemes')}
              value={searchQuery}
              readOnly
            />
          </div>

          <button
            onClick={() => setIsCreating(true)}
            className="control-button-primary flex items-center gap-2 px-3 py-2 text-[11px] font-medium tracking-[0.03em]"
          >
            <Plus size={16} /> <span className="hidden sm:inline">{t('library.newContentTheme')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-text/35">{t('library.themeLibrary')}</div>
              <div className="text-sm font-semibold text-text">{t('library.themeLibraryDesc')}</div>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-text/32">
              {t('library.themesCount', { count: filteredPresets.length })}
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {filteredPresets.map((preset) => (
              <div
                key={preset.id}
                draggable={(preset.contentType || 'song') === 'song'}
                onDragStart={(event) => {
                  if ((preset.contentType || 'song') !== 'song') return;
                  event.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'song-preset',
                    id: preset.id,
                    name: preset.name,
                  }));
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onDoubleClick={() => setEditingPreset(preset)}
                className={`group flex flex-col rounded-[22px] border border-white/8 bg-white/[0.03] p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.05] ${(preset.contentType || 'song') === 'song' ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[16px] border border-white/8 bg-[#11151c]">
                  {preset.previewUrl ? (
                    <img src={toRenderableMediaUrl(preset.previewUrl)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-text/28">
                      <LayoutTemplate size={22} />
                      <span className="text-[9px] font-semibold uppercase tracking-[0.16em]">{t('library.generatingPreview')}</span>
                    </div>
                  )}
                  <div className="absolute bottom-2.5 right-2.5 rounded-md border border-white/12 bg-[#0d1118]/88 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/76 backdrop-blur-sm">
                    {(preset.contentType || 'song').toUpperCase()}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="min-h-10 text-sm font-semibold leading-5 text-text">{preset.name}</div>
                    <div className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-text/38">
                      {preset.category || t('library.contentThemes')}
                    </div>
                  </div>
                  <button onClick={(event) => { event.stopPropagation(); setEditingPreset(preset); }} className="control-button flex h-9 w-9 items-center justify-center px-0 py-0 opacity-60 transition-opacity group-hover:opacity-100" title={t('library.editPreset')}>
                    <Edit3 size={14} />
                  </button>
                  <button onClick={(event) => { event.stopPropagation(); void handleDelete(preset); }} className="control-button flex h-9 w-9 items-center justify-center px-0 py-0 text-red-300 opacity-60 transition-opacity hover:text-white group-hover:opacity-100" title={t('library.deletePreset')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {filteredPresets.length === 0 && (
              <div className="col-span-full rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-text/30">
                  <LayoutTemplate size={24} />
                </div>
                <div className="mt-4 text-sm font-semibold text-text/72">{t('library.noThemesFound')}</div>
                <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-text/35">{t('library.noThemesHelp')}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {(editingPreset || isCreating) && (
        <SongPresetEditorModal
          template={editingPreset}
          initialPresetType="song"
          onClose={() => {
            setEditingPreset(null);
            setIsCreating(false);
          }}
          onSaved={() => void refreshPresets()}
        />
      )}
    </>
  );
}
