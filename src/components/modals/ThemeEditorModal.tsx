import { useState } from 'react';
import { Save, Type, Image as ImageIcon, Zap } from 'lucide-react';
import { ipcThemeService } from '../../core/services/ipcThemeService';
import type { Theme } from '../../electron/database/schema';

interface ThemeEditorModalProps {
  theme: Theme | null; // null = create new
  onClose: () => void;
  onSave: () => void;
}

export default function ThemeEditorModal({ theme, onClose, onSave }: ThemeEditorModalProps) {
  const [name, setName] = useState(theme?.name || 'New Theme');
  const [backgroundType, setBackgroundType] = useState(theme?.backgroundType || 'color');
  const [backgroundValue, setBackgroundValue] = useState(theme?.backgroundValue || '#000000');
  
  // Tabs: 'background', 'typography', 'transition'
  const [activeTab, setActiveTab] = useState('background');

  async function handleSave() {
    const data = {
      name,
      backgroundType,
      backgroundValue,
      textStyle: JSON.stringify({ color: '#ffffff', fontSize: 40 }), // Placeholder
      isDefault: false,
    };

    if (theme?.id) {
      await ipcThemeService.update(theme.id, data);
    } else {
      await ipcThemeService.create(data);
    }
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[90vw] h-[85vh] bg-[#181820] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 bg-[#1e1e24]">
          <input 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent text-lg font-bold text-white border-b border-transparent focus:border-primary focus:outline-none w-64"
            placeholder="Theme Name"
          />
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-text/50 hover:text-white transition-colors">Cancel</button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded font-bold flex items-center gap-2"
            >
              <Save size={16} /> Save Theme
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex min-h-0">
          
          {/* LEFT: Controls */}
          <div className="w-80 border-r border-white/5 flex flex-col bg-[#1e1e24]">
            {/* Tabs */}
            <div className="flex border-b border-white/5">
              {[
                { id: 'background', icon: ImageIcon, label: 'BG' },
                { id: 'typography', icon: Type, label: 'Text' },
                { id: 'transition', icon: Zap, label: 'Anim' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-bold uppercase border-b-2 transition-colors ${
                    activeTab === tab.id ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-text/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </div>

            {/* Controls Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {activeTab === 'background' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text/50 uppercase">Background Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['color', 'gradient', 'image'].map(t => (
                        <button
                          key={t}
                          onClick={() => setBackgroundType(t)}
                          className={`py-2 rounded text-xs border ${
                            backgroundType === t ? 'border-primary bg-primary/20 text-white' : 'border-white/10 text-text/50 hover:border-white/30'
                          }`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {backgroundType === 'color' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-text/50 uppercase">Color</label>
                      <input 
                        type="color" 
                        value={backgroundValue}
                        onChange={(e) => setBackgroundValue(e.target.value)}
                        className="w-full h-10 rounded border border-white/10 bg-transparent cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Placeholders for other types */}
                  {backgroundType !== 'color' && (
                    <div className="p-4 rounded border border-dashed border-white/10 text-center text-xs text-text/30">
                      {backgroundType} editor coming soon...
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'typography' && (
                <div className="text-center text-text/30 text-xs py-10">
                  Typography settings placeholder
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Preview Canvas */}
          <div className="flex-1 bg-[#12121a] p-8 flex items-center justify-center relative overflow-hidden">
             {/* Checkerboard background for transparency */}
             <div className="absolute inset-0 opacity-10" 
                  style={{ backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}>
             </div>

             {/* The Slide Preview */}
             <div 
               className="aspect-[16/9] w-full max-w-3xl bg-black rounded shadow-2xl relative flex items-center justify-center text-center p-12 transition-all duration-300"
               style={{ 
                 background: backgroundType === 'color' ? backgroundValue : '#000',
               }}
             >
               <h1 style={{ color: 'white', fontSize: '3rem', fontWeight: 'bold', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                 Amazing Grace<br/>
                 <span style={{ fontSize: '0.6em', opacity: 0.8, fontWeight: 'normal' }}>How sweet the sound</span>
               </h1>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
