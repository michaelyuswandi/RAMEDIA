import { Layers, Music, BookOpen, Monitor, Settings, Image, Volume2, Presentation, ScreenShare } from 'lucide-react';
import { useUIStore } from '../../core/stores/useUIStore';
import { useI18n } from '../../i18n';

export default function Sidebar() {
  const { activeView, setActiveView, isScreensPanelOpen, toggleScreensPanel, openSettings } = useUIStore();
  const { t } = useI18n();

  const menuItems = [
    { id: 'dashboard', icon: Layers, label: t('sidebar.dashboard') },
    { id: 'songs', icon: Music, label: t('sidebar.songs') },
    { id: 'media', icon: Image, label: t('sidebar.media') },
    { id: 'audio', icon: Volume2, label: t('sidebar.audio') },
    { id: 'prd', icon: Presentation, label: t('sidebar.prd') },
    { id: 'capture', icon: ScreenShare, label: t('sidebar.capture') },
    { id: 'bible', icon: BookOpen, label: t('sidebar.bible') },
  ];

  return (
    <div className="w-16 flex flex-col items-center py-4 bg-surface border-r border-text/5 gap-6 z-20 h-full">
      <div className="p-2 rounded-xl bg-primary/20 text-primary mb-2">
        <Layers size={24} />
      </div>
      
      <nav className="flex flex-col gap-4 w-full items-center">
        {menuItems.map((item) => (
          <button 
            key={item.id}
            onClick={() => setActiveView(item.id as any)}
            className={`p-3 rounded-xl transition-all duration-200 group relative ${
              activeView === item.id 
                ? 'bg-primary text-white shadow-[0_0_15px_var(--color-primary)]' 
                : 'hover:bg-text/10 text-text/50 hover:text-text'
            }`}
          >
            <item.icon size={20} strokeWidth={activeView === item.id ? 2.5 : 2} />
            
            {/* Tooltip */}
            <div className="absolute left-14 bg-surface border border-text/10 px-3 py-1.5 rounded-lg text-xs font-bold text-text opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {item.label}
            </div>
          </button>
        ))}

        <button
          onClick={toggleScreensPanel}
          className={`p-3 rounded-xl transition-all duration-200 group relative ${
            isScreensPanelOpen
              ? 'bg-primary text-white shadow-[0_0_15px_var(--color-primary)]'
              : 'hover:bg-text/10 text-text/50 hover:text-text'
          }`}
        >
          <Monitor size={20} strokeWidth={isScreensPanelOpen ? 2.5 : 2} />

          <div className="absolute left-14 bg-surface border border-text/10 px-3 py-1.5 rounded-lg text-xs font-bold text-text opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {t('sidebar.screens')}
          </div>
        </button>
      </nav>

      <div className="mt-auto">
        <button 
          onClick={openSettings}
          title={t('sidebar.settings')}
          className="p-3 rounded-xl hover:bg-text/10 text-text/50 hover:text-text transition-colors"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
