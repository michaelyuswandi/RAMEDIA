import React from 'react';
import { Layers, Plus } from 'lucide-react';
import { SlideRenderer } from '../../common/SlideRenderer';
import { LayerIcons, getLayerName } from './utils';
import type { SlideWithLayers } from './useEditorLogic';

interface CanvasAreaProps {
  selectedSlide: SlideWithLayers | undefined;
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  canvasRef: React.RefObject<HTMLDivElement>;
  slideCanvasRef?: React.RefObject<HTMLDivElement>;
  outputWidth: number;
  outputHeight: number;
  canvasStyle: React.CSSProperties;
  onAddLayer?: (type: 'text' | 'media' | 'overlay' | 'background') => void;
}

export function CanvasArea({ 
  selectedSlide, 
  selectedLayerId, 
  onSelectLayer, 
  canvasRef, 
  slideCanvasRef,
  outputWidth, 
  outputHeight, 
  canvasStyle,
  onAddLayer,
}: CanvasAreaProps) {
  const handleAddLayer = onAddLayer || (() => undefined);

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-surface">
       {/* Toolbar */}
       <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-text/10 bg-surface px-4">
          {/* View Stats */}
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto text-[11px] font-bold text-text/50">
             <span className="text-[10px] uppercase tracking-wider text-text/40 mr-1">Add Layer:</span>
             <button onClick={() => handleAddLayer('text')} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-text/10 px-3 transition hover:bg-text/5 active:scale-[0.98]"><Plus size={13} className="text-primary" /> Text</button>
             <button onClick={() => handleAddLayer('media')} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-text/10 px-3 transition hover:bg-text/5 active:scale-[0.98]"><Plus size={13} className="text-primary" /> Media</button>
             <button onClick={() => handleAddLayer('background')} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-text/10 px-3 transition hover:bg-text/5 active:scale-[0.98]"><Plus size={13} className="text-primary" /> Background</button>
             <button onClick={() => handleAddLayer('overlay')} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-text/10 px-3 transition hover:bg-text/5 active:scale-[0.98]"><Plus size={13} className="text-primary" /> Overlay</button>
          </div>

          {/* Layer Selection Toolbar */}
          <div className="flex gap-0.5 rounded-lg border border-text/10 bg-background p-1">
             {['background', 'overlay', 'text', 'media', 'base'].map((type) => {
                const l = selectedSlide?.layers.find(ly => ly.layerType === type);
                const isActive = selectedLayerId === l?.id;
                const Icon = LayerIcons[type] || Layers;
                
                return (
                   <button
                      key={type}
                      onClick={() => l && onSelectLayer(l.id)}
                      disabled={!l}
                      className={`group relative rounded-md p-1.5 transition ${
                         isActive 
                             ? 'bg-primary/20 text-primary shadow-sm' 
                             : 'text-text/50 hover:bg-text/5 hover:text-text'
                      } ${!l && 'opacity-20 cursor-not-allowed'}`}
                      title={`Select ${getLayerName(type)}`}
                   >
                      <Icon size={14} />
                      {/* Status Dot */}
                      {l && !l.visible && (
                         <div className="absolute right-0 top-0 h-1.5 w-1.5 translate-x-1/4 -translate-y-1/4 rounded-full border border-surface bg-error"></div>
                      )}
                   </button>
                );
             })}
          </div>

          <div className="flex shrink-0 items-center gap-2 text-[10px] font-mono text-text/40">
            <span>{outputWidth} x {outputHeight}</span>
            <span className="rounded border border-text/10 px-2 py-1">100%</span>
          </div>
       </div>

       {/* Canvas Area with Gizmo Overlay */}
       <div ref={canvasRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-text/5 p-8">
          <div 
            ref={slideCanvasRef}
            className="relative flex items-center justify-center overflow-hidden rounded-sm border border-text/20 bg-black shadow-[0_24px_60px_rgba(15,23,42,0.16)] transition-all duration-300 select-none"
            style={canvasStyle}
          >
             <SlideRenderer 
                slide={selectedSlide}
                layers={selectedSlide?.layers}
                isEditor={true}
                selectedLayerId={selectedLayerId}
                onLayerSelect={(id) => onSelectLayer(id)}
                renderMode="preview"
             />
             
             {!selectedSlide && <div className="text-text/40">Select a slide</div>}
          </div>
        </div>

     </div>
  );
}
