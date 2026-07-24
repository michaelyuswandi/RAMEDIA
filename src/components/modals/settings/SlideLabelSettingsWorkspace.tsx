import { AlertTriangle, GripVertical, Keyboard, Plus, Tag, Trash2 } from 'lucide-react';
import type { SlideLabelSetting } from '../../../core/stores/useSlideLabelSettingsStore';
import { useHotkeysStore } from '../../../core/stores/useHotkeysStore';
import { useI18n } from '../../../i18n';

interface Props {
  labels: SlideLabelSetting[];
  onChange: (labels: SlideLabelSetting[]) => void;
}

const normalizeShortcut = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '');

export function SlideLabelSettingsWorkspace({ labels, onChange }: Props) {
  const { t } = useI18n();
  const hotkeyCommands = useHotkeysStore((state) => state.commands);
  const update = (id: string, changes: Partial<SlideLabelSetting>) => {
    onChange(labels.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  };

  const conflicts = new Set(
    labels
      .map((item) => normalizeShortcut(item.shortcut))
      .filter((shortcut, index, all) => shortcut && all.indexOf(shortcut) !== index),
  );

  const addLabel = () => {
    const id = crypto.randomUUID();
    onChange([...labels, {
      id,
      sectionType: `custom_${labels.length + 1}`,
      label: 'New Label',
      backgroundColor: '#475569',
      textColor: '#f8fafc',
      shortcut: '',
    }]);
  };

  const previewItems = labels.filter((item) => ['verse', 'chorus', 'bridge', 'intro'].includes(item.sectionType));

  return (
    <div className="grid min-h-full xl:grid-cols-[minmax(680px,1fr)_320px]">
      <section className="min-w-0 border-r border-text/5 p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Tag size={17} className="text-primary" />
              <h3 className="text-base font-semibold text-text">{t('slideLabelsWorkspace.title')}</h3>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-text/48">
              {t('slideLabelsWorkspace.description')}
            </p>
          </div>
          <button type="button" onClick={addLabel} className="control-button flex h-9 shrink-0 items-center gap-2 px-3 text-xs">
            <Plus size={14} /> {t('slideLabelsWorkspace.addLabel')}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-text/10 bg-black/10">
          <div className="grid grid-cols-[28px_minmax(170px,1.25fr)_170px_minmax(150px,.8fr)_42px] items-center gap-3 border-b border-text/10 bg-text/[0.035] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text/38">
            <span />
            <span>{t('slideLabelsWorkspace.labelHeader')}</span>
            <span>{t('slideLabelsWorkspace.badgeColorsHeader')}</span>
            <span>{t('slideLabelsWorkspace.shortcutHeader')}</span>
            <span />
          </div>

          <div className="divide-y divide-text/6">
            {labels.map((item) => {
              const shortcut = normalizeShortcut(item.shortcut);
              const matchingGlobalCommand = hotkeyCommands.find((command) => normalizeShortcut(command.keybinding) === shortcut);
              const hasConflict = conflicts.has(shortcut) || (!!shortcut && !!matchingGlobalCommand);
              return (
                <div key={item.id} className="grid grid-cols-[28px_minmax(170px,1.25fr)_170px_minmax(150px,.8fr)_42px] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-text/[0.025]">
                  <GripVertical size={15} className="text-text/22" />
                  <div className="min-w-0">
                    <input
                      value={item.label}
                      onChange={(event) => update(item.id, { label: event.target.value })}
                      className="h-9 w-full rounded-lg border border-text/10 bg-background px-3 text-xs font-semibold text-text outline-none transition-colors focus:border-primary/55"
                      style={{ borderLeft: `3px solid ${item.backgroundColor}` }}
                      aria-label={`${item.label} label name`}
                    />
                    <input
                      value={item.sectionType}
                      onChange={(event) => update(item.id, { sectionType: event.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      className="mt-1 w-full bg-transparent px-1 text-[9px] font-mono text-text/28 outline-none focus:text-text/55"
                      aria-label={`${item.label} section type`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative h-9 flex-1 overflow-hidden rounded-lg border border-text/12 bg-background" title="Badge background color">
                      <span className="absolute inset-1.5 rounded" style={{ backgroundColor: item.backgroundColor }} />
                      <input type="color" value={item.backgroundColor} onChange={(event) => update(item.id, { backgroundColor: event.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                    <label className="relative h-9 flex-1 overflow-hidden rounded-lg border border-text/12 bg-background" title="Badge text color">
                      <span className="absolute inset-1.5 rounded border border-black/10" style={{ backgroundColor: item.textColor }} />
                      <input type="color" value={item.textColor} onChange={(event) => update(item.id, { textColor: event.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                  </div>
                  <div>
                    <input
                      value={item.shortcut}
                      maxLength={18}
                      onChange={(event) => update(item.id, { shortcut: normalizeShortcut(event.target.value) })}
                      placeholder="None"
                      className={`h-9 w-full rounded-lg border bg-background px-3 font-mono text-xs text-text outline-none transition-colors ${hasConflict ? 'border-amber-400/55' : 'border-text/10 focus:border-primary/55'}`}
                      aria-label={`${item.label} shortcut`}
                    />
                    {hasConflict && (
                      <span className="mt-1 flex items-center gap-1 text-[9px] font-medium text-amber-400">
                        <AlertTriangle size={10} /> {matchingGlobalCommand ? `Used by ${matchingGlobalCommand.name}` : 'Shortcut conflict'}
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={() => onChange(labels.filter((entry) => entry.id !== item.id))} className="grid h-8 w-8 place-items-center rounded-lg text-text/30 transition-colors hover:bg-red-500/10 hover:text-red-400" title={`Delete ${item.label}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="bg-background/55 p-5">
        <div className="sticky top-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/34">{t('slideLabelsWorkspace.livePreview')}</div>
          <h4 className="mt-2 text-sm font-semibold text-text">{t('slideLabelsWorkspace.sectionBadges')}</h4>
          <div className="mt-4 space-y-2.5">
            {previewItems.map((item, index) => (
              <div key={item.id} className="rounded-xl border border-text/8 bg-white/[0.025] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ backgroundColor: item.backgroundColor, color: item.textColor }}>
                    {item.label}
                  </span>
                  {item.shortcut && <kbd className="rounded border border-text/15 bg-black/20 px-2 py-1 font-mono text-[10px] text-text/60">{item.shortcut}</kbd>}
                </div>
                <div className="mt-3 text-sm font-semibold text-text/82">{item.label}{item.sectionType === 'verse' ? ` ${index + 1}` : ''}</div>
                <div className="mt-1 text-[10px] text-text/34">{t('slideLabelsWorkspace.cueHint')}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-3 rounded-xl border border-primary/15 bg-primary/[0.055] p-3.5">
            <Keyboard size={17} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-[11px] leading-5 text-text/52">
              {t('slideLabelsWorkspace.shortcutBehaviorHint')}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
