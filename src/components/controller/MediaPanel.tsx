import { useState, useEffect } from 'react';
import { Image, Video, Trash2, Plus, Search, Settings2, FileText, Globe } from 'lucide-react';
import { ipcMediaService } from '../../core/services/ipcMediaService';
import type { Media } from '../../electron/database/schema';
import { toRenderableMediaUrl } from '../../core/utils/mediaUrl';
import { getPdfPlaybackSettings, importPdfWithRasterizer, repairPdfMediaCache } from '../../core/utils/pdf';
import { isScheduleOnlyMedia } from '../../core/utils/mediaVisibility';
import MediaInspectorModal from '@/components/modals/MediaInspectorModal';
import AddOnlineMediaModal from '@/components/modals/AddOnlineMediaModal';
import { useI18n } from '../../i18n';

export default function MediaPanel() {
  const { t } = useI18n();
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingMedia, setInspectingMedia] = useState<Media | null>(null);
  const [isRasterizing, setIsRasterizing] = useState(false);
  const [isAddOnlineOpen, setIsAddOnlineOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'image' | 'video' | 'pdf' | 'youtube'>('all');

  useEffect(() => {
    refreshData();
  }, []);

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

  async function refreshData() {
    const items = await ipcMediaService.getAll();
    setMediaItems(items.filter((item) =>
      (item.mediaType === 'image' || item.mediaType === 'video' || item.mediaType === 'pdf' || item.mediaType === 'youtube') &&
      !isScheduleOnlyMedia(item)
    ));
  }

  async function handleFileUpload() {
    try {
      const result = await ipcMediaService.importFile();
      if (result) {
        refreshData();
      }
    } catch (err) {
      console.error("Failed to import media", err);
    }
  }

  async function handlePdfUpload() {
    if (!window.api) {
      alert(t('mediaPanel.desktopPdfOnly'));
      return;
    }

    setIsRasterizing(true);
    try {
      const success = await importPdfWithRasterizer(ipcMediaService, toRenderableMediaUrl);
      if (success) {
        setActiveFilter('pdf');
        await refreshData();
      }
    } catch (err) {
      console.error('Failed to import PDF', err);
      alert(t('mediaPanel.importPdfFailed'));
    } finally {
      setIsRasterizing(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirm(t('mediaPanel.deleteConfirm'))) {
      await ipcMediaService.delete(id);
      refreshData();
    }
  }

  const filteredItems = mediaItems.filter((item) => {
    const matchesSearch = item.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || item.mediaType === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const handleDragStart = (e: React.DragEvent, media: Media) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'media',
      id: media.id,
      title: media.filename
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const getPreviewSource = (item: Media) =>
    toRenderableMediaUrl(
      item.thumbnail ||
      (item.mediaType === 'pdf' ? getPdfPlaybackSettings(item).pageUrls[0] || '' : item.filepath)
    );

  return (
    <div className="panel-shell flex h-full flex-col border-t border-text/5 font-sans relative">
      {isRasterizing && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white font-medium animate-pulse">{t('mediaPanel.compilingPdf')}</p>
        </div>
      )}

      {inspectingMedia && (
        <MediaInspectorModal
          media={inspectingMedia}
          onClose={() => {
            setInspectingMedia(null);
            refreshData();
          }}
        />
      )}

      {isAddOnlineOpen && (
        <AddOnlineMediaModal
          onClose={() => setIsAddOnlineOpen(false)}
          onSuccess={() => {
            setActiveFilter('youtube');
            refreshData();
          }}
        />
      )}
      
      {/* Toolbar */}
      <div className="flex h-14 items-center gap-3 border-b border-text/5 bg-black/10 px-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-text/45">
           <Image size={16} /> {t('mediaPanel.title')}
        </div>

        <div className="flex rounded-xl border border-white/6 bg-white/[0.03] p-1">
          {[
            { id: 'all', label: t('mediaPanel.all') },
            { id: 'image', label: t('mediaPanel.images') },
            { id: 'video', label: t('mediaPanel.videos') },
            { id: 'pdf', label: 'PDF' },
            { id: 'youtube', label: '🌐 Online' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id as any)}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium tracking-[0.04em] transition-all duration-150 ${
                activeFilter === filter.id
                  ? 'bg-primary text-black shadow-[0_10px_24px_rgba(245,158,11,0.24)] font-bold'
                  : 'text-text/50 hover:bg-white/[0.05] hover:text-text'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        
        <div className="ml-4 flex max-w-md flex-1 items-center rounded-xl border border-text/10 bg-white/[0.03] px-3 transition-colors duration-150 focus-within:border-info/40">
           <Search size={14} className="text-text/30" />
           <input 
             className="w-full border-none bg-transparent px-3 py-3 text-sm text-text placeholder:text-text/30 focus:outline-none"
             placeholder={t('mediaPanel.searchPlaceholder')}
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
        </div>

        <div className="flex-1"></div>

        <button 
          onClick={async () => {
             if (confirm(t('mediaPanel.cleanupConfirm'))) {
                const result = await ipcMediaService.cleanupOrphans();
                if (result) {
                  alert(t('mediaPanel.cleanupResult', { count: result.deletedCount, mb: Math.round(result.savedBytes / 1024 / 1024) }));
                  refreshData();
                }
             }
          }}
          className="control-button flex items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em]"
        >
           <Trash2 size={16} /> {t('mediaPanel.cleanup')}
        </button>

        <button 
          onClick={handleFileUpload}
          className="control-button-primary flex items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em]"
        >
           <Plus size={16} /> {t('mediaPanel.importMedia')}
        </button>
        <button 
          onClick={handlePdfUpload}
          className="control-button-primary flex items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em]"
        >
           <FileText size={16} /> {t('mediaPanel.importPdf')}
        </button>

        <button 
          onClick={() => setIsAddOnlineOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] rounded-xl bg-red-600 text-white hover:bg-red-500 shadow-md shadow-red-600/20 transition-all"
        >
           <Globe size={16} /> + Online YouTube
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-text/35">{t('mediaPanel.assets')}</div>
            <div className="text-sm font-semibold text-text">{t('mediaPanel.assetsDescription')}</div>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-text/32">
            {t('library.itemsLoaded', { count: filteredItems.length })}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 pb-24">
           {filteredItems.map(item => {
              const previewSource = getPreviewSource(item);
              return (
              <div 
                key={item.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                className="group relative cursor-grab active:cursor-grabbing aspect-square overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.05] hover:shadow-[0_14px_30px_rgba(0,0,0,0.16)]"
                onDoubleClick={() => setInspectingMedia(item)}
              >
                 {/* Visual Placeholder */}
                 <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(88,213,247,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]">
                   {previewSource && (
                     <img
                       src={previewSource}
                       alt={item.filename}
                       className="absolute inset-0 h-full w-full object-cover"
                     />
                   )}
                   <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-150" />
                   <div className="relative z-10 drop-shadow-md">
                      {item.mediaType === 'youtube' ? (
                        <Globe size={32} className="text-red-400 group-hover:text-red-300 drop-shadow" />
                      ) : item.mediaType === 'video' ? (
                        <Video size={32} className="text-white/60 group-hover:text-white" />
                      ) : item.mediaType === 'pdf' ? (
                        <FileText size={32} className="text-white/60 group-hover:text-white" />
                      ) : (
                        <Image size={32} className="text-white/60 group-hover:text-white" />
                      )}
                   </div>
                 </div>

                 {/* Type Badge */}
                 {item.mediaType === 'youtube' && (
                   <span className="absolute top-2 left-2 rounded bg-red-600/90 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm z-20 shadow">
                     YOUTUBE
                   </span>
                 )}
                 
                 <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/60 p-2 backdrop-blur-md">
                    <div className="truncate text-center text-[10px] font-medium uppercase tracking-[0.14em] text-white/88 drop-shadow-sm">{item.filename}</div>
                    {item.mediaType === 'pdf' && (
                      <div className="mt-1 text-center text-[9px] font-medium uppercase tracking-[0.12em] text-white/55">
                        {t('library.pagesCount', { count: getPdfPlaybackSettings(item).pageCount })}
                      </div>
                    )}
                 </div>

                 {/* Inspect Action */}
                 <button 
                   onClick={(e) => { e.stopPropagation(); setInspectingMedia(item); }}
                   className="absolute left-2 top-2 rounded-lg bg-black/40 p-1.5 text-white/70 opacity-0 backdrop-blur-md transition-all duration-150 hover:bg-primary hover:text-black group-hover:opacity-100 z-30"
                   title={t('mediaPanel.inspector')}
                 >
                    <Settings2 size={12} />
                 </button>

                 {/* Delete Action */}
                 <button 
                   onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                   className="absolute right-2 top-2 rounded-lg bg-red-500/20 p-1.5 text-red-400 opacity-0 backdrop-blur-md transition-all duration-150 hover:bg-red-500 hover:text-white group-hover:opacity-100 z-30"
                   title={t('common.delete')}
                 >
                    <Trash2 size={12} />
                 </button>
              </div>
              );
            })}
            
            {filteredItems.length === 0 && (
               <div className="col-span-full flex h-40 flex-col items-center justify-center text-text/30 opacity-50">
                  <Image size={48} className="mb-2" />
                  <span className="text-xs font-medium uppercase tracking-[0.18em]">{t('mediaPanel.noMediaFound')}</span>
               </div>
            )}
         </div>
      </div>

      {/* Bottom Online Media Dock */}
      <div className="absolute bottom-0 inset-x-0 border-t border-red-500/20 bg-slate-950/90 backdrop-blur-md px-4 py-3 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
            <Globe size={16} />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>ONLINE MEDIA (YOUTUBE)</span>
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-semibold text-red-300">STREAM NO DOWNLOAD</span>
            </div>
            <div className="text-[10px] text-white/50">Tambah dan putar video YouTube secara langsung tanpa perlu unduh file.</div>
          </div>
        </div>

        <button
          onClick={() => setIsAddOnlineOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-red-600/20 hover:from-red-500 hover:to-rose-500 transition-all"
        >
          <Plus size={14} /> + Tambah YouTube Video
        </button>
      </div>
    </div>
  );
}
