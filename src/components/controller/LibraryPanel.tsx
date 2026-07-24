import React, { useState, useEffect } from 'react';
import { Music, Video, Search, Plus, List, FolderOpen, Tag, Settings, Edit3, Trash2, Volume2, BookOpen, FileText, Image as ImageIcon, MonitorUp, ScreenShare, LayoutTemplate, Globe } from 'lucide-react';
import { ipcSongService, type SongWithSlides } from '../../core/services/ipcSongService';
import { ipcMediaService } from '../../core/services/ipcMediaService';
import { ipcAudioService } from '../../core/services/ipcAudioService';
import type { Song, Media } from '../../electron/database/schema';
import { toRenderableMediaUrl } from '../../core/utils/mediaUrl';
import { buildMediaVirtualSlides } from '../../core/utils/mediaSlides';
import { usePresentationStore } from '../../core/stores/usePresentationStore';
import { useScheduleStore } from '../../core/stores/useScheduleStore';
import { useUIStore } from '../../core/stores/useUIStore';
import { getPdfPlaybackSettings, importPdfWithRasterizer, repairPdfMediaCache } from '../../core/utils/pdf';
import { isScheduleOnlyMedia } from '../../core/utils/mediaVisibility';
import SongPresetLibraryPanel from './SongPresetLibraryPanel';
import AddOnlineMediaModal from '../modals/AddOnlineMediaModal';
import { useI18n } from '../../i18n';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { resolvePrimaryOutputChannel } from '../../core/models/outputSettings';


interface LibraryPanelProps {
  onOpenSongEditor: (song: SongWithSlides | null) => void;
  refreshToken?: number;
}

type LibraryTab = 'all' | 'song' | 'media' | 'presentation' | 'preset';

function buildPreviewSlides(song: SongWithSlides | null) {
  if (!song) return [];

  if (Array.isArray(song.slides) && song.slides.length > 0) {
    return song.slides.map((slide: any, index: number) => ({
      id: slide.id || `${song.id}-slide-${index}`,
      type: 'lyrics' as const,
      content: slide.content || '',
      sectionType: slide.sectionType || 'slide',
      sectionNumber: slide.sectionNumber ?? null,
      label:
        slide.sectionType
          ? `${String(slide.sectionType).charAt(0).toUpperCase()}${String(slide.sectionType).slice(1)}${slide.sectionNumber ? ` ${slide.sectionNumber}` : ''}`
          : `Slide ${index + 1}`,
      layers: slide.layers || [],
    }));
  }

  const sections = (song.rawLyrics || '')
    .split(/\n\n+/)
    .map((section) => section.replace(/^\[.*?\]\s*\n?/, '').trim())
    .filter(Boolean);

  return sections.map((content, index) => ({
    id: `${song.id}-fallback-${index}`,
    type: 'lyrics' as const,
    content,
    label: `Slide ${index + 1}`,
  }));
}

