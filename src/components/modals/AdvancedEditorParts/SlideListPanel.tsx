import React from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SlideWithLayers } from './useEditorLogic';
import { SlideLabelBadge } from '../../common/SlideLabelBadge';
import { findSlideLabel, useSlideLabelSettingsStore } from '../../../core/stores/useSlideLabelSettingsStore';

interface SlideListPanelProps {
  slides: SlideWithLayers[];
  selectedSlideId: string | null;
  onSelectSlide: (id: string) => void;
  onAddSlide: () => void;
  onDeleteSlide: (id: string, e: React.MouseEvent) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function SlideListPanel({ 
  slides, 
  selectedSlideId, 
  onSelectSlide, 
  onAddSlide, 
  onDeleteSlide,
  isCollapsed,
  onToggleCollapse,
}: SlideListPanelProps) {
  const labelSettings = useSlideLabelSettingsStore((state) => state.labels);
  if (isCollapsed) {
    return (
      <div className="flex w-12 shrink-0 flex-col items-center border-r border-text/10 bg-background py-3 gap-4">
        <button 
          onClick={onToggleCollapse} 
          className="rounded p-1 text-text/50 hover:bg-text/10 transition-colors"
          title="Expand Slide Strip"
        >
          <ChevronRight size={16} />
        </button>
        <button 
          onClick={onAddSlide} 
          className="rounded p-1.5 bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
          title="Add Slide"
        >
          <Plus size={14} />
        </button>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto w-full items-center px-1">
          {slides.map((slide, index) => {
            const setting = findSlideLabel(labelSettings, slide);
            return <button
              key={slide.id}
              onClick={() => onSelectSlide(slide.id)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition ${
                selectedSlideId === slide.id 
                  ? 'bg-primary/20 text-primary shadow-sm' 
                  : 'border border-text/10 bg-surface text-text/60 hover:bg-text/5'
              }`}
              style={selectedSlideId !== slide.id && setting ? { borderColor: setting.backgroundColor, color: setting.backgroundColor } : undefined}
              title={`${(slide.sectionType || 'slide').toUpperCase()} ${slide.sectionNumber || ''}`}
            >
              {index + 1}
            </button>;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-56 flex-col border-r border-text/10 bg-surface">
      <div className="flex items-center justify-between border-b border-text/10 p-3 h-12 shrink-0 bg-background">
        <div className="flex items-center gap-2">
          <button 
            onClick={onToggleCollapse} 
            className="rounded p-0.5 text-text/50 hover:bg-text/10 transition-colors"
            title="Collapse Panel"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
            Song Structure
          </span>
        </div>
        <button 
          onClick={onAddSlide}
          className="rounded p-1 text-primary transition-colors hover:bg-primary/10"
          title="Add Slide"
        >
          <Plus size={14} />
        </button>
      </div>
      
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
         {slides.map((slide) => (
           <div 
             key={slide.id}
             onClick={() => onSelectSlide(slide.id)}
             className={`group relative cursor-pointer rounded-lg border p-2 transition ${
               selectedSlideId === slide.id 
                 ? 'border-primary/50 bg-primary/10' 
                 : 'border-text/10 bg-surface hover:bg-text/5'
             }`}
           >
              <div className="flex justify-between items-start mb-1">
                <SlideLabelBadge slide={slide} className="w-fit px-1.5 py-0.5 text-[9px] uppercase" />
                
                {slides.length > 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSlide(slide.id, e);
                    }}
                    className="text-text/30 opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              
              <div className="line-clamp-2 h-8 text-[10px] leading-relaxed text-text/60">
                 {slide.content}
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}
