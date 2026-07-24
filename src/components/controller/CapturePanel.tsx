import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Monitor,
  RefreshCw,
  Search,
  ScreenShare,
  Tv,
  Video,
} from 'lucide-react';
import { usePresentationStore } from '../../core/stores/usePresentationStore';
import { useUIStore } from '../../core/stores/useUIStore';

interface CaptureSourceOption {
  id: string;
  name: string;
  type: 'screen' | 'window';
  displayId: string;
  thumbnail: string | null;
}

type CaptureFilter = 'screen' | 'window' | 'hdmi' | 'camera';

const INITIAL_OUTPUT_STATE = {
  isOpen: false,
  isFullscreen: false,
  openCount: 0,
  totalLocalOutputs: 0,
};

const SOURCE_TYPES: Array<{
  id: CaptureFilter;
  label: string;
  description: string;
  icon: typeof ScreenShare;
}> = [
  { id: 'screen', label: 'Screen', description: 'Entire display', icon: Monitor },
  { id: 'window', label: 'Window', description: 'Specific app window', icon: Video },
  { id: 'hdmi', label: 'HDMI', description: 'Coming soon', icon: Tv },
  { id: 'camera', label: 'Camera', description: 'Coming soon', icon: Camera },
];

function getSourceTypeLabel(source: CaptureSourceOption | null, filter: CaptureFilter) {
  if (source) return source.type === 'screen' ? 'Screen Capture' : 'Window Capture';
  if (filter === 'hdmi') return 'HDMI Capture';
  if (filter === 'camera') return 'Camera Capture';
  return 'No source selected';
}

