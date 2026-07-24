import { useEffect, useState } from 'react';
import { Edit3, LayoutTemplate, Plus, Trash2, X } from 'lucide-react';
import { ipcTemplateService } from '../../core/services/ipcTemplateService';
import type { Template } from '../../electron/database/schema';
import SongPresetEditorModal from './SongPresetEditorModal';

interface SongPresetManagerModalProps {
  onClose: () => void;
}

export default function SongPresetManagerModal({ onClose }: SongPresetManagerModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const refreshTemplates = async () => {
    const nextTemplates = await ipcTemplateService.getAll();
    setTemplates(nextTemplates);
  };

  useEffect(() => {
    void refreshTemplates();
  }, []);

  const handleDelete = async (template: Template) => {
    if (!confirm(`Delete preset "${template.name}"?`)) return;
    await ipcTemplateService.delete(template.id);
    await refreshTemplates();
  };

  return (
    <>
      <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="flex h-[78vh] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#0f1018] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/8 bg-black/20 px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="control-button flex h-10 w-10 shrink-0 items-center justify-center"
                aria-label="Close preset manager"
                title="Close preset manager"
              >
                <X size={15} />
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <LayoutTemplate size={18} />
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-text/35">Content Themes</div>
                <div className="text-sm font-semibold text-text">Manage reusable slide designs by content type</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreating(true)}
                className="control-button-primary flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em]"
              >
                <Plus size={15} />
                New Theme
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {templates.map((template) => (
                <div key={template.id} className="flex flex-col rounded-2xl border border-white/8 bg-black/18 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text">{template.name}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text/38">
                        {(template.contentType || 'song').toUpperCase()} · {template.category || 'Theme'}
                      </div>
                    </div>
                    <div className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
                      Theme
                    </div>
                  </div>

                  <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-white/8 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4 text-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-text/35">Content-bound layers</div>
                      <div className="mt-2 text-sm text-text/74">Dipakai saat konten memilih theme ini atau Screen Layout memaksanya.</div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setEditingTemplate(template)}
                      className="control-button flex-1 justify-center px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em]"
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDelete(template)}
                      className="control-button flex items-center justify-center px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-red-300 hover:text-white"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {templates.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
                  <div className="text-sm font-semibold text-text/72">No song presets yet</div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-text/35">
                    Create one and design it in the advanced editor
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {editingTemplate && (
        <SongPresetEditorModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => void refreshTemplates()}
        />
      )}

      {isCreating && (
        <SongPresetEditorModal
          template={null}
          onClose={() => setIsCreating(false)}
          onSaved={() => void refreshTemplates()}
        />
      )}
    </>
  );
}
