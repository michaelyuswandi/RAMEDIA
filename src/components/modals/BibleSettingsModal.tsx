import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trash2, Download, Palette, Key, ExternalLink, Check } from 'lucide-react';
import { useBibleManager } from '../../hooks/useBibleManager';
import { ipcTemplateService } from '../../core/services/ipcTemplateService';
import { ipcOutputSettingsService } from '../../core/services/ipcOutputSettingsService';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { buildLayersFromContentThemeData } from '../../core/songEditor/songPresets';
import type { Template } from '../../electron/database/schema';
import { SlideRenderer } from '../common/SlideRenderer';

interface BibleSettingsModalProps {
  onClose: () => void;
}

export default function BibleSettingsModal({ onClose }: BibleSettingsModalProps) {
  const [bibleSettingsTab, setBibleSettingsTab] = useState<'local' | 'cloud'>('local');
  const [countryQuery, setCountryQuery] = useState('');
  const [languageQuery, setLanguageQuery] = useState('');
  const [bibleQuery, setBibleQuery] = useState('');
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedLanguageIso, setSelectedLanguageIso] = useState<string | null>(null);
  const [scriptureThemes, setScriptureThemes] = useState<Template[]>([]);
  const savedBibleBrainApiKey = useSettingsStore((state) => state.bibleBrainApiKey);
  const [bibleBrainApiKeyInput, setBibleBrainApiKeyInput] = useState(savedBibleBrainApiKey || '');
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const defaultBibleContentThemeId = useSettingsStore((state) => state.defaultBibleContentThemeId);
  const defaultBibleContentThemeName = useSettingsStore((state) => state.defaultBibleContentThemeName);
  const defaultBibleContentThemeLayersData = useSettingsStore((state) => state.defaultBibleContentThemeLayersData);
  const setOutputSettings = useSettingsStore((state) => state.setSettings);

  const handleSaveApiKey = async () => {
    const trimmed = bibleBrainApiKeyInput.trim() || null;
    setOutputSettings({ bibleBrainApiKey: trimmed });
    if (window.api?.bible?.setApiKey) {
      await window.api.bible.setApiKey(trimmed);
    }
    setIsApiKeySaved(true);
    setTimeout(() => setIsApiKeySaved(false), 2500);
  };

  const {
    versions: installedBibles,
    countries,
    languages,
    bibles: remoteBibles,
    storageStats,
    isDownloading,
    isLoadingCloud,
    error,
    downloadProgress,
    refreshVersions: loadBibleManagementData,
    fetchCountries,
    fetchLanguages,
    fetchBiblesByLanguage,
    downloadFromCloud: handleDownloadBible,
    deleteVersion: handleDeleteBible,
    clearCache: handleClearAllBibles,
  } = useBibleManager();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (bibleSettingsTab !== 'cloud' || countries.length > 0) return;
    void fetchCountries().catch(() => undefined);
  }, [bibleSettingsTab, countries.length, fetchCountries]);

  useEffect(() => {
    let active = true;
    const loadThemes = async () => {
      await ipcTemplateService.seed();
      const page = await ipcTemplateService.getLibraryPage({ contentType: 'scripture', limit: 250 });
      if (active) setScriptureThemes(page.items);
    };
    const refreshThemes = () => void loadThemes().catch(() => undefined);
    refreshThemes();
    window.addEventListener('rumedia:templates-changed', refreshThemes);
    return () => {
      active = false;
      window.removeEventListener('rumedia:templates-changed', refreshThemes);
    };
  }, []);

  const selectedDefaultTheme = useMemo(
    () => scriptureThemes.find((theme) => theme.id === defaultBibleContentThemeId) || null,
    [defaultBibleContentThemeId, scriptureThemes],
  );

  const defaultThemePreviewSlide = useMemo(() => {
    const layersData = selectedDefaultTheme?.layersData || defaultBibleContentThemeLayersData;
    if (!defaultBibleContentThemeId || !layersData) return null;
    const scriptureText = 'Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal.';
    const scriptureReference = 'Yohanes 3:16';
    return {
      id: 'bible-settings-theme-preview',
      type: 'bible',
      content: `${scriptureReference}\n\n${scriptureText}`,
      label: scriptureReference,
      sectionType: 'Bible',
      scriptureText,
      scriptureReference,
      versionCode: 'TB',
      contentThemeId: defaultBibleContentThemeId,
      contentThemeName: selectedDefaultTheme?.name || defaultBibleContentThemeName,
      layers: buildLayersFromContentThemeData(
        'bible-settings-theme-preview',
        scriptureText,
        layersData,
        {
          scriptureText,
          scriptureReference,
          scriptureVersion: 'TB',
          sectionLabel: 'Ayat',
        },
      ),
    } as any;
  }, [
    defaultBibleContentThemeId,
    defaultBibleContentThemeLayersData,
    defaultBibleContentThemeName,
    selectedDefaultTheme,
  ]);

  const updateDefaultScriptureTheme = (themeId: string) => {
    const theme = scriptureThemes.find((item) => item.id === themeId) || null;
    const patch = {
      defaultBibleContentThemeId: theme?.id || null,
      defaultBibleContentThemeName: theme?.name || null,
      defaultBibleContentThemeLayersData: theme?.layersData || null,
    };
    setOutputSettings(patch);
    void ipcOutputSettingsService.setSettings(patch).catch(() => undefined);
  };

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === selectedCountryId) || null,
    [countries, selectedCountryId],
  );
  const selectedLanguage = useMemo(
    () => languages.find((language) => (language.iso || language.id) === selectedLanguageIso) || null,
    [languages, selectedLanguageIso],
  );
  const filteredCountries = useMemo(() => {
    const query = countryQuery.trim().toLowerCase();
    if (!query) return countries;
    return countries.filter((country) =>
      country.name.toLowerCase().includes(query)
      || country.id.toLowerCase().includes(query)
      || (country.code || '').toLowerCase().includes(query)
    );
  }, [countries, countryQuery]);
  const filteredLanguages = useMemo(() => {
    const query = languageQuery.trim().toLowerCase();
    if (!query) return languages;
    return languages.filter((language) =>
      language.name.toLowerCase().includes(query)
      || language.iso.toLowerCase().includes(query)
      || (language.autonym || '').toLowerCase().includes(query)
    );
  }, [languageQuery, languages]);
  const filteredBibles = useMemo(() => {
    const query = bibleQuery.trim().toLowerCase();
    if (!query) return remoteBibles;
    return remoteBibles.filter((bible) =>
      bible.name.toLowerCase().includes(query)
      || bible.abbr.toLowerCase().includes(query)
      || (bible.vname || '').toLowerCase().includes(query)
      || bible.language.toLowerCase().includes(query)
    );
  }, [bibleQuery, remoteBibles]);

  const selectCountry = (countryId: string) => {
    setSelectedCountryId(countryId);
    setSelectedLanguageIso(null);
    setLanguageQuery('');
    setBibleQuery('');
    void fetchLanguages(countryId).catch(() => undefined);
  };

  const selectLanguage = (languageIso: string) => {
    setSelectedLanguageIso(languageIso);
    setBibleQuery('');
    void fetchBiblesByLanguage(languageIso).catch(() => undefined);
  };

  const refreshCloudStep = () => {
    if (selectedLanguageIso) {
      void fetchBiblesByLanguage(selectedLanguageIso).catch(() => undefined);
      return;
    }
    if (selectedCountryId) {
      void fetchLanguages(selectedCountryId).catch(() => undefined);
      return;
    }
    void fetchCountries().catch(() => undefined);
  };

  const handleImportLocalFile = async () => {
    try {
      if (window.api?.bible?.importFile) {
        const result = await window.api.bible.importFile();
        if (result) {
          await loadBibleManagementData();
        }
      }
    } catch (err) {
      console.error('Failed to import local bible:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bible-settings-title"
        className="flex h-[min(720px,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-[0_24px_70px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.06)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-text/10 px-6 py-4 bg-surface">
          <div>
            <h3 id="bible-settings-title" className="font-extrabold text-text text-base uppercase tracking-wider">Bible Settings & Translations</h3>
            <p className="text-xs text-text/50">Kelola modul terjemahan dan preferensi Alkitab</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-text/10 bg-text/[0.04] px-3 py-1.5 text-xs font-semibold text-text/75 hover:bg-text/10 hover:text-text transition"
          >
            Tutup
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-text/10 bg-surface/50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setBibleSettingsTab('local')}
            className={`pb-3 px-4 text-xs font-bold text-center border-b-2 transition ${
              bibleSettingsTab === 'local'
                ? 'border-primary text-primary'
                : 'border-transparent text-text/60 hover:text-text'
            }`}
          >
            Local Bibles
          </button>
          <button
            type="button"
            onClick={() => setBibleSettingsTab('cloud')}
            className={`pb-3 px-4 text-xs font-bold text-center border-b-2 transition ${
              bibleSettingsTab === 'cloud'
                ? 'border-primary text-primary'
                : 'border-transparent text-text/60 hover:text-text'
            }`}
          >
            Cloud Downloads
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
          {bibleSettingsTab === 'local' ? (
            <>
              {/* Import Action Box */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-primary/30 bg-primary/[0.04]">
                <div>
                  <div className="text-xs font-bold text-text">Import File Alkitab Lokal</div>
                  <p className="text-[11px] text-text/50 mt-0.5">Mendukung format XML (Zefania / OSIS / OpenSong), JSON, USFM, SQLite, & .bible</p>
                </div>
                <button
                  type="button"
                  onClick={handleImportLocalFile}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Download size={14} />
                  <span>Import File Alkitab</span>
                </button>
              </div>

              {storageStats && (
                <div className="bg-text/[0.04] border border-text/10 rounded-lg p-4 text-xs text-text/70 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Installed Translations:</span>
                    <span className="font-bold text-text">{storageStats.biblesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Storage Used:</span>
                    <span className="font-bold text-text">{storageStats.totalSizeInMB.toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage Path:</span>
                    <span className="font-mono text-[10px] text-text/50 truncate max-w-md">{storageStats.biblesPath}</span>
                  </div>
                </div>
              )}

              <div className="grid gap-4 rounded-lg border border-primary/20 bg-primary/[0.045] p-4 sm:grid-cols-[minmax(220px,0.8fr)_minmax(300px,1.2fr)] sm:items-stretch">
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                      <Palette size={17} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-text">Default Scripture Theme</div>
                      <p className="mt-1 text-[11px] leading-4 text-text/45">
                        Otomatis dipakai untuk item Bible baru. Theme per item masih dapat diganti di Bible Workspace.
                      </p>
                    </div>
                  </div>
                  <label className="mt-4 block space-y-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text/40">Theme</span>
                    <select
                      value={defaultBibleContentThemeId || ''}
                      onChange={(event) => updateDefaultScriptureTheme(event.target.value)}
                      className="h-10 w-full rounded-lg border border-text/10 bg-text/[0.04] px-3 text-xs font-semibold text-text outline-none transition focus:border-primary/55 active:scale-[0.99]"
                    >
                      <option value="">No default · use Screen Layout rule</option>
                      {scriptureThemes.map((theme) => (
                        <option key={theme.id} value={theme.id}>{theme.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-auto pt-3 text-[10px] font-semibold text-primary/85">
                    {selectedDefaultTheme
                      ? `${selectedDefaultTheme.category || 'Scripture'} · Content Theme`
                      : 'Output mengikuti aturan Screen Layout'}
                  </div>
                </div>

                <div className="min-w-0 border-l border-text/8 pl-4 max-sm:border-l-0 max-sm:border-t max-sm:pl-0 max-sm:pt-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text/40">Sample Preview</span>
                    <span className="max-w-44 truncate text-[10px] font-semibold text-text/55">
                      {selectedDefaultTheme?.name || defaultBibleContentThemeName || 'Screen Layout'}
                    </span>
                  </div>
                  <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-text/10 bg-[#111318] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    {defaultThemePreviewSlide ? (
                      <div className="pointer-events-none h-full w-full">
                        <SlideRenderer slide={defaultThemePreviewSlide} forceMuted renderMode="preview" />
                      </div>
                    ) : (
                      <div className="px-6 text-center">
                        <Palette size={20} className="mx-auto text-text/25" />
                        <div className="mt-2 text-[11px] font-semibold text-text/50">Preview mengikuti Screen Layout</div>
                        <div className="mt-1 text-[10px] leading-4 text-text/30">Pilih sebuah Scripture Theme untuk melihat hasilnya di sini.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Terjemahan Tersimpan Section */}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-text/60">Terjemahan Tersimpan</span>
                <button
                  type="button"
                  onClick={() => void loadBibleManagementData()}
                  className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {installedBibles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-text/15 p-8 text-center text-xs text-text/40">
                  Belum ada terjemahan lokal yang terpasang. Silakan unduh melalui tab Cloud Downloads atau import file XML lokal.
                </div>
              ) : (
                <div className="space-y-2">
                  {installedBibles.map((bible: any) => (
                    <div
                      key={bible.id || bible.code}
                      className="flex items-center justify-between rounded-lg border border-text/10 bg-text/[0.02] p-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-text">{bible.name}</div>
                        <div className="text-[11px] text-text/50">{bible.code} • {bible.language}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBible(bible.id || bible.code)}
                        className="rounded-md p-2 text-rose-400 hover:bg-rose-500/10 transition"
                        title="Hapus terjemahan ini"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {/* BibleBrain Custom API Key Configuration */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/[0.03] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-text">
                    <Key size={15} className="text-primary" />
                    <span>BibleBrain API Key (Opsional)</span>
                  </div>
                  <a
                    href="https://biblebrain.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    Dapatkan Key Gratis <ExternalLink size={11} />
                  </a>
                </div>
                <p className="text-[11px] text-text/60 leading-relaxed">
                  Secara default RAMEDIA menyertakan API Key bawaan. Anda dapat memasukkan API Key BibleBrain (DBT) milik gereja Anda sendiri untuk akses penuh.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={bibleBrainApiKeyInput}
                    onChange={(e) => setBibleBrainApiKeyInput(e.target.value)}
                    placeholder="e.g. e42de252-9cdd-410f-8274-..."
                    className="flex-1 h-9 rounded-lg border border-text/15 bg-background px-3 text-xs text-text font-mono outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleSaveApiKey}
                    className="h-9 px-4 rounded-lg bg-primary/20 text-primary border border-primary/30 text-xs font-bold hover:bg-primary/30 transition flex items-center gap-1"
                  >
                    {isApiKeySaved ? <Check size={14} /> : null}
                    <span>{isApiKeySaved ? 'Tersimpan' : 'Simpan Key'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text/35">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCountryId(null);
                        setSelectedLanguageIso(null);
                        setCountryQuery('');
                      }}
                      className={selectedCountryId ? 'transition hover:text-primary' : 'text-primary'}
                    >
                      Negara
                    </button>
                    {selectedCountry && <><span>/</span><button type="button" onClick={() => setSelectedLanguageIso(null)} className={selectedLanguageIso ? 'max-w-48 truncate transition hover:text-primary' : 'max-w-48 truncate text-primary'}>{selectedCountry.name}</button></>}
                    {selectedLanguage && <><span>/</span><span className="max-w-48 truncate text-primary">{selectedLanguage.name}</span></>}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-text/70">
                    {selectedLanguage ? 'Pilih versi Alkitab untuk diunduh' : selectedCountry ? `Bahasa di ${selectedCountry.name}` : 'Cari Alkitab berdasarkan negara'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={refreshCloudStep}
                  disabled={isLoadingCloud}
                  className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary transition hover:text-primary/80 disabled:opacity-40"
                >
                  <RefreshCw size={12} className={isLoadingCloud ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-xs leading-relaxed text-rose-300">
                  {error}
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text/40">
                  {selectedLanguage ? 'Cari versi' : selectedCountry ? 'Cari bahasa' : 'Cari negara'}
                </span>
                <input
                  value={selectedLanguage ? bibleQuery : selectedCountry ? languageQuery : countryQuery}
                  onChange={(event) => {
                    if (selectedLanguage) setBibleQuery(event.target.value);
                    else if (selectedCountry) setLanguageQuery(event.target.value);
                    else setCountryQuery(event.target.value);
                  }}
                  placeholder={selectedLanguage ? 'Nama atau singkatan versi...' : selectedCountry ? 'Nama atau kode bahasa...' : 'Nama atau kode negara...'}
                  className="w-full rounded-lg border border-text/10 bg-text/[0.035] px-3 py-2.5 text-xs text-text outline-none transition placeholder:text-text/25 focus:border-primary/55"
                />
              </label>

              {isLoadingCloud ? (
                <div className="space-y-2" aria-label="Memuat katalog Cloud Bible">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-lg border border-text/8 bg-text/[0.02] p-3">
                      <div className="space-y-2">
                        <div className="h-3 w-48 animate-pulse rounded bg-text/10" />
                        <div className="h-2.5 w-28 animate-pulse rounded bg-text/[0.06]" />
                      </div>
                      <div className="h-7 w-20 animate-pulse rounded-lg bg-text/10" />
                    </div>
                  ))}
                </div>
              ) : !selectedCountry ? (
                filteredCountries.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-text/15 px-6 py-10 text-center">
                    <div className="text-xs font-semibold text-text/55">Negara tidak ditemukan</div>
                    <div className="mt-1 text-[11px] text-text/35">Ubah kata pencarian atau tekan Refresh.</div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredCountries.map((country) => (
                      <button
                        key={country.id}
                        type="button"
                        onClick={() => selectCountry(country.id)}
                        className="flex min-h-16 items-center gap-3 rounded-lg border border-text/10 bg-text/[0.02] px-3 py-2.5 text-left transition hover:border-primary/35 hover:bg-primary/[0.055] active:scale-[0.98]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-text/[0.055] font-mono text-[10px] font-bold uppercase text-text/65">{(country.code || country.id).slice(0, 3)}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-text/85">{country.name}</span>
                          <span className="mt-0.5 block text-[10px] text-text/35">{country.languagesCount ? `${country.languagesCount} bahasa` : country.code || country.id}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )
              ) : !selectedLanguage ? (
                filteredLanguages.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-text/15 px-6 py-10 text-center">
                    <div className="text-xs font-semibold text-text/55">Bahasa tidak ditemukan</div>
                    <div className="mt-1 text-[11px] text-text/35">Pilih negara lain atau tekan Refresh.</div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredLanguages.map((language) => (
                      <button
                        key={language.id || language.iso}
                        type="button"
                        onClick={() => selectLanguage(language.iso || language.id)}
                        className="flex min-h-16 items-center gap-3 rounded-lg border border-text/10 bg-text/[0.02] px-3 py-2.5 text-left transition hover:border-primary/35 hover:bg-primary/[0.055] active:scale-[0.98]"
                      >
                        <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md bg-text/[0.055] px-1.5 font-mono text-[10px] font-bold uppercase text-text/65">{language.iso}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-text/85">{language.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-text/35">{language.autonym || (language.biblesCount ? `${language.biblesCount} versi` : language.iso)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )
              ) : filteredBibles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-text/15 px-6 py-10 text-center">
                  <div className="text-xs font-semibold text-text/55">Versi Alkitab tidak ditemukan</div>
                  <div className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-text/35">Ubah pencarian, pilih bahasa lain, atau tekan Refresh.</div>
                </div>
              ) : (
                <div className="space-y-2">
                {filteredBibles.map((bible: any) => {
                  const bibleCode = String(bible.abbr || bible.code || '');
                  const isAlreadyInstalled = installedBibles.some((item: any) => String(item.code || '').toLowerCase() === bibleCode.toLowerCase());
                  const isCurrentDownloading = isDownloading && downloadProgress?.code === bibleCode;
                  return (
                    <div
                      key={bible.id || bible.code || bible.abbr}
                      className="flex items-center justify-between rounded-lg border border-text/10 bg-text/[0.02] p-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-text">{bible.vname || bible.name}</div>
                        <div className="text-[11px] text-text/50">{bibleCode} · {bible.language}</div>
                      </div>
                      <button
                        type="button"
                        disabled={isAlreadyInstalled || isDownloading}
                        onClick={() => void handleDownloadBible(
                          bibleCode,
                          bible.name || bible.vname || '',
                          bible.filesetId || '',
                          bible.languageIso || bible.language || ''
                        ).catch(() => undefined)}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-bold text-black hover:brightness-110 disabled:opacity-40 transition"
                      >
                        <Download size={14} />
                        {isAlreadyInstalled ? 'Terpasang' : isCurrentDownloading ? `Mengunduh ${Math.round(downloadProgress?.percent || 0)}%` : 'Unduh'}
                      </button>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-5 border-t border-text/10 bg-surface px-6 py-4">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Hapus semua terjemahan Alkitab lokal yang terunduh?')) {
                void handleClearAllBibles();
              }
            }}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition"
          >
            Clear Cache
          </button>
          <p className="min-w-0 flex-1 text-center text-[10px] leading-4 text-text/38">
            Tampilan ayat dikelola melalui <span className="font-semibold text-text/60">Content Theme — Scripture</span> di Preset Library.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-black hover:brightness-105 transition"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