export default function CapturePanel() {
  const { liveCapture, startCapture, stopCapture, setCaptureError } = usePresentationStore();
  const setActiveView = useUIStore((state) => state.setActiveView);
  const [outputState, setOutputState] = useState(INITIAL_OUTPUT_STATE);
  const [sources, setSources] = useState<CaptureSourceOption[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [filter, setFilter] = useState<CaptureFilter>('screen');
  const [searchQuery, setSearchQuery] = useState('');
  const [uiError, setUiError] = useState<string | null>(null);

  const filteredSources = useMemo(() => {
    if (filter === 'hdmi' || filter === 'camera') return [];

    const query = searchQuery.trim().toLowerCase();
    return sources.filter((source) => {
      if (source.type !== filter) return false;
      if (!query) return true;
      return `${source.name} ${source.displayId}`.toLowerCase().includes(query);
    });
  }, [filter, searchQuery, sources]);

  const selectedSource =
    sources.find((source) => source.id === selectedSourceId && source.type === filter) ||
    filteredSources[0] ||
    null;

  const isFutureInput = filter === 'hdmi' || filter === 'camera';
  const canStartCapture = !!selectedSource && !liveCapture.active && !isFutureInput;

  const refreshOutputState = async () => {
    if (!window.api) return;
    const state = await window.api.window.getOutputState();
    setOutputState(state);
  };

  const loadSources = async () => {
    if (!window.api?.capture) {
      setUiError('Capture is available in the Electron app.');
      return;
    }

    setIsLoadingSources(true);
    setUiError(null);

    try {
      const nextSources = await window.api.capture.getScreenSources();
      setSources(nextSources);
      setSelectedSourceId((current) => {
        if (current && nextSources.some((source) => source.id === current && source.type === filter)) return current;
        return nextSources.find((source) => source.type === filter)?.id || null;
      });
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Unable to load capture sources.');
    } finally {
      setIsLoadingSources(false);
    }
  };

  const selectSourceType = (nextFilter: CaptureFilter) => {
    setFilter(nextFilter);
    setSelectedSourceId(sources.find((source) => source.type === nextFilter)?.id || null);
  };

  const beginCapture = async () => {
    if (!selectedSource || !window.api?.capture) return;

    try {
      setUiError(null);
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
      setUiError(message);
      setCaptureError(message);
    }
  };

  const endCapture = async () => {
    stopCapture();
    await window.api?.capture?.clearActiveSource().catch(() => undefined);
  };

  useEffect(() => {
    void refreshOutputState();
    void loadSources();
  }, []);

  return (
    <div className="theme-scope absolute inset-0 z-40 flex flex-col overflow-hidden bg-slate-50 font-sans text-slate-950">
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveView('songs')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]"
            aria-label="Back to Library"
            title="Back to Library"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ScreenShare size={20} className="text-blue-600" />
              <h1 className="text-lg font-bold text-slate-950">Capture</h1>
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                  liveCapture.active
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                {liveCapture.active ? 'Live' : 'Idle'}
              </span>
            </div>
            <div className="mt-1 truncate text-sm text-slate-500">
              {liveCapture.active ? liveCapture.sourceName || 'Capture is live' : 'Choose a screen or window, then send it to output.'}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Output</div>
          <div className="mt-0.5 text-sm font-bold text-slate-800">
            {outputState.totalLocalOutputs > 0
              ? `${outputState.openCount}/${outputState.totalLocalOutputs} connected`
              : 'No output open'}
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[260px_340px_minmax(0,1fr)] gap-4 overflow-hidden p-4">
        <aside className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Source Type</div>
          <div className="mt-3 space-y-2">
            {SOURCE_TYPES.map((item) => {
              const Icon = item.icon;
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSourceType(item.id)}
                  className={`flex h-16 w-full items-center gap-3 rounded-xl border px-3 text-left transition active:scale-[0.99] ${
                    active
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={19} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className={`mt-0.5 block truncate text-xs ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-bold text-slate-700">Output</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {outputState.totalLocalOutputs > 0
                ? `${outputState.openCount}/${outputState.totalLocalOutputs} local outputs`
                : 'No local output is open'}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Sources</div>
                <div className="mt-1 text-xs text-slate-500">{filteredSources.length} available</div>
              </div>
              <button
                type="button"
                onClick={() => void loadSources()}
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]"
                aria-label="Refresh sources"
                title="Refresh sources"
              >
                <RefreshCw size={16} className={isLoadingSources ? 'animate-spin' : ''} />
              </button>
            </div>

            {!isFutureInput && (
              <label className="mt-3 flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-blue-300">
                <Search size={15} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search sources..."
                  className="min-w-0 flex-1 border-none bg-transparent px-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {isFutureInput ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 text-center">
                {filter === 'hdmi' ? <Tv size={34} className="text-slate-400" /> : <Camera size={34} className="text-slate-400" />}
                <div className="mt-3 text-sm font-bold text-slate-800">
                  {filter === 'hdmi' ? 'HDMI input coming soon' : 'Camera input coming soon'}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">Screen and window capture are ready now.</div>
              </div>
            ) : filteredSources.length > 0 ? (
              <div className="space-y-2">
                {filteredSources.map((source) => {
                  const selected = selectedSource?.id === source.id;
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => setSelectedSourceId(source.id)}
                      onDoubleClick={() => void beginCapture()}
                      className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition active:scale-[0.99] ${
                        selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-950">
                        {source.thumbnail ? (
                          <img src={source.thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-white/50">
                            {source.type === 'screen' ? <Monitor size={18} /> : <Video size={18} />}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-slate-800">{source.name}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">{source.displayId || getSourceTypeLabel(source, filter)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void loadSources()}
                className="flex h-full min-h-[260px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 text-center transition hover:bg-blue-50/40"
              >
                <ScreenShare size={32} className="text-slate-400" />
                <div className="mt-3 text-sm font-bold text-slate-800">Load capture sources</div>
                <div className="mt-1 text-xs text-slate-500">Screens and windows will appear here.</div>
              </button>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white">
          <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Preview</div>
              <div className="mt-1 max-w-[52vw] truncate text-sm font-bold text-slate-800">{selectedSource?.name || 'No source selected'}</div>
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                liveCapture.active
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              {liveCapture.active ? 'On Output' : 'Preview Only'}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-950 p-4">
            <div className="relative flex aspect-video max-h-full w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950">
              {selectedSource?.thumbnail ? (
                <img src={selectedSource.thumbnail} alt="" className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center text-center text-white/55">
                  <ScreenShare size={42} className="mb-3 opacity-70" />
                  <div className="text-sm font-bold text-white/80">Select a source</div>
                  <div className="mt-1 text-xs text-white/45">Choose a screen or window from the list.</div>
                </div>
              )}
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-[1fr_1fr] gap-3 border-t border-slate-100 p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Source Info</div>
              <div className="mt-3 space-y-2 text-sm">
                <InfoRow label="Name" value={selectedSource?.name || '-'} />
                <InfoRow label="Type" value={getSourceTypeLabel(selectedSource, filter)} />
                <InfoRow label="Display" value={selectedSource?.displayId || '-'} />
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Action</div>
                <div className="mt-2 text-sm text-slate-600">
                  {liveCapture.active ? 'Capture is currently live on output.' : 'Start capture to send selected source to output.'}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void beginCapture()}
                  disabled={!canStartCapture}
                  className="h-10 rounded-xl bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Start Capture
                </button>
                <button
                  type="button"
                  onClick={() => void endCapture()}
                  disabled={!liveCapture.active}
                  className="h-10 rounded-xl border border-red-200 bg-white text-sm font-bold text-red-500 transition hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>

          {(uiError || liveCapture.error) && (
            <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {uiError || liveCapture.error}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
      <div className="text-slate-500">{label}</div>
      <div className="truncate text-right font-bold text-slate-800">{value}</div>
    </div>
  );
}
