import React, { useEffect, useState } from 'react';
import { Sparkles, Download, CheckCircle2, AlertCircle, RefreshCw, XCircle, Sliders, Type } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { useSettingsStore } from '../../../core/stores/useSettingsStore';
import { DEFAULT_AI_FORMATTING_SETTINGS, type AiFormattingSettings } from '../../../core/models/outputSettings';

interface AiStatus {
  enabled: boolean;
  modelDownloaded: boolean;
  downloading: boolean;
  downloadProgress: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string | null;
}

export const AiSettingsWorkspace: React.FC = () => {
  const { t } = useI18n();
  const settingsStore = useSettingsStore();
  const aiFormatting = settingsStore.aiFormatting || DEFAULT_AI_FORMATTING_SETTINGS;

  const updateFormatting = (patch: Partial<AiFormattingSettings>) => {
    settingsStore.setSettings({
      aiFormatting: {
        ...aiFormatting,
        ...patch,
      },
    });
  };

  const [aiStatus, setAiStatus] = useState<AiStatus>({
    enabled: false,
    modelDownloaded: false,
    downloading: false,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    error: null,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchStatus = async () => {
      try {
        if (window.api?.ai) {
          const status = await window.api.ai.getStatus();
          setAiStatus(status);

          unsubscribe = window.api.ai.onStatusChanged((newStatus: AiStatus) => {
            setAiStatus(newStatus);
          });
        }
      } catch (err) {
        console.error('Failed to load AI status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleToggleAi = async (checked: boolean) => {
    if (!window.api?.ai) return;
    try {
      const updated = await window.api.ai.toggleEnable(checked);
      setAiStatus(updated);
    } catch (err) {
      console.error('Failed to toggle AI:', err);
    }
  };

  const handleCancelDownload = async () => {
    if (!window.api?.ai) return;
    try {
      await window.api.ai.cancelDownload();
    } catch (err) {
      console.error('Failed to cancel download:', err);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-text/50">
        <RefreshCw className="animate-spin mr-2" size={20} />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 backdrop-blur-md">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles size={28} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text flex flex-wrap items-center gap-2">
              {t('aiAssistantWorkspace.title')}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                {t('aiAssistantWorkspace.offlineTag')}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                {t('aiAssistantWorkspace.experimentalTag')}
              </span>
            </h3>
            <p className="text-sm text-text/70 mt-1 leading-relaxed">
              {t('aiAssistantWorkspace.description')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Activation Card */}
      <div className="p-6 rounded-2xl bg-surface/50 border border-border/50 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-medium text-text">{t('aiAssistantWorkspace.activateTitle')}</h4>
            <p className="text-xs text-text/60 mt-0.5">
              {t('aiAssistantWorkspace.activateDesc')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={aiStatus.enabled}
              onChange={(e) => handleToggleAi(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Status Indicator & Download Bar */}
        {aiStatus.enabled && (
          <div className="pt-4 border-t border-border/40 space-y-4">
            {aiStatus.downloading && (
              <div className="space-y-3 bg-surface-hover/50 p-4 rounded-xl border border-indigo-500/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-indigo-400 font-medium">
                    <Download size={14} className="animate-bounce" />
                    {t('aiAssistantWorkspace.downloadingModel')}
                  </span>
                  <span className="text-text/70 font-mono">
                    {aiStatus.totalBytes > 0
                      ? `${formatBytes(aiStatus.downloadedBytes)} / ${formatBytes(aiStatus.totalBytes)} (${aiStatus.downloadProgress}%)`
                      : `${formatBytes(aiStatus.downloadedBytes)} (${aiStatus.downloadProgress}%)`}
                  </span>
                </div>
                <div className="w-full bg-surface-hover rounded-full h-2 overflow-hidden border border-border/30">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(2, Math.min(100, aiStatus.downloadProgress))}%` }}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleCancelDownload}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <XCircle size={14} /> {t('aiAssistantWorkspace.cancelDownload')}
                  </button>
                </div>
              </div>
            )}

            {aiStatus.modelDownloaded && !aiStatus.downloading && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                <CheckCircle2 size={20} className="shrink-0" />
                <div>
                  <span className="font-semibold">{t('aiAssistantWorkspace.aiReady')}</span> {t('aiAssistantWorkspace.aiReadyDesc')}
                </div>
              </div>
            )}

            {aiStatus.error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={20} className="shrink-0" />
                <div>
                  <span className="font-semibold">{t('aiAssistantWorkspace.downloadFailed')}</span> {aiStatus.error}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sub-settings Container (Disabled when AI is off) */}
      <div className={`space-y-6 transition-all duration-300 ${!aiStatus.enabled ? 'opacity-40 pointer-events-none select-none' : ''}`}>
        {/* Formatting Rules & Line Limits Settings */}
        <div className="p-6 rounded-2xl bg-surface/50 border border-border/50 space-y-5">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-indigo-400" />
            <h4 className="text-base font-medium text-text">{t('aiAssistantWorkspace.formattingRulesTitle')}</h4>
          </div>
          <p className="text-xs text-text/60">
            {t('aiAssistantWorkspace.formattingRulesDesc')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-text">
                {t('aiAssistantWorkspace.maxCharsPerLine')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={15}
                  max={100}
                  disabled={!aiStatus.enabled}
                  value={aiFormatting.maxCharsPerLine}
                  onChange={(e) => updateFormatting({ maxCharsPerLine: parseInt(e.target.value, 10) || 40 })}
                  className="w-24 h-9 rounded-lg border border-border bg-background px-3 text-xs text-text font-mono outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <span className="text-xs text-text/50">{t('aiAssistantWorkspace.maxCharsPerLineDesc')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-text">
                {t('aiAssistantWorkspace.maxLinesPerSlide')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={8}
                  disabled={!aiStatus.enabled}
                  value={aiFormatting.maxLinesPerSlide}
                  onChange={(e) => updateFormatting({ maxLinesPerSlide: parseInt(e.target.value, 10) || 4 })}
                  className="w-24 h-9 rounded-lg border border-border bg-background px-3 text-xs text-text font-mono outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <span className="text-xs text-text/50">{t('aiAssistantWorkspace.maxLinesPerSlideDesc')}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/40">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-text flex items-center gap-2">
                  <Type size={15} className="text-indigo-400" />
                  {t('aiAssistantWorkspace.autoFixTypos')}
                </span>
                <p className="text-xs text-text/50 mt-0.5">
                  {t('aiAssistantWorkspace.autoFixTyposDesc')}
                </p>
              </div>
              <input
                type="checkbox"
                disabled={!aiStatus.enabled}
                checked={aiFormatting.autoFixTypos}
                onChange={(e) => updateFormatting({ autoFixTypos: e.target.checked })}
                className="h-4 w-4 accent-indigo-600 rounded disabled:opacity-50"
              />
            </label>
          </div>
        </div>

        {/* Feature Capabilities list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-surface/30 border border-border/40 space-y-1.5">
            <h5 className="text-sm font-medium text-text flex items-center gap-2">
              {t('aiAssistantWorkspace.autoStructuring')}
            </h5>
            <p className="text-xs text-text/60">
              {t('aiAssistantWorkspace.autoStructuringDesc')}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-surface/30 border border-border/40 space-y-1.5">
            <h5 className="text-sm font-medium text-text flex items-center gap-2">
              {t('aiAssistantWorkspace.smartLineSplitter')}
            </h5>
            <p className="text-xs text-text/60">
              {t('aiAssistantWorkspace.smartLineSplitterDesc')}
            </p>
          </div>
        </div>

        {/* AI Auto-Tagging & Seed Smart Playlists Card */}
        <AutoTaggingCard enabled={aiStatus.enabled} />
      </div>
    </div>
  );
};

function AutoTaggingCard({ enabled }: { enabled: boolean }) {
  const [isTagging, setIsTagging] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number; log: string } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    if (window.api?.ai?.onAutoTaggingProgress) {
      const unsubscribe = window.api.ai.onAutoTaggingProgress((data) => {
        setProgress(data);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleRunAutoTagging = async () => {
    if (!window.api?.ai?.runAutoTagging || isTagging || !enabled) return;
    setIsTagging(true);
    setSummary(null);
    setProgress({ processed: 0, total: 0, log: 'Memulai proses Auto-Tagging...' });

    try {
      const res = await window.api.ai.runAutoTagging();
      setSummary(`Selesai! ${res.processedSongs} lagu dianalisis. ${res.tagsAssigned} tag baru ditambahkan ke playlist.`);
    } catch (err) {
      setSummary(err instanceof Error ? `Gagal: ${err.message}` : 'Proses auto-tagging gagal.');
    } finally {
      setIsTagging(false);
    }
  };

  const seedTags = ['#Pujian', '#Penyembahan', '#Natal', '#Paskah', '#PerjamuanKudus', '#AnakAnak', '#Firman'];

  return (
    <div className="p-6 rounded-2xl bg-surface/50 border border-border/50 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-text flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            AI Auto-Tagging & Seed Smart Playlists
          </h4>
          <p className="text-xs text-text/60 mt-1">
            Analisis seluruh database lagu di RAMEDIA untuk secara otomatis memberikan tag kategori dan mengisi Smart Playlists bawaan.
          </p>
        </div>
      </div>

      {/* Seed Tags Badges */}
      <div className="flex flex-wrap gap-2">
        {seedTags.map((tag) => (
          <span key={tag} className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {tag}
          </span>
        ))}
      </div>

      {/* Action Button */}
      <button
        onClick={() => void handleRunAutoTagging()}
        disabled={!enabled || isTagging}
        className="w-full py-3 px-5 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg transition hover:from-indigo-400 hover:to-purple-500 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isTagging ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
        {isTagging ? 'Memproses Auto-Tagging...' : 'Jalankan AI Auto-Tagging & Smart Playlists'}
      </button>

      {/* Progress & Log Feed */}
      {progress && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-text/70 font-mono">
            <span>Progress: {progress.processed} / {progress.total} Lagu</span>
            <span>{progress.total > 0 ? `${Math.round((progress.processed / progress.total) * 100)}%` : '0%'}</span>
          </div>
          <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border/40">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-200"
              style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[11px] font-mono text-indigo-300 truncate bg-background/50 px-3 py-2 rounded-lg border border-border/30">
            {progress.log}
          </p>
        </div>
      )}

      {summary && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} />
          {summary}
        </div>
      )}
    </div>
  );
}