export default function LibraryPanel({ onOpenSongEditor, refreshToken = 0 }: LibraryPanelProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collections] = useState<string[]>([]);
  
  // Baca role dari primary output channel agar preset yang benar digunakan
  const primaryOutputRole = useSettingsStore((state) => resolvePrimaryOutputChannel(state)?.role ?? 'audience');

  
  const [songs, setSongs] = useState<Song[]>([]);
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const setPreviewSlide = usePresentationStore((state) => state.setPreviewSlide);
  const goLive = usePresentationStore((state) => state.goLive);
  const setLibraryPreviewSong = useScheduleStore((state) => state.setLibraryPreviewSong);
  const setLibraryPreviewMedia = useScheduleStore((state) => state.setLibraryPreviewMedia);
  const libraryPreviewMedia = useScheduleStore((state) => state.libraryPreviewMedia);
  const setPresenterMedia = useScheduleStore((state) => state.setPresenterMedia);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const openSettings = useUIStore((state) => state.openSettings);
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [isAddOnlineOpen, setIsAddOnlineOpen] = useState(false);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; songId: string } | null>(null);

  // Initial Load
  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshToken]);

  useEffect(() => {
    if (!window.api) return;

    const brokenPdfs = mediaItems.filter((item) => {
      if (item.mediaType !== 'pdf') return false;
      const settings = getPdfPlaybackSettings(item);
      return settings.pageUrls.length === 0 && item.filepath.endsWith('.pdf');
    });

    if (brokenPdfs.length === 0) return;

    let cancelled = false;

    const repair = async () => {
      for (const media of brokenPdfs) {
        if (cancelled) return;
        const repaired = await repairPdfMediaCache(media, ipcMediaService, toRenderableMediaUrl);
        if (repaired && !cancelled) {
          await refreshData();
        }
      }
    };

    void repair();

    return () => {
      cancelled = true;
    };
  }, [mediaItems]);

  // Search / Filter / Collection Effect
  useEffect(() => {
    const fetchData = async () => {
         const allMedia = (await ipcMediaService.getAll()).filter((item) =>
           (item.mediaType === 'image' || item.mediaType === 'video' || item.mediaType === 'pdf' || item.mediaType === 'youtube') &&
           !isScheduleOnlyMedia(item)
         );
      if (selectedCollection) {
         // Filter by Tag
      } else if (searchQuery) {
         // Advanced Search
         setSongs(await ipcSongService.search(searchQuery));
         setMediaItems(allMedia.filter(m => m.filename.toLowerCase().includes(searchQuery.toLowerCase())));
      } else {
         // All Items
         setSongs(await ipcSongService.getAll());
         setMediaItems(allMedia);
      }
    };
    fetchData();
  }, [searchQuery, selectedCollection]);

  async function refreshData() {
    await ipcSongService.seed(); 
    setSongs(await ipcSongService.getAll());
    setMediaItems((await ipcMediaService.getAll()).filter((item) =>
      (item.mediaType === 'image' || item.mediaType === 'video' || item.mediaType === 'pdf' || item.mediaType === 'youtube') &&
      !isScheduleOnlyMedia(item)
    ));
  }

  async function handleSongPreview(songId: string) {
    const song = await ipcSongService.getById(songId, primaryOutputRole);
    if (!song) return;

    setLibraryPreviewSong(song, 'preview');
    const slides = buildPreviewSlides(song);
    setPreviewSlide((slides[0] as any) || null);
  }

  async function handleSongGoLive(songId: string) {
    const song = await ipcSongService.getById(songId, primaryOutputRole);
    if (!song) return;

    setLibraryPreviewSong(song, 'liveControl');
    const slides = buildPreviewSlides(song);
    if (slides[0]) {
      setPreviewSlide(slides[0] as any);
      goLive(slides[0] as any);
    }
  }

  async function handleDeleteMedia(mediaId: string, filename: string) {
    if (!confirm(t('library.deleteMediaConfirm', { name: filename }))) return;
    try {
      await ipcMediaService.delete(mediaId);
      await refreshData();
    } catch (e) {
      console.error('[LibraryPanel] Delete failed:', e);
      alert(t('library.deleteMediaFailed'));
    }
  }

  function handleMediaPreview(media: Media) {
    setLibraryPreviewMedia(media, 'preview');
    const [slide] = buildMediaVirtualSlides(media);
    setPreviewSlide((slide as any) || null);
  }

  function handleMediaGoLive(media: Media) {
    setLibraryPreviewMedia(media, 'liveControl');
    const [slide] = buildMediaVirtualSlides(media);
    if (slide) {
      setPreviewSlide(slide as any);
      goLive(slide as any);
    }
  }

  function handleOpenPdfPresenter(media: Media) {
    setPresenterMedia(media);
    setActiveView('prd');
  }

  function handleOpenPdfStandard(media: Media) {
    setActiveView('songs');
    handleMediaPreview(media);
  }

  function handleContextMenu(e: React.MouseEvent, songId: string) {
     e.preventDefault();
     setContextMenu({ x: e.clientX, y: e.clientY, songId });
  }

  // Drag Start Handler
  const handleDragStart = (e: React.DragEvent, song: Song) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'song',
      id: song.id,
      title: song.title
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Close context menu on click elsewhere
  useEffect(() => {
     const closeMenu = () => setContextMenu(null);
     window.addEventListener('click', closeMenu);
     return () => window.removeEventListener('click', closeMenu);
  }, []);

  async function handlePdfImport() {
    if (!window.api) {
      alert(t('library.desktopPdfOnly'));
      return;
    }

    setIsImportingPdf(true);
    try {
      const success = await importPdfWithRasterizer(ipcMediaService, toRenderableMediaUrl);
      if (success) {
        setActiveTab('media');
        await refreshData();
      }
    } catch (error) {
      console.error('[LibraryPanel] Failed to import PDF:', error);
      alert(t('library.pdfImportFailed'));
    } finally {
      setIsImportingPdf(false);
    }
  }

  return (
    <div className="panel-shell flex h-full border-t border-text/5 font-sans">
      {isImportingPdf && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-white">{t('library.compilingPdf')}</p>
          </div>
        </div>
      )}
      
      {/* SIDEBAR: Collections & Folders */}
      <div className="flex w-48 flex-col border-r border-text/5 bg-black/10">
         <div className="border-b border-text/5 px-3.5 py-2.5">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-text/35">{t('library.assetBrowser')}</div>
            <div className="mt-1 text-sm font-medium text-text/88">{t('library.library')}</div>
         </div>
         
         <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {/* Standard Filters */}
            <button 
               onClick={() => { setActiveTab('all'); setSelectedCollection(null); }}
               className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-medium tracking-[0.03em] transition-colors duration-150 ${
                  !selectedCollection && activeTab === 'all' ? 'bg-primary/12 text-primary' : 'text-text/62 hover:bg-white/[0.05] hover:text-text'
               }`}
            >
               <List size={14} /> {t('library.allItems')}
            </button>
            
            <div className="px-3 pb-1 pt-4 text-[10px] font-medium uppercase tracking-[0.16em] text-text/28">{t('library.collections')}</div>
            {collections.map(tag => (
               <button 
                  key={tag}
                  onClick={() => { setSelectedCollection(tag); setActiveTab('all'); }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold transition-colors duration-150 ${
                     selectedCollection === tag ? 'bg-info/12 text-info' : 'text-text/68 hover:bg-white/[0.05]'
                  }`}
               >
                  <Tag size={14} className="text-primary/70" /> {tag}
               </button>
            ))}
            
            <button 
               onClick={() => {
                  const name = prompt(t('library.newCollectionPrompt'));
                  // Just a UI placeholder, actual tag is created when assigned to a song
                  if (name) alert(t('library.newCollectionHelp', { name }));
               }}
               className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-text/32 transition-colors duration-150 hover:bg-white/[0.05] hover:text-text/72"
            >
               <Plus size={14} /> {t('library.newCollection')}
            </button>
         </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 flex-col bg-white/[0.02]">
         
         {/* Toolbar */}
         <div className="flex h-12 items-center gap-2.5 border-b border-text/5 bg-black/10 px-3">
            {/* Type Filters */}
            <div className="flex rounded-xl border border-white/6 bg-white/[0.03] p-1">
               {(['all', 'song', 'media', 'presentation', 'preset'] as LibraryTab[]).map(tab => (
                 <button
                   key={tab}
                   onClick={() => { setActiveTab(tab); setSelectedCollection(null); }}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium tracking-[0.04em] transition-all duration-150 ${
                     activeTab === tab && !selectedCollection ? 'bg-primary text-black shadow-[0_10px_24px_rgba(245,158,11,0.24)]' : 'text-text/50 hover:bg-white/[0.05] hover:text-text'
                   }`}
                 >
                   {t(`library.${tab}`)}
                 </button>
               ))}
            </div>
            
            {/* Search Bar */}
            <div className="flex max-w-xl flex-1 items-center rounded-xl border border-text/10 bg-white/[0.03] px-3 transition-colors duration-150 focus-within:border-info/45 focus-within:bg-white/[0.05]">
               <Search size={14} className="text-text/30" />
               <input 
                 className="w-full border-none bg-transparent px-2.5 py-2.5 text-sm text-text placeholder:text-text/30 focus:outline-none"
                 placeholder={selectedCollection ? t('library.searchInCollection', { name: selectedCollection }) : t('library.searchPlaceholder')}
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
               {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="px-1 text-[10px] font-medium tracking-[0.04em] text-text/30 hover:text-text">{t('library.clearSearch')}</button>
               )}
            </div>

            <div className="flex-1"></div>

            <button 
              onClick={openSettings}
              className="control-button flex items-center gap-2 px-2.5 py-2 text-[11px] font-medium tracking-[0.03em]"
            >
               <Settings size={14} />
            </button>

            <button 
              onClick={() => setActiveView('capture')}
              className="control-button flex items-center gap-2 px-2.5 py-2 text-[11px] font-medium tracking-[0.03em]"
              title={t('library.openCapturePanel')}
            >
               <ScreenShare size={14} /> <span className="hidden sm:inline">{t('library.capture')}</span>
            </button>

            <button
              onClick={() => setActiveView('audio')}
              className="control-button flex items-center gap-2 px-3 py-2 text-[11px] font-medium tracking-[0.03em]"
              title={t('library.openAudioPanel')}
            >
              <Volume2 size={14} /> <span className="hidden sm:inline">{t('library.audioPanel')}</span>
            </button>

            <button
              onClick={() => setActiveView('bible')}
              className="control-button flex items-center gap-2 px-3 py-2 text-[11px] font-medium tracking-[0.03em]"
              title={t('library.openBiblePanel')}
            >
              <BookOpen size={14} /> <span className="hidden sm:inline">{t('library.biblePanel')}</span>
            </button>

            <button
              onClick={async () => {
                const res = await ipcAudioService.importFile();
                if (res && res.length > 0) {
                  setActiveView('audio');
                }
              }}
              className="control-button-primary flex items-center gap-2 px-3 py-2 text-[11px] font-medium tracking-[0.03em]"
              title={t('library.importAudioFiles')}
            >
              <Volume2 size={14} /> <span className="hidden sm:inline">{t('library.addAudio')}</span>
            </button>

            <button 
              onClick={() => void handlePdfImport()}
              title={t('library.importPdfPresentation')}
              className="control-button-primary flex items-center gap-2 px-3 py-2 text-[11px] font-medium tracking-[0.03em]"
            >
               <FileText size={16} /> <span className="hidden sm:inline">{t('library.addPdf')}</span>
            </button>

            {activeTab === 'media' ? (
              <>
                <button 
                  onClick={async () => {
                     const res = await ipcMediaService.importFile();
                     if (res && res.length > 0) refreshData();
                  }}
                  title={t('library.addImageOrVideo')}
                  className="control-button-primary flex items-center gap-2 px-3 py-2 text-[11px] font-medium tracking-[0.03em]"
                >
                   <Plus size={16} /> <span className="hidden sm:inline">{t('library.addImageVideo')}</span>
                </button>

                <button 
                  onClick={() => setIsAddOnlineOpen(true)}
                  title="Add YouTube Video"
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-[11px] font-bold text-white shadow hover:bg-red-500 transition-all"
                >
                   <Globe size={16} /> <span className="hidden sm:inline">+ Online YouTube</span>
                </button>
              </>
            ) : activeTab === 'preset' ? (
              <button
                onClick={() => setActiveTab('preset')}
                className="control-button-primary flex items-center gap-2 px-3 py-2 text-[11px] font-medium tracking-[0.03em]"
              >
                <LayoutTemplate size={16} /> <span className="hidden sm:inline">{t('library.presetLibrary')}</span>
              </button>
            ) : (
              <button 
                onClick={() => onOpenSongEditor(null)}
                className="control-button-primary flex items-center gap-2 px-3 py-2 text-[11px] font-medium tracking-[0.03em]"
              >
                 <Plus size={16} /> <span className="hidden sm:inline">{t('library.addSong')}</span>
              </button>
            )}
         </div>

         {activeTab === 'preset' ? (
           <SongPresetLibraryPanel searchQuery={searchQuery} refreshToken={refreshToken} />
         ) : (
         <div className="flex-1 overflow-y-auto p-3">

            <div className="mb-2.5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-text/35">{t('library.contentPool')}</div>
                <div className="text-sm font-medium text-text/88">
                  {activeTab === 'all'
                    ? t('library.songsAndMedia')
                  : activeTab === 'media'
                  ? t('library.mediaLibrary')
                  : activeTab === 'presentation'
                  ? t('library.pdfPresentations')
                  : t('library.sectionLibrary', { name: t(`library.${activeTab}`) })}
                </div>
              </div>
              <div className="text-[10px] font-mono tracking-[0.06em] text-text/32">
                {t('library.itemsLoaded', {
                  count: activeTab === 'media'
                    ? mediaItems.length
                    : activeTab === 'all'
                    ? songs.length + mediaItems.length
                    : activeTab === 'presentation'
                    ? mediaItems.filter((media) => media.mediaType === 'pdf').length
                    : songs.length
                })}
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(146px,1fr))] gap-2.5">
               {songs
                 .filter(_s => activeTab === 'all' || activeTab === 'song')
                 .map(song => (
                  <div 
                    key={song.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, song)}
                    onClick={() => void handleSongPreview(song.id)}
                    onDoubleClick={() => void handleSongGoLive(song.id)}
                    onContextMenu={(e) => handleContextMenu(e, song.id)}
                    className="group relative flex cursor-grab flex-col gap-2 rounded-[18px] border border-white/8 bg-white/[0.03] p-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.05] hover:shadow-[0_12px_24px_rgba(0,0,0,0.14)] active:cursor-grabbing"
                  >
                     {/* Delete button */}
                     <button
                        onClick={async (e) => {
                           e.stopPropagation();
                           e.preventDefault();
                           if (confirm(t('library.deleteSongConfirm', { name: song.title }))) {
                              await ipcSongService.delete(song.id);
                              await refreshData();
                           }
                        }}
                        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/0 opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-error/90 hover:text-white group-hover:opacity-100 group-hover:text-white/60"
                        title={t('library.deleteSong')}
                     >
                        <Trash2 size={11} />
                     </button>

                    {/* Icon Box */}
                    <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-[14px] border border-white/8 bg-[linear-gradient(180deg,rgba(88,213,247,0.06),rgba(255,255,255,0.02))] text-text/20 transition-colors duration-150 group-hover:text-primary">
                       <Music size={24} />
                        
                        {/* Edit Button Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               ipcSongService.getById(song.id).then((song) => onOpenSongEditor(song));
                             }}
                             className="rounded-full bg-primary p-2.5 text-black shadow-lg shadow-primary/20 transition-transform duration-150 hover:scale-110 active:scale-95"
                             title={t('library.editSong')}
                           >
                              <Edit3 size={18} />
                           </button>
                        </div>
                       
                       {/* Tags Overlay */}
                       <div className="absolute bottom-1 right-1 flex flex-wrap justify-end gap-1">
                          {JSON.parse(song.tags || '[]').slice(0, 2).map((t: string) => (
                             <div key={t} className="rounded-full border border-primary/25 bg-primary/12 px-1.5 py-0.5 text-[7px] font-medium uppercase tracking-[0.1em] text-primary">
                                {t}
                             </div>
                          ))}
                       </div>
                    </div>
                    
                    <div className="min-w-0">
                       <div className="truncate text-[13px] font-medium text-text/88 transition-colors duration-150 group-hover:text-primary">{song.title}</div>
                       <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-text/46">
                          {song.author || t('common.unknownArtist')}
                       </div>
                    </div>
                 </div>
               ))}
               
               {mediaItems
                 .filter((media) => {
                    if (activeTab === 'all') return true;
                    if (activeTab === 'presentation') return media.mediaType === 'pdf';
                    if (activeTab === 'media') return media.mediaType === 'image' || media.mediaType === 'video';
                    return false;
                  })
                 .map(media => (
                  (() => {
                    const isPdf = media.mediaType === 'pdf';
                    const showPdfActions = isPdf && libraryPreviewMedia?.id === media.id;
                    return (
                  <div 
                    key={media.id}
                    draggable
                    onClick={() => handleMediaPreview(media)}
                    onDoubleClick={() => handleMediaGoLive(media)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'media',
                        id: media.id,
                        title: media.filename
                      }));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="group relative flex cursor-grab flex-col gap-2 rounded-[18px] border border-white/8 bg-white/[0.03] p-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.05] hover:shadow-[0_12px_24px_rgba(0,0,0,0.14)] active:cursor-grabbing"
                  >
                     {/* Delete button */}
                     <button
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteMedia(media.id, media.filename); }}
                        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/0 opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-error/90 hover:text-white group-hover:opacity-100 group-hover:text-white/60"
                        title={t('library.deleteMedia')}
                     >
                        <Trash2 size={11} />
                     </button>
                     <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-[14px] border border-white/8 bg-[linear-gradient(180deg,rgba(88,213,247,0.06),rgba(255,255,255,0.02))] text-text/20 transition-colors duration-150 group-hover:text-primary">
                        {media.thumbnail || (media.mediaType === 'pdf' && getPdfPlaybackSettings(media).pageUrls[0]) ? (
                           <img 
                              src={toRenderableMediaUrl(media.thumbnail || getPdfPlaybackSettings(media).pageUrls[0] || '')} 
                              alt={media.filename}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                           />
                        ) : media.mediaType === 'video' ? (
                           <Video size={24} />
                        ) : media.mediaType === 'pdf' ? (
                           <FileText size={24} />
                        ) : (
                           <ImageIcon size={24} />
                        )}
                        {media.mediaType === 'pdf' && (
                          <div className="absolute bottom-2 right-2 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/80">
                            {t('library.pagesCount', { count: getPdfPlaybackSettings(media).pageCount })}
                          </div>
                        )}
                     </div>
                     <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-text/88 transition-colors duration-150 group-hover:text-primary">{media.filename}</div>
                        <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-text/46">
                           {media.mediaType === 'video' ? t('library.mediaTypeVideo') : media.mediaType === 'pdf' ? t('library.mediaTypePdf') : t('library.mediaTypeImage')}
                        </div>
                        {showPdfActions && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPdfPresenter(media);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/12 text-primary transition-colors hover:border-primary/45 hover:bg-primary/18"
                              title={t('library.openInPresenter')}
                            >
                              <MonitorUp size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPdfStandard(media);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-text/72 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-text"
                              title={t('library.openInStandard')}
	                            >
	                              <FileText size={14} />
	                            </button>
	                          </div>
	                        )}
	                     </div>
	                  </div>
	                );
	                  })()
	               ))}
               
            </div>
            
	            {songs.length === 0 && (
	               <div className="flex h-64 flex-col items-center justify-center text-text/30">
	                  <Search size={48} className="mb-4 opacity-20" />
	                  <div className="text-sm font-medium tracking-[0.04em]">{t('library.noResultsFound')}</div>
	                  <div className="mt-1 text-xs text-text/40">{t('library.noResultsHelp')}</div>
	               </div>
	            )}
	         </div>
         )}

         {/* Context Menu */}
         {contextMenu && (
            <div 
               className="panel-shell fixed z-50 flex min-w-[180px] flex-col py-1 text-xs text-text"
               style={{ top: contextMenu.y, left: contextMenu.x }}
            >
               {/* Edit Action */}
               <button 
                  onClick={async () => {
                     const song = await ipcSongService.getById(contextMenu.songId);
                     onOpenSongEditor(song);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-left text-primary transition-colors duration-150 hover:bg-primary/12"
               >
                  <Edit3 size={12} /> {t('library.editSongContent')}
               </button>

               <div className="h-px bg-text/5 my-1"></div>

               <div className="mb-1 border-b border-text/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-text/30">
                  {t('library.collections')}
               </div>
               
               {/* Existing Collections */}
               {collections.map(tag => (
                  <button 
                     key={tag}
                     onClick={async () => {
                        // await ipcSongService.addTag(contextMenu.songId, tag);
                        refreshData();
                     }}
                     className="flex items-center gap-2 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-primary/12 hover:text-primary"
                  >
                     <FolderOpen size={12} /> {t('library.addToCollection', { name: tag })}
                  </button>
               ))}
               
               <button 
                  onClick={() => {
                     const tag = prompt(t('library.newCollectionPrompt'));
                     if (tag) {
                        // await ipcSongService.addTag(contextMenu.songId, tag);
                        refreshData();
                     }
                  }}
                  className="mt-1 flex items-center gap-2 border-t border-text/5 px-3 py-1.5 text-left text-primary transition-colors duration-150 hover:bg-white/[0.04]"
               >
                  <Plus size={12} /> {t('library.newCollection')}...
               </button>
               
               <div className="h-px bg-text/5 my-1"></div>
               
               <button 
                  onClick={async () => {
                     if (confirm(t('library.deleteSongConfirmShort'))) {
                        await ipcSongService.delete(contextMenu.songId);
                        refreshData();
                     }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-left text-red-400 transition-colors duration-150 hover:bg-red-500/16 hover:text-red-300"
               >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  {t('library.deleteSong')}
               </button>
            </div>
         )}
         {isAddOnlineOpen && (
           <AddOnlineMediaModal
             onClose={() => setIsAddOnlineOpen(false)}
             onSuccess={() => void refreshData()}
           />
         )}
      </div>
    </div>
  );
}
