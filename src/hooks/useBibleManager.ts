import { useState, useEffect, useCallback } from 'react';
import type { BibleVersion } from '../electron/database/schema';

interface DownloadProgress {
  code: string;
  loaded: number;
  total: number;
  percent: number;
}

interface StorageStats {
  rumediaPath: string;
  biblesPath: string;
  totalBiblesSize: number;
  biblesCount: number;
  totalSizeInMB: number;
}

export interface BibleBrainCountry {
  id: string;
  name: string;
  code: string | null;
  languagesCount: number | null;
  biblesCount: number | null;
}

export interface BibleBrainLanguage {
  id: string;
  iso: string;
  name: string;
  autonym: string | null;
  biblesCount: number | null;
  population: number | null;
}

export interface BibleBrainBible {
  id: string;
  abbr: string;
  name: string;
  vname: string | null;
  language: string;
  languageIso: string | null;
  autonym: string | null;
  date: string | null;
  filesetId: string;
  filesetType: string;
  size: string | null;
  copyright: string | null;
  publisher: string | null;
}

function getBibleApi() {
  if (!window.api?.bible) {
    throw new Error('Bible API is not available in this runtime.');
  }
  return window.api.bible;
}

function notifyBibleVersionChanged() {
  window.dispatchEvent(new Event('bible-version-changed'));
}

export function useBibleManager() {
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<BibleVersion | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [cloudBibles, setCloudBibles] = useState<BibleBrainBible[]>([]);
  const [countries, setCountries] = useState<BibleBrainCountry[]>([]);
  const [languages, setLanguages] = useState<BibleBrainLanguage[]>([]);
  const [bibles, setBibles] = useState<BibleBrainBible[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const bibleApi = getBibleApi();
      const [all, active, stats] = await Promise.all([
        bibleApi.getVersions(),
        bibleApi.getActiveVersion(),
        bibleApi.getStorageStats(),
      ]);

      setVersions(all);
      setActiveVersion(active);
      setStorageStats(stats);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Bible versions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const switchVersion = useCallback(async (id: string) => {
    setError(null);
    try {
      const bibleApi = getBibleApi();
      await bibleApi.setActiveVersion(id);
      const updated = await bibleApi.getActiveVersion();
      setActiveVersion(updated);
      notifyBibleVersionChanged();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to switch version';
      setError(errorMsg);
      throw err;
    }
  }, []);

  const deleteVersion = useCallback(async (id: string) => {
    setError(null);
    try {
      await getBibleApi().deleteVersion(id);
      await loadVersions();
      notifyBibleVersionChanged();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete version';
      setError(errorMsg);
      throw err;
    }
  }, [loadVersions]);

  const clearCache = useCallback(async () => {
    setError(null);
    try {
      await getBibleApi().clearCache();
      await loadVersions();
      notifyBibleVersionChanged();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to clear cache';
      setError(errorMsg);
      throw err;
    }
  }, [loadVersions]);

  const fetchCloudBibles = useCallback(async (query?: string) => {
    setIsLoadingCloud(true);
    setError(null);
    try {
      const list = query?.trim()
        ? await getBibleApi().searchCloudBibles(query.trim())
        : await getBibleApi().getCloudBibles();
      setCloudBibles(list);
      return list;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get cloud bibles';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoadingCloud(false);
    }
  }, []);

  const fetchCountries = useCallback(async (query?: string) => {
    setIsLoadingCloud(true);
    setError(null);
    try {
      const list = await getBibleApi().getCountries(query);
      setCountries(list);
      return list;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get countries';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoadingCloud(false);
    }
  }, []);

  const fetchLanguages = useCallback(async (countryId?: string, query?: string) => {
    setIsLoadingCloud(true);
    setError(null);
    try {
      const list = await getBibleApi().getLanguages({ countryId, query });
      setLanguages(list);
      return list;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get languages';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoadingCloud(false);
    }
  }, []);

  const fetchBiblesByLanguage = useCallback(async (language: string, query?: string) => {
    setIsLoadingCloud(true);
    setError(null);
    try {
      const list = await getBibleApi().getBibles({ language, query });
      setBibles(list);
      setCloudBibles(list);
      return list;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get Bible versions';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoadingCloud(false);
    }
  }, []);

  const downloadFromCloud = useCallback(async (abbr: string, name: string, filesetId: string, language?: string) => {
    setIsDownloading(true);
    setError(null);
    setDownloadProgress({ code: abbr, loaded: 0, total: 100, percent: 5 });
    const unsubscribe = getBibleApi().subscribeDownloadProgress((event) => {
      if (event.code === abbr) setDownloadProgress(event);
    });
    try {
      const version = await getBibleApi().downloadCloud({ abbr, name, filesetId, language });
      setDownloadProgress({ code: abbr, loaded: 100, total: 100, percent: 100 });
      await loadVersions();
      notifyBibleVersionChanged();
      return version;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Cloud download failed';
      setError(errorMsg);
      throw err;
    } finally {
      unsubscribe();
      setIsDownloading(false);
      setTimeout(() => setDownloadProgress(null), 400);
    }
  }, [loadVersions]);

  useEffect(() => {
    void fetchCountries();
  }, [fetchCountries]);

  return {
    versions,
    activeVersion,
    isLoading,
    isDownloading,
    isLoadingCloud,
    error,
    downloadProgress,
    storageStats,
    switchVersion,
    deleteVersion,
    clearCache,
    cloudBibles,
    countries,
    languages,
    bibles,
    fetchCloudBibles,
    fetchCountries,
    fetchLanguages,
    fetchBiblesByLanguage,
    downloadFromCloud,
    refreshVersions: loadVersions,
  };
}
