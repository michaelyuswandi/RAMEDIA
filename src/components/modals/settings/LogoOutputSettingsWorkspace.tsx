import { useEffect, useMemo, useState } from 'react';
import { Check, Film, Image as ImageIcon, Search, ShieldCheck, Trash2 } from 'lucide-react';
import type { LogoOutputSettings } from '../../../core/models/outputSettings';
import { ipcMediaService } from '../../../core/services/ipcMediaService';
import type { Media } from '../../../electron/database/schema';
import { toRenderableMediaUrl } from '../../../core/utils/mediaUrl';
import { LogoOutputSurface } from '../../common/LogoOutputSurface';
import { useI18n } from '../../../i18n';

interface Props {
  value: LogoOutputSettings;
  onChange: (value: LogoOutputSettings) => void;
}

function getPreviewSource(media: Media) {
  return toRenderableMediaUrl(media.thumbnail || media.filepath);
}

export function LogoOutputSettingsWorkspace({ value, onChange }: Props) {
  const { t } = useI18n();
  const [media, setMedia] = useState<Media[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    ipcMediaService.getAll()
      .then((items) => {
        if (active) setMedia(items.filter((item) => item.mediaType === 'image' || item.mediaType === 'video'));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const visibleMedia = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return media.filter((item) => !needle || item.filename.toLowerCase().includes(needle));
  }, [media, query]);

  const selectMedia = (item: Media) => {
    onChange({
      ...value,
      mediaId: item.id,
      filename: item.filename,
      mediaType: item.mediaType === 'video' ? 'video' : 'image',
      source: item.filepath,
      thumbnail: item.thumbnail || null,
      loop: true,
    });
  };

  return (
    <div className="grid min-h-full xl:grid-cols-[minmax(640px,1fr)_360px]">
      <section className="min-w-0 border-r border-text/5 p-6">
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <ImageIcon size={17} className="text-primary" />
            <h3 className="text-base font-semibold text-text">{t('logoOutput.title')}</h3>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-text/48">
            {t('logoOutput.description')}
          </p>
        </div>

        <div className="rounded-xl border border-text/10 bg-black/10 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/38">{t('logoOutput.logoMedia')}</div>
          {value.mediaId ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.055] p-3">
              <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-text/10 bg-black">
                {value.thumbnail || (value.mediaType === 'image' && value.source) ? (
                  <img src={toRenderableMediaUrl(value.thumbnail || value.source)} alt="" className="h-full w-full object-cover" />
                ) : value.mediaType === 'video' ? <Film size={20} className="text-text/45" /> : <ImageIcon size={20} className="text-text/45" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-text">{value.filename}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-text/38">
                  {value.mediaType === 'video' ? 'Video · Muted · Loop' : 'Image'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...value, mediaId: null, filename: null, mediaType: null, source: null, thumbnail: null })}
                className="grid h-9 w-9 place-items-center rounded-lg text-text/35 transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="Remove logo media"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-text/12 px-4 py-6 text-center text-xs text-text/38">
              {t('logoOutput.noLogoMedia')}
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text/42">{t('logoOutput.fit')}</span>
              <select
                value={value.fit}
                onChange={(event) => onChange({ ...value, fit: event.target.value as LogoOutputSettings['fit'] })}
                className="h-10 w-full rounded-lg border border-text/10 bg-background px-3 text-xs text-text outline-none focus:border-primary/50"
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="fill">Fill</option>
              </select>
            </label>
            <div className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text/42">{t('logoOutput.videoBehavior')}</span>
              <label className="flex h-10 items-center justify-between rounded-lg border border-text/10 bg-background px-3 text-xs text-text/65">
                {t('logoOutput.loopVideo')}
                <input type="checkbox" checked={value.loop} onChange={(event) => onChange({ ...value, loop: event.target.checked })} className="accent-primary" />
              </label>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.055] p-3 text-[11px] leading-5 text-text/52">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-400" />
            {t('logoOutput.audioNotice')}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/38">{t('logoOutput.chooseFromMedia')}</div>
              <div className="mt-1 text-xs text-text/42">{t('logoOutput.imagesAndVideosOnly')}</div>
            </div>
            <label className="flex h-9 w-56 items-center gap-2 rounded-lg border border-text/10 bg-background px-3 text-text/35 focus-within:border-primary/50">
              <Search size={13} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('logoOutput.searchMedia')} className="min-w-0 flex-1 bg-transparent text-xs text-text outline-none placeholder:text-text/25" />
            </label>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((item) => <div key={item} className="aspect-video animate-pulse rounded-xl bg-text/[0.05]" />)}
            </div>
          ) : visibleMedia.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {visibleMedia.map((item) => {
                const selected = value.mediaId === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => selectMedia(item)}
                    className={`group overflow-hidden rounded-xl border text-left transition active:scale-[0.99] ${selected ? 'border-primary bg-primary/8' : 'border-text/8 bg-white/[0.025] hover:border-text/18'}`}
                  >
                    <div className="relative aspect-video bg-black">
                      {item.thumbnail || item.mediaType === 'image' ? (
                        <img src={getPreviewSource(item)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-text/[0.04]"><Film size={24} className="text-white/45" /></div>
                      )}
                      <span className="absolute left-2 top-2 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/75">{item.mediaType}</span>
                      {selected && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-black"><Check size={12} /></span>}
                    </div>
                    <div className="truncate px-2.5 py-2 text-[10px] font-semibold text-text/70">{item.filename}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-text/10 px-4 py-8 text-center text-xs text-text/35">{t('logoOutput.noMediaInLibrary')}</div>
          )}
        </div>
      </section>

      <aside className="bg-background/55 p-5">
        <div className="sticky top-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/34">{t('logoOutput.secondScreenPreview')}</div>
          <div className="mt-4 overflow-hidden rounded-xl border border-text/10 bg-black shadow-[0_18px_44px_rgba(0,0,0,0.22)]" style={{ aspectRatio: '16 / 9' }}>
            <LogoOutputSurface settings={value} />
          </div>
          <div className="mt-3 inline-flex rounded-md bg-primary px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-black">{t('logoOutput.readyForLogo')}</div>
          <p className="mt-3 text-[11px] leading-5 text-text/46">
            {t('logoOutput.clickLogoHint')}
          </p>
          <div className="mt-5 rounded-xl border border-text/8 bg-white/[0.025] p-3.5 text-[10px] leading-5 text-text/42">
            {t('logoOutput.toggleFlowHint')}
          </div>
        </div>
      </aside>
    </div>
  );
}
