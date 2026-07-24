import { useState, useEffect, useRef } from 'react';
import type { SongEditorSlide, SongWithSlides } from '../../../core/services/ipcSongService';
import type { Slide, SlideLayer, Template } from '../../../electron/database/schema';
import { createDefaultSlideLayers } from '../../../core/songEditor/defaultLayers';
import { ipcTemplateService } from '../../../core/services/ipcTemplateService';
import { useSettingsStore } from '../../../core/stores/useSettingsStore';
import { buildLayersFromSongPreset } from '../../../core/songEditor/songPresets';

function parseRecord(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// Helper type for Slide with Layers
export type SlideWithLayers = Slide & { layers: SlideLayer[] };

export function useEditorLogic(
  song: SongWithSlides | null, 
  initialSlides: SongEditorSlide[],
  onUpdate: (updates: { slides: SlideWithLayers[] }) => void,
  canvasRef: React.RefObject<HTMLDivElement>,
  selectedTemplateId?: string | null,
  templates?: Template[]
) {
  const prevTemplateIdRef = useRef<string | null | undefined>(undefined);

  // Local state for slides
  const [slides, setSlides] = useState<SlideWithLayers[]>([]);
  const slidesRef = useRef(slides); 
  slidesRef.current = slides;
  
  // Selection state
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // History state for Undo/Redo
  const [past, setPast] = useState<SlideWithLayers[][]>([]);
  const [future, setFuture] = useState<SlideWithLayers[][]>([]);

  const saveHistory = () => {
    // Limit history stack to 50 items
    setPast(prev => [...prev.slice(-49), slidesRef.current]);
    setFuture([]); // Clear redo stack on new action
  };

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setFuture([slides, ...future]);
    setSlides(previous);
    setPast(newPast);
    onUpdate({ slides: previous });
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast([...past, slides]);
    setSlides(next);
    setFuture(newFuture);
    onUpdate({ slides: next });
  };

  // Interaction State
  const [dragState, setDragState] = useState<{
     isDragging: boolean;
     type: 'move' | 'rotate' | 'resize' | null;
     startX: number;
     startY: number;
     initialX?: number;
     initialY?: number;
     initialRotation?: number;
     initialScale?: number;
     initialStyle?: any;
  }>({ isDragging: false, type: null, startX: 0, startY: 0 });

  // Initialize state from prop
  useEffect(() => {
    if (initialSlides?.length) {
      setPast([]); // Reset history on new song load
      setFuture([]);
      
      const defaultSongStyle = useSettingsStore.getState().defaultSongStyle;
      
      // PRE-FILL layerless slides
      const mappedSlides = initialSlides.map(slide => {
        if (!slide.layers || slide.layers.length === 0) {
           return {
             ...slide,
             layers: createDefaultSlideLayers(slide.id, slide.content || '', defaultSongStyle)
           };
        }
        return slide;
      });

      setSlides(mappedSlides);
      if (mappedSlides.length > 0) {
        setSelectedSlideId(mappedSlides[0].id);
        // Select Text layer by default if exists
        const textLayer = mappedSlides[0].layers.find(l => l.layerType === 'text');
        if (textLayer) setSelectedLayerId(textLayer.id);
      }
    } else if (slides.length === 0) {
      // Initialize with 1 empty slide if new song
      addSlide();
    }
  }, [song?.id, initialSlides?.[0]?.id]);

  // Listen for template changes from the parent modal
  useEffect(() => {
    if (prevTemplateIdRef.current === undefined) {
      prevTemplateIdRef.current = selectedTemplateId;
      return;
    }

    if (prevTemplateIdRef.current === selectedTemplateId) return;
    prevTemplateIdRef.current = selectedTemplateId;

    if (!selectedTemplateId || !templates || templates.length === 0) return;
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    // Apply template to ALL slides
    saveHistory();
    const defaultSongStyle = useSettingsStore.getState().defaultSongStyle;
    
    const newSlides = slidesRef.current.map((slide) => {
      const newLayers = buildLayersFromSongPreset(
        slide.id,
        slide.content || '',
        template,
        defaultSongStyle,
        {
          songTitle: song?.title || 'Song Title',
          sectionLabel: slide.sectionType
            ? `${slide.sectionType.charAt(0).toUpperCase()}${slide.sectionType.slice(1)}${slide.sectionNumber ? ` ${slide.sectionNumber}` : ''}`
            : `Slide ${slide.orderIndex}`,
        },
      );
      return {
        ...slide,
        layers: newLayers
      };
    });

    setSlides(newSlides);
    onUpdate({ slides: newSlides });
  }, [selectedTemplateId, templates]);

  // Actions
  function addSlide() {
    const slideId = crypto.randomUUID();
    saveHistory();
    const newSlide: SlideWithLayers = {
      id: slideId,
      songId: song?.id || '',
      orderIndex: slides.length + 1,
      sectionType: 'verse',
      sectionNumber: 1,
      content: '',
      notes: null,
      customThemeId: null,
      createdAt: new Date().toISOString(),
      layers: createDefaultSlideLayers(slideId, 'New Slide', useSettingsStore.getState().defaultSongStyle),
    };
    
    // Auto-label logic
    const verseCount = slides.filter(s => s.sectionType === 'verse').length;
    newSlide.sectionType = 'verse';
    newSlide.sectionNumber = verseCount + 1;
    newSlide.content = `Verse ${verseCount + 1}`;
    newSlide.layers.find(l => l.layerType === 'text')!.content = newSlide.content;

    const newSlides = [...slides, newSlide];
    setSlides(newSlides);
    setSelectedSlideId(slideId);
    onUpdate({ slides: newSlides });
  }

  const deleteSlide = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (slides.length <= 1) return;
    
    saveHistory();
    const newSlides = slides.filter(s => s.id !== id);
    setSlides(newSlides);
    if (selectedSlideId === id) {
      setSelectedSlideId(newSlides[0].id);
    }
    onUpdate({ slides: newSlides });
  };

  const updateLayer = (layerId: string, updates: Partial<SlideLayer>, recordHistory = true) => {
    if (!selectedSlideId) return;

    if (recordHistory) saveHistory();

    const newSlides = slidesRef.current.map(slide => {
      if (slide.id !== selectedSlideId) return slide;
      
      return {
        ...slide,
        layers: slide.layers.map(layer => {
          if (layer.id !== layerId) return layer;
          return { ...layer, ...updates };
        })
      };
    });

    setSlides(newSlides);
    onUpdate({ slides: newSlides });
  };

  const updateSelectedLayer = (updates: Partial<SlideLayer>, recordHistory = true) => {
    if (!selectedLayerId) return;
    updateLayer(selectedLayerId, updates, recordHistory);
  };
  
  const updateSlideContent = (content: string) => {
    if (!selectedSlideId) return;

    saveHistory();
    
    const newSlides = slidesRef.current.map(slide => {
      if (slide.id !== selectedSlideId) return slide;
      
      return {
        ...slide,
        content,
        // Update ALL text layers with this content? 
        // For "Simple lyrics input", we usually update the FIRST text layer.
        layers: slide.layers.map((l, idx) => 
          (l.layerType === 'text' && idx === slide.layers.findIndex(ly => ly.layerType === 'text')) 
            ? { ...l, content } 
            : l
        )
      };
    });
    
    setSlides(newSlides);
    onUpdate({ slides: newSlides });
  };

  const addLayer = (type: 'text' | 'media' | 'overlay' | 'background') => {
    if (!selectedSlideId) return;
    saveHistory();

    const newLayer: SlideLayer = {
      id: crypto.randomUUID(),
      slideId: selectedSlideId,
      layerType: type,
      layerOrder: selectedSlide ? selectedSlide.layers.length + 1 : 1,
      content: type === 'text' ? 'New Text Layer' : type === 'overlay' ? 'rgba(0, 0, 0, 0.35)' : null,
      visible: true,
      opacity: 1,
      mediaId: null,
      style: type === 'text' ? JSON.stringify({
        x: 50,
        y: 50,
        rotation: 0,
        sizingMode: 'auto',
        boxWidth: 80,
        boxHeight: 40,
        allowWrap: true,
        scale: 1,
        color: '#ffffff',
        textAlign: 'center',
        textRole: 'static',
        fontFamily: 'Manrope, Inter, sans-serif',
        fontWeight: 600,
        fontStyle: 'normal',
        textDecoration: 'none',
        shadow: true,
      }) : type === 'overlay' ? JSON.stringify({
        overlayType: 'solid',
        background: 'rgba(0, 0, 0, 0.35)',
      }) : JSON.stringify({
        mediaType: null,
        source: null,
        objectFit: type === 'background' ? 'cover' : 'contain',
        x: 50,
        y: 50,
        scale: 0.5,
      }),
      transition: null,
    };

    const newSlides = slides.map(s => {
      if (s.id !== selectedSlideId) return s;
      return { ...s, layers: [...s.layers, newLayer] };
    });

    setSlides(newSlides);
    setSelectedLayerId(newLayer.id);
    onUpdate({ slides: newSlides });
  };

  const deleteLayer = (layerId: string) => {
    if (!selectedSlideId) return;
    const slide = slides.find(s => s.id === selectedSlideId);
    if (!slide) return;
    saveHistory();

    // Prevent deleting the very last layer or the base layer?
    // Let's at least protect the 'base' layer for now as it's the background color.
    const layer = slide.layers.find(l => l.id === layerId);
    if (layer?.layerType === 'base') return;

    const newSlides = slides.map(s => {
      if (s.id !== selectedSlideId) return s;
      return { ...s, layers: s.layers.filter(l => l.id !== layerId) };
    });

    setSlides(newSlides);
    if (selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
    onUpdate({ slides: newSlides });
  };

  const reorderLayers = (startIndex: number, endIndex: number) => {
    if (!selectedSlideId || !selectedSlide) return;
    saveHistory();

    const newLayers = Array.from(selectedSlide.layers);
    const [removed] = newLayers.splice(startIndex, 1);
    newLayers.splice(endIndex, 0, removed);

    // Update layerOrder property for all to match index
    const updatedLayers = newLayers.map((l, idx) => ({
      ...l,
      layerOrder: idx + 1
    }));

    const newSlides = slides.map(s => {
      if (s.id !== selectedSlideId) return s;
      return { ...s, layers: updatedLayers };
    });

    setSlides(newSlides);
    onUpdate({ slides: newSlides });
  };

  const alignSelectedLayer = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedLayer || !selectedLayerId) return;
    saveHistory();

    const currentStyle = parseRecord(selectedLayer.style);
    
    const newStyle = { ...currentStyle };
    const boxWidth = Math.max(0, Math.min(100, Number(currentStyle.boxWidth ?? 0) || 0));
    const halfBoxWidth = selectedLayer.layerType === 'text' && boxWidth > 0 ? boxWidth / 2 : 0;
    const isFixedText = selectedLayer.layerType === 'text' && currentStyle.sizingMode === 'fixed';
    const boxHeight = Math.max(0, Math.min(100, Number(currentStyle.boxHeight ?? 0) || 0));
    const halfBoxHeight = isFixedText && boxHeight > 0 ? boxHeight / 2 : 0;
    
    switch (alignment) {
      case 'left': newStyle.x = halfBoxWidth; break;
      case 'center': newStyle.x = 50; break;
      case 'right': newStyle.x = 100 - halfBoxWidth; break;
      case 'top': newStyle.y = halfBoxHeight; break;
      case 'middle': newStyle.y = 50; break;
      case 'bottom': newStyle.y = 100 - halfBoxHeight; break;
    }

    updateSelectedLayer({ style: JSON.stringify(newStyle) }, false);
  };
  
  const applyTemplate = (template: Template) => {
    if (!selectedSlideId || !selectedSlide) return;
    saveHistory();

    const newLayers = buildLayersFromSongPreset(
      selectedSlideId,
      selectedSlide.content || '',
      template,
      useSettingsStore.getState().defaultSongStyle,
      {
        songTitle: song?.title || 'Song Title',
        sectionLabel: selectedSlide.sectionType
          ? `${selectedSlide.sectionType.charAt(0).toUpperCase()}${selectedSlide.sectionType.slice(1)}${selectedSlide.sectionNumber ? ` ${selectedSlide.sectionNumber}` : ''}`
          : `Slide ${selectedSlide.orderIndex}`,
      },
    );

    const newSlides = slides.map(s => {
      if (s.id !== selectedSlideId) return s;
      return { ...s, layers: newLayers };
    });

    setSlides(newSlides);
    // Select first text layer if exists
    const firstText = newLayers.find(l => l.layerType === 'text');
    if (firstText) setSelectedLayerId(firstText.id);
    
    onUpdate({ slides: newSlides });
  };

  const saveAsTemplate = async (name: string, category: string) => {
    if (!selectedSlide) return;
    
    // Scrub slideId and other specific data from layers
    const layersData = JSON.stringify(selectedSlide.layers.map(l => ({
      layerType: l.layerType,
      visible: l.visible,
      opacity: l.opacity,
      content: l.layerType === 'text' ? null : l.content, // Don't save lyrics in template
      mediaId: l.mediaId,
      style: l.style,
      transition: l.transition
    })));

    await ipcTemplateService.create(name, category, layersData);
  };


  // Note: For updateSelectedLayer during drag, we only want to save history 
  // at the START or END of interaction, not every mouseMove.
  // We'll call saveHistory in handleInteractStart.

  // Global Drag listeners
  useEffect(() => {
    // 1. Listen for START interaction
    const handleInteractStart = (e: any) => {
      const { type, clientX, clientY, layerId } = e.detail;
      // Read from ref to get LATEST slides
      const layer = slidesRef.current.find(s => s.id === selectedSlideId)?.layers.find(l => l.id === layerId);
      if (!layer) return;

      const s = parseRecord(layer.style);
      saveHistory(); // Save snapshot before drag/rotate/resize
      
      setDragState({
         isDragging: true,
         type,
         startX: clientX,
         startY: clientY,
         initialX: s.x ?? 50,
         initialY: s.y ?? 50,
         initialRotation: s.rotation || 0,
         initialScale: s.scale || 1,
         initialStyle: s
      });
    };

    window.addEventListener('editor-interact', handleInteractStart as any);

    // 2. Handle Dragging
    if (dragState.isDragging && dragState.type) {
      const handleMouseMove = (e: MouseEvent) => {
         const rect = canvasRef.current?.getBoundingClientRect();
         if (!rect) return;
         
         const current = dragState.initialStyle || {};
         
         if (dragState.type === 'move') {
            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;
            
            const movePctX = (deltaX / rect.width) * 100;
            const movePctY = (deltaY / rect.height) * 100;

            updateSelectedLayer({
               style: JSON.stringify({
                  ...current,
                  x: (dragState.initialX || 0) + movePctX,
                  y: (dragState.initialY || 0) + movePctY
               })
            }, false);
         }
         else if (dragState.type === 'rotate') {
            const centerX = rect.left + ((dragState.initialX ?? 50) / 100) * rect.width;
            const centerY = rect.top + ((dragState.initialY ?? 50) / 100) * rect.height;
            
            const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
            const snapped = e.shiftKey ? Math.round(angle / 45) * 45 : angle;
            const rotation = snapped + 90;

            updateSelectedLayer({
               style: JSON.stringify({ ...current, rotation })
            }, false);
         }
         else if (dragState.type?.startsWith('resize')) {
            const centerX = rect.left + ((dragState.initialX ?? 50) / 100) * rect.width;
            const centerY = rect.top + ((dragState.initialY ?? 50) / 100) * rect.height;
            const rotation = dragState.initialRotation || 0;

            // Un-rotate mouse position
            const rad = (Math.PI / 180) * -rotation;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;
            
            const localDx = (dx * cos) - (dy * sin); 
            const localDy = (dx * sin) + (dy * cos);

            const sizingMode = current.sizingMode || 'auto';
            const handle = dragState.type || '';

            const newStyle = { ...current };

            // 1. Width Resizing (Available in BOTH modes)
            if (handle.includes('w') || handle.includes('e')) {
               const wPx = Math.abs(localDx) * 2;
               const wPct = (wPx / rect.width) * 100;
               newStyle.boxWidth = Math.max(5, Math.min(100, wPct));
            }

            // 2. Height Resizing (Fixed Mode ONLY)
            if (sizingMode === 'fixed' && (handle.includes('n') || handle.includes('s'))) {
               const hPx = Math.abs(localDy) * 2;
               const hPct = (hPx / rect.height) * 100;
               newStyle.boxHeight = Math.max(5, Math.min(100, hPct));
            }

            updateSelectedLayer({ style: JSON.stringify(newStyle) }, false);
         }
      };

      const handleMouseUp = () => {
         setDragState(prev => ({ ...prev, isDragging: false, type: null }));
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
         window.removeEventListener('mousemove', handleMouseMove);
         window.removeEventListener('mouseup', handleMouseUp);
      };
    }

    return () => {
       window.removeEventListener('editor-interact', handleInteractStart as any);
    };

  }, [dragState.isDragging, selectedSlideId, selectedLayerId]); // Dependencies

  // Derived
  const selectedSlide = slides.find(s => s.id === selectedSlideId);
  const selectedLayer = selectedSlide?.layers.find(l => l.id === selectedLayerId);

  return {
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
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    addLayer,
    deleteLayer,
    reorderLayers,
    updateLayer,
    updateSelectedLayer,
    alignSelectedLayer,
    alignLayer: alignSelectedLayer, // correct aliasing

    applyTemplate,
    saveAsTemplate,
    updateSlideContent
  };

}
