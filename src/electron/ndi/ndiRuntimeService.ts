import { app } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { OutputChannel, PersistedOutputSettings } from '../../core/models/outputSettings';
import { resolveEffectiveOutputChannel, sanitizeOutputSettings } from '../../core/models/outputSettings';

export type NdiOutputRuntimeState = 'idle' | 'starting' | 'live' | 'error' | 'unavailable';

export interface NdiOutputRuntimeEntry {
  outputId: string;
  outputName: string;
  sourceName: string;
  resolution: '1080p' | '720p';
  fps: 30 | 60;
  includeAudio: boolean;
  alphaEnabled: boolean;
  state: NdiOutputRuntimeState;
  lastStartedAt: string | null;
  error: string | null;
}

export interface NdiRuntimeSummary {
  helperAvailable: boolean;
  helperPath: string | null;
  platform: NodeJS.Platform;
  outputs: NdiOutputRuntimeEntry[];
}

interface NdiOutputProcess {
  child: ChildProcess;
  configKey: string;
  acceptingFrames: boolean;
}

function getPlatformHelperRelativePath() {
  switch (process.platform) {
    case 'darwin':
      return path.join('resources', 'ndi-helper', process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64', 'ndi-helper');
    case 'win32':
      return path.join('resources', 'ndi-helper', 'win32-x64', 'ndi-helper.exe');
    default:
      return null;
  }
}

function resolveHelperPath() {
  const relative = getPlatformHelperRelativePath();
  if (!relative) return null;

  const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(basePath, relative);
}

function buildUnavailableError(helperPath: string | null) {
  if (!helperPath) {
    return `NDI helper is not supported on ${process.platform}.`;
  }
  return `NDI helper was not found at ${helperPath}.`;
}

function toRuntimeEntry(output: OutputChannel, helperAvailable: boolean, helperPath: string | null): NdiOutputRuntimeEntry {
  return {
    outputId: output.id,
    outputName: output.name,
    sourceName: output.ndiConfig.sourceName,
    resolution: output.ndiConfig.resolution,
    fps: output.ndiConfig.fps,
    includeAudio: output.ndiConfig.includeAudio,
    alphaEnabled: output.ndiConfig.alphaEnabled,
    state: helperAvailable ? 'idle' : 'unavailable',
    lastStartedAt: null,
    error: helperAvailable ? null : buildUnavailableError(helperPath),
  };
}

function getNdiOutputs(settings: PersistedOutputSettings) {
  return settings.outputs
    .filter((output) => output.enabled && output.targetType === 'ndi')
    .map((output) => resolveEffectiveOutputChannel(settings, output) || output);
}

function getOutputConfigKey(output: OutputChannel) {
  return JSON.stringify({
    sourceName: output.ndiConfig.sourceName,
    resolution: output.ndiConfig.resolution,
    fps: output.ndiConfig.fps,
    includeAudio: output.ndiConfig.includeAudio,
    alphaEnabled: output.ndiConfig.alphaEnabled,
    role: output.role,
    songPresetMode: output.songPresetMode,
    forcedSongPresetId: output.forcedSongPresetId,
  });
}

function buildHelperArgs(output: OutputChannel) {
  return [
    '--output-id',
    output.id,
    '--source-name',
    output.ndiConfig.sourceName,
    '--resolution',
    output.ndiConfig.resolution,
    '--fps',
    String(output.ndiConfig.fps),
    '--role',
    output.role,
    ...(output.ndiConfig.includeAudio ? ['--include-audio'] : []),
    ...(output.ndiConfig.alphaEnabled ? ['--alpha'] : []),
  ];
}

export function createNdiRuntimeService() {
  const processes = new Map<string, NdiOutputProcess>();
  let summary: NdiRuntimeSummary = {
    helperAvailable: false,
    helperPath: null,
    platform: process.platform,
    outputs: [],
  };

  const setOutputEntry = (outputId: string, updater: (entry: NdiOutputRuntimeEntry) => NdiOutputRuntimeEntry) => {
    summary = {
      ...summary,
      outputs: summary.outputs.map((entry) => (entry.outputId === outputId ? updater(entry) : entry)),
    };
  };

  const stopProcess = (outputId: string) => {
    const runtime = processes.get(outputId);
    if (!runtime) return;
    processes.delete(outputId);
    if (!runtime.child.killed) {
      runtime.child.kill();
    }
  };

  const refreshAvailability = () => {
    const helperPath = resolveHelperPath();
    const helperAvailable = !!helperPath && fs.existsSync(helperPath);
    if (!helperAvailable) {
      for (const outputId of processes.keys()) {
        stopProcess(outputId);
      }
    }
    summary = {
      ...summary,
      helperAvailable,
      helperPath,
      platform: process.platform,
      outputs: summary.outputs.map((entry) => ({
        ...entry,
        state: helperAvailable
          ? (processes.has(entry.outputId) ? entry.state : entry.error ? 'error' : 'idle')
          : 'unavailable',
        error: helperAvailable ? entry.error : buildUnavailableError(helperPath),
      })),
    };
  };

  const startProcessForOutput = (output: OutputChannel) => {
    refreshAvailability();
    const entry = toRuntimeEntry(output, summary.helperAvailable, summary.helperPath);
    summary = {
      ...summary,
      outputs: [
        ...summary.outputs.filter((item) => item.outputId !== output.id),
        { ...entry, state: summary.helperAvailable ? 'starting' : 'unavailable', lastStartedAt: null },
      ],
    };

    if (!summary.helperAvailable || !summary.helperPath) {
      return summary;
    }

    const configKey = getOutputConfigKey(output);
    const current = processes.get(output.id);
    if (current?.configKey === configKey && !current.child.killed) {
      setOutputEntry(output.id, (item) => ({ ...item, state: 'live', error: null }));
      return summary;
    }
    if (current) {
      stopProcess(output.id);
    }

    try {
      const helperDirectory = path.dirname(summary.helperPath);
      const child = spawn(summary.helperPath, buildHelperArgs(output), {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          DYLD_LIBRARY_PATH: [
            helperDirectory,
            process.env.DYLD_LIBRARY_PATH,
          ].filter(Boolean).join(path.delimiter),
          RUMEDIA_NDI_OUTPUT_ID: output.id,
          RUMEDIA_NDI_SOURCE_NAME: output.ndiConfig.sourceName,
        },
      });

      const runtime: NdiOutputProcess = { child, configKey, acceptingFrames: true };
      processes.set(output.id, runtime);
      const startedAt = new Date().toISOString();
      setOutputEntry(output.id, (item) => ({
        ...item,
        state: 'starting',
        lastStartedAt: startedAt,
        error: null,
      }));

      child.stdout?.on('data', (chunk) => {
        const message = String(chunk).trim();
        if (!message) return;
        console.log(`[NDI:${output.id}] ${message}`);
        if (/helper live/i.test(message)) {
          setOutputEntry(output.id, (item) => ({ ...item, state: 'live', error: null }));
        }
      });

      child.stderr.on('data', (chunk) => {
        const message = String(chunk).trim();
        if (!message) return;
        console.error(`[NDI:${output.id}] ${message}`);
        if (/failed|fatal|error/i.test(message)) {
          setOutputEntry(output.id, (item) => ({ ...item, state: 'error', error: message }));
        }
      });

      child.stdin?.on('drain', () => {
        const active = processes.get(output.id);
        if (active?.child === child) active.acceptingFrames = true;
      });

      child.on('error', (error) => {
        processes.delete(output.id);
        setOutputEntry(output.id, (item) => ({
          ...item,
          state: 'error',
          error: error instanceof Error ? error.message : String(error),
        }));
      });

      child.on('exit', (code, signal) => {
        processes.delete(output.id);
        setOutputEntry(output.id, (item) => ({
          ...item,
          state: code === 0 || signal === 'SIGTERM' ? 'idle' : 'error',
          error: code === 0 || signal === 'SIGTERM'
            ? null
            : `NDI helper exited unexpectedly with code ${code ?? 'null'}${signal ? ` and signal ${signal}` : ''}.`,
        }));
      });
    } catch (error) {
      processes.delete(output.id);
      setOutputEntry(output.id, (item) => ({
        ...item,
        state: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
    }

    return summary;
  };

  const reconcile = (rawSettings?: PersistedOutputSettings | null) => {
    refreshAvailability();
    const settings = sanitizeOutputSettings(rawSettings);
    const outputs = getNdiOutputs(settings);
    const outputIds = new Set(outputs.map((output) => output.id));

    for (const outputId of processes.keys()) {
      if (!outputIds.has(outputId)) {
        stopProcess(outputId);
      }
    }

    summary = {
      ...summary,
      outputs: outputs.map((output) => {
        const existing = summary.outputs.find((entry) => entry.outputId === output.id);
        const next = toRuntimeEntry(output, summary.helperAvailable, summary.helperPath);
        if (!summary.helperAvailable) return next;
        return {
          ...next,
          state: processes.has(output.id) ? existing?.state ?? 'live' : 'idle',
          lastStartedAt: processes.has(output.id) ? existing?.lastStartedAt ?? null : null,
          error: processes.has(output.id) ? existing?.error ?? null : null,
        };
      }),
    };
    outputs.forEach((output) => {
      if (!summary.helperAvailable) return;
      const current = processes.get(output.id);
      if (!current || current.configKey !== getOutputConfigKey(output) || current.child.killed) {
        startProcessForOutput(output);
      }
    });
    return summary;
  };

  const startOutput = (outputId: string, rawSettings?: PersistedOutputSettings | null) => {
    const settings = sanitizeOutputSettings(rawSettings);
    const output = getNdiOutputs(settings).find((item) => item.id === outputId);
    if (!output) {
      stopProcess(outputId);
      summary = {
        ...summary,
        outputs: summary.outputs.filter((entry) => entry.outputId !== outputId),
      };
      return summary;
    }
    startProcessForOutput(output);
    return summary;
  };

  const stopOutput = (outputId: string) => {
    stopProcess(outputId);
    summary = {
      ...summary,
      outputs: summary.outputs.map((entry) => (
        entry.outputId === outputId
          ? { ...entry, state: summary.helperAvailable ? 'idle' : 'unavailable', error: null }
          : entry
      )),
    };
    return summary;
  };

  const getSummary = () => {
    refreshAvailability();
    return summary;
  };

  const sendVideoFrame = (outputId: string, bitmap: Buffer) => {
    const runtime = processes.get(outputId);
    if (!runtime || runtime.child.killed || !runtime.child.stdin || !runtime.acceptingFrames) return false;
    runtime.acceptingFrames = runtime.child.stdin.write(bitmap);
    return true;
  };

  const shutdown = () => {
    for (const outputId of [...processes.keys()]) {
      stopProcess(outputId);
    }
    summary = {
      ...summary,
      outputs: summary.outputs.map((entry) => ({
        ...entry,
        state: summary.helperAvailable ? 'idle' : 'unavailable',
        error: null,
      })),
    };
  };

  return {
    reconcile,
    startOutput,
    stopOutput,
    getSummary,
    sendVideoFrame,
    shutdown,
  };
}

export type NdiRuntimeService = ReturnType<typeof createNdiRuntimeService>;
