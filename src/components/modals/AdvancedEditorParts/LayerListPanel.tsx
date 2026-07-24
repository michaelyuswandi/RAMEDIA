
import { Eye, EyeOff, Trash2, ChevronUp, ChevronDown, Plus, ChevronLeft, ChevronRight, Type } from 'lucide-react';
import type { SlideLayer } from '../../../electron/database/schema';
import { LayerIcons, getLayerName } from './utils';

interface LayerListPanelProps {
  layers: SlideLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onDeleteLayer: (id: string) => void;
  onReorderLayer: (startIndex: number, endIndex: number) => void;
  onAddLayer: (type: 'text' | 'media' | 'overlay' | 'background') => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function LayerListPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onToggleVisibility,
  onDeleteLayer,
  onReorderLayer,
  onAddLayer,
  isCollapsed,
  onToggleCollapse,
}: LayerListPanelProps) {
  const sortedLayers = [...layers].sort((a, b) => b.layerOrder - a.layerOrder);

  if (isCollapsed) {
    return (
      <div className="flex w-12 shrink-0 flex-col items-center border-r border-text/10 bg-background py-3 gap-4">
        <button 
          onClick={onToggleCollapse} 
          className="rounded p-1 text-text/50 hover:bg-text/10 transition-colors"
          title="Expand Layers Panel"
        >
          <ChevronRight size={16} />
        </button>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto w-full items-center px-1">
          {sortedLayers.map((layer) => {
            const isSelected = selectedLayerId === layer.id;
            const Icon = LayerIcons[layer.layerType] || Type;
            return (
              <button
                key={layer.id}
                onClick={() => onSelectLayer(layer.id)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition ${
                  isSelected 
                    ? 'bg-primary/20 text-primary shadow-sm' 
                    : 'border border-text/10 bg-surface text-text/60 hover:bg-text/5'
                }`}
                title={layer.layerType === 'text' && layer.content ? layer.content : getLayerName(layer.layerType)}
              >
                <Icon size={12} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-[220px] shrink-0 flex-col border-r border-text/10 bg-surface">
      <div className="flex h-12 items-center justify-between border-b border-text/10 bg-background px-3 shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={onToggleCollapse} 
            className="rounded p-0.5 text-text/50 hover:bg-text/10 transition-colors"
            title="Collapse Panel"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Layers</span>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => onAddLayer('text')}
            className="rounded p-1 text-primary transition-colors hover:bg-primary/10"
            title="Add Text Layer"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2.5">
        {sortedLayers.map((layer) => {
          const isSelected = selectedLayerId === layer.id;
          const Icon = LayerIcons[layer.layerType] || Type;
          const layerIndex = layers.findIndex(l => l.id === layer.id);

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition ${
                isSelected 
                  ? 'border-primary/30 bg-primary/10' 
                  : 'border-transparent hover:bg-text/5'
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(layer.id, !layer.visible);
                }}
                className={`text-xs ${layer.visible ? 'text-primary' : 'text-text/30'}`}
              >
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>

              <div className={`rounded p-1.5 ${isSelected ? 'bg-primary/20 text-primary' : 'bg-text/5 text-text/50'}`}>
                <Icon size={12} />
              </div>

              <div className="flex-1 min-w-0">
                <div className={`truncate text-[11px] font-semibold ${isSelected ? 'text-text' : 'text-text/60'}`}>
                  {layer.layerType === 'text' && layer.content ? layer.content : getLayerName(layer.layerType)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                {layer.layerType !== 'base' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (layerIndex > 0) onReorderLayer(layerIndex, layerIndex - 1);
                      }}
                      className="p-1 text-text/30 hover:text-text"
                      disabled={layerIndex <= 0}
                      title="Move layer down"
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (layerIndex < layers.length - 1) onReorderLayer(layerIndex, layerIndex + 1);
                      }}
                      className="p-1 text-text/30 hover:text-text"
                      disabled={layerIndex >= layers.length - 1}
                      title="Move layer up"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLayer(layer.id);
                      }}
                      className="p-1 text-text/30 hover:text-error"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
