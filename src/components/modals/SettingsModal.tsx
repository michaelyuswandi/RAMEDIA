import { useEffect, useMemo, useState, useRef } from 'react';
import {
  X,
  Monitor,
  RotateCcw,
  Check,
  Settings,
  Keyboard,
  Info,
  Tv,
  Palette,
  Moon,
  Sun,
  Database,
  UploadCloud,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Tags,
  Image as ImageIcon,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import { AiSettingsWorkspace } from './settings/AiSettingsWorkspace';
import { Broadcast as BroadcastIcon } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { ipcOutputSettingsService } from '../../core/services/ipcOutputSettingsService';
import {
  DEFAULT_AI_FORMATTING_SETTINGS,
  createBrowserOutputClient,
  createDefaultOutputChannel,
  getDefaultBrowserClientName,
  getDefaultOutputName,
  type BrowserOutputClient,
  type OutputChannel,
  type OutputDisplayInfo,
  type OutputPreset,
  DEFAULT_LOGO_OUTPUT_SETTINGS,
  type LogoOutputSettings,
} from '../../core/models/outputSettings';
import { ipcSongService, type EasyWorshipImportResult, type EasyWorshipScanResult } from '../../core/services/ipcSongService';
import { ipcTemplateService } from '../../core/services/ipcTemplateService';
import { useHotkeysStore } from '../../core/stores/useHotkeysStore';
import type { Template } from '../../electron/database/schema';
import { OutputSettingsWorkspace } from './settings/OutputSettingsWorkspace';
import type { BrowserRuntimeState, NdiRuntimeState } from './settings/outputShared';
import { useI18n, type LocaleCode } from '../../i18n';
import {
  DEFAULT_SLIDE_LABELS,
  useSlideLabelSettingsStore,
  type SlideLabelSetting,
} from '../../core/stores/useSlideLabelSettingsStore';
import { SlideLabelSettingsWorkspace } from './settings/SlideLabelSettingsWorkspace';
import { LogoOutputSettingsWorkspace } from './settings/LogoOutputSettingsWorkspace';
import { sync } from '../../core/sync';
import type { RemoteRuntimeSummary } from '../../core/remote/types';
import { RemoteControlSettingsWorkspace } from './settings/RemoteControlSettingsWorkspace';
import {
  DEFAULT_GENERAL_SETTINGS,
  useGeneralSettingsStore,
  type GeneralSettings,
} from '../../core/stores/useGeneralSettingsStore';

interface SettingsModalProps {
  onClose: () => void;
  onLibraryChanged?: () => void;
  standalone?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
}

const COLORS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
];

const INITIAL_OUTPUT_STATE = {
  isOpen: false,
  isFullscreen: false,
  openCount: 0,
  totalLocalOutputs: 0,
};

