import { useState, useEffect } from 'react';
import { Palette, Plus, Search, Trash2, Edit3, Check } from 'lucide-react';
import { ipcThemeService } from '../../core/services/ipcThemeService';
import type { Theme } from '../../electron/database/schema';
import ThemeEditorModal from '../modals/ThemeEditorModal.tsx';

export default function ThemePanel() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  async function refreshData() {
    const items = await ipcThemeService.getAll();
    setThemes(items);
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this theme?')) {
      await ipcThemeService.delete(id);
      refreshData();
    }
  }

  function handleEdit(theme: Theme) {
    setSelectedTheme(theme);
    setIsEditorOpen(true);
  }

  function handleCreate() {
    setSelectedTheme(null);
    setIsEditorOpen(true);
  }

  const filteredItems = themes.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-surface border-t border-text/5 font-sans">
      {/* Toolbar */}
      <div className="h-12 flex items-center px-4 gap-3 border-b border-text/5 bg-background">
        <div className="flex items-center gap-2 text-text/50 font-bold text-xs uppercase tracking-wider">
           <Palette size={16} /> Theme Library
        </div>
        
        <div className="flex-1 max-w-md flex items-center bg-text/5 rounded px-3 border border-text/5 focus-within:border-primary/50 transition-colors ml-4">
           <Search size={14} className="text-text/30" />
           <input 
             className="bg-transparent border-none text-xs text-text px-3 py-2 focus:outline-none w-full placeholder:text-text/30"
             placeholder="Search themes..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
        </div>

        <div className="flex-1"></div>

        <button 
          onClick={handleCreate}
          className="px-3 py-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50 flex items-center gap-2 text-xs font-bold transition-all"
        >
           <Plus size={16} /> New Theme
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
           {filteredItems.map(theme => (
             <div 
               key={theme.id} 
               className="group relative aspect-video bg-text/5 rounded-lg border border-text/5 hover:border-primary/50 flex flex-col items-center justify-center overflow-hidden transition-all"
             >
                {/* Visual Preview (Placeholder for now) */}
                <div 
                  className="absolute inset-0 flex items-center justify-center p-2 text-center"
                  style={{ 
                    background: theme.backgroundValue || '#000', 
                    color: theme.textStyle ? JSON.parse(theme.textStyle).color : '#fff' 
                  }}
                >
                   <span className="text-xs font-bold line-clamp-2">Amazing Grace</span>
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 backdrop-blur-sm flex items-center justify-between">
                   <div className="text-[10px] text-white font-medium truncate">{theme.name}</div>
                   {theme.isDefault && <Check size={10} className="text-green-400" />}
                </div>

                {/* Actions Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                   <button 
                      onClick={() => handleEdit(theme)}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                      title="Edit"
                   >
                      <Edit3 size={14} />
                   </button>
                   <button 
                      onClick={() => handleDelete(theme.id)}
                      className="p-2 rounded-full bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white transition-colors"
                      title="Delete"
                   >
                      <Trash2 size={14} />
                   </button>
                </div>
             </div>
           ))}
           
           {filteredItems.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center h-40 text-text/30 opacity-50">
                 <Palette size={48} className="mb-2" />
                 <span className="text-xs">No themes found</span>
              </div>
           )}
        </div>
      </div>

      {isEditorOpen && (
        <ThemeEditorModal 
          theme={selectedTheme} 
          onClose={() => setIsEditorOpen(false)} 
          onSave={() => {
            refreshData();
            setIsEditorOpen(false);
          }} 
        />
      )}
    </div>
  );
}
