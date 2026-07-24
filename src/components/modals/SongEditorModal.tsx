import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Info, Layers, Plus, Save, Type, X, Sparkles, RefreshCw, RotateCcw } from 'lucide-react';
import type { SongEditorSlide, SongUpdatePayload, SongWithSlides } from '../../core/services/ipcSongService';
import { ipcSongService } from '../../core/services/ipcSongService';
import { parseSongLyrics } from '../../utils/songParser';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { ipcOutputSettingsService } from '../../core/services/ipcOutputSettingsService';
import { DEFAULT_OUTPUT_SETTINGS, type DefaultSongStyle } from '../../core/models/outputSettings';
import { ipcTemplateService } from '../../core/services/ipcTemplateService';
import type { Template } from '../../electron/database/schema';
import AdvancedEditor from './AdvancedEditor';
import { buildLayersFromSongPreset } from '../../core/songEditor/songPresets';
import { LiveOutputSurface } from '../common/LiveOutputSurface';
import { SlideLabelBadge } from '../common/SlideLabelBadge';

interface SongEditorModalProps {
  song: SongWithSlides | null;
  onClose: () => void;
  onSave: (songId?: string) => void;
  standalone?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

function formatSlideLabel(type: string, number: number | null, index: number) {
  const base = type ? `${type.charAt(0).toUpperCase()}${type.slice(1)}` : 'Slide';
  return number ? `${base} ${number}` : `${base} ${index + 1}`;
}

function buildSectionLabel(type: string, number: number | null, index: number) {
  return formatSlideLabel(type, number, index);
}

function toPresetDrivenSlides(slides: SongEditorSlide[]): SongEditorSlide[] {
  return slides.map((slide) => ({
    ...slide,
    customThemeId: null,
    layers: [],
  }));
}

function toCustomLayerSlides(slides: SongEditorSlide[]): SongEditorSlide[] {
  return slides.map((slide) => ({
    ...slide,
    customThemeId: '__custom_layers__',
  }));
}

export default function SongEditorModal({ song, onClose, onSave, standalone = false, onDirtyChange }: SongEditorModalProps) {
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [rawLyrics, setRawLyrics] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [advancedSlides, setAdvancedSlides] = useState<SongEditorSlide[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(song?.defaultTemplateId || null);
  const [isAiFormatting, setIsAiFormatting] = useState(false);
  const [previousRawLyricsBeforeAi, setPreviousRawLyricsBeforeAi] = useState<string | null>(null);

  const handleAiFormat = async () => {
    if (!rawLyrics.trim()) return;
    setIsAiFormatting(true);
    try {
      if (window.api?.ai) {
        let aiFormattingSettings = useSettingsStore.getState().aiFormatting;
        if (!aiFormattingSettings) {
          const settings = await ipcOutputSettingsService.getSettings();
          aiFormattingSettings = settings.aiFormatting;
        }
        const result = await window.api.ai.formatLyric(rawLyrics, aiFormattingSettings);
        if (result.slides && result.slides.length > 0) {
          const formatted = result.slides
            .map((slide: { title: string; content: string }) => `[${slide.title.toUpperCase()}]\n${slide.content}`)
            .join('\n\n');
          setPreviousRawLyricsBeforeAi(rawLyrics);
          setRawLyrics(formatted);
        }
      }
    } catch (err) {
      console.error('AI format failed:', err);
    } finally {
      setIsAiFormatting(false);
    }
  };

  const handleUndoAiFormat = () => {
    if (previousRawLyricsBeforeAi !== null) {
      setRawLyrics(previousRawLyricsBeforeAi);
      setPreviousRawLyricsBeforeAi(null);
    }
  };

  useEffect(() => {
    setTitle(song?.title || '');
    setAuthor(song?.author || '');
    setRawLyrics(song?.rawLyrics || '');
    setMode('easy');
    setError(null);
    setActivePreviewIndex(0);
    setSelectedTemplateId(song?.defaultTemplateId || null);
  }, [song]);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        const nextTemplates = await ipcTemplateService.getAll();
        if (cancelled) return;

        setTemplates(nextTemplates.filter((template) => (template.contentType || 'song') === 'song'));
        setSelectedTemplateId((currentId) => {
          if (song?.defaultTemplateId && nextTemplates.some((template) => template.id === song.defaultTemplateId)) {
            return song.defaultTemplateId;
          }
          if (currentId && nextTemplates.some((template) => template.id === currentId)) {
            return currentId;
          }
          return null;
        });
      } catch {
        if (!cancelled) {
          setTemplates([]);
        }
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [song?.defaultTemplateId]);

  const initialSnapshot = useMemo(
    () => JSON.stringify({
      title: song?.title || '',
      author: song?.author || '',
      rawLyrics: song?.rawLyrics || '',
      selectedTemplateId: song?.defaultTemplateId || null,
      advancedSlides: song?.slides || [],
    }),
    [song],
  );

  const currentSnapshot = JSON.stringify({ title, author, rawLyrics, selectedTemplateId, advancedSlides });
  const isDirty = currentSnapshot !== initialSnapshot;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const parsedSections = useMemo(
    () => parseSongLyrics(rawLyrics),
    [rawLyrics],
  );

  const easyDefaultSongStyle = useMemo<DefaultSongStyle>(
    () => useSettingsStore.getState().defaultSongStyle || DEFAULT_OUTPUT_SETTINGS.defaultSongStyle!,
    [],
  );

  const parsedSlides = useMemo(
    () => parsedSections.map((slide, index) => {
      const slideId = `${song?.id || 'draft'}-${index}`;
      const effectiveTemplateId = selectedTemplateId;
      const selectedTemplate = templates.find((template) => template.id === effectiveTemplateId) || null;
      
      return {
        id: slideId,
        type: 'lyrics' as const,
        sectionType: slide.type,
        sectionNumber: slide.number,
        label: formatSlideLabel(slide.type, slide.number, index),
        content: slide.content,
        layers: buildLayersFromSongPreset(
          slideId,
          slide.content,
          selectedTemplate,
          easyDefaultSongStyle,
          {
            songTitle: title || song?.title || 'Song Title',
            sectionLabel: buildSectionLabel(slide.type, slide.number, index),
          },
        ),
      };
    }),
    [easyDefaultSongStyle, parsedSections, selectedTemplateId, song?.id, song?.title, templates, title],
  );

  const generatedAdvancedSlides = useMemo<SongEditorSlide[]>(
    () =>
      parsedSections.map((slide, index) => {
        const slideId = `${song?.id || 'draft'}-${index}`;
        return {
          id: slideId,
          songId: song?.id || '',
          orderIndex: index + 1,
          sectionType: slide.type,
          sectionNumber: slide.number,
          content: slide.content,
          notes: null,
          customThemeId: null,
          createdAt: new Date().toISOString(),
          layers: buildLayersFromSongPreset(
            slideId,
            slide.content,
            templates.find((template) => template.id === selectedTemplateId) || null,
            easyDefaultSongStyle,
            {
              songTitle: title || song?.title || 'Song Title',
              sectionLabel: buildSectionLabel(slide.type, slide.number, index),
            },
          ),
        };
      }),
    [easyDefaultSongStyle, parsedSections, selectedTemplateId, song?.id, song?.title, templates, title],
  );

  useEffect(() => {
    if (song?.slides?.length) {
      setAdvancedSlides(song.slides as SongEditorSlide[]);
      return;
    }

    setAdvancedSlides(generatedAdvancedSlides);
  }, [song?.id, song?.slides, generatedAdvancedSlides]);

  const activePreviewSlide = parsedSlides[activePreviewIndex] || null;
  const lyricLines = rawLyrics.split('\n');
  const totalLines = lyricLines.filter((line) => line.trim()).length;
  const verseCount = parsedSections.filter((section) => section.type === 'verse').length;
  const chorusCount = parsedSections.filter((section) => section.type === 'chorus').length;
  const insertSection = (marker: string) => {
    setRawLyrics((current) => {
      const separator = current.trim().length ? '\n\n' : '';
      return `${current}${separator}${marker}\n`;
    });
  };
  const handleTextareaCursorChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const selectionStart = e.currentTarget.selectionStart;
    const slicedText = rawLyrics.slice(0, selectionStart);
    const cursorIndex = slicedText.split(/\n\n+/).filter(p => p.trim()).length - 1;
    const activeIndex = Math.max(0, Math.min(cursorIndex, parsedSlides.length - 1));
    setActivePreviewIndex(activeIndex);
  };