export default function SettingsModal({ onClose, onLibraryChanged, standalone = false, onDirtyChange, onSaved }: SettingsModalProps) {
  const { t } = useI18n();
  const {
    locale,
    outputWidth,
    outputHeight,
    appTheme,
    primaryColor,
    showSafeArea,
    safeAreaPercent,
    outputs,
    outputPresets,
    browserClients,
    defaultSongPresetId,
    defaultSongStyle,
    logoOutput,
    setSettings,
  } = useSettingsStore();

  const [width, setWidth] = useState(outputWidth);
  const [height, setHeight] = useState(outputHeight);
  const [selectedLocale, setSelectedLocale] = useState<LocaleCode>(locale);
  const [theme, setTheme] = useState(appTheme);
  const [color, setColor] = useState(primaryColor);
  const [isSafeAreaEnabled, setIsSafeAreaEnabled] = useState(showSafeArea);
  const [safeArea, setSafeArea] = useState(safeAreaPercent);
  const [outputChannels, setOutputChannels] = useState<OutputChannel[]>(outputs);
  const [outputPresetItems, setOutputPresetItems] = useState<OutputPreset[]>(outputPresets);
  const [browserTargets, setBrowserTargets] = useState<BrowserOutputClient[]>(browserClients);
  const [globalDefaultSongPresetId, setGlobalDefaultSongPresetId] = useState<string | null>(defaultSongPresetId);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(outputs[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState('general');
  const [outputSection, setOutputSection] = useState<'channels' | 'logo'>('channels');
  const savedDefaultControllerView = useGeneralSettingsStore((state) => state.defaultControllerView);
  const savedRememberLastControllerView = useGeneralSettingsStore((state) => state.rememberLastControllerView);
  const savedRestoreLastRundown = useGeneralSettingsStore((state) => state.restoreLastRundown);
  const savedDefaultKeyboardFocus = useGeneralSettingsStore((state) => state.defaultKeyboardFocus);
  const savedDefaultSlideViewMode = useGeneralSettingsStore((state) => state.defaultSlideViewMode);
  const savedGeneralSettings = useMemo<GeneralSettings>(() => ({
    defaultControllerView: savedDefaultControllerView,
    rememberLastControllerView: savedRememberLastControllerView,
    restoreLastRundown: savedRestoreLastRundown,
    defaultKeyboardFocus: savedDefaultKeyboardFocus,
    defaultSlideViewMode: savedDefaultSlideViewMode,
  }), [savedDefaultControllerView, savedRememberLastControllerView, savedRestoreLastRundown, savedDefaultKeyboardFocus, savedDefaultSlideViewMode]);
  const saveGeneralSettings = useGeneralSettingsStore((state) => state.setSettings);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(savedGeneralSettings);
  const [appVersion, setAppVersion] = useState('—');
  const [systemInfo, setSystemInfo] = useState<{ platform: string; userDataPath: string; databasePath: string; logsPath: string } | null>(null);
  const { labels: savedSlideLabels, setLabels: saveSlideLabels } = useSlideLabelSettingsStore();
  const [slideLabels, setSlideLabels] = useState<SlideLabelSetting[]>(savedSlideLabels);
  const [logoOutputSettings, setLogoOutputSettings] = useState<LogoOutputSettings>(logoOutput);
  const [outputState, setOutputState] = useState(INITIAL_OUTPUT_STATE);
  const [displays, setDisplays] = useState<OutputDisplayInfo[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isImportingSongs, setIsImportingSongs] = useState(false);
  const [isScanningSongs, setIsScanningSongs] = useState(false);
  const [importResult, setImportResult] = useState<EasyWorshipImportResult | null>(null);
  const [scanResult, setScanResult] = useState<EasyWorshipScanResult | null>(null);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<number>>(new Set());
  const [importSearch, setImportSearch] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [songPresets, setSongPresets] = useState<Template[]>([]);
  const [browserRuntime, setBrowserRuntime] = useState<BrowserRuntimeState | null>(null);
  const [ndiRuntime, setNdiRuntime] = useState<NdiRuntimeState | null>(null);
  const [remoteRuntime, setRemoteRuntime] = useState<RemoteRuntimeSummary | null>(null);
  const [dbSuccessMessage, setDbSuccessMessage] = useState<string | null>(null);
  const txtInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const [activeDbSubTab, setActiveDbSubTab] = useState<'backup' | 'cache' | 'songs'>('backup');
  const [cacheStats, setCacheStats] = useState<{ totalBytes: number; folders: { name: string; size: number }[] } | null>(null);
  const [cacheAssets, setCacheAssets] = useState<any[]>([]);
  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [dbSongs, setDbSongs] = useState<any[]>([]);
  const [dbSongsQuery, setDbSongsQuery] = useState('');
  const [selectedDbSongIds, setSelectedDbSongIds] = useState<Set<string>>(new Set());

  const savedSettingsSnapshot = useMemo(() => JSON.stringify({
    width: outputWidth,
    height: outputHeight,
    locale,
    theme: appTheme,
    color: primaryColor,
    safeAreaEnabled: showSafeArea,
    safeArea: safeAreaPercent,
    outputChannels: outputs,
    outputPresetItems: outputPresets,
    browserTargets: browserClients,
    globalDefaultSongPresetId: defaultSongPresetId,
    slideLabels: savedSlideLabels,
    logoOutputSettings: logoOutput,
    generalSettings: savedGeneralSettings,
  }), [outputWidth, outputHeight, locale, appTheme, primaryColor, showSafeArea, safeAreaPercent, outputs, outputPresets, browserClients, defaultSongPresetId, savedSlideLabels, logoOutput, savedGeneralSettings]);
  const currentSettingsSnapshot = useMemo(() => JSON.stringify({
    width,
    height,
    locale: selectedLocale,
    theme,
    color,
    safeAreaEnabled: isSafeAreaEnabled,
    safeArea,
    outputChannels,
    outputPresetItems,
    browserTargets,
    globalDefaultSongPresetId,
    slideLabels,
    logoOutputSettings,
    generalSettings,
  }), [width, height, selectedLocale, theme, color, isSafeAreaEnabled, safeArea, outputChannels, outputPresetItems, browserTargets, globalDefaultSongPresetId, slideLabels, logoOutputSettings, generalSettings]);
  const isDirty = savedSettingsSnapshot !== currentSettingsSnapshot;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const requestClose = () => {
    if (standalone) {
      onClose();
      return;
    }
    if (isDirty && !window.confirm('Unsaved settings changes will be lost. Close anyway?')) return;
    onDirtyChange?.(false);
    onClose();
  };

  const loadCacheData = async () => {
    if (!window.api?.dbManager) return;
    try {
      const stats = await window.api.dbManager.getCacheStats();
      const assets = await window.api.dbManager.listCacheAssets();
      setCacheStats(stats);
      setCacheAssets(assets);
    } catch (e) {
      console.error('Failed to load cache stats:', e);
    }
  };

  const loadDbSongs = async () => {
    try {
      const allSongs = await ipcSongService.getAll();
      setDbSongs(allSongs);
    } catch (e) {
      console.error('Failed to load songs:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'import') {
      if (activeDbSubTab === 'cache') {
        void loadCacheData();
      } else if (activeDbSubTab === 'songs') {
        void loadDbSongs();
      }
    }
  }, [activeTab, activeDbSubTab]);

  // Hotkey store and states
  const { commands: hotkeyCommands, updateKeybinding, resetToDefaults: resetHotkeys } = useHotkeysStore();
  const [recordingCommandId, setRecordingCommandId] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState<string>('');
  const [hotkeysSearch, setHotkeysSearch] = useState<string>('');

  useEffect(() => {
    setWidth(outputWidth);
    setHeight(outputHeight);
    setSelectedLocale(locale);
    setTheme(appTheme);
    setColor(primaryColor);
    setIsSafeAreaEnabled(showSafeArea);
    setSafeArea(safeAreaPercent);
    setOutputChannels(outputs);
    setOutputPresetItems(outputPresets);
    setBrowserTargets(browserClients);
    setGlobalDefaultSongPresetId(defaultSongPresetId);
    setSlideLabels(savedSlideLabels);
    setLogoOutputSettings(logoOutput);
    setGeneralSettings(savedGeneralSettings);
    setSelectedOutputId((current) => {
      if (outputs.some((output) => output.id === current)) return current;
      return outputs[0]?.id ?? null;
    });
  }, [
    locale,
    outputWidth,
    outputHeight,
    appTheme,
    primaryColor,
    showSafeArea,
    safeAreaPercent,
    outputs,
    outputPresets,
    browserClients,
    defaultSongPresetId,
    defaultSongStyle,
    savedSlideLabels,
    logoOutput,
    savedGeneralSettings,
  ]);

  useEffect(() => {
    if (!window.api?.getAppVersion) return;
    window.api.getAppVersion().then(setAppVersion).catch(() => setAppVersion('Unknown'));
    window.api.system?.getInfo().then((info) => {
      setAppVersion(info.version);
      setSystemInfo(info);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!window.api) return;
    window.api.window.getOutputState().then(setOutputState).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!window.api?.remote) return;
    let active = true;
    const loadRemoteRuntime = async () => {
      try {
        const next = await window.api.remote.getRuntime();
        if (active) setRemoteRuntime(next);
      } catch {
        if (active) setRemoteRuntime(null);
      }
    };
    void loadRemoteRuntime();
    const timer = window.setInterval(() => void loadRemoteRuntime(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    ipcOutputSettingsService.getDisplays().then(setDisplays).catch(() => undefined);

    if (window.api?.screen?.onChanged) {
      const cleanup = window.api.screen.onChanged((updatedDisplays) => {
        setDisplays(updatedDisplays);
      });
      return cleanup;
    }
  }, []);

  useEffect(() => {
    ipcTemplateService.getAll().then(setSongPresets).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!window.api?.outputSettings?.getBrowserRuntime) return;

    let active = true;
    const loadRuntime = async () => {
      try {
        const [browserNext, ndiNext] = await Promise.all([
          window.api.outputSettings.getBrowserRuntime(),
          window.api.ndi?.getRuntimeStatus?.() ?? null,
        ]);
        if (active) {
          setBrowserRuntime(browserNext);
          setNdiRuntime(ndiNext);
        }
      } catch {
        if (active) {
          setBrowserRuntime(null);
          setNdiRuntime(null);
        }
      }
    };

    void loadRuntime();
    const timer = window.setInterval(() => {
      void loadRuntime();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const refreshOutputState = async () => {
    if (!window.api) return;
    const state = await window.api.window.getOutputState();
    setOutputState(state);
  };

  const handleApply = async () => {
    const payload = {
      outputWidth: Math.max(1, width),
      outputHeight: Math.max(1, height),
      locale: selectedLocale,
      appTheme: theme,
      primaryColor: color,
      showSafeArea: isSafeAreaEnabled,
      safeAreaPercent: Math.max(0, Math.min(20, safeArea)),
      outputs: outputChannels,
      outputPresets: outputPresetItems,
      browserClients: browserTargets,
      defaultSongPresetId: globalDefaultSongPresetId,
      defaultSongStyle,
      logoOutput: logoOutputSettings,
      aiFormatting: useSettingsStore.getState().aiFormatting || DEFAULT_AI_FORMATTING_SETTINGS,
    } as const;

    setIsApplying(true);
    try {
      const savedSettings = await ipcOutputSettingsService.setSettings(payload);
      setSettings(savedSettings);
      if (!window.api) {
        sync.broadcast('STATE_UPDATE', { type: 'OUTPUT_SETTINGS_CHANGED', payload: savedSettings });
      }
      saveSlideLabels(slideLabels);
      saveGeneralSettings(generalSettings);
      await refreshOutputState();
      onLibraryChanged?.();
      onDirtyChange?.(false);
      onSaved?.();
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  const applyPreset = (w: number, h: number) => {
    setWidth(w);
    setHeight(h);
  };

  const updateOutput = (outputId: string, updater: (output: OutputChannel) => OutputChannel) => {
    setOutputChannels((current) => current.map((output) => (output.id === outputId ? updater(output) : output)));
  };

  const addOutput = () => {
    const nextIndex = outputChannels.length + 1;
    const nextOutput = createDefaultOutputChannel({
      name: getDefaultOutputName(selectedLocale, nextIndex),
      isPrimary: outputChannels.length === 0,
      role: (['audience', 'singer', 'worship-leader', 'confidence'][Math.min(outputChannels.length, 3)] as OutputChannel['role']) ?? 'audience',
      targetType: 'electron-display',
      locale: selectedLocale,
    });
    setOutputChannels((current) => [...current, nextOutput]);
    setSelectedOutputId(nextOutput.id);
  };

  const addBrowserTarget = (initialName?: string): BrowserOutputClient => {
    const nextIndex = browserTargets.length + 1;
    const nextClient = createBrowserOutputClient({
      name: initialName || getDefaultBrowserClientName(selectedLocale, nextIndex),
      locale: selectedLocale,
    });
    setBrowserTargets((current) => [...current, nextClient]);
    return nextClient;
  };

  const updateBrowserTarget = (clientId: string, updater: (client: BrowserOutputClient) => BrowserOutputClient) => {
    setBrowserTargets((current) => current.map((client) => (client.id === clientId ? updater(client) : client)));
  };

  const removeBrowserTarget = (clientId: string) => {
    setBrowserTargets((current) => current.filter((client) => client.id !== clientId));
    setOutputChannels((current) => current.map((output) => (
      output.browserClientId === clientId ? { ...output, browserClientId: null } : output
    )));
  };

  const removeOutput = (outputId: string) => {
    let nextSelectedId: string | null = null;
    const targetOutput = outputChannels.find((output) => output.id === outputId);
    if (targetOutput?.browserClientId) {
      const clientId = targetOutput.browserClientId;
      setBrowserTargets((current) => current.filter((client) => client.id !== clientId));
    }
    setOutputChannels((current) => {
      if (current.length <= 1) return current;
      const target = current.find((output) => output.id === outputId);
      const next = current.filter((output) => output.id !== outputId);
      if (target?.isPrimary && next.length > 0) {
        next[0] = { ...next[0], isPrimary: true };
      }
      nextSelectedId = next.find((output) => output.id !== outputId)?.id ?? next[0]?.id ?? null;
      return next;
    });
    setSelectedOutputId((current) => (current === outputId ? nextSelectedId : current));
  };

  const setPrimaryOutput = (outputId: string) => {
    setOutputChannels((current) => current.map((output) => ({ ...output, isPrimary: output.id === outputId })));
  };

  const visibleImportSongs = useMemo(() => {
    if (!scanResult) return [];
    const query = importSearch.trim().toLowerCase();
    if (!query) return scanResult.songs;

    return scanResult.songs.filter((song) => (
      song.title.toLowerCase().includes(query) ||
      (song.author || '').toLowerCase().includes(query)
    ));
  }, [importSearch, scanResult]);

  const selectedImportableCount = useMemo(() => {
    if (!scanResult) return 0;
    return scanResult.songs.filter((song) => selectedSongIds.has(song.sourceId) && !song.alreadyExists && song.slideCount > 0).length;
  }, [scanResult, selectedSongIds]);

  const handleEasyWorshipScan = async () => {
    setIsScanningSongs(true);
    setImportError(null);
    setImportResult(null);
    setDbSuccessMessage(null);

    try {
      const result = await ipcSongService.scanEasyWorship();
      if (result) {
        setScanResult(result);
        setSelectedSongIds(new Set(result.songs.filter((song) => !song.alreadyExists && song.slideCount > 0).map((song) => song.sourceId)));
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('settings.scanFailed'));
    } finally {
      setIsScanningSongs(false);
    }
  };

  const handleEasyWorshipImport = async () => {
    if (!scanResult) return;

    setIsImportingSongs(true);
    setImportError(null);
    setImportResult(null);
    setDbSuccessMessage(null);

    try {
      const selectedIds = scanResult.songs
        .filter((song) => selectedSongIds.has(song.sourceId) && !song.alreadyExists && song.slideCount > 0)
        .map((song) => song.sourceId);
      const result = await ipcSongService.importEasyWorship(scanResult.folderPath, selectedIds);

      setImportResult(result);
      if (result.imported > 0) {
        onLibraryChanged?.();
        setScanResult({
          ...scanResult,
          songs: scanResult.songs.map((song) => (
            selectedIds.includes(song.sourceId) ? { ...song, alreadyExists: true } : song
          )),
        });
        setSelectedSongIds(new Set());
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('settings.importFailed'));
    } finally {
      setIsImportingSongs(false);
    }
  };

  const handleToggleImportSong = (sourceId: number) => {
    setSelectedSongIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const handleSelectVisibleSongs = (checked: boolean) => {
    setSelectedSongIds((current) => {
      const next = new Set(current);
      for (const song of visibleImportSongs) {
        if (song.alreadyExists || song.slideCount === 0) continue;
        if (checked) {
          next.add(song.sourceId);
        } else {
          next.delete(song.sourceId);
        }
      }
      return next;
    });
  };

  const handleDeleteEasyWorshipImports = async () => {
    if (!confirm(t('settings.deleteImportConfirm'))) return;

    setIsImportingSongs(true);
    setImportError(null);
    setImportResult(null);
    setDbSuccessMessage(null);

    try {
      const result = await ipcSongService.deleteEasyWorshipImports();
      setDbSuccessMessage(t('settings.deleteImportSummary', { count: result.deleted }));
      onLibraryChanged?.();
      if (scanResult) {
        setScanResult({
          ...scanResult,
          songs: scanResult.songs.map((song) => ({ ...song, alreadyExists: false })),
        });
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('settings.deleteImportFailed'));
    } finally {
      setIsImportingSongs(false);
    }
  };

  const handleExportBackup = async () => {
    setImportError(null);
    setDbSuccessMessage(null);
    try {
      const songs = await ipcSongService.getAll();
      const backupData = songs.map(song => ({
        title: song.title,
        author: song.author,
        rawLyrics: song.rawLyrics,
        tags: song.tags,
        copyright: song.copyright,
        ccliNumber: song.ccliNumber
      }));
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ramedia-songs-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDbSuccessMessage(t('settings.exportSuccess'));
      onLibraryChanged?.();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Export failed');
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingSongs(true);
    setImportError(null);
    setDbSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('Failed to read backup file');
        const backupSongs = JSON.parse(text);
        if (!Array.isArray(backupSongs)) throw new Error('Invalid backup file format');

        let imported = 0;
        const existingSongs = await ipcSongService.getAll();
        const existingKeys = new Set(existingSongs.map(s => `${s.title || ''}::${s.author || ''}`.trim().toLowerCase()));

        for (const song of backupSongs) {
          const key = `${song.title || ''}::${song.author || ''}`.trim().toLowerCase();
          if (existingKeys.has(key)) continue;

          const songId = await ipcSongService.createFromLyrics(song.title || 'Untitled', song.rawLyrics || '', song.author || undefined);
          await ipcSongService.update(songId, {
            tags: song.tags || JSON.stringify([]),
            copyright: song.copyright || null,
            ccliNumber: song.ccliNumber || null
          });
          imported++;
        }

        setDbSuccessMessage(t('settings.importSuccess', { count: imported }));
        onLibraryChanged?.();
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'Import failed');
      } finally {
        setIsImportingSongs(false);
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleImportTxtFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsImportingSongs(true);
    setImportError(null);
    setDbSuccessMessage(null);

    let imported = 0;
    try {
      const existingSongs = await ipcSongService.getAll();
      const existingKeys = new Set(existingSongs.map(s => `${s.title || ''}`.trim().toLowerCase()));

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const title = file.name.replace(/\.(txt|chordpro)$/i, '').trim();
        const key = title.toLowerCase();
        
        if (existingKeys.has(key)) continue;

        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string || '');
          reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
          reader.readAsText(file);
        });

        if (!text.trim()) continue;

        await ipcSongService.createFromLyrics(title, text, undefined);
        imported++;
      }

      setDbSuccessMessage(t('settings.txtImportSuccess', { count: imported }));
      onLibraryChanged?.();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'TXT import failed');
    } finally {
      setIsImportingSongs(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleWipeDatabase = async () => {
    if (!confirm(t('settings.wipeConfirm'))) return;

    setIsImportingSongs(true);
    setImportError(null);
    setDbSuccessMessage(null);

    try {
      const songs = await ipcSongService.getAll();
      for (const song of songs) {
        await ipcSongService.delete(song.id);
      }
      setDbSuccessMessage(t('settings.wipeSuccess'));
      onLibraryChanged?.();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Wipe database failed');
    } finally {
      setIsImportingSongs(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm(t('settings.resetConfirm'))) return;

    setIsImportingSongs(true);
    setImportError(null);
    setDbSuccessMessage(null);

    try {
      const songs = await ipcSongService.getAll();
      for (const song of songs) {
        await ipcSongService.delete(song.id);
      }

      const seedSongs = [
        {
          title: "Bapa Sentuh Hatiku",
          author: "Jason",
          tags: '["Worship","Slow"]',
          rawLyrics: "Betapa kumencintai\nSegala yang tlah terjadi\nTak pernah sendiri\nJalani hidup ini\nSelalu menyertai\n\nBetapa kumenyadari\nDi dalam hidupku ini\nKau slalu memberi\nRancangan terbaik\nOleh karena kasih\n\nBapa sentuh hatiku\nUbah hidupku\nMenjadi yang baru\nBagai emas yang murni\nKau membentuk bejana hatiku\n\nBapa ajarku mengerti\nSebuah kasih\nYang selalu memberi\nBagai air mengalir\nYang tiada pernah berhenti"
        },
        {
          title: "Satu-Satunya Harapan",
          author: "NDC Worship",
          tags: '["Praise","Medium"]',
          rawLyrics: "Engkaulah satusatunya\nPenolongku yang sungguh\nTiada yang sepertiMu\nEngkaulah harapanku\n\nReff:\nTuhan Yesus setia\nDia sahabat kita\nDalam sgala susah\nDia tak pernah tinggalkan"
        },
        {
          title: "Hidup Ini Adalah Kesempatan",
          author: "Pdt. Wilhelmus Latumahina",
          tags: '["Classic","Hymn"]',
          rawLyrics: "Hidup ini adalah kesempatan\nHidup ini untuk melayani Tuhan\nJangan siasiakan waktu yang Tuhan beri\nHidup ini hanya sementara\n\nOh Tuhan pakailah hidupku\nSelagi aku masih kuat\nBila saatnya nanti\nKu tak berdaya lagi\nHidup ini sudah jadi berkat"
        },
        {
          title: "Seperti Rusa Rindu SungaiMu",
          author: "Asaph",
          tags: '["Worship","Classic"]',
          rawLyrics: "Seperti rusa rindu sungaiMu\nJiwaku rindu Engkau\nKaulah Tuhan hasrat hatiku\nKurindu menyembahMu\n\nEngkau kekuatan dan perisaiku\nKepadaMu rohku berserah\nKaulah Tuhan hasrat hatiku\nKurindu menyembahMu"
        },
        {
          title: "Kecaplah dan Lihatlah",
          author: "Franky Sihombing",
          tags: '["Praise","Fast"]',
          rawLyrics: "Kecaplah dan lihatlah\nBetapa baiknya Tuhan itu\nRasakan dan nikmati\nKasih setia Tuhan\n\nSyukur bagiMu Tuhan\nSgala hormat bagiMu Tuhan\nAllah yang mengasihiku\nAllah yang memeliharaku\nSelamanya"
        }
      ];

      for (const song of seedSongs) {
        const songId = await ipcSongService.createFromLyrics(song.title, song.rawLyrics, song.author);
        await ipcSongService.update(songId, { tags: song.tags });
      }

      setDbSuccessMessage(t('settings.resetSuccess'));
      onLibraryChanged?.();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Reset database failed');
    } finally {
      setIsImportingSongs(false);
    }
  };

  const MENU_ITEMS = [
    { id: 'general', label: t('settings.general'), icon: Settings },
    { id: 'output', label: t('settings.output'), icon: Tv },
    { id: 'remote-control', label: t('settings.remoteControl'), icon: BroadcastIcon },
    { id: 'ai-assistant', label: t('settings.aiAssistant'), icon: Sparkles },
    { id: 'appearance', label: t('settings.appearance'), icon: Palette },
    { id: 'import', label: t('settings.databaseAndAssets'), icon: Database },
    { id: 'hotkeys', label: t('settings.hotkeys'), icon: Keyboard },
    { id: 'slide-labels', label: t('settings.slideLabels'), icon: Tags },
    { id: 'about', label: t('settings.about'), icon: Info },
  ];

  return (
    <div className={`fixed inset-0 z-[200] bg-[#09090b]/92 ${standalone ? 'p-0' : 'p-3 backdrop-blur-sm'}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`flex h-full w-full overflow-hidden border bg-surface ${standalone ? 'rounded-none border-0 shadow-none' : 'rounded-[24px] border-white/10 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.65)]'}`}
      >
        {!isSidebarHidden && <div className="w-64 shrink-0 border-r border-text/5 bg-background/95 flex flex-col">
          <div className="flex items-start gap-3 px-5 py-4 border-b border-text/5 bg-white/[0.02]">
            {!standalone && <button
              onClick={requestClose}
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-text/10 bg-text/[0.03] text-text/55 transition-colors hover:bg-text/10 hover:text-text"
              aria-label="Close settings"
              title="Close settings"
            >
              <X size={16} />
            </button>}
            <div className="min-w-0">
              <span className="font-bold text-[11px] uppercase text-text/45 tracking-[0.18em]">{t('settings.workspaceSettings')}</span>
              <div className="mt-1 text-sm font-semibold text-text/85">{t('settings.systemSetup')}</div>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarHidden(true)}
              className="ml-auto mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text/45 transition-colors hover:bg-text/8 hover:text-text active:scale-[0.98]"
              aria-label="Hide settings menu"
              title="Hide settings menu"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-primary/12 text-text shadow-[inset_0_0_0_1px_rgba(245,158,11,0.18)]'
                    : 'text-text/50 hover:bg-text/5 hover:text-text'
                }`}
              >
                <item.icon size={16} className={activeTab === item.id ? 'text-primary' : 'text-text/45'} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="border-t border-text/5 px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/35">{t('settings.session')}</div>
            <div className="mt-2 text-xs leading-5 text-text/50">
              {t('settings.sessionDescription')}
            </div>
          </div>
        </div>}

        <div className="flex-1 flex flex-col min-w-0 bg-surface">
          <div className="h-14 flex items-center gap-3 px-4 border-b border-text/5 bg-white/[0.02]">
            {isSidebarHidden && (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsSidebarHidden(false)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-text/10 bg-text/[0.03] text-text/55 transition-colors hover:bg-text/10 hover:text-text active:scale-[0.98]"
                  aria-label="Show settings menu"
                  title="Show settings menu"
                >
                  <PanelLeftOpen size={17} />
                </button>
                {!standalone && <button
                  type="button"
                  onClick={requestClose}
                  className="grid h-9 w-9 place-items-center rounded-lg text-text/45 transition-colors hover:bg-text/8 hover:text-text active:scale-[0.98]"
                  aria-label="Close settings"
                  title="Close settings"
                >
                  <X size={16} />
                </button>}
              </div>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <h2 className="flex shrink-0 items-center gap-2 font-bold text-text">
                <Monitor size={18} className="text-primary" />
                {MENU_ITEMS.find((item) => item.id === activeTab)?.label}
              </h2>
              {activeTab === 'output' && (
                <div className="flex items-center gap-1 border-l border-text/8 pl-3">
                  <button type="button" onClick={() => setOutputSection('channels')} className={`inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold transition active:scale-[0.98] ${outputSection === 'channels' ? 'bg-primary/15 text-primary' : 'text-text/45 hover:bg-text/5 hover:text-text'}`}><Tv size={14} className="mr-1.5" />{t('settings.outputChannels')}</button>
                  <button type="button" onClick={() => setOutputSection('logo')} className={`inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold transition active:scale-[0.98] ${outputSection === 'logo' ? 'bg-primary/15 text-primary' : 'text-text/45 hover:bg-text/5 hover:text-text'}`}><ImageIcon size={14} className="mr-1.5" />{t('settings.logoOutput')}</button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0 scrollbar-thin">
            {activeTab === 'general' ? (
              <div className="mx-auto max-w-4xl space-y-5 p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <section className="rounded-2xl border border-text/8 bg-black/10 p-5">
                  <div className="flex items-center gap-2"><Settings size={16} className="text-primary" /><h3 className="text-sm font-semibold text-text">{t('settings.application')}</h3></div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold text-text/65">{t('language.label')}</span>
                      <select
                        value={selectedLocale}
                        onChange={(event) => {
                          const nextLocale = event.target.value as LocaleCode;
                          setSelectedLocale(nextLocale);
                          setSettings({ locale: nextLocale });
                        }}
                        className="h-11 w-full rounded-xl border border-text/10 bg-background px-3 text-sm text-text outline-none focus:border-primary/55"
                      >
                        <option value="id">{t('language.indonesian')}</option>
                        <option value="en">{t('language.english')}</option>
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold text-text/65">{t('settings.defaultControllerPage')}</span>
                      <select value={generalSettings.defaultControllerView} onChange={(event) => setGeneralSettings((current) => ({ ...current, defaultControllerView: event.target.value as GeneralSettings['defaultControllerView'] }))} className="h-11 w-full rounded-xl border border-text/10 bg-background px-3 text-sm text-text outline-none focus:border-primary/55">
                        <option value="songs">{t('sidebar.songs')}</option><option value="bible">{t('sidebar.bible')}</option><option value="audio">{t('sidebar.audio')}</option><option value="prd">{t('sidebar.prd')}</option><option value="capture">{t('sidebar.capture')}</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-text/8 bg-black/10 p-5">
                  <div className="flex items-center gap-2"><Monitor size={16} className="text-primary" /><h3 className="text-sm font-semibold text-text">{t('settings.startupAndWorkspace')}</h3></div>
                  <div className="mt-4 divide-y divide-text/7">
                    {([
                      ['rememberLastControllerView', t('settings.rememberLastControllerView'), t('settings.rememberLastControllerViewDesc')],
                      ['restoreLastRundown', t('settings.restoreLastRundown'), t('settings.restoreLastRundownDesc')],
                    ] as const).map(([key, title, description]) => (
                      <label key={key} className="flex cursor-pointer items-center justify-between gap-5 py-4 first:pt-1 last:pb-1">
                        <span><span className="block text-sm font-semibold text-text">{title}</span><span className="mt-1 block text-xs leading-5 text-text/45">{description}</span></span>
                        <input type="checkbox" checked={generalSettings[key]} onChange={(event) => setGeneralSettings((current) => ({ ...current, [key]: event.target.checked }))} className="h-5 w-5 shrink-0 accent-primary" />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-text/8 bg-black/10 p-5">
                  <div className="flex items-center gap-2"><Keyboard size={16} className="text-primary" /><h3 className="text-sm font-semibold text-text">{t('settings.controllerBehavior')}</h3></div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2"><span className="text-xs font-semibold text-text/65">{t('settings.initialKeyboardFocus')}</span><select value={generalSettings.defaultKeyboardFocus} onChange={(event) => setGeneralSettings((current) => ({ ...current, defaultKeyboardFocus: event.target.value as GeneralSettings['defaultKeyboardFocus'] }))} className="h-11 w-full rounded-xl border border-text/10 bg-background px-3 text-sm text-text outline-none focus:border-primary/55"><option value="preview">Preview</option><option value="live">Live</option></select></label>
                    <label className="space-y-2"><span className="text-xs font-semibold text-text/65">{t('settings.defaultSlideLayout')}</span><select value={generalSettings.defaultSlideViewMode} onChange={(event) => setGeneralSettings((current) => ({ ...current, defaultSlideViewMode: event.target.value as GeneralSettings['defaultSlideViewMode'] }))} className="h-11 w-full rounded-xl border border-text/10 bg-background px-3 text-sm text-text outline-none focus:border-primary/55"><option value="text">{t('settings.textList')}</option><option value="grid">{t('settings.thumbnailGrid')}</option></select></label>
                  </div>
                </section>
              </div>
            ) : activeTab === 'output' ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto">
                {outputSection === 'channels' ? <OutputSettingsWorkspace
                outputChannels={outputChannels}
                selectedOutputId={selectedOutputId}
                browserTargets={browserTargets}
                songPresets={songPresets}
                screenLayouts={outputPresetItems}
                setScreenLayouts={setOutputPresetItems}
                displays={displays}
                browserRuntime={browserRuntime}
                ndiRuntime={ndiRuntime}
                outputState={outputState}
                width={width}
                height={height}
                isSafeAreaEnabled={isSafeAreaEnabled}
                safeArea={safeArea}
                setSelectedOutputId={setSelectedOutputId}
                addOutput={addOutput}
                updateOutput={updateOutput}
                removeOutput={removeOutput}
                setPrimaryOutput={setPrimaryOutput}
                addBrowserTarget={addBrowserTarget}
                updateBrowserTarget={updateBrowserTarget}
                removeBrowserTarget={removeBrowserTarget}
                refreshOutputState={refreshOutputState}
                applyPreset={applyPreset}
                setWidth={setWidth}
                setHeight={setHeight}
                setIsSafeAreaEnabled={setIsSafeAreaEnabled}
                setSafeArea={setSafeArea}
                /> : <LogoOutputSettingsWorkspace value={logoOutputSettings} onChange={setLogoOutputSettings} />}
                </div>
              </div>
            ) : activeTab === 'remote-control' ? (
              <RemoteControlSettingsWorkspace runtime={remoteRuntime} onRuntimeChange={setRemoteRuntime} />
            ) : activeTab === 'ai-assistant' ? (
              <div className="p-6">
                <AiSettingsWorkspace />
              </div>
            ) : activeTab === 'appearance' ? (
              <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase text-text/50 tracking-wider">{t('settings.interfaceTheme')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`px-4 py-3 rounded border flex items-center gap-3 transition-all ${
                        theme === 'dark'
                          ? 'bg-primary/20 border-primary text-white'
                          : 'bg-text/5 border-text/5 text-text/50 hover:bg-text/10'
                      }`}
                    >
                      <Moon size={18} className={theme === 'dark' ? 'text-white' : 'text-text'} />
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-text'}`}>{t('settings.darkMode')}</span>
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`px-4 py-3 rounded border flex items-center gap-3 transition-all ${
                        theme === 'light'
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-text/5 border-text/5 text-text/50 hover:bg-text/10'
                      }`}
                    >
                      <Sun size={18} className={theme === 'light' ? 'text-primary' : 'text-text'} />
                      <span className={`text-sm font-medium ${theme === 'light' ? 'text-primary' : 'text-text'}`}>{t('settings.lightMode')}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase text-text/50 tracking-wider">{t('settings.accentColor')}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {COLORS.map((entry) => (
                      <button
                        key={entry.value}
                        onClick={() => setColor(entry.value)}
                        className={`px-3 py-2 rounded border text-xs font-medium transition-all flex items-center gap-2 ${
                          color === entry.value
                            ? 'bg-text/10 border-text text-text'
                            : 'bg-text/5 border-text/5 text-text/70 hover:bg-text/10'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full" style={{ background: entry.value }} />
                        {entry.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : activeTab === 'import' ? (
              <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-5xl">
                {/* Global Status Message */}
                {dbSuccessMessage && (
                  <div className="border border-emerald-500/20 bg-emerald-950/20 px-4 py-2.5 text-xs text-emerald-400 flex items-center justify-between shadow-sm rounded-sm">
                    <span>{dbSuccessMessage}</span>
                    <button onClick={() => setDbSuccessMessage(null)} className="text-emerald-400/60 hover:text-emerald-400 font-bold ml-2">×</button>
                  </div>
                )}
                {importError && (
                  <div className="border border-red-500/20 bg-red-950/20 px-4 py-2.5 text-xs text-red-400 flex items-center justify-between shadow-sm rounded-sm">
                    <span>{importError}</span>
                    <button onClick={() => setImportError(null)} className="text-red-400/60 hover:text-red-400 font-bold ml-2">×</button>
                  </div>
                )}

                {/* Sub Tab Navigation */}
                <div className="flex border-b border-text/10 pb-2 gap-4">
                  <button
                    onClick={() => setActiveDbSubTab('backup')}
                    className={`pb-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                      activeDbSubTab === 'backup' ? 'border-b-2 border-primary text-text' : 'text-text/50 hover:text-text'
                    }`}
                  >
                    {t('settings.subTabBackup')}
                  </button>
                  <button
                    onClick={() => setActiveDbSubTab('cache')}
                    className={`pb-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                      activeDbSubTab === 'cache' ? 'border-b-2 border-primary text-text' : 'text-text/50 hover:text-text'
                    }`}
                  >
                    {t('settings.subTabCache')}
                  </button>
                  <button
                    onClick={() => setActiveDbSubTab('songs')}
                    className={`pb-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                      activeDbSubTab === 'songs' ? 'border-b-2 border-primary text-text' : 'text-text/50 hover:text-text'
                    }`}
                  >
                    {t('settings.subTabSongs')}
                  </button>
                </div>

                {/* HIDDEN FILE INPUTS */}
                <input
                  type="file"
                  ref={txtInputRef}
                  onChange={handleImportTxtFiles}
                  multiple
                  accept=".txt,.chordpro"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={backupInputRef}
                  onChange={handleImportBackup}
                  accept=".json"
                  className="hidden"
                />

                {activeDbSubTab === 'backup' && (
                  <div className="space-y-6">
                    {/* SECTION 1: EASYWORSHIP SONGS */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-primary pb-2 border-b border-text/10 mb-4">
                        {t('settings.easyWorshipSongs')}
                      </h3>
                      
                      <div className="space-y-4 text-xs">
                        <div className="flex flex-col gap-2">
                          <p className="text-text/60 leading-relaxed max-w-3xl">
                            {t('settings.easyWorshipDescription')}
                          </p>
                          <div className="pt-2">
                            <button
                              onClick={handleEasyWorshipScan}
                              disabled={isScanningSongs || isImportingSongs || !window.api}
                              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 disabled:opacity-50 text-white px-3 py-1.5 rounded-sm font-medium transition-colors"
                            >
                              <UploadCloud size={14} />
                              {isScanningSongs ? t('settings.scanning') : t('settings.selectFolder')}
                            </button>
                          </div>
                        </div>

                        {!window.api ? (
                          <div className="border border-amber-500/20 bg-amber-950/10 px-4 py-2.5 text-amber-200/90 rounded-sm">
                            {t('settings.desktopOnly')}
                          </div>
                        ) : scanResult ? (
                          <div className="space-y-4 pt-2 border-t border-text/5">
                            {importResult && (
                              <div className="border border-emerald-500/20 bg-emerald-950/10 px-4 py-2.5 text-emerald-400 rounded-sm">
                                {t('settings.importSummary', { imported: importResult.imported, skipped: importResult.skipped, failed: importResult.failed })}
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-text/[0.02] border border-text/5 p-3 rounded-sm">
                              <div className="min-w-0">
                                <div className="font-semibold text-text">{t('settings.chooseSongs')}</div>
                                <div className="mt-1 break-all font-mono text-[10px] text-text/40">{scanResult.folderPath}</div>
                              </div>
                              <button
                                onClick={handleEasyWorshipImport}
                                disabled={isImportingSongs || selectedImportableCount === 0}
                                className="bg-primary hover:bg-primary/95 text-white px-4 py-1.5 rounded-sm font-medium disabled:opacity-50 transition-colors self-start sm:self-center"
                              >
                                {isImportingSongs ? t('settings.importing') : t('settings.importSongs', { count: selectedImportableCount })}
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { label: t('settings.found'), value: scanResult.total },
                                { label: t('settings.existing'), value: scanResult.songs.filter((song) => song.alreadyExists).length },
                                { label: t('settings.importable'), value: scanResult.songs.filter((song) => !song.alreadyExists && song.slideCount > 0).length },
                                { label: t('settings.selected'), value: selectedSongIds.size },
                              ].map((stat, idx) => (
                                <div key={idx} className="bg-text/[0.02] border border-text/5 p-2 rounded-sm text-center">
                                  <div className="text-[10px] text-text/40 font-bold uppercase tracking-wider">{stat.label}</div>
                                  <div className="text-sm font-bold text-text mt-0.5">{stat.value}</div>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center gap-4 py-1.5 border-b border-text/5 text-xs text-text/60">
                              <input
                                type="search"
                                placeholder={t('settings.searchSongs')}
                                value={importSearch}
                                onChange={(e) => setImportSearch(e.target.value)}
                                className="bg-text/[0.02] border border-text/10 rounded-sm px-2.5 py-1 text-xs text-text placeholder:text-text/30 outline-none focus:border-primary/50 transition-colors w-[220px]"
                              />
                              <div className="flex items-center gap-1.5 ml-auto">
                                <button
                                  onClick={() => handleSelectVisibleSongs(true)}
                                  className="text-[10px] font-bold text-primary hover:underline"
                                >
                                  {t('settings.selectAll')}
                                </button>
                                <span className="text-text/20">|</span>
                                <button
                                  onClick={() => handleSelectVisibleSongs(false)}
                                  className="text-[10px] font-bold text-primary hover:underline"
                                >
                                  {t('settings.selectNone')}
                                </button>
                              </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto divide-y divide-text/5 border border-text/5 rounded-sm bg-text/[0.01]">
                              {visibleImportSongs.map((song) => {
                                const disabled = song.alreadyExists || song.slideCount === 0;
                                return (
                                  <label
                                    key={song.sourceId}
                                    className={`flex items-start gap-2.5 p-2 transition-colors text-xs ${
                                      disabled ? 'opacity-50 cursor-not-allowed bg-text/[0.01]' : 'hover:bg-text/[0.02] cursor-pointer'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={disabled}
                                      checked={selectedSongIds.has(song.sourceId)}
                                      onChange={() => handleToggleImportSong(song.sourceId)}
                                      className="mt-0.5 rounded border-text/20 text-primary focus:ring-primary/20"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-semibold text-text truncate">{song.title}</div>
                                      <div className="text-[10px] text-text/45 mt-0.5 truncate flex items-center gap-1.5">
                                        {song.author && <span>{song.author}</span>}
                                        {song.author && <span className="text-text/20">•</span>}
                                        <span>{song.slideCount} slides</span>
                                      </div>
                                    </div>
                                    {song.alreadyExists && (
                                      <span className="text-[9px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm shrink-0">
                                        {t('settings.exists')}
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* SECTION 2: IMPORT TEXT & LYRICS */}
                    <div className="pt-6 border-t border-text/5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-primary pb-2 border-b border-text/10 mb-4">
                        {t('settings.textLyricsImport')}
                      </h3>
                      <div className="text-xs flex flex-col gap-2">
                        <p className="text-text/60 leading-relaxed max-w-3xl">
                          {t('settings.textLyricsDescription')}
                        </p>
                        <div className="pt-2">
                          <button
                            onClick={() => txtInputRef.current?.click()}
                            disabled={isImportingSongs}
                            className="inline-flex items-center gap-1.5 border border-text/20 hover:bg-text/5 text-text px-3 py-1.5 rounded-sm font-medium transition-colors disabled:opacity-50"
                          >
                            <UploadCloud size={14} />
                            {t('settings.selectFiles')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: DATABASE MAINTENANCE & TOOLS */}
                    <div className="pt-6 border-t border-text/5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-primary pb-2 border-b border-text/10 mb-4">
                        {t('settings.databaseMaintenance')}
                      </h3>

                      <div className="divide-y divide-text/10 text-xs">
                        {/* Export JSON */}
                        <div className="flex items-center justify-between py-3">
                          <div className="max-w-xl">
                            <h4 className="font-semibold text-text">{t('settings.exportDatabase')}</h4>
                            <p className="mt-1 text-text/40">{t('settings.exportDatabaseDescription')}</p>
                          </div>
                          <button
                            onClick={handleExportBackup}
                            className="border border-text/20 hover:bg-text/5 text-text px-3 py-1 rounded-sm font-medium transition-colors"
                          >
                            {t('settings.exportButton')}
                          </button>
                        </div>

                        {/* Import JSON */}
                        <div className="flex items-center justify-between py-3">
                          <div className="max-w-xl">
                            <h4 className="font-semibold text-text">{t('settings.importDatabase')}</h4>
                            <p className="mt-1 text-text/40">{t('settings.importDatabaseDescription')}</p>
                          </div>
                          <button
                            onClick={() => backupInputRef.current?.click()}
                            className="border border-text/20 hover:bg-text/5 text-text px-3 py-1 rounded-sm font-medium transition-colors"
                          >
                            {t('settings.importButton')}
                          </button>
                        </div>

                        {/* Backup ZIP */}
                        <div className="flex items-center justify-between py-3">
                          <div className="max-w-xl">
                            <h4 className="font-semibold text-text">{t('settings.exportZip')}</h4>
                            <p className="mt-1 text-text/40">{t('settings.exportZipDesc')}</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (!window.api?.dbManager) return;
                              setImportError(null);
                              setDbSuccessMessage(null);
                              const res = await window.api.dbManager.backup();
                              if (res.success) {
                                setDbSuccessMessage(`Backup successfully exported to: ${res.filePath}`);
                              } else if (res.error !== 'Backup cancelled') {
                                setImportError(res.error || 'Export failed');
                              }
                            }}
                            className="border border-text/20 hover:bg-text/5 text-text px-3 py-1 rounded-sm font-medium transition-colors"
                          >
                            {t('settings.exportZipButton')}
                          </button>
                        </div>

                        {/* Restore ZIP */}
                        <div className="flex items-center justify-between py-3">
                          <div className="max-w-xl">
                            <h4 className="font-semibold text-text text-amber-500">{t('settings.restoreZip')}</h4>
                            <p className="mt-1 text-text/40">{t('settings.restoreZipDesc')}</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (!window.api?.dbManager) return;
                              if (!confirm(t('settings.restoreZipConfirm'))) return;
                              setImportError(null);
                              setDbSuccessMessage(null);
                              const res = await window.api.dbManager.restore();
                              if (res.success) {
                                setDbSuccessMessage('Database restored successfully! Application is restarting...');
                              } else if (res.error !== 'Restore cancelled') {
                                setImportError(res.error || 'Restore failed');
                              }
                            }}
                            className="border border-amber-500/30 hover:bg-amber-500/10 text-amber-500 px-3 py-1 rounded-sm font-medium transition-colors"
                          >
                            {t('settings.restoreZipButton')}
                          </button>
                        </div>

                        {/* Delete EW Imports */}
                        {window.api && (
                          <div className="flex items-center justify-between py-3">
                            <div className="max-w-xl">
                              <h4 className="font-semibold text-text">{t('settings.deleteEasyWorshipImport')}</h4>
                              <p className="mt-1 text-text/40">{t('settings.deleteImportConfirm')}</p>
                            </div>
                            <button
                              onClick={handleDeleteEasyWorshipImports}
                              disabled={isImportingSongs}
                              className="border border-red-500/35 hover:bg-red-500/5 text-red-400 px-3 py-1 rounded-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {t('settings.deleteImportButton')}
                            </button>
                          </div>
                        )}

                        {/* Reset to Default Seed */}
                        <div className="flex items-center justify-between py-3">
                          <div className="max-w-xl">
                            <h4 className="font-semibold text-text">{t('settings.resetDefaultSeed')}</h4>
                            <p className="mt-1 text-text/40">{t('settings.resetDefaultSeedDescription')}</p>
                          </div>
                          <button
                            onClick={handleResetDatabase}
                            disabled={isImportingSongs}
                            className="border border-amber-500/35 hover:bg-amber-500/5 text-amber-500 px-3 py-1 rounded-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {t('settings.resetButton')}
                          </button>
                        </div>

                        {/* Wipe Database */}
                        <div className="flex items-center justify-between py-3">
                          <div className="max-w-xl">
                            <h4 className="font-semibold text-text">{t('settings.wipeDatabase')}</h4>
                            <p className="mt-1 text-text/40">{t('settings.wipeDatabaseDescription')}</p>
                          </div>
                          <button
                            onClick={handleWipeDatabase}
                            disabled={isImportingSongs}
                            className="border border-red-500/35 hover:bg-red-500/5 text-red-400 px-3 py-1 rounded-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {t('settings.wipeButton')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeDbSubTab === 'cache' && (
                  <div className="space-y-6">
                    {/* Cache Summary Cards */}
                    {cacheStats && (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-text/[0.02] border border-text/5 p-4 rounded-xl">
                          <div className="text-[10px] uppercase font-bold text-text/40 tracking-wider">{t('settings.totalCacheSize')}</div>
                          <div className="text-xl font-bold text-text mt-1">{(cacheStats.totalBytes / (1024 * 1024)).toFixed(1)} MB</div>
                        </div>
                        <div className="bg-text/[0.02] border border-text/5 p-4 rounded-xl">
                          <div className="text-[10px] uppercase font-bold text-text/40 tracking-wider">{t('settings.cachedFiles')}</div>
                          <div className="text-xl font-bold text-text mt-1">{cacheAssets.length} assets</div>
                        </div>
                        <div className="bg-text/[0.02] border border-text/5 p-4 rounded-xl flex items-center justify-between">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-text/40 tracking-wider">{t('settings.unusedCache')}</div>
                            <div className="text-xl font-bold text-text mt-1">{cacheAssets.filter(a => !a.inUse).length} assets</div>
                          </div>
                          <button
                            disabled={isCleaningCache || cacheAssets.filter(a => !a.inUse).length === 0}
                            onClick={async () => {
                              if (!window.api?.dbManager) return;
                              if (!confirm(t('settings.cleanUnusedConfirm'))) return;
                              setIsCleaningCache(true);
                              try {
                                const res = await window.api.dbManager.clearUnusedCache();
                                setDbSuccessMessage(`Cleaned ${res.deletedCount} unused cache files, saving ${(res.savedBytes / (1024 * 1024)).toFixed(1)} MB.`);
                                await loadCacheData();
                              } catch (e) {
                                setImportError('Failed to clear unused cache.');
                              } finally {
                                setIsCleaningCache(false);
                              }
                            }}
                            className="text-xs bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black px-2.5 py-1.5 rounded-lg font-bold transition-colors"
                          >
                            {t('settings.cleanUnused')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Cached Asset Gallery/List */}
                    <div className="border border-text/5 rounded-xl overflow-hidden bg-text/[0.01]">
                      <div className="p-3 border-b border-text/5 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text/60">{t('settings.assetList')}</span>
                        <button onClick={loadCacheData} className="text-[10px] font-bold text-primary hover:underline">{t('common.refresh')}</button>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto divide-y divide-text/5">
                        {cacheAssets.length === 0 ? (
                          <div className="p-6 text-center text-text/30 text-xs">{t('settings.noMediaCache')}</div>
                        ) : (
                          cacheAssets.map(asset => (
                            <div key={asset.id} className="p-3 flex items-center justify-between text-xs hover:bg-text/[0.02]">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded overflow-hidden bg-black flex items-center justify-center shrink-0">
                                  {asset.thumbnail ? (
                                    <img src={asset.thumbnail} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[9px] uppercase font-bold text-text/40">{asset.mediaType}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-text truncate">{asset.filename}</div>
                                  <div className="text-[10px] text-text/40 mt-0.5">{(asset.fileSize / (1024 * 1024)).toFixed(2)} MB</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0">
                                {asset.inUse ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[9px] uppercase tracking-wider">{t('settings.inUse')}</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold text-[9px] uppercase tracking-wider">{t('settings.unused')}</span>
                                )}
                                <button
                                  onClick={async () => {
                                    if (!window.api?.dbManager) return;
                                    if (asset.inUse) {
                                      if (!confirm(`Warning: "${asset.filename}" is currently in use. Deleting it will leave broken references in slides/schedule. Continue?`)) return;
                                    } else {
                                      if (!confirm(`Delete "${asset.filename}" cache?`)) return;
                                    }
                                    const success = await window.api.dbManager.deleteCacheAsset(asset.id);
                                    if (success) {
                                      await loadCacheData();
                                      onLibraryChanged?.();
                                    } else {
                                      alert('Failed to delete asset');
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-500 p-1 hover:bg-red-500/10 rounded transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeDbSubTab === 'songs' && (
                  <div className="space-y-4">
                    {/* Search & Batch Delete header */}
                    <div className="flex items-center justify-between gap-4">
                      <input
                        type="search"
                        placeholder={t('settings.searchSongsPlaceholder')}
                        value={dbSongsQuery}
                        onChange={e => setDbSongsQuery(e.target.value)}
                        className="bg-text/[0.02] border border-text/10 rounded-lg px-3 py-1.5 text-xs text-text placeholder:text-text/30 outline-none focus:border-primary/50 transition-colors w-[260px]"
                      />
                      <div className="flex items-center gap-3">
                        {selectedDbSongIds.size > 0 && (
                          <button
                            onClick={async () => {
                              if (!window.api?.dbManager) return;
                              if (!confirm(t('settings.deleteSelectedSongsConfirm', { count: selectedDbSongIds.size }))) return;
                              const ids = Array.from(selectedDbSongIds);
                              await window.api.dbManager.deleteSongsBatch(ids);
                              setSelectedDbSongIds(new Set());
                              await loadDbSongs();
                              onLibraryChanged?.();
                            }}
                            className="bg-red-500 hover:bg-red-600 text-black font-bold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <Trash2 size={13} />
                            <span>{t('settings.deleteSelectedSongs', { count: selectedDbSongIds.size })}</span>
                          </button>
                        )}
                        <button onClick={loadDbSongs} className="text-xs font-bold text-primary hover:underline">{t('common.refresh')}</button>
                      </div>
                    </div>

                    {/* Table List */}
                    <div className="border border-text/5 rounded-xl overflow-hidden bg-text/[0.01]">
                      <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-text/[0.03] border-b border-text/5 font-bold text-text/50 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="p-3 w-10">
                                <input
                                  type="checkbox"
                                  checked={dbSongs.length > 0 && dbSongs.every(s => selectedDbSongIds.has(s.id))}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setSelectedDbSongIds(new Set(dbSongs.map(s => s.id)));
                                    } else {
                                      setSelectedDbSongIds(new Set());
                                    }
                                  }}
                                  className="rounded border-text/20"
                                />
                              </th>
                              <th className="p-3">{t('settings.tableTitle')}</th>
                              <th className="p-3">{t('settings.author')}</th>
                              <th className="p-3">{t('settings.copyright')}</th>
                              <th className="p-3 text-right">{t('settings.action')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-text/5">
                            {dbSongs.filter(s =>
                              `${s.title || ''} ${s.author || ''}`.toLowerCase().includes(dbSongsQuery.toLowerCase())
                            ).length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-6 text-center text-text/30">{t('settings.noSongsFound')}</td>
                              </tr>
                            ) : (
                              dbSongs.filter(s =>
                                `${s.title || ''} ${s.author || ''}`.toLowerCase().includes(dbSongsQuery.toLowerCase())
                              ).map(song => (
                                <tr key={song.id} className="hover:bg-text/[0.02]">
                                  <td className="p-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedDbSongIds.has(song.id)}
                                      onChange={() => {
                                        setSelectedDbSongIds(current => {
                                          const next = new Set(current);
                                          if (next.has(song.id)) next.delete(song.id);
                                          else next.add(song.id);
                                          return next;
                                        });
                                      }}
                                      className="rounded border-text/20"
                                    />
                                  </td>
                                  <td className="p-3 font-semibold text-text">{song.title}</td>
                                  <td className="p-3 text-text/60">{song.author || '-'}</td>
                                  <td className="p-3 text-text/40">{song.copyright || '-'}</td>
                                  <td className="p-3 text-right">
                                    <button
                                      onClick={async () => {
                                        if (!window.api?.dbManager) return;
                                        if (!confirm(`Delete song "${song.title}"?`)) return;
                                        await window.api.dbManager.deleteSong(song.id);
                                        await loadDbSongs();
                                        onLibraryChanged?.();
                                      }}
                                      className="text-red-400 hover:text-red-500 p-1 hover:bg-red-500/10 rounded transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === 'slide-labels' ? (
              <SlideLabelSettingsWorkspace labels={slideLabels} onChange={setSlideLabels} />
            ) : activeTab === 'hotkeys' ? (
              <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-4xl flex flex-col h-full min-h-0">
                {/* Search Header */}
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    value={hotkeysSearch}
                    onChange={(e) => setHotkeysSearch(e.target.value)}
                    placeholder={t('settings.searchKeybindings')}
                    className="flex-1 border border-text/10 bg-background hover:border-text/20 focus:border-primary px-3 py-2 text-xs text-text placeholder:text-text/30 focus:outline-none rounded-sm"
                  />
                  <button
                    onClick={resetHotkeys}
                    className="border border-text/20 hover:bg-text/5 text-text px-3 py-2 text-xs rounded-sm font-medium transition-colors shrink-0"
                  >
                    {t('common.resetDefault')}
                  </button>
                </div>

                {/* Keybindings List / Table */}
                <div className="flex-1 min-h-0 border border-text/10 bg-black/10 rounded-sm overflow-hidden flex flex-col">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-text/[0.03] border-b border-text/10 font-bold text-text/45 text-[10px] uppercase tracking-wider select-none shrink-0">
                    <div className="col-span-5">{t('settings.command')}</div>
                    <div className="col-span-3">{t('settings.category')}</div>
                    <div className="col-span-2">{t('settings.keybinding')}</div>
                    <div className="col-span-2 text-right">{t('settings.source')}</div>
                  </div>

                  {/* Table Body */}
                  <div className="flex-1 overflow-y-auto divide-y divide-text/5 text-xs">
                    {hotkeyCommands
                      .filter((cmd) => {
                        const q = hotkeysSearch.trim().toLowerCase();
                        return !q || cmd.name.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q);
                      })
                      .map((cmd) => {
                        const isUser = cmd.keybinding !== cmd.defaultKeybinding;
                        return (
                          <div
                            key={cmd.id}
                            onDoubleClick={() => {
                              setRecordingCommandId(cmd.id);
                              setRecordingKeys(cmd.keybinding);
                            }}
                            title={t('settings.doubleClickToEdit')}
                            className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-text/[0.02] items-center cursor-pointer select-none group"
                          >
                            <div className="col-span-5 font-medium text-text">{cmd.name}</div>
                            <div className="col-span-3 text-text/50">{cmd.category}</div>
                            <div className="col-span-2">
                              {cmd.keybinding ? (
                                <kbd className="px-1.5 py-0.5 border border-text/20 bg-text/[0.05] rounded-sm font-mono text-[10px] text-text/90">
                                  {cmd.keybinding}
                                </kbd>
                              ) : (
                                <span className="text-text/30 italic">None</span>
                              )}
                            </div>
                            <div className="col-span-2 text-right text-text/50 flex items-center justify-end gap-2">
                              <span>{isUser ? t('settings.user') : t('settings.default')}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRecordingCommandId(cmd.id);
                                  setRecordingKeys(cmd.keybinding);
                                }}
                                className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity p-0.5"
                                title={t('settings.doubleClickToEdit')}
                              >
                                <Palette size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* RECORDING HOTKEY OVERLAY */}
                {recordingCommandId && (() => {
                  const cmd = hotkeyCommands.find((c) => c.id === recordingCommandId);
                  if (!cmd) return null;
                  
                  return (
                    <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm grid place-items-center p-4">
                      <div 
                        tabIndex={0}
                        autoFocus
                        onKeyDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          if (e.key === 'Escape') {
                            setRecordingCommandId(null);
                            return;
                          }
                          if (e.key === 'Enter') {
                            if (recordingKeys) {
                              updateKeybinding(recordingCommandId, recordingKeys);
                            }
                            setRecordingCommandId(null);
                            return;
                          }

                          const parts: string[] = [];
                          if (e.ctrlKey) parts.push('Ctrl');
                          if (e.shiftKey) parts.push('Shift');
                          if (e.altKey) parts.push('Alt');
                          if (e.metaKey) parts.push('Meta');

                          const key = e.key;
                          if (key !== 'Control' && key !== 'Shift' && key !== 'Alt' && key !== 'Meta') {
                            let keyName = key;
                            if (keyName === ' ') keyName = 'Space';
                            
                            if (keyName === 'ArrowRight') keyName = 'ArrowRight';
                            if (keyName === 'ArrowLeft') keyName = 'ArrowLeft';
                            if (keyName === 'ArrowUp') keyName = 'ArrowUp';
                            if (keyName === 'ArrowDown') keyName = 'ArrowDown';
                            
                            if (keyName.length === 1) keyName = keyName.toUpperCase();
                            parts.push(keyName);
                          }
                          
                          const keyCombination = parts.join('+');
                          if (keyCombination) {
                            setRecordingKeys(keyCombination);
                          }
                        }}
                        className="w-full max-w-md bg-surface border border-text/10 p-6 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.5)] focus:outline-none flex flex-col gap-4 text-center items-center"
                      >
                        <h4 className="text-sm font-semibold text-text">
                          {t('settings.pressKeys')}
                        </h4>
                        <p className="text-xs text-text/50 font-mono">
                          {cmd.name}
                        </p>

                        <div className="h-16 flex items-center justify-center border border-dashed border-text/15 w-full bg-black/20 text-xl font-bold tracking-wide text-primary">
                          {recordingKeys ? (
                            <kbd className="px-2 py-1 border border-text/20 bg-text/[0.05] rounded-sm font-mono text-lg">
                              {recordingKeys}
                            </kbd>
                          ) : (
                            <span className="text-text/30 animate-pulse">{t('settings.recording')}</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 text-[10px] text-text/40">
                          <div>{t('settings.cancelRecording')}</div>
                          <div>{t('settings.confirmSaveKey')}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : activeTab === 'about' ? (
              <div className="mx-auto max-w-3xl space-y-5 p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <section className="overflow-hidden rounded-2xl border border-text/8 bg-black/10">
                  <div className="border-b border-text/7 p-6">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-lg font-black text-primary">R</div>
                    <h3 className="mt-4 text-xl font-bold text-text">RAMEDIA</h3>
                    <p className="mt-1 text-sm text-text/45">{t('settings.appDescription')}</p>
                  </div>
                  <dl className="divide-y divide-text/7 px-6">
                    <div className="flex items-center justify-between gap-4 py-4"><dt className="text-xs text-text/45">{t('settings.version')}</dt><dd className="font-mono text-xs font-semibold text-text">{appVersion}</dd></div>
                    <div className="flex items-center justify-between gap-4 py-4"><dt className="text-xs text-text/45">{t('settings.runtime')}</dt><dd className="text-xs font-semibold text-text">{window.api ? `Electron Desktop${systemInfo?.platform ? ` · ${systemInfo.platform}` : ''}` : 'Web Browser'}</dd></div>
                    <div className="flex items-center justify-between gap-4 py-4"><dt className="text-xs text-text/45">{t('settings.database')}</dt><dd className="text-xs font-semibold text-text">SQLite · Local workspace</dd></div>
                  </dl>
                </section>
                {systemInfo && <section className="rounded-2xl border border-text/8 bg-black/10 p-5"><h4 className="text-sm font-semibold text-text">{t('settings.localFiles')}</h4><div className="mt-4 space-y-3">{([['database', t('settings.database'), systemInfo.databasePath], ['userData', t('settings.userData'), systemInfo.userDataPath], ['logs', t('settings.logs'), systemInfo.logsPath]] as const).map(([target, label, value]) => <div key={target} className="flex items-center gap-3 rounded-xl border border-text/8 bg-text/[0.025] p-3"><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-text">{label}</div><div className="mt-1 truncate font-mono text-[10px] text-text/35" title={value}>{value}</div></div><button type="button" onClick={() => void window.api.system.openPath(target)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-text/10 text-text/50 hover:border-primary/30 hover:text-primary" title={`Open ${label}`}><FolderOpen size={16} /></button></div>)}</div></section>}
                <section className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setActiveTab('import')} className="rounded-xl border border-text/10 bg-text/[0.025] p-4 text-left transition hover:border-primary/30 hover:bg-primary/[0.05]"><Database size={18} className="text-primary" /><span className="mt-3 block text-sm font-semibold text-text">{t('settings.databaseAndAssets')}</span><span className="mt-1 block text-xs leading-5 text-text/45">Backup, restore, cache, and library maintenance.</span></button>
                  <button type="button" onClick={() => { setActiveTab('output'); setOutputSection('channels'); }} className="rounded-xl border border-text/10 bg-text/[0.025] p-4 text-left transition hover:border-primary/30 hover:bg-primary/[0.05]"><Tv size={18} className="text-primary" /><span className="mt-3 block text-sm font-semibold text-text">{t('settings.outputDiagnostics')}</span><span className="mt-1 block text-xs leading-5 text-text/45">{t('settings.outputDiagnosticsDesc')}</span></button>
                </section>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text/30 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 p-6">
                <div className="p-4 rounded-full bg-text/5">
                  <Settings size={32} />
                </div>
                <p className="text-sm">{t('common.underDevelopment')}</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-text/5 bg-background flex justify-between items-center">
            {activeTab === 'general' ? (
              <button onClick={() => setGeneralSettings(DEFAULT_GENERAL_SETTINGS)} className="text-xs text-text/50 hover:text-text flex items-center gap-1.5 transition-colors"><RotateCcw size={14} /> {t('common.resetDefault')}</button>
            ) : activeTab === 'output' && outputSection === 'channels' ? (
              <button
                onClick={() => {
                  setWidth(1920);
                  setHeight(1080);
                  setIsSafeAreaEnabled(false);
                  setSafeArea(8);
                  const defaultOutput = createDefaultOutputChannel({ locale: selectedLocale });
                  setOutputChannels([defaultOutput]);
                  setBrowserTargets([]);
                  setSelectedOutputId(defaultOutput.id);
                }}
                className="text-xs text-text/50 hover:text-text flex items-center gap-1.5 transition-colors"
              >
              <RotateCcw size={14} /> {t('common.resetDefault')}
              </button>
            ) : activeTab === 'output' && outputSection === 'logo' ? (
              <button
                onClick={() => setLogoOutputSettings(DEFAULT_LOGO_OUTPUT_SETTINGS)}
                className="text-xs text-text/50 hover:text-text flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={14} /> {t('common.resetDefault')}
              </button>
            ) : activeTab === 'slide-labels' ? (
              <button
                onClick={() => setSlideLabels(DEFAULT_SLIDE_LABELS)}
                className="text-xs text-text/50 hover:text-text flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={14} /> {t('common.resetDefault')}
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-3 ml-auto">
              {!standalone && <button
                onClick={requestClose}
                className="px-4 py-2 rounded text-sm font-medium text-text/70 hover:text-text hover:bg-text/10 transition-colors"
              >
                {t('common.cancel')}
              </button>}
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="px-6 py-2 rounded bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                <Check size={16} /> {isApplying ? t('common.saving') : t('common.applyChanges')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
