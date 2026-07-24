import type { Template } from '../../../electron/database/schema';
import {
  type BrowserOutputClient,
  type NdiOutputConfig,
  type OutputChannel,
  type OutputDisplayInfo,
} from '../../../core/models/outputSettings';


export interface BrowserRuntimeState {
  isRunning: boolean;
  port: number;
  urls: string[];
  clients: Array<{
    id: string;
    pairingCode: string;
    isConnected: boolean;
    activeConnections: number;
    lastSeen: string | null;
    url: string;
  }>;
}

export interface NdiRuntimeState {
  helperAvailable: boolean;
  helperPath: string | null;
  platform: string;
  outputs: Array<{
    outputId: string;
    outputName: string;
    sourceName: string;
    resolution: NdiOutputConfig['resolution'];
    fps: NdiOutputConfig['fps'];
    includeAudio: boolean;
    alphaEnabled: boolean;
    state: 'idle' | 'starting' | 'live' | 'error' | 'unavailable';
    lastStartedAt: string | null;
    error: string | null;
  }>;
}

export const OUTPUT_CANVAS_PRESETS = [
  { label: 'HD', w: 1280, h: 720 },
  { label: 'Full HD', w: 1920, h: 1080 },
  { label: '4:3', w: 1024, h: 768 },
  { label: 'Ultrawide', w: 2560, h: 1080 },
] as const;

export function getAspectRatioLabel(width: number, height: number) {
  const ratio = width / Math.max(1, height);
  if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9';
  if (Math.abs(ratio - 4 / 3) < 0.01) return '4:3';
  if (Math.abs(ratio - 21 / 9) < 0.02) return '21:9';
  return `${ratio.toFixed(2)}:1`;
}

export function getOutputTargetSummary(
  output: OutputChannel,
  displays: OutputDisplayInfo[],
  browserClients: BrowserOutputClient[],
) {
  if (output.targetType === 'browser-client') {
    const client = output.browserClientId
      ? browserClients.find((entry) => entry.id === output.browserClientId)
      : null;
    return client ? `Browser client · ${client.name}` : 'Browser client · pending pairing';
  }

  if (output.targetType === 'ndi') {
    return `NDI output · ${output.ndiConfig.sourceName}`;
  }

  const display = output.targetDisplayId
    ? displays.find((entry) => entry.id === output.targetDisplayId)
    : displays.find((entry) => entry.isPrimary);

  return display ? display.label : 'Primary display fallback';
}

export function getRuntimeDisplay(output: OutputChannel | null, displays: OutputDisplayInfo[]) {
  const displayId = output?.targetDisplayId;
  return (
    (displayId ? displays.find((display) => display.id === displayId) : null)
    ?? displays.find((display) => display.isPrimary)
    ?? null
  );
}

export function getBrowserClientRuntime(
  clientId: string,
  browserRuntime: BrowserRuntimeState | null,
) {
  return browserRuntime?.clients.find((entry) => entry.id === clientId) || null;
}

export function getBrowserClientUrl(
  client: BrowserOutputClient,
  browserRuntime: BrowserRuntimeState | null,
) {
  const urls = getBrowserClientUrls(client, browserRuntime);
  return urls.find((url) => !url.includes('://localhost:') && !url.includes('://127.0.0.1:')) ?? urls[0];
}

export function getBrowserClientUrls(
  client: BrowserOutputClient,
  browserRuntime: BrowserRuntimeState | null,
) {
  const runtimeClient = getBrowserClientRuntime(client.id, browserRuntime);
  const runtimeBases = browserRuntime?.urls?.length ? browserRuntime.urls : ['http://localhost:17884'];
  const urls = runtimeBases.map((base) => `${base}/browser-output/${client.pairingCode}`);

  if (runtimeClient?.url && !urls.includes(runtimeClient.url)) {
    urls.unshift(runtimeClient.url);
  }

  return urls;
}

export function getOutputMetrics(outputChannels: OutputChannel[]) {
  const localOutputs = outputChannels.filter((output) => output.targetType === 'electron-display');
  const browserOutputs = outputChannels.filter((output) => output.targetType === 'browser-client');
  const ndiOutputs = outputChannels.filter((output) => output.targetType === 'ndi');
  return {
    total: outputChannels.length,
    local: localOutputs.length,
    browser: browserOutputs.length,
    ndi: ndiOutputs.length,
    enabled: outputChannels.filter((output) => output.enabled).length,
  };
}

export function getNdiRuntimeForOutput(
  outputId: string,
  ndiRuntime: NdiRuntimeState | null,
) {
  return ndiRuntime?.outputs.find((entry) => entry.outputId === outputId) || null;
}

export function resolveRuntimeOutput(outputChannels: OutputChannel[]) {
  // Cari primary electron output channel langsung dari list yang diberikan
  // tanpa perlu bungkus ke PersistedOutputSettings dengan data hardcoded
  return (
    outputChannels.find((output) => output.enabled && output.isPrimary && output.targetType === 'electron-display')
    || outputChannels.find((output) => output.enabled && output.targetType === 'electron-display')
    || outputChannels.find((output) => output.enabled && output.isPrimary)
    || outputChannels.find((output) => output.enabled)
    || outputChannels[0]
    || null
  );
}


export type OutputWorkspaceSongPreset = Template;
