import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { useElementSize } from '../../hooks/useElementSize';
import type { SongEditorSlide, SongWithSlides } from '../../core/services/ipcSongService';
import { ipcMediaService } from '../../core/services/ipcMediaService';
import { ipcTemplateService } from '../../core/services/ipcTemplateService';
import type { Media, Template } from '../../electron/database/schema';


// Refactored Parts
import { useEditorLogic, type SlideWithLayers } from './AdvancedEditorParts/useEditorLogic';
import { SlideListPanel } from './AdvancedEditorParts/SlideListPanel';
import { LayerListPanel } from './AdvancedEditorParts/LayerListPanel';
import { CanvasArea } from './AdvancedEditorParts/CanvasArea';
import { PropertiesPanel } from './AdvancedEditorParts/PropertiesPanel';

interface AdvancedEditorProps {
  song: SongWithSlides | null;
  slides: SongEditorSlide[];
  onUpdate: (updates: { slides: SlideWithLayers[] }) => void;
  selectedTemplateId: string | null;
}

export default function AdvancedEditor({ song, slides: initialSlides, onUpdate, selectedTemplateId }: AdvancedEditorProps) {
  // Global Settings
  const { outputWidth, outputHeight } = useSettingsStore();
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [slidesCollapsed, setSlidesCollapsed] = useState(false);
  const [layersCollapsed, setLayersCollapsed] = useState(false);


  // Canvas Measurements
  const { ref: canvasRef, width: containerW, height: containerH } = useElementSize<HTMLDivElement>();
  const slideCanvasRef = useRef<HTMLDivElement>(null);
  const targetAspect = outputWidth / outputHeight;
  const containerAspect = containerW / containerH;
  const isConstrainedByHeight = containerAspect > targetAspect;
  const canvasStyle = isConstrainedByHeight 
     ? { height: '100%', aspectRatio: targetAspect }
     : { width: '100%', aspectRatio: targetAspect };

  useEffect(() => {
    let cancelled = false;

    ipcMediaService.getAll().then((items) => {
      if (!cancelled) setMediaItems(items);
    }).catch(() => {
      if (!cancelled) setMediaItems([]);
    });

    const refreshMedia = () => {
       ipcMediaService.getAll().then(items => { if (!cancelled) setMediaItems(items) });
    };
    window.addEventListener('ramedia:refresh-media', refreshMedia);

    ipcTemplateService.seed().then(() => {
      ipcTemplateService.getAll().then((items) => {
        if (!cancelled) setTemplates(items);
      });
    });

    return () => {
      cancelled = true;
      window.removeEventListener('ramedia:refresh-media', refreshMedia);
    };
  }, []);


  // Editor Logic (State & Accessors)
  const {
    slides,
    selectedSlideId,
    selectedLayerId,
    selectedSlide,
    selectedLayer,
    setSelectedSlideId,
    setSelectedLayerId,
    addSlide,
    deleteSlide,
    undo,
    redo,
    canUndo,
    canRedo,
    addLayer,
    deleteLayer,
    reorderLayers,
    updateLayer,
    updateSelectedLayer,
    alignSelectedLayer,
    updateSlideContent
  } = useEditorLogic(song, initialSlides, onUpdate, slideCanvasRef, selectedTemplateId, templates);


  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // 1. Undo / Redo
      if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (isShift) redo();
        else undo();
      }
      if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }

      // 2. Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerId) {
          e.preventDefault();
          deleteLayer(selectedLayerId);
        }
      }

      // 3. Nudging
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (selectedLayer) {
          e.preventDefault();
          const currentStyle = typeof selectedLayer.style === 'string' 
            ? JSON.parse(selectedLayer.style || '{}') 
            : (selectedLayer.style || {});
          
          const step = isShift ? 5 : 1;
          const nextStyle = { ...currentStyle };
          
          if (e.key === 'ArrowLeft') nextStyle.x = (nextStyle.x ?? 50) - step;
          if (e.key === 'ArrowRight') nextStyle.x = (nextStyle.x ?? 50) + step;
          if (e.key === 'ArrowUp') nextStyle.y = (nextStyle.y ?? 50) - step;
          if (e.key === 'ArrowDown') nextStyle.y = (nextStyle.y ?? 50) + step;

          updateSelectedLayer({ style: JSON.stringify(nextStyle) });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, selectedLayer, undo, redo, deleteLayer, updateSelectedLayer]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-surface text-text">
      {/* LEFT: Slide Strip */}
      <SlideListPanel 
        slides={slides}
        selectedSlideId={selectedSlideId}
        onSelectSlide={setSelectedSlideId}
        onAddSlide={addSlide}
        onDeleteSlide={deleteSlide}
        isCollapsed={slidesCollapsed}
        onToggleCollapse={() => setSlidesCollapsed(!slidesCollapsed)}
      />

      {/* LEFT-CENTER: Layers Strip */}
      <LayerListPanel
        layers={selectedSlide?.layers || []}
        selectedLayerId={selectedLayerId}
        onSelectLayer={setSelectedLayerId}
        onToggleVisibility={(layerId, visible) => updateLayer(layerId, { visible })}
        onDeleteLayer={deleteLayer}
        onReorderLayer={reorderLayers}
        onAddLayer={addLayer}
        isCollapsed={layersCollapsed}
        onToggleCollapse={() => setLayersCollapsed(!layersCollapsed)}
      />

      {/* CENTER: Canvas Editor */}
      <CanvasArea 
         selectedSlide={selectedSlide}
         selectedLayerId={selectedLayerId}
         onSelectLayer={setSelectedLayerId}
         canvasRef={canvasRef}
         slideCanvasRef={slideCanvasRef}
         outputWidth={outputWidth}
         outputHeight={outputHeight}
         canvasStyle={canvasStyle}
         onAddLayer={addLayer}
      />

      {/* RIGHT: Inspector & Layers */}
      <PropertiesPanel 
         selectedLayer={selectedLayer}
         updateSelectedLayer={updateSelectedLayer}
         updateContent={updateSlideContent}
         mediaItems={mediaItems}
         undo={undo}
         redo={redo}
         canUndo={canUndo}
         canRedo={canRedo}
         onAlign={alignSelectedLayer}
         onDeleteLayer={deleteLayer}
      />
    </div>
  );
}
