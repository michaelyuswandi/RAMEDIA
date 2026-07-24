import { useEffect, useRef } from 'react';
import { 
  Settings, Undo2, Redo2, 
  AlignLeft, AlignCenter, AlignRight, 
  AlignStartVertical, AlignCenterVertical, AlignEndVertical 
} from 'lucide-react';
import type { Media, SlideLayer } from '../../../electron/database/schema';
import { getLayerName } from './utils';

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

interface PropertiesPanelProps {
  selectedLayer: SlideLayer | undefined;
  updateSelectedLayer: (updates: Partial<SlideLayer>) => void;
  updateContent: (content: string) => void;
  mediaItems: Media[];
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAlign: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  textContentMode?: 'song-slide' | 'layer';
  onDeleteLayer?: (id: string) => void;
  textRoleOptions?: Array<{ value: string; label: string; sampleContent?: string }>;
}

export function PropertiesPanel({ 
  selectedLayer, 
  updateSelectedLayer, 
  updateContent,
  mediaItems,
  undo,
  redo,
  canUndo,
  canRedo,
  onAlign,
  textContentMode = 'song-slide',
  onDeleteLayer,
  textRoleOptions,
}: PropertiesPanelProps) {
  const styleObject = parseRecord(selectedLayer?.style);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (selectedLayer && selectedLayer.layerType === 'text') {
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedLayer?.id]);

  const updateStyle = (nextStyle: Record<string, unknown>) => {
    updateSelectedLayer({ style: JSON.stringify(nextStyle) });
  };

  const selectableMedia = mediaItems.filter((item) => item.mediaType === 'image' || item.mediaType === 'video');
  
  return (
    <div className={`flex w-[320px] shrink-0 flex-col border-l bg-surface transition-all duration-300 ${selectedLayer ? 'border-primary/30 ring-2 ring-primary/10 z-10' : 'border-text/10'}`}>
      {/* Properties Panel (Takes Full Height now) */}
      <div className="flex min-h-0 flex-1 flex-col bg-surface">
          <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-text/10 bg-background px-3">
            <div className="flex items-center gap-1">
              <button 
                onClick={undo}
                disabled={!canUndo}
                className={`rounded p-1 ${canUndo ? 'text-text/60 hover:bg-text/5' : 'cursor-not-allowed text-text/30'}`}
                title="Undo"
              >
                <Undo2 size={14} />
              </button>
              <button 
                onClick={redo}
                disabled={!canRedo}
                className={`rounded p-1 ${canRedo ? 'text-text/60 hover:bg-text/5' : 'cursor-not-allowed text-text/30'}`}
                title="Redo"
              >
                <Redo2 size={14} />
              </button>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Properties</span>
            <Settings size={12} className="text-text/40" />
         </div>
         
         <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {!selectedLayer && <div className="mt-4 text-center text-xs text-text/40">Select a layer</div>}

            {selectedLayer && (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-primary">
                     {getLayerName(selectedLayer.layerType)}
                  </span>
                  {selectedLayer.layerType !== 'base' && onDeleteLayer && (
                    <button
                      onClick={() => onDeleteLayer(selectedLayer.id)}
                      className="rounded bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-700 transition-colors hover:bg-rose-100"
                      title="Delete Layer"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {selectedLayer.layerType === 'text' && (
                  <div className="space-y-2">
                     <label className="block text-[10px] font-bold text-text/50">
                       {styleObject.textRole && styleObject.textRole !== 'static' ? 'Preview Content' : 'Text Content'}
                     </label>
                      <textarea 
                        ref={textareaRef}
                        value={selectedLayer.content || ''}
                        onChange={(e) => (
                          textContentMode === 'layer'
                            ? updateSelectedLayer({ content: e.target.value })
                            : updateContent(e.target.value)
                        )}
                        className="h-20 w-full resize-y rounded border border-text/10 bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/15 focus:ring-offset-0 transition-all"
                      />
                      {styleObject.textRole && styleObject.textRole !== 'static' && (
                        <p className="text-[10px] leading-relaxed text-text/40">
                          Sample only. Live content replaces this text using the selected role.
                        </p>
                      )}
                  </div>
                )}

                {selectedLayer.layerType === 'text' && (() => {
                  const currentStyle = parseRecord(selectedLayer.style);
                  const currentRole = currentStyle.textRole || 'static';

                  return (
                    <div className="space-y-2 border-t border-text/10 pt-2">
                      <label className="block text-[10px] font-bold text-text/50">Text Role</label>
                      <select
                        value={currentRole}
                        onChange={(e) => {
                          const selectedRole = textRoleOptions?.find((option) => option.value === e.target.value);
                          updateSelectedLayer({
                            style: JSON.stringify({ ...currentStyle, textRole: e.target.value }),
                            ...(selectedRole?.sampleContent ? { content: selectedRole.sampleContent } : {}),
                          });
                        }}
                        className="w-full rounded border border-text/10 bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-primary/30"
                      >
                        {(textRoleOptions || [
                          { value: 'lyrics-main', label: 'Lyrics Main' },
                          { value: 'lyrics-secondary', label: 'Lyrics Secondary' },
                          { value: 'song-title', label: 'Song Title' },
                          { value: 'section-label', label: 'Section Label' },
                          { value: 'static', label: 'Static Text' },
                        ]).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                  );
                })()}

                <div className="space-y-2">
                   <label className="block text-[10px] font-bold text-text/50">Opacity</label>
                   <div className="flex gap-2 items-center">
                     <input 
                       type="range" 
                       min="0" max="1" step="0.1"
                       value={selectedLayer.opacity ?? 1}
                       onChange={(e) => updateSelectedLayer({ opacity: parseFloat(e.target.value) })}
                       className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-text/10 accent-primary"
                     />
                     <span className="w-8 text-right text-xs text-text/60">{Math.round((selectedLayer.opacity ?? 1) * 100)}%</span>
                   </div>
                </div>

                {/* ALIGNMENT TOOLS (NEW) */}
                {selectedLayer.layerType === 'text' && (
                <div className="space-y-2 border-t border-text/10 pt-2">
                   <label className="block text-[10px] font-bold text-text/50">Align Box to Canvas</label>
                   <div className="flex gap-1 justify-between">
                      <div className="flex gap-0.5 rounded border border-text/10 bg-background p-0.5">
                        <button onClick={() => onAlign('left')} title="Align Left" className="rounded p-1.5 text-text/50 hover:bg-text/5 hover:text-text"><AlignLeft size={14}/></button>
                        <button onClick={() => onAlign('center')} title="Align Center" className="rounded p-1.5 text-text/50 hover:bg-text/5 hover:text-text"><AlignCenter size={14}/></button>
                        <button onClick={() => onAlign('right')} title="Align Right" className="rounded p-1.5 text-text/50 hover:bg-text/5 hover:text-text"><AlignRight size={14}/></button>
                      </div>
                      <div className="flex gap-0.5 rounded border border-text/10 bg-background p-0.5">
                        <button onClick={() => onAlign('top')} title="Align Top" className="rounded p-1.5 text-text/50 hover:bg-text/5 hover:text-text"><AlignStartVertical size={14}/></button>
                        <button onClick={() => onAlign('middle')} title="Align Middle" className="rounded p-1.5 text-text/50 hover:bg-text/5 hover:text-text"><AlignCenterVertical size={14}/></button>
                        <button onClick={() => onAlign('bottom')} title="Align Bottom" className="rounded p-1.5 text-text/50 hover:bg-text/5 hover:text-text"><AlignEndVertical size={14}/></button>
                      </div>
                   </div>
                </div>
                )}

                {selectedLayer.layerType === 'text' && (
                  <>
                    {/* SIZING MODE TOGGLE */}
                    <div className="space-y-2 border-t border-text/10 pt-2">
                       <label className="block text-[10px] font-bold text-text/50">Sizing Mode</label>
                       <div className="flex rounded-lg border border-text/10 bg-text/5 p-0.5">
                          {[
                            { id: 'auto', label: 'Auto-Size' },
                            { id: 'fixed', label: 'Fixed Box' }
                          ].map((mode) => {
                             const currentStyle = parseRecord(selectedLayer.style);
                             const isSelected = (currentStyle.sizingMode || 'auto') === mode.id;
                             
                             return (
                               <button
                                 key={mode.id}
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    const newStyle = { ...currentStyle, sizingMode: mode.id };
                                    updateSelectedLayer({ style: JSON.stringify(newStyle) });
                                 }}
                                 className={`flex-1 py-1 rounded text-[10px] uppercase font-bold transition-all ${
                                    isSelected ? 'bg-primary/20 text-primary shadow-sm' : 'text-text/50 hover:bg-text/5 hover:text-text'
                                 }`}
                               >
                                  {mode.label}
                               </button>
                             );
                          })}
                       </div>
                    </div>

                    {/* BOX DIMENSIONS (Fixed Mode Only) */}
                    {(() => {
                       const currentStyle = parseRecord(selectedLayer.style);
                       if (currentStyle.sizingMode !== 'fixed') return null;
                       
                       return (
                         <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-text/50">Box Dimensions</label>
                            
                            {/* Width */}
                            <div className="flex gap-2 items-center">
                              <span className="w-8 text-[10px] font-bold text-text/50">W</span>
                              <input 
                                type="range" 
                                min="10" max="100" step="1"
                                value={currentStyle.boxWidth ?? 80}
                                onChange={(e) => {
                                   updateSelectedLayer({ style: JSON.stringify({ ...currentStyle, boxWidth: parseInt(e.target.value) }) });
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-text/10 accent-primary"
                              />
                              <span className="w-10 text-right text-xs text-text/60">{currentStyle.boxWidth ?? 80}%</span>
                            </div>
                            
                            {/* Height */}
                            <div className="flex gap-2 items-center">
                              <span className="w-8 text-[10px] font-bold text-text/50">H</span>
                              <input 
                                type="range" 
                                min="5" max="100" step="1"
                                value={currentStyle.boxHeight ?? 40}
                                onChange={(e) => {
                                   updateSelectedLayer({ style: JSON.stringify({ ...currentStyle, boxHeight: parseInt(e.target.value) }) });
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-text/10 accent-primary"
                              />
                              <span className="w-10 text-right text-xs text-text/60">{currentStyle.boxHeight ?? 40}%</span>
                            </div>
                         </div>
                       );
                    })()}

                    {/* ALLOW WRAP TOGGLE */}
                    <div className="space-y-2">
                       <label className="block text-[10px] font-bold text-text/50">Text Behavior</label>
                       <label className="flex items-center gap-2 cursor-pointer">
                          {(() => {
                             const currentStyle = parseRecord(selectedLayer.style);
                             const allowWrap = currentStyle.allowWrap ?? true;
                             return (
                                <>
                                   <input 
                                      type="checkbox"
                                      checked={allowWrap}
                                      onChange={(e) => {
                                         updateSelectedLayer({ style: JSON.stringify({ ...currentStyle, allowWrap: e.target.checked }) });
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-4 w-4 rounded accent-primary"
                                   />
                                   <span className="text-xs font-semibold text-text/70">Allow Word Wrap</span>
                                </>
                             );
                          })()}
                       </label>
                    </div>

                    {/* TEXT ALIGNMENT */}
                    <div className="space-y-2 border-t border-text/10 pt-2">
                       <label className="block text-[10px] font-bold text-text/50">Text Alignment in Box</label>
                       <div className="flex rounded-lg border border-text/10 bg-text/5 p-0.5">
                          {['left', 'center', 'right'].map((align) => {
                             const currentStyle = parseRecord(selectedLayer.style);
                             const isSelected = (currentStyle.textAlign || 'center') === align;
                             
                             return (
                               <button
                                 key={align}
                                 onClick={() => {
                                    const newStyle = { ...currentStyle, textAlign: align };
                                    updateSelectedLayer({ style: JSON.stringify(newStyle) });
                                 }}
                                 className={`flex-1 py-1 rounded text-[10px] uppercase font-bold transition-all ${
                                    isSelected ? 'bg-primary/20 text-primary shadow-sm' : 'text-text/50 hover:bg-text/5 hover:text-text'
                                 }`}
                               >
                                  {align}
                               </button>
                             );
                          })}
                       </div>
                    </div>

                    {/* FONT STYLE */}
                    <div className="space-y-2">
                       <label className="block text-[10px] font-bold text-text/50">Style</label>
                       <div className="flex gap-0.5 rounded-lg border border-text/10 bg-text/5 p-0.5">
                          {[
                            { id: 'bold', label: 'B', prop: 'fontWeight', val: 700, def: 400, title: 'Bold' },
                            { id: 'italic', label: 'I', prop: 'fontStyle', val: 'italic', def: 'normal', title: 'Italic' },
                            { id: 'underline', label: 'U', prop: 'textDecoration', val: 'underline', def: 'none', title: 'Underline' },
                            { id: 'shadow', label: 'S', prop: 'shadow', val: true, def: false, title: 'Text Shadow' },
                          ].map((btn) => {
                             const currentStyle = parseRecord(selectedLayer.style);
                             // Check logic handles boolean (shadow) vs string props
                             const isActive = btn.id === 'bold'
                                ? currentStyle.fontWeight === 'bold' || Number(currentStyle.fontWeight) >= 600
                                : btn.val === true 
                                ? !!currentStyle[btn.prop]
                                : currentStyle[btn.prop] === btn.val;

                             return (
                               <button
                                 key={btn.id}
                                 title={btn.title}
                                 onClick={() => {
                                    const newVal = isActive ? btn.def : btn.val;
                                    const newStyle = { ...currentStyle, [btn.prop]: newVal };
                                    updateSelectedLayer({ style: JSON.stringify(newStyle) });
                                 }}
                                 className={`flex-1 rounded py-1 font-bold transition-all ${
                                    isActive ? 'bg-surface text-text shadow-sm' : 'text-text/50 hover:bg-text/5 hover:text-text'
                                 }`}
                               >
                                  {btn.label}
                               </button>
                             );
                          })}
                       </div>
                    </div>

                    {/* FONT SIZE SCALE */}
                    <div className="space-y-2">
                       <label className="block text-[10px] font-bold text-text/50">Size Scale</label>
                       <div className="flex gap-2 items-center">
                         <input 
                           type="range" 
                           min="0.5" max="3" step="0.1"
                           value={(() => {
                              const s = parseRecord(selectedLayer.style);
                              return s.scale || 1;
                           })()}
                           onChange={(e) => {
                              const currentStyle = parseRecord(selectedLayer.style);
                              updateSelectedLayer({ style: JSON.stringify({ ...currentStyle, scale: parseFloat(e.target.value) }) });
                           }}
                           onClick={(e) => e.stopPropagation()}
                           onMouseDown={(e) => e.stopPropagation()}
                           className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-text/10 accent-primary"
                         />
                         <span className="w-8 text-right text-xs text-text/60">
                            {(() => {
                               const s = parseRecord(selectedLayer.style);
                               return (s.scale || 1).toFixed(1);
                            })()}x
                         </span>
                       </div>
                    </div>

                    <div className="space-y-2 border-t border-text/10 pt-2">
                       <label className="block text-[10px] font-bold text-text/50">Font Family</label>
                       <select 
                          className="w-full rounded border border-text/10 bg-surface px-2 py-1.5 text-xs text-text focus:border-primary/55 focus:outline-none"
                          value={(() => {
                             const s = parseRecord(selectedLayer.style);
                             return s.fontFamily || 'Inter, sans-serif';
                          })()}
                          onChange={(e) => {
                             const currentStyle = parseRecord(selectedLayer.style);
                             updateSelectedLayer({ style: JSON.stringify({ ...currentStyle, fontFamily: e.target.value }) });
                          }}
                       >
                          <option value="Manrope, Inter, sans-serif">Manrope</option>
                          <option value="Manrope, sans-serif">Manrope (system stack)</option>
                          <option value="Inter">Inter (preset)</option>
                          <option value="Inter, sans-serif">Inter</option>
                          <option value="Roboto, sans-serif">Roboto</option>
                          <option value="Outfit, sans-serif">Outfit (system stack)</option>
                          <option value="Outfit, Manrope, sans-serif">Outfit</option>
                          <option value="SF Pro Text, Inter, sans-serif">SF Pro Text</option>
                          <option value="serif">Serif</option>
                          <option value="monospace">Monospace</option>
                       </select>
                    </div>
                    
                    <div className="space-y-2">
                       <label className="block text-[10px] font-bold text-text/50">Color</label>
                       <div className="flex gap-2">
                          <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded border border-text/10">
                             <input 
                               type="color"
                               value={(() => {
                                  const s = parseRecord(selectedLayer.style);
                                  return s.color || '#ffffff';
                               })()}
                               onChange={(e) => {
                                  const currentStyle = parseRecord(selectedLayer.style);
                                  updateSelectedLayer({ style: JSON.stringify({ ...currentStyle, color: e.target.value }) });
                               }}
                               className="absolute -left-2 -top-2 h-16 w-16 cursor-pointer opacity-0"
                             />
                             <div 
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                   backgroundColor: (() => {
                                      const s = parseRecord(selectedLayer.style);
                                      return s.color || '#ffffff';
                                   })()
                                }}
                             ></div>
                          </label>
                          <input 
                             type="text" 
                             value={(() => {
                                const s = parseRecord(selectedLayer.style);
                                return s.color || '#ffffff';
                             })()}
                             onChange={(e) => {
                                const currentStyle = parseRecord(selectedLayer.style);
                                updateSelectedLayer({ style: JSON.stringify({ ...currentStyle, color: e.target.value }) });
                             }}
                             className="flex-1 rounded border border-text/10 bg-surface px-2 py-1.5 text-xs uppercase text-text focus:border-primary/55 focus:outline-none"
                          />
                       </div>
                    </div>
                  </>
                )}

                {selectedLayer.layerType === 'base' && (
                  <div className="space-y-2 border-t border-text/10 pt-2">
                    <label className="block text-[10px] font-bold text-text/50">Base Color</label>
                    <div className="flex gap-2">
                      <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded border border-text/10">
                        <input
                          type="color"
                          value={selectedLayer.content || '#000000'}
                          onChange={(e) => updateSelectedLayer({ content: e.target.value })}
                          className="absolute -left-2 -top-2 h-16 w-16 cursor-pointer opacity-0"
                        />
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{ backgroundColor: selectedLayer.content || '#000000' }}
                        />
                      </label>
                      <input
                        type="text"
                        value={selectedLayer.content || '#000000'}
                        onChange={(e) => updateSelectedLayer({ content: e.target.value })}
                        className="flex-1 rounded border border-text/10 bg-surface px-2 py-1.5 text-xs uppercase text-text focus:border-primary/55 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {selectedLayer.layerType === 'overlay' && (
                  <div className="space-y-2 border-t border-text/10 pt-2">
                    <label className="block text-[10px] font-bold text-text/50">Overlay Color</label>
                    <div className="flex gap-2">
                      <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded border border-text/10">
                        <input
                          type="color"
                          value={/^#[0-9a-f]{6}$/i.test(String(styleObject.background || '')) ? styleObject.background : '#000000'}
                          onChange={(e) => updateStyle({ ...styleObject, background: e.target.value })}
                          className="absolute -left-2 -top-2 h-16 w-16 cursor-pointer opacity-0"
                        />
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{ background: styleObject.background || selectedLayer.content || 'rgba(0, 0, 0, 0.35)' }}
                        />
                      </label>
                      <input
                        type="text"
                        value={styleObject.background || selectedLayer.content || 'rgba(0, 0, 0, 0.35)'}
                        onChange={(e) => updateStyle({ ...styleObject, background: e.target.value })}
                        className="flex-1 rounded border border-text/10 bg-surface px-2 py-1.5 text-xs text-text focus:border-primary/55 focus:outline-none"
                        placeholder="#000000 or rgba(...)"
                      />
                    </div>
                  </div>
                )}

                {(selectedLayer.layerType === 'background' || selectedLayer.layerType === 'media') && (
                  <>
                    <div className="space-y-2 border-t border-text/10 pt-2">
                      <label className="block text-[10px] font-bold text-text/50">Content Type</label>
                      <div className="flex gap-0.5 rounded-lg border border-text/10 bg-text/5 p-0.5">
                        {[
                          { id: 'image', label: 'Image' },
                          { id: 'video', label: 'Video' },
                        ].map((option) => {
                          const isSelected = styleObject.mediaType === option.id;
                          return (
                            <button
                              key={option.id}
                              onClick={() => updateSelectedLayer({
                                mediaId: null,
                                content: null,
                                style: JSON.stringify({
                                  ...styleObject,
                                  mediaType: option.id,
                                  source: null,
                                  playbackSettings: undefined,
                                }),
                              })}
                              className={`flex-1 py-1 rounded text-[10px] uppercase font-bold transition-all ${
                                isSelected ? 'bg-primary/20 text-primary shadow-sm' : 'text-text/50 hover:bg-text/5 hover:text-text'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold text-text/50">Media Source</label>
                        <button 
                           onClick={async () => {
                             const { ipcMediaService } = await import('../../../core/services/ipcMediaService');
                             const res = await ipcMediaService.importFile();
                             if (res && res.length > 0) {
                               // Simulate a refresh by triggering an external state update if possible
                               // We'll dispatch an event so AdvancedEditor can re-fetch
                               window.dispatchEvent(new CustomEvent('ramedia:refresh-media'));
                             }
                           }}
                           className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary transition-colors hover:bg-primary/15"
                        >
                           + Import
                        </button>
                      </div>
                      <select
                        className="w-full rounded border border-text/10 bg-surface px-2 py-1.5 text-xs text-text focus:border-primary/55 focus:outline-none"
                        value={selectedLayer.mediaId || ''}
                        onChange={(e) => {
                          const mediaId = e.target.value || null;
                          const selectedMedia = selectableMedia.find((item) => item.id === mediaId) || null;
                          updateSelectedLayer({
                            mediaId,
                            content: selectedMedia?.filepath || null,
                            style: JSON.stringify({
                              ...styleObject,
                              mediaType: selectedMedia?.mediaType || styleObject.mediaType || null,
                              source: selectedMedia?.filepath || null,
                              objectFit: styleObject.objectFit || (selectedLayer.layerType === 'background' ? 'cover' : 'contain'),
                              playbackSettings: selectedMedia?.playbackSettings ? parseRecord(selectedMedia.playbackSettings) : undefined,
                            }),
                          });
                        }}
                      >
                        <option value="">Select media...</option>
                        {selectableMedia
                          .filter((item) => !styleObject.mediaType || item.mediaType === styleObject.mediaType)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.filename}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-text/50">Fit</label>
                      <div className="flex gap-0.5 rounded-lg border border-text/10 bg-text/5 p-0.5">
                        {['cover', 'contain'].map((fit) => {
                          const isSelected = (styleObject.objectFit || (selectedLayer.layerType === 'background' ? 'cover' : 'contain')) === fit;
                          return (
                            <button
                              key={fit}
                              onClick={() => updateStyle({ ...styleObject, objectFit: fit })}
                              className={`flex-1 py-1 rounded text-[10px] uppercase font-bold transition-all ${
                                isSelected ? 'bg-primary/20 text-primary shadow-sm' : 'text-text/50 hover:bg-text/5 hover:text-text'
                              }`}
                            >
                              {fit}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
                
                {/* ANIMATIONS SECTION */}

                <div className="space-y-4 border-t border-text/10 pt-4">
                   <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text/50">Animations</label>
                   </div>
                   
                   <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-text/50">Entrance</label>
                      <select 
                         className="w-full rounded border border-text/10 bg-surface px-2 py-1.5 text-xs text-text focus:border-primary/55 focus:outline-none"
                         value={parseRecord(selectedLayer.transition).entrance || 'none'}
                         onChange={(e) => {
                            const currentT = parseRecord(selectedLayer.transition);
                            updateSelectedLayer({ transition: JSON.stringify({ ...currentT, entrance: e.target.value }) });
                         }}
                      >
                         <option value="none">None</option>
                         <option value="fade">Fade In</option>
                         <option value="slideUp">Slide Up</option>
                         <option value="slideDown">Slide Down</option>
                         <option value="zoomIn">Zoom In</option>
                      </select>
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                         <label className="block text-[10px] font-bold text-text/50">Duration (s)</label>
                         <input 
                            type="number" 
                            step="0.1" min="0" max="5"
                            className="w-full rounded border border-text/10 bg-surface px-2 py-1 text-xs text-text focus:border-primary/55 focus:outline-none"
                            value={parseRecord(selectedLayer.transition).duration ?? 0.4}
                            onChange={(e) => {
                               const currentT = parseRecord(selectedLayer.transition);
                               const duration = Number(e.target.value);
                               if (Number.isFinite(duration)) {
                                 updateSelectedLayer({ transition: JSON.stringify({ ...currentT, duration }) });
                               }
                            }}
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="block text-[10px] font-bold text-text/50">Delay (s)</label>
                         <input 
                            type="number" 
                            step="0.1" min="0" max="5"
                            className="w-full rounded border border-text/10 bg-surface px-2 py-1 text-xs text-text focus:border-primary/55 focus:outline-none"
                            value={parseRecord(selectedLayer.transition).delay ?? 0}
                            onChange={(e) => {
                               const currentT = parseRecord(selectedLayer.transition);
                               const delay = Number(e.target.value);
                               if (Number.isFinite(delay)) {
                                 updateSelectedLayer({ transition: JSON.stringify({ ...currentT, delay }) });
                               }
                            }}
                         />
                      </div>
                   </div>
                </div>
              </>
            )}

         </div>
      </div>
    </div>
  );
}