  const canGoPreviousPreview = activePreviewIndex > 0;
  const canGoNextPreview = activePreviewIndex < parsedSlides.length - 1;
  const goPreviousPreview = () => setActivePreviewIndex((current) => Math.max(0, current - 1));
  const goNextPreview = () => setActivePreviewIndex((current) => Math.min(Math.max(parsedSlides.length - 1, 0), current + 1));

  useEffect(() => {
    if (activePreviewIndex > parsedSlides.length - 1) {
      setActivePreviewIndex(0);
    }
  }, [activePreviewIndex, parsedSlides.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, isSaving, title, author, rawLyrics, song, onClose, onSave]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleAdvancedUpdate = ({ slides }: { slides: SongEditorSlide[] }) => {
    setAdvancedSlides(slides);
  };

  const handleClose = () => {
    if (standalone) {
      onClose();
      return;
    }
    if (isDirty && !isSaving) {
      const shouldDiscard = window.confirm('Unsaved song changes will be lost. Close anyway?');
      if (!shouldDiscard) return;
    }
    onDirtyChange?.(false);
    onClose();
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Song title is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let savedSongId = song?.id;
      if (song) {
        const slidesToSave = mode === 'advanced'
          ? toCustomLayerSlides(advancedSlides)
          : toPresetDrivenSlides(generatedAdvancedSlides);
        const payload: SongUpdatePayload = {
          title: title.trim(),
          author: author.trim() || null,
          rawLyrics,
          defaultTemplateId: selectedTemplateId,
          slides: slidesToSave,
        };
        await ipcSongService.update(song.id, payload);
      } else {
        const songId = await ipcSongService.createFromLyrics(
          title.trim(),
          rawLyrics,
          author.trim() || undefined,
        );

        const slidesToSave = mode === 'advanced'
          ? toCustomLayerSlides(advancedSlides)
          : toPresetDrivenSlides(generatedAdvancedSlides);
        await ipcSongService.update(songId, {
          title: title.trim(),
          author: author.trim() || null,
          rawLyrics,
          defaultTemplateId: selectedTemplateId,
          slides: slidesToSave,
        });
        savedSongId = songId;
      }

      onDirtyChange?.(false);
      onSave(savedSongId);
      onClose();
    } catch (saveError) {
      setError((saveError as Error).message || 'Failed to save song');
    } finally {
      setIsSaving(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-background text-text">
      <div className="flex h-full w-full flex-col bg-background">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-text/10 bg-surface px-6 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            {!standalone && <button
              onClick={handleClose}
              className="flex h-10 items-center gap-2 rounded-lg border border-text/15 bg-background px-4 text-sm font-bold text-text/65 transition hover:bg-text/5 hover:text-text active:scale-[0.98]"
            >
              <ChevronLeft size={15} />
              Back
            </button>}

            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-text/40">
                Song Workspace
              </div>
              <div className="truncate text-base font-semibold text-text">
                {song ? `Edit Song: ${title || song.title}` : (title ? `New Song: ${title}` : 'New Song')}
              </div>
            </div>

            {isDirty && (
              <div className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-warning">
                Unsaved
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-text/10 bg-background p-1">
              <button
                onClick={() => setMode('easy')}
                className={`flex h-8 items-center gap-2 rounded-md px-4 text-[11px] font-extrabold uppercase tracking-[0.14em] transition ${
                  mode === 'easy'
                    ? 'border border-primary/30 bg-primary/12 text-primary'
                    : 'text-text/50 hover:bg-text/5 hover:text-text'
                }`}
              >
                <Type size={14} />
                Easy Input
              </button>
              <button
                onClick={() => setMode('advanced')}
                className={`flex h-8 items-center gap-2 rounded-md px-4 text-[11px] font-extrabold uppercase tracking-[0.14em] transition ${
                  mode === 'advanced'
                    ? 'border border-primary/30 bg-primary/12 text-primary'
                    : 'text-text/50 hover:bg-text/5 hover:text-text'
                }`}
              >
                <Layers size={14} />
                Advanced
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/20 px-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary transition hover:bg-primary/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={15} />
              {isSaving ? 'Saving...' : 'Save Song'}
            </button>

            {!standalone && <button
              onClick={handleClose}
              className="grid h-10 w-10 place-items-center rounded-lg border border-text/15 text-text/50 transition hover:bg-text/5 hover:text-text active:scale-[0.98]"
              aria-label="Close song editor"
            >
              <X size={18} />
            </button>}
          </div>
        </div>

        <div className="grid shrink-0 gap-5 px-6 py-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text/55">
              Song Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 w-full rounded-lg border border-text/15 bg-surface px-3.5 text-sm text-text shadow-sm outline-none transition placeholder:text-text/30 focus:border-primary/55 focus:ring-2 focus:ring-primary/15"
              placeholder="Amazing Grace"
              autoFocus
            />
            <p className="text-xs text-text/40">Judul lagu akan ditampilkan di rundown dan layar.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text/55">
              Author / Artist
            </label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="h-11 w-full rounded-lg border border-text/15 bg-surface px-3.5 text-sm text-text shadow-sm outline-none transition placeholder:text-text/30 focus:border-primary/55 focus:ring-2 focus:ring-primary/15"
              placeholder="John Newton"
            />
            <p className="text-xs text-text/40">Penulis atau composer lagu.</p>
          </div>
        </div>

        <div className="grid shrink-0 gap-5 border-b border-text/10 px-6 pb-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text/55">
              Song Content Theme
            </label>
            <select
              value={selectedTemplateId || ''}
              onChange={(e) => setSelectedTemplateId(e.target.value || null)}
              className="h-11 w-full rounded-lg border border-text/15 bg-surface px-3.5 text-sm text-text shadow-sm outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Use built-in song style</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.category || 'Theme'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <div className="pb-2 text-xs text-text/40">
              Tanpa theme memakai style lagu bawaan. Pilihan lain menjadi Content Theme khusus untuk lagu ini.
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-3 flex shrink-0 items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm font-semibold text-error">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden p-6 pt-4">
          {mode === 'advanced' ? (
            <div className="flex min-h-0 w-full overflow-hidden rounded-xl border border-text/10 bg-surface shadow-sm">
              <AdvancedEditor
                song={song}
                slides={advancedSlides}
                onUpdate={handleAdvancedUpdate}
                selectedTemplateId={selectedTemplateId}
              />
            </div>
          ) : (            <div className="grid min-h-0 w-full gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.98fr)]">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-text/10 bg-surface shadow-sm">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text/55">Lyrics / Structure</div>
                    <div className="mt-1 text-xs text-text/40">Tulis lirik lagu Anda di sini. Setiap baris akan menjadi satu baris teks di slide.</div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-text/50">
                    <button
                      type="button"
                      onClick={handleAiFormat}
                      disabled={isAiFormatting || !rawLyrics.trim()}
                      className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400 transition hover:from-indigo-500/20 hover:to-purple-500/20 disabled:opacity-40"
                      title="Auto Structure & Format Lyrics with Local AI"
                    >
                      {isAiFormatting ? (
                        <RefreshCw size={13} className="animate-spin text-indigo-400" />
                      ) : (
                        <Sparkles size={13} className="text-indigo-400" />
                      )}
                      <span>{isAiFormatting ? 'Formatting...' : '✨ Magic AI Format'}</span>
                    </button>

                    {previousRawLyricsBeforeAi !== null && (
                      <button
                        type="button"
                        onClick={handleUndoAiFormat}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/20"
                        title="Kembalikan Teks Sebelum Format AI (Undo AI)"
                      >
                        <RotateCcw size={13} />
                        <span>Undo AI</span>
                      </button>
                    )}

                    <span className="rounded-md border border-text/15 px-2 py-1">Tips:</span>
                    {['[Verse]', '[Chorus]', '[Bridge]'].map((marker) => (
                      <button key={marker} type="button" onClick={() => insertSection(marker)} className="rounded-md border border-text/15 p-0.5 transition hover:bg-text/5 active:scale-[0.98]">
                        <SlideLabelBadge slide={{ sectionType: marker.slice(1, -1).toLowerCase() }} fallback={marker} className="px-2 py-1 text-[10px] uppercase" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mx-5 min-h-0 flex-1 overflow-hidden rounded-lg border border-text/10 bg-background">
                  <div className="flex h-full overflow-hidden">
                    <div className="w-12 shrink-0 select-none border-r border-text/10 bg-text/[0.03] py-4 text-right font-mono text-xs leading-7 text-text/35">
                      {lyricLines.map((_, index) => (
                        <div key={index} className="px-3">{index + 1}</div>
                      ))}
                    </div>
                    <textarea
                      value={rawLyrics}
                      onChange={(e) => setRawLyrics(e.target.value)}
                      onSelect={handleTextareaCursorChange}
                      onClick={handleTextareaCursorChange}
                      onKeyUp={handleTextareaCursorChange}
                      className="min-h-0 flex-1 resize-none bg-background px-4 py-4 font-mono text-sm leading-7 text-text outline-none placeholder:text-text/25"
                      placeholder={`[VERSE 1]
Amazing grace how sweet the sound
That saved a wretch like me
 
[CHORUS]
Grace, grace, God's grace`}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4 px-5 py-4 text-xs text-text/50">
                  <span>Total {totalLines} lines</span>
                  <span>•</span>
                  <span>{verseCount} verse, {chorusCount} chorus</span>
                </div>
              </div>

              <div className="flex min-h-0 flex-col rounded-xl border border-text/10 bg-surface p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text/55">Preview</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={goPreviousPreview}
                      disabled={!canGoPreviousPreview}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-text/15 text-text/50 transition hover:bg-text/5 hover:text-text active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Previous preview slide"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="min-w-20 text-center text-xs font-semibold text-text/50">
                      Slide {parsedSlides.length ? activePreviewIndex + 1 : 0} / {parsedSlides.length}
                    </div>
                    <button
                      type="button"
                      onClick={goNextPreview}
                      disabled={!canGoNextPreview}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-text/15 text-text/50 transition hover:bg-text/5 hover:text-text active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Next preview slide"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="relative aspect-video shrink-0 overflow-hidden rounded-xl border border-text/10 bg-background">
                  {activePreviewSlide ? (
                    <>
                      <LiveOutputSurface
                        currentSlide={activePreviewSlide as any}
                        isBlack={false}
                        isClear={false}
                        mode="preview"
                        showPreviewBadge={false}
                      />
                      <SlideLabelBadge slide={activePreviewSlide} fallback={activePreviewSlide.label} className="absolute left-4 top-4 px-2 py-1 text-xs uppercase shadow-sm" />
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-semibold text-text/40">Start typing lyrics</div>
                  )}
                </div>

                <div className="mt-4 rounded-lg border border-dashed border-text/15 px-4 py-3 text-xs text-text/40">
                  <Info size={14} className="mr-2 inline" />
                  Preview ini hanya contoh. Tampilan akhir mengikuti output dan layer Anda.
                </div>

                <div className="mt-4 min-h-0 overflow-y-auto">
                  <div className="space-y-2">
                    {parsedSlides.map((slide, index) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setActivePreviewIndex(index)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition ${activePreviewIndex === index ? 'border-primary/30 bg-primary/10' : 'border-text/10 hover:bg-text/5'}`}
                      >
                        <SlideLabelBadge slide={slide} fallback={slide.label} className="px-2 py-0.5 text-[10px] uppercase tracking-[0.1em]" />
                        <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-text/50">{slide.content}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {mode === 'easy' && (
          <div className="flex h-16 shrink-0 items-center justify-between border-t border-text/10 bg-surface px-6">
            <button type="button" onClick={() => insertSection('[Verse]')} className="flex h-10 items-center gap-2 rounded-lg border border-primary/30 px-4 text-sm font-bold text-primary transition hover:bg-primary/10 active:scale-[0.98]">
              <Plus size={16} />
              Add Section
            </button>
            <div className="flex items-center gap-2">
              {!standalone && <button type="button" onClick={handleClose} className="h-10 rounded-lg border border-text/15 px-5 text-sm font-bold text-text/55 transition hover:bg-text/5 hover:text-text active:scale-[0.98]">Cancel</button>}
              <button type="button" onClick={handleSave} disabled={isSaving} className="flex h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/20 px-5 text-sm font-bold text-primary transition hover:bg-primary/30 active:scale-[0.98] disabled:opacity-50">
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Song'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
