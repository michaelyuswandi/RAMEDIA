import { useEffect, useMemo, useState } from 'react';
import { Monitor, Tv, Maximize, Presentation, Mic2, UserSquare2, Eye, ArrowRight, X, ScreenShare, Square, RefreshCw } from 'lucide-react';
import { ipcScreenSettingsService } from '../../core/services/ipcScreenSettingsService';
import { usePresentationStore } from '../../core/stores/usePresentationStore';
import {
  DEFAULT_SCREEN_PROFILE_ID,
  SCREEN_PROFILES,
  getScreenProfileDefinition,
  type ScreenProfileId,
} from '../../core/screens/screenProfiles';
import { useI18n } from '../../i18n';

const SCREEN_PROFILE_ICONS = {
  audience: Presentation,
  singer: Mic2,
  'worship-leader': UserSquare2,
  confidence: Eye,
} as const;

interface ScreensPanelProps {
  onClose?: () => void;
}

interface CaptureSourceOption {
  id: string;
  name: string;
  type: 'screen' | 'window';
  displayId: string;
  thumbnail: string | null;
}

const INITIAL_OUTPUT_STATE = {
  isOpen: false,
  isFullscreen: false,
  openCount: 0,
  totalLocalOutputs: 0,
};

export default function ScreensPanel({ onClose }: ScreensPanelProps) {
  const { t } = useI18n();
  const { liveCapture, startCapture, stopCapture, setCaptureError } = usePresentationStore();
  const [outputState, setOutputState] = useState(INITIAL_OUTPUT_STATE);
  const [selectedProfile, setSelectedProfile] = useState<ScreenProfileId>(DEFAULT_SCREEN_PROFILE_ID);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [captureSources, setCaptureSources] = useState<CaptureSourceOption[]>([]);
  const [selectedCaptureSourceId, setSelectedCaptureSourceId] = useState<string | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [captureUiError, setCaptureUiError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.api) return;
    window.api.window.getOutputState().then(setOutputState).catch(() => undefined);
  }, []);

  useEffect(() => {
    let isMounted = true;

    ipcScreenSettingsService
      .getDefaultProfile()
      .then((profileId) => {
        if (!isMounted) return;
        setSelectedProfile(profileId);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsProfileLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeProfile = useMemo(
    () => getScreenProfileDefinition(selectedProfile),
    [selectedProfile],
  );

  const refreshOutputState = async () => {
    if (!window.api) return;
    const state = await window.api.window.getOutputState();
    setOutputState(state);
  };

  const openOutput = async () => {
    if (!window.api) return;
    await window.api.window.openOutput();
    await refreshOutputState();
  };

  const loadCaptureSources = async () => {
    if (!window.api?.capture) {
      setCaptureUiError('Screen capture is available in the Electron app.');
      return;
    }

    setIsLoadingSources(true);
    setCaptureUiError(null);

    try {
      const sources = await window.api.capture.getScreenSources();
      setCaptureSources(sources);
      setSelectedCaptureSourceId((current) => current || sources[0]?.id || null);
    } catch (error) {
      setCaptureUiError(error instanceof Error ? error.message : 'Unable to load capture sources.');
    } finally {
      setIsLoadingSources(false);
    }
  };

  const beginCapture = async () => {
    const selectedSource = captureSources.find((source) => source.id === selectedCaptureSourceId);
    if (!selectedSource || !window.api?.capture) return;

    try {
      setCaptureUiError(null);
      await window.api.window.openOutput();
      await window.api.capture.setActiveSource({
        sourceId: selectedSource.id,
        sourceName: selectedSource.name,
        includeAudio: false,
      });
      startCapture({
        sourceType: selectedSource.type,
        sourceId: selectedSource.id,
        sourceName: selectedSource.name,
        includeAudio: false,
      });
      await refreshOutputState();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start capture.';
      setCaptureUiError(message);
      setCaptureError(message);
    }
  };

  const endCapture = async () => {
    stopCapture();
    await window.api?.capture?.clearActiveSource().catch(() => undefined);
  };

  const toggleFullscreen = async () => {
    if (!window.api) return;
    await window.api.window.toggleOutputFullscreen();
    await refreshOutputState();
  };

  const selectProfile = async (profileId: ScreenProfileId) => {
    setSelectedProfile(profileId);
    setIsSavingProfile(true);

    try {
      await ipcScreenSettingsService.setDefaultProfile(profileId);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const ActiveIcon = SCREEN_PROFILE_ICONS[activeProfile.id];

  return (
    <div className="panel-shell flex h-full min-h-0 flex-col overflow-hidden font-sans">
      <div className="flex h-12 items-center justify-between border-b border-text/5 bg-black/10 px-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-text/30">{t('screensPanel.screensOutputs')}</div>
          <div className="mt-1 text-sm font-medium text-text/88">{t('screensPanel.outputControl')}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-mono tracking-[0.08em] text-text/28">
            Phase 2
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-text/55 transition-colors hover:bg-white/[0.06] hover:text-text"
              aria-label="Close screens panel"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div className="panel-muted flex min-h-0 flex-col rounded-[18px] overflow-hidden">
          <div className="flex h-10 items-center gap-2 border-b border-white/6 px-4">
            <Monitor size={14} className="text-info" />
            <div className="text-[11px] font-medium text-text/70">{t('screensPanel.output')}</div>
          </div>

          <div className="flex flex-col">
            <div className="flex min-h-[64px] items-center justify-between border-b border-white/6 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-text/82">{t('screensPanel.localOutputs')}</div>
                <div className="mt-1 truncate text-[11px] text-text/45">
                  {outputState.isOpen
                    ? outputState.isFullscreen
                      ? t('screensPanel.connectedFullscreen', { open: outputState.openCount, total: outputState.totalLocalOutputs })
                      : t('screensPanel.connected', { open: outputState.openCount, total: outputState.totalLocalOutputs })
                    : t('screensPanel.noLocalOutputOpen')}
                </div>
              </div>
              <div
                className={`ml-3 shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] ${
                  outputState.isOpen
                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-text/45'
                }`}
              >
                {outputState.isOpen ? t('screensPanel.statusConnected') : t('screensPanel.statusOffline')}
              </div>
            </div>

            <div className="border-b border-white/6 px-4 py-3">
              <div className="mb-3 text-[11px] font-medium text-text/60">{t('screensPanel.quickActions')}</div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={openOutput}
                  className="control-button-primary flex h-10 items-center justify-between gap-3 px-3 text-[12px] font-medium tracking-[0.01em]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Tv size={14} />
                    <span className="truncate">{outputState.isOpen ? t('screensPanel.focusOutputs') : t('screensPanel.openOutputs')}</span>
                  </span>
                  <ArrowRight size={14} className="shrink-0" />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="control-button flex h-10 items-center justify-between gap-3 px-3 text-[12px] font-medium tracking-[0.01em]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Maximize size={14} />
                    <span className="truncate">{outputState.isFullscreen ? t('screensPanel.exitFullscreen') : t('screensPanel.fullscreen')}</span>
                  </span>
                  <ArrowRight size={14} className="shrink-0 text-text/35" />
                </button>
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="text-[11px] font-medium text-text/60">{t('screensPanel.next')}</div>
              <div className="mt-1 text-[11px] leading-5 text-text/45">
                {t('screensPanel.nextOutputHint')}
              </div>
            </div>
          </div>
        </div>

        <div className="panel-muted flex min-h-0 flex-col rounded-[18px] overflow-hidden">
          <div className="flex h-10 items-center justify-between border-b border-white/6 px-4">
            <div className="flex items-center gap-2">
              <ScreenShare size={14} className="text-emerald-300" />
              <div className="text-[11px] font-medium text-text/70">{t('screensPanel.liveCapture')}</div>
            </div>
            <div
              className={`rounded-full border px-2 py-0.5 text-[9px] font-medium tracking-[0.08em] ${
                liveCapture.active
                  ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.03] text-text/42'
              }`}
            >
              {liveCapture.active ? t('screensPanel.sharing') : t('screensPanel.idle')}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="border-b border-white/6 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-text/82">{t('screensPanel.screenShare')}</div>
                  <div className="mt-1 truncate text-[11px] text-text/45">
                    {liveCapture.active
                      ? liveCapture.sourceName || t('screensPanel.captureActive')
                      : t('screensPanel.sendScreenHint')}
                  </div>
                </div>
                <button
                  onClick={() => void loadCaptureSources()}
                  className="control-button flex h-8 w-8 shrink-0 items-center justify-center"
                  title={t('screensPanel.refreshCaptureSources')}
                >
                  <RefreshCw size={13} className={isLoadingSources ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {captureSources.map((source) => {
                  const isSelected = selectedCaptureSourceId === source.id;

                  return (
                    <button
                      key={source.id}
                      onClick={() => setSelectedCaptureSourceId(source.id)}
                      className={`overflow-hidden rounded-xl border text-left transition-colors ${
                        isSelected
                          ? 'border-emerald-300/35 bg-emerald-300/10'
                          : 'border-white/8 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="aspect-video bg-black">
                        {source.thumbnail ? (
                          <img src={source.thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-text/28">
                            <Monitor size={18} />
                          </div>
                        )}
                      </div>
                      <div className="border-t border-white/6 px-2.5 py-2">
                        <div className="truncate text-[11px] font-medium text-text/82">{source.name}</div>
                        <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-text/35">
                          {source.type}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {!isLoadingSources && captureSources.length === 0 && (
                  <button
                    onClick={() => void loadCaptureSources()}
                    className="col-span-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center text-[11px] text-text/45 transition-colors hover:border-white/16 hover:text-text/65"
                  >
                    {t('screensPanel.loadAvailableSources')}
                  </button>
                )}
              </div>

              {(captureUiError || liveCapture.error) && (
                <div className="mt-3 rounded-xl border border-red-400/20 bg-red-950/20 px-3 py-2 text-[11px] leading-5 text-red-200/80">
                  {captureUiError || liveCapture.error}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 px-4 py-3">
              <button
                onClick={() => void beginCapture()}
                disabled={!selectedCaptureSourceId || liveCapture.active}
                className="control-button-primary flex h-10 items-center justify-center gap-2 px-3 text-[12px] font-medium tracking-[0.01em] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ScreenShare size={14} />
                <span>{t('screensPanel.startShare')}</span>
              </button>
              <button
                onClick={() => void endCapture()}
                disabled={!liveCapture.active}
                className="control-button flex h-10 items-center justify-center gap-2 px-3 text-[12px] font-medium tracking-[0.01em] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Square size={13} />
                <span>{t('screensPanel.stop')}</span>
              </button>
            </div>

            <div className="border-t border-white/6 px-4 py-3">
              <div className="text-[11px] font-medium text-text/60">{t('screensPanel.nextInputs')}</div>
              <div className="mt-1 text-[11px] leading-5 text-text/45">
                {t('screensPanel.nextInputsHint')}
              </div>
            </div>
          </div>
        </div>

        <div className="panel-muted flex min-h-0 flex-col rounded-[18px] overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="px-4 py-3">
              <div className="text-[11px] font-medium text-text/70">{t('screensPanel.profiles')}</div>
              <div className="mt-1 text-sm font-medium text-text/88">{t('screensPanel.defaultOutputProfile')}</div>
            </div>
            <div className="px-4 text-[10px] tracking-[0.06em] text-text/32">
              {isSavingProfile ? t('screensPanel.saving') : isProfileLoaded ? t('screensPanel.savedToSettings') : t('screensPanel.loading')}
            </div>
          </div>

          <div className="border-t border-white/6">
            <div className="flex flex-col">
              {SCREEN_PROFILES.map((profile) => {
                const Icon = SCREEN_PROFILE_ICONS[profile.id];
                const isActive = profile.id === selectedProfile;

                return (
                  <button
                    key={profile.id}
                    onClick={() => void selectProfile(profile.id)}
                    className={`w-full border-b border-white/6 px-4 py-3 text-left transition-all duration-150 last:border-b-0 ${
                      isActive
                        ? 'bg-white/[0.05]'
                        : 'bg-transparent hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                        style={{
                          borderColor: `${profile.accent}55`,
                          backgroundColor: `${profile.accent}18`,
                          color: profile.accent,
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-text/90">{profile.label}</div>
                        <div className="mt-0.5 truncate text-[11px] text-text/45">{profile.description}</div>
                      </div>
                      <div
                        className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium tracking-[0.06em] ${
                          isActive
                            ? 'text-text'
                            : 'text-text/35'
                        }`}
                        style={
                          isActive
                            ? {
                                borderColor: `${profile.accent}44`,
                                backgroundColor: `${profile.accent}18`,
                                color: profile.accent,
                              }
                            : undefined
                        }
                      >
                        {isActive ? t('screensPanel.active') : t('screensPanel.set')}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-white/6 px-4 py-3">
              <div className="text-[11px] font-medium text-text/60">{t('screensPanel.currentSelection')}</div>
              <div className="mt-3 flex items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: `${activeProfile.accent}55`,
                    backgroundColor: `${activeProfile.accent}18`,
                    color: activeProfile.accent,
                  }}
                >
                  <ActiveIcon size={20} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium text-text/92">{activeProfile.label}</div>
                  <div className="mt-1 text-[11px] leading-5 text-text/48">{activeProfile.description}</div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                <div className="text-[11px] font-medium text-text/58">{t('screensPanel.behavior')}</div>
                <div className="mt-1 text-[11px] leading-5 text-text/62">{activeProfile.behavior}</div>
              </div>

              <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3">
                <div className="text-[11px] font-medium text-text/58">{t('screensPanel.assignment')}</div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-text/55">
                  <span>{t('screensPanel.mainOutput')}</span>
                  <ArrowRight size={14} className="text-text/35" />
                  <span style={{ color: activeProfile.accent }} className="font-semibold">
                    {activeProfile.label}
                  </span>
                </div>
                <div className="mt-2 text-[11px] leading-5 text-text/40">
                  {t('screensPanel.rememberProfileHint')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
