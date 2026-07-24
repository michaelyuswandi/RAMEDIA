import { app, BrowserWindow, ipcMain, screen, dialog, nativeImage, protocol, desktopCapturer, session, Menu, shell, type MenuItemConstructorOptions, type MessageBoxOptions } from 'electron';
import path from 'path';
import fs from 'fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { closeDatabase, DATABASE_PATH, db, initDatabase, schema } from './database/index';

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import { resolveEffectiveOutputChannel, sanitizeOutputSettings, type OutputChannel } from '../core/models/outputSettings';
import { createNdiRuntimeService } from './ndi/ndiRuntimeService';
import type { OpenPresetEditorPayload, PresetEditorSavedPayload } from '../core/presets/presetEditorWindow';
import type { OpenWorkspaceWindowPayload, WorkspaceWindowSavedPayload } from '../core/windows/workspaceWindow';
import type { AppMenuCommand } from '../core/windows/appMenu';
import * as bibleManager from './services/bibleManager';
import { setCustomBibleBrainApiKey } from './services/bibleBrainService';
import * as dbBackupService from './services/dbBackupService';
import * as dbCacheService from './services/dbCacheService';
import { aiService } from './services/aiService';
import { runAutoTaggingAndSeedPlaylists } from './services/seedPlaylistService';
import {
  REMOTE_ROLE_PERMISSIONS,
  type RemoteCommand,
  type RemoteCommandResult,
  type RemoteControllerContext,
  type RemoteRole,
  type RemoteRoleSecurity,
  type RemoteSettings,
} from '../core/remote/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ramedia-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require('electron-squirrel-startup')) { // require not available in ESM without createRequire
//   app.quit();
// }

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow: BrowserWindow | null = null;
let webrtcHostWindow: BrowserWindow | null = null;
const outputWindows = new Map<string, BrowserWindow>();
const presetEditorWindows = new Map<string, {
  window: BrowserWindow;
  dirty: boolean;
  allowClose: boolean;
  confirmingClose: boolean;
}>();
const workspaceWindows = new Map<string, {
  window: BrowserWindow;
  dirty: boolean;
  allowClose: boolean;
  confirmingClose: boolean;
}>();
const ndiOutputWindows = new Map<string, { window: BrowserWindow; configKey: string; frameTimer: NodeJS.Timeout }>();
let appSettingsServiceRef: (typeof import('./database/appSettingsService'))['appSettingsService'] | null = null;
let browserOutputServer: http.Server | null = null;
let browserOutputServerPort = 17884;
const browserOutputConnections = new Map<string, Set<ServerResponse<IncomingMessage>>>();
const browserOutputPresence = new Map<string, { lastSeen: string | null; connections: number }>();
const remoteConnections = new Map<string, Set<ServerResponse<IncomingMessage>>>();
const remoteSessions = new Map<string, {
  id: string;
  deviceName: string;
  role: RemoteRole;
  createdAt: string;
  lastSeen: string;
}>();
const processedRemoteCommandIds = new Map<string, number>();
const pendingRemoteCommands = new Map<string, {
  resolve: (result: RemoteCommandResult) => void;
  timer: NodeJS.Timeout;
}>();
let remoteControllerContext: RemoteControllerContext = {
  revision: 0,
  activeSchedule: null,
  currentItem: null,
  selectedItemId: null,
  slides: [],
  currentSlideId: null,
  rundown: [],
};
type WebrtcPeerRecord = {
  peerId: string;
  pairingCode: string;
  clientId: string;
  offer: RTCSessionDescriptionInit;
  answer: RTCSessionDescriptionInit | null;
  browserIce: RTCIceCandidateInit[];
  hostIce: RTCIceCandidateInit[];
  createdAt: number;
  updatedAt: number;
};
const browserOutputWebrtcPeers = new Map<string, WebrtcPeerRecord>();
let activeCaptureSource: {
  sourceId: string;
  sourceName: string;
  sourceType: 'screen' | 'window';
  includeAudio: boolean;
} | null = null;
const ndiRuntimeService = createNdiRuntimeService();
let runtimeShutdownStarted = false;
let applicationQuitApproved = false;
let closeConfirmationInProgress = false;
let presentationState = {
  currentSlide: null as unknown,
  previousSlide: null as unknown,
  nextSlide: null as unknown,
  isBlack: false,
  isClear: false,
  isLogo: false,
  transitionMode: 'fade',
  annotations: {} as Record<string, unknown[]>,
  pointer: {
    enabled: false,
    visible: false,
    x: 0.5,
    y: 0.5,
  },
  liveCapture: {
    active: false,
    sourceType: null as 'screen' | 'window' | 'device' | null,
    sourceId: null as string | null,
    sourceName: null as string | null,
    includeAudio: false,
    startedAt: null as string | null,
    error: null as string | null,
  },
  mediaPlayback: null as unknown,
  manualAlert: null as unknown,
  showName: null as string | null,
  slideIndex: 0,
  totalSlides: 0,
};
let songServiceRef: typeof import('./database/songService').songService | null = null;

app.on('second-instance', () => {
  focusMainWindow();
});

const REMOTE_SETTINGS_KEY = 'remote.settings';

function generateRemoteAccessCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join('');
}

function sanitizeRemoteRole(value: unknown): RemoteRole {
  return value === 'presenter' || value === 'worship-leader' || value === 'operator' || value === 'viewer'
    ? value
    : 'operator';
}

function getRemoteSettings(): RemoteSettings {
  const fallbackSecurity: RemoteRoleSecurity = {
    presenterPin: '1234',
    worshipLeaderPin: '5678',
    viewerPin: '',
    viewerRequirePin: false,
  };
  const fallback: RemoteSettings = {
    enabled: false,
    accessCode: generateRemoteAccessCode(),
    defaultRole: 'operator',
    security: fallbackSecurity,
  };
  const raw = appSettingsServiceRef?.get(REMOTE_SETTINGS_KEY);
  if (!raw) {
    appSettingsServiceRef?.set(REMOTE_SETTINGS_KEY, JSON.stringify(fallback));
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled === true,
      accessCode: typeof parsed?.accessCode === 'string' && parsed.accessCode.length >= 6
        ? parsed.accessCode.toUpperCase()
        : fallback.accessCode,
      defaultRole: sanitizeRemoteRole(parsed?.defaultRole),
      security: {
        presenterPin: typeof parsed?.security?.presenterPin === 'string' ? parsed.security.presenterPin : fallbackSecurity.presenterPin,
        worshipLeaderPin: typeof parsed?.security?.worshipLeaderPin === 'string' ? parsed.security.worshipLeaderPin : fallbackSecurity.worshipLeaderPin,
        viewerPin: typeof parsed?.security?.viewerPin === 'string' ? parsed.security.viewerPin : fallbackSecurity.viewerPin,
        viewerRequirePin: parsed?.security?.viewerRequirePin === true,
      },
    };
  } catch {
    return fallback;
  }
}

function setRemoteSettings(patch: Partial<RemoteSettings>) {
  const current = getRemoteSettings();
  const nextSecurity: RemoteRoleSecurity = patch.security
    ? {
        presenterPin: typeof patch.security.presenterPin === 'string' ? patch.security.presenterPin : current.security.presenterPin,
        worshipLeaderPin: typeof patch.security.worshipLeaderPin === 'string' ? patch.security.worshipLeaderPin : current.security.worshipLeaderPin,
        viewerPin: typeof patch.security.viewerPin === 'string' ? patch.security.viewerPin : current.security.viewerPin,
        viewerRequirePin: typeof patch.security.viewerRequirePin === 'boolean' ? patch.security.viewerRequirePin : current.security.viewerRequirePin,
      }
    : current.security;

  const next: RemoteSettings = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
    accessCode: typeof patch.accessCode === 'string' && patch.accessCode.length >= 6
      ? patch.accessCode.toUpperCase()
      : current.accessCode,
    defaultRole: patch.defaultRole ? sanitizeRemoteRole(patch.defaultRole) : current.defaultRole,
    security: nextSecurity,
  };
  appSettingsServiceRef?.set(REMOTE_SETTINGS_KEY, JSON.stringify(next));
  if (!next.enabled) {
    remoteSessions.clear();
    for (const connections of remoteConnections.values()) connections.forEach((res) => res.end());
    remoteConnections.clear();
  }
  return next;
}

function getRemoteRuntimeSummary() {
  const settings = getRemoteSettings();
  return {
    ...settings,
    isRunning: !!browserOutputServer?.listening,
    port: browserOutputServerPort,
    urls: getBrowserServerUrls().map((base) => `${base}/remote`),
    activeSessions: remoteSessions.size,
    sessions: Array.from(remoteSessions.values()),
  };
}

function getRemoteSession(req: IncomingMessage, requestUrl: URL) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : requestUrl.searchParams.get('token') || '';
  const sessionRecord = remoteSessions.get(token) || null;
  if (sessionRecord) sessionRecord.lastSeen = new Date().toISOString();
  return sessionRecord ? { token, record: sessionRecord } : null;
}

function getRemoteSnapshot(role: RemoteRole) {
  return {
    ...remoteControllerContext,
    currentSlideId: (presentationState.currentSlide as any)?.id || remoteControllerContext.currentSlideId,
    serverName: 'RAMEDIA Controller',
    role,
    permissions: REMOTE_ROLE_PERMISSIONS[role],
    isBlack: presentationState.isBlack,
    isClear: presentationState.isClear,
    isLogo: presentationState.isLogo,
  };
}

function broadcastRemoteState() {
  for (const [token, connections] of remoteConnections.entries()) {
    const sessionRecord = remoteSessions.get(token);
    if (!sessionRecord) {
      connections.forEach((res) => res.end());
      remoteConnections.delete(token);
      continue;
    }
    const payload = getRemoteSnapshot(sessionRecord.role);
    connections.forEach((res) => {
      if (!res.writableEnded) sendSseEvent(res, 'state', payload);
    });
  }
}

function pruneRemoteCommandIds() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, createdAt] of processedRemoteCommandIds.entries()) {
    if (createdAt < cutoff) processedRemoteCommandIds.delete(id);
  }
}

function sendRemoteCommand(command: RemoteCommand) {
  return new Promise<RemoteCommandResult>((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      resolve({ commandId: command.commandId, ok: false, error: 'The RAMEDIA controller window is not ready.' });
      return;
    }
    const timer = setTimeout(() => {
      pendingRemoteCommands.delete(command.commandId);
      resolve({ commandId: command.commandId, ok: false, error: 'The controller did not acknowledge this command.' });
    }, 10000);
    pendingRemoteCommands.set(command.commandId, { resolve, timer });
    mainWindow.webContents.send('sync:event', { channel: 'REMOTE_COMMAND', data: command });
  });
}

const VISUAL_MEDIA_EXTENSIONS = ['mp4', 'webm', 'mov', 'jpg', 'jpeg', 'png'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg'];
const PDF_EXTENSIONS = ['pdf'];

function getBrowserOutputClients(settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined)) {
  return settings.browserClients;
}

function getBrowserClientByPairingCode(pairingCode: string) {
  const settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined);
  return settings.browserClients.find((client) => client.pairingCode === pairingCode.toUpperCase()) || null;
}

function getAssignedOutputForBrowserClient(clientId: string) {
  const settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined);
  return settings.outputs.find((output) => output.browserClientId === clientId) || null;
}

function markBrowserClientPresence(clientId: string) {
  const current = browserOutputPresence.get(clientId);
  browserOutputPresence.set(clientId, {
    lastSeen: new Date().toISOString(),
    connections: current?.connections ?? 0,
  });
}

function setBrowserClientConnections(clientId: string, count: number) {
  const current = browserOutputPresence.get(clientId);
  browserOutputPresence.set(clientId, {
    lastSeen: current?.lastSeen ?? null,
    connections: count,
  });
}

function getBrowserServerUrls() {
  const interfaces = networkInterfaces();
  const urls = new Set<string>([`http://localhost:${browserOutputServerPort}`]);

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry.family === 'IPv4' && !entry.internal) {
        urls.add(`http://${entry.address}:${browserOutputServerPort}`);
      }
    });
  });

  return Array.from(urls);
}

function getBrowserOutputRuntimeSummary(settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined)) {
  const serverUrls = getBrowserServerUrls();
  return {
    isRunning: !!browserOutputServer?.listening,
    port: browserOutputServerPort,
    urls: serverUrls,
    clients: getBrowserOutputClients(settings).map((client) => {
      const presence = browserOutputPresence.get(client.id);
      return {
        id: client.id,
        pairingCode: client.pairingCode,
        isConnected: (presence?.connections ?? 0) > 0,
        activeConnections: presence?.connections ?? 0,
        lastSeen: presence?.lastSeen ?? null,
        url: `${serverUrls[0]}/browser-output/${client.pairingCode}`,
      };
    }),
  };
}

function getBrowserOutputStatePayload(clientId?: string | null) {
  const settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined);
  const assignedOutput = clientId ? resolveEffectiveOutputChannel(settings, getAssignedOutputForBrowserClient(clientId)) : null;
  const outputId = assignedOutput?.id || null;
  return {
    currentSlide: outputId && songServiceRef ? songServiceRef.resolveSlideForOutput(presentationState.currentSlide, outputId) : presentationState.currentSlide,
    previousSlide: outputId && songServiceRef ? songServiceRef.resolveSlideForOutput(presentationState.previousSlide, outputId) : presentationState.previousSlide,
    nextSlide: outputId && songServiceRef ? songServiceRef.resolveSlideForOutput(presentationState.nextSlide, outputId) : presentationState.nextSlide,
    isBlack: presentationState.isBlack,
    isClear: presentationState.isClear,
    isLogo: presentationState.isLogo,
    logoOutput: settings.logoOutput,
    transitionMode: presentationState.transitionMode,
    annotations: presentationState.annotations,
    pointer: presentationState.pointer,
    liveCapture: presentationState.liveCapture,
    mediaPlayback: presentationState.mediaPlayback,
    manualAlert: presentationState.manualAlert,
    role: assignedOutput?.role || 'audience',
    outputName: assignedOutput?.name || null,
    assignedOutput: assignedOutput || null,
  };
}

function sendSseEvent(res: ServerResponse<IncomingMessage>, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastBrowserOutputState() {
  for (const [clientId, connections] of browserOutputConnections.entries()) {
    const payload = getBrowserOutputStatePayload(clientId);
    connections.forEach((res) => {
      if (!res.writableEnded) {
        sendSseEvent(res, 'state', payload);
      }
    });
  }
}

function writeJson(res: ServerResponse<IncomingMessage>, statusCode: number, payload: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: IncomingMessage) {
  return new Promise<any>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function remoteCommandPermission(role: RemoteRole, type: RemoteCommand['type']) {
  const permissions = REMOTE_ROLE_PERMISSIONS[role];
  if (type === 'next-slide' || type === 'previous-slide' || type === 'go-to-slide') return permissions.navigate;
  if (type === 'toggle-black' || type === 'toggle-clear' || type === 'toggle-logo') return permissions.toggles;
  if (type === 'select-item') return permissions.selectItems;
  if (type === 'add-song') return permissions.addSongs;
  return false;
}

async function handleRemoteRequest(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  requestUrl: URL,
  pathParts: string[],
) {
  if (req.method === 'OPTIONS') {
    writeJson(res, 200, { ok: true });
    return;
  }

  const action = pathParts[2] || '';
  const settings = getRemoteSettings();

  if (action === 'public' && req.method === 'GET') {
    writeJson(res, 200, {
      enabled: settings.enabled,
      serverName: 'RAMEDIA Controller',
      accessCodeRequired: true,
      roles: [
        {
          role: 'operator',
          label: 'Operator',
          description: 'Akses penuh kontrol live, library, dan rundown.',
          securityType: 'master_code',
          requireInput: true,
        },
        {
          role: 'presenter',
          label: 'Presenter',
          description: 'Navigasi live dan toggle output, tanpa akses library.',
          securityType: settings.security.presenterPin ? 'pin' : 'open',
          requireInput: Boolean(settings.security.presenterPin),
        },
        {
          role: 'worship-leader',
          label: 'Worship Leader',
          description: 'Navigasi live dan tambah lagu ke rundown.',
          securityType: settings.security.worshipLeaderPin ? 'pin' : 'open',
          requireInput: Boolean(settings.security.worshipLeaderPin),
        },
        {
          role: 'viewer',
          label: 'Viewer',
          description: 'Monitoring live dan rundown (khusus baca).',
          securityType: settings.security.viewerRequirePin ? 'pin' : 'open',
          requireInput: Boolean(settings.security.viewerRequirePin),
        },
      ],
    });
    return;
  }

  if (action === 'pair' && req.method === 'POST') {
    if (!settings.enabled) {
      writeJson(res, 403, { error: 'Remote Control is disabled on the RAMEDIA controller.' });
      return;
    }
    const body = await readJsonBody(req);
    const submittedRole: RemoteRole = sanitizeRemoteRole(body?.role || settings.defaultRole);
    const submittedCode = String(body?.code || '').trim().toUpperCase();
    const submittedPin = String(body?.pin || '').trim();

    // Verification Logic
    let authenticated = false;
    let authError = 'Otentikasi gagal.';

    if (submittedCode && submittedCode === settings.accessCode) {
      // Master Pairing Code grants access to any requested role
      authenticated = true;
    } else if (submittedRole === 'operator') {
      authError = 'Role Operator memerlukan Kode Pairing Utama (Master Code).';
      authenticated = submittedCode === settings.accessCode;
    } else if (submittedRole === 'presenter') {
      if (!settings.security.presenterPin) {
        authenticated = true;
      } else {
        authenticated = submittedPin === settings.security.presenterPin;
        authError = 'PIN Presenter tidak valid.';
      }
    } else if (submittedRole === 'worship-leader') {
      if (!settings.security.worshipLeaderPin) {
        authenticated = true;
      } else {
        authenticated = submittedPin === settings.security.worshipLeaderPin;
        authError = 'PIN Worship Leader tidak valid.';
      }
    } else if (submittedRole === 'viewer') {
      if (!settings.security.viewerRequirePin) {
        authenticated = true;
      } else {
        authenticated = submittedPin === settings.security.viewerPin;
        authError = 'PIN Viewer tidak valid.';
      }
    }

    if (!authenticated) {
      writeJson(res, 401, { error: authError });
      return;
    }

    const token = randomBytes(32).toString('base64url');
    const now = new Date().toISOString();
    const sessionRecord = {
      id: randomBytes(8).toString('hex'),
      deviceName: String(body?.deviceName || 'Web Remote').trim().slice(0, 60) || 'Web Remote',
      role: submittedRole,
      createdAt: now,
      lastSeen: now,
    };
    remoteSessions.set(token, sessionRecord);
    writeJson(res, 200, { token, session: sessionRecord, snapshot: getRemoteSnapshot(sessionRecord.role) });
    return;
  }

  const sessionRecord = getRemoteSession(req, requestUrl);
  if (!settings.enabled || !sessionRecord) {
    writeJson(res, 401, { error: settings.enabled ? 'Remote session is invalid or has been revoked.' : 'Remote Control is disabled.' });
    return;
  }

  if (action === 'state' && req.method === 'GET') {
    writeJson(res, 200, getRemoteSnapshot(sessionRecord.record.role));
    return;
  }

  if (action === 'events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');
    const connections = remoteConnections.get(sessionRecord.token) ?? new Set();
    connections.add(res);
    remoteConnections.set(sessionRecord.token, connections);
    sendSseEvent(res, 'state', getRemoteSnapshot(sessionRecord.record.role));
    const keepAlive = setInterval(() => {
      if (!res.writableEnded) res.write(':keep-alive\n\n');
    }, 15000);
    req.on('close', () => {
      clearInterval(keepAlive);
      const active = remoteConnections.get(sessionRecord.token);
      active?.delete(res);
      if (active?.size === 0) remoteConnections.delete(sessionRecord.token);
      res.end();
    });
    return;
  }

  if (action === 'library' && pathParts[3] === 'songs' && req.method === 'GET') {
    if (!REMOTE_ROLE_PERMISSIONS[sessionRecord.record.role].addSongs) {
      writeJson(res, 403, { error: 'This remote role cannot access the song library.' });
      return;
    }
    const query = requestUrl.searchParams.get('q') || '';
    const offset = Math.max(0, Number(requestUrl.searchParams.get('offset')) || 0);
    const limit = Math.min(50, Math.max(1, Number(requestUrl.searchParams.get('limit')) || 30));
    const page = songServiceRef?.getLibraryPage({ query, offset, limit, searchBy: 'all', sortBy: 'title' });
    writeJson(res, 200, page || { items: [], total: 0, offset, limit });
    return;
  }

  if (action === 'commands' && req.method === 'POST') {
    const body = await readJsonBody(req) as RemoteCommand;
    const commandId = String(body?.commandId || '').trim();
    const type = body?.type;
    if (!commandId || !type) {
      writeJson(res, 400, { error: 'commandId and type are required.' });
      return;
    }
    if (!remoteCommandPermission(sessionRecord.record.role, type)) {
      writeJson(res, 403, { error: 'This remote role cannot perform that action.' });
      return;
    }
    pruneRemoteCommandIds();
    if (processedRemoteCommandIds.has(commandId)) {
      writeJson(res, 200, { ok: true, duplicate: true, revision: remoteControllerContext.revision });
      return;
    }
    if (pendingRemoteCommands.has(commandId)) {
      writeJson(res, 409, { error: 'This command is already being processed.', commandId });
      return;
    }
    const command: RemoteCommand = { commandId, type, payload: body.payload || {} };
    const result = await sendRemoteCommand(command);
    if (!result.ok) {
      writeJson(res, 500, { error: result.error || 'Remote command failed.', commandId });
      return;
    }
    processedRemoteCommandIds.set(commandId, Date.now());
    writeJson(res, 200, { ok: true, commandId, revision: remoteControllerContext.revision });
    return;
  }

  if (action === 'session' && req.method === 'DELETE') {
    remoteSessions.delete(sessionRecord.token);
    remoteConnections.get(sessionRecord.token)?.forEach((connection) => connection.end());
    remoteConnections.delete(sessionRecord.token);
    writeJson(res, 200, { ok: true });
    return;
  }

  writeJson(res, 404, { error: 'Remote route not found.' });
}

function cleanupStaleWebrtcPeers() {
  const now = Date.now();
  for (const [peerId, peer] of browserOutputWebrtcPeers.entries()) {
    if (now - peer.updatedAt > 5 * 60 * 1000) {
      browserOutputWebrtcPeers.delete(peerId);
    }
  }
}

async function handleBrowserOutputWebrtcRequest(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  pathParts: string[],
) {
  cleanupStaleWebrtcPeers();

  if (req.method === 'OPTIONS') {
    writeJson(res, 204, {});
    return;
  }

  const firstParam = pathParts[2]?.toUpperCase();
  const action = pathParts[3];
  if (!firstParam || !action) {
    writeJson(res, 400, { error: 'Missing WebRTC route parameter' });
    return;
  }

  if (action === 'offer' && req.method === 'POST') {
    const client = getBrowserClientByPairingCode(firstParam);
    if (!client) {
      writeJson(res, 404, { error: 'Unknown pairing code' });
      return;
    }

    const body = await readJsonBody(req);
    if (!body?.offer) {
      writeJson(res, 400, { error: 'Missing offer' });
      return;
    }

    const peerId = crypto.randomUUID();
    browserOutputWebrtcPeers.set(peerId, {
      peerId,
      pairingCode: firstParam,
      clientId: client.id,
      offer: body.offer,
      answer: null,
      browserIce: [],
      hostIce: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    ensureWebrtcHostWindow();
    writeJson(res, 200, { peerId });
    return;
  }

  const peer = browserOutputWebrtcPeers.get(firstParam);
  if (!peer) {
    writeJson(res, 404, { error: 'Unknown WebRTC peer' });
    return;
  }

  peer.updatedAt = Date.now();

  if (action === 'answer' && req.method === 'GET') {
    writeJson(res, peer.answer ? 200 : 202, { answer: peer.answer });
    return;
  }

  if (action === 'ice' && pathParts[4] === 'browser' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body?.candidate) {
      peer.browserIce.push(body.candidate);
    }
    writeJson(res, 200, { ok: true, next: peer.browserIce.length });
    return;
  }

  if (action === 'ice' && pathParts[4] === 'host' && req.method === 'GET') {
    const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${browserOutputServerPort}`);
    const after = Math.max(0, Number(requestUrl.searchParams.get('after')) || 0);
    writeJson(res, 200, {
      candidates: peer.hostIce.slice(after),
      next: peer.hostIce.length,
    });
    return;
  }

  writeJson(res, 404, { error: 'Unknown WebRTC action' });
}

function getRendererDistPath() {
  return path.join(__dirname, '../dist');
}

function getAppIconPath() {
  const candidates = [
    path.join(app.getAppPath(), 'dist', 'ramedia-icon.png'),
    path.join(app.getAppPath(), 'public', 'ramedia-icon.png'),
    path.join(__dirname, '../dist/ramedia-icon.png'),
    path.join(__dirname, '../public/ramedia-icon.png'),
    path.join(process.cwd(), 'public', 'ramedia-icon.png'),
    path.join(process.cwd(), 'iconra.png'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function getAppIconImage() {
  const iconPath = getAppIconPath();
  if (!iconPath) return undefined;

  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function showMainMessageBox(options: MessageBoxOptions) {
  if (mainWindow && !mainWindow.isDestroyed()) return dialog.showMessageBox(mainWindow, options);
  return dialog.showMessageBox(options);
}

function sendAppMenuCommand(command: AppMenuCommand) {
  focusMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('appMenu:command', command);
}

function hasDirtyEditorWindows() {
  return [...presetEditorWindows.values(), ...workspaceWindows.values()].some((state) => state.dirty);
}

function hasActiveOutputRuntime() {
  const localOutputIsOpen = [...outputWindows.values()].some((win) => !win.isDestroyed());
  const ndiIsActive = ndiRuntimeService.getSummary().outputs.some((output) => output.state === 'starting' || output.state === 'live');
  const browserOutputIsConnected = [...browserOutputConnections.values()].some((connections) => connections.size > 0);
  return localOutputIsOpen || ndiIsActive || browserOutputIsConnected;
}

async function requestApplicationQuit() {
  if (applicationQuitApproved || closeConfirmationInProgress) return;
  closeConfirmationInProgress = true;
  try {
    console.log('[Lifecycle] Quit requested.', {
      hasDirtyEditors: hasDirtyEditorWindows(),
      hasActiveOutput: hasActiveOutputRuntime(),
    });
    if (hasDirtyEditorWindows()) {
      await showMainMessageBox({
        type: 'warning',
        title: 'Unsaved changes',
        message: 'RAMEDIA still has an editor with unsaved changes.',
        detail: 'Save or close the editor before exiting RAMEDIA.',
        buttons: ['Return to RAMEDIA'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      const dirtyState = [...presetEditorWindows.values(), ...workspaceWindows.values()].find((state) => state.dirty);
      if (dirtyState && !dirtyState.window.isDestroyed()) {
        if (dirtyState.window.isMinimized()) dirtyState.window.restore();
        dirtyState.window.show();
        dirtyState.window.focus();
      }
      return;
    }

    if (hasActiveOutputRuntime()) {
      const result = await showMainMessageBox({
        type: 'warning',
        title: 'Output is still live',
        message: 'Quit RAMEDIA while an output is still active?',
        detail: 'Local display, browser, and NDI outputs will stop immediately.',
        buttons: ['Cancel', 'Quit RAMEDIA'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (result.response !== 1) return;
    }

    applicationQuitApproved = true;
    app.quit();
  } finally {
    closeConfirmationInProgress = false;
  }
}

function updateApplicationMenuState() {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  const outputState = getOutputStateSummary();
  const openItem = menu.getMenuItemById('output-open');
  const closeItem = menu.getMenuItemById('output-close');
  const blackItem = menu.getMenuItemById('output-black');
  const clearItem = menu.getMenuItemById('output-clear');
  const logoItem = menu.getMenuItemById('output-logo');
  if (openItem) openItem.enabled = outputState.totalLocalOutputs > 0 && !outputState.isOpen;
  if (closeItem) closeItem.enabled = outputState.isOpen;
  if (blackItem) blackItem.checked = presentationState.isBlack;
  if (clearItem) clearItem.checked = presentationState.isClear;
  if (logoItem) logoItem.checked = presentationState.isLogo;
}

async function showBackupResult() {
  const result = await dbBackupService.backupToZip(mainWindow);
  if (!result.success || !result.filePath) return;
  await showMainMessageBox({
    type: 'info',
    title: 'Backup complete',
    message: 'RAMEDIA backup was created successfully.',
    detail: result.filePath,
    buttons: ['OK'],
    defaultId: 0,
    noLink: true,
  });
}

async function confirmAndRestoreBackup() {
  const confirmation = await showMainMessageBox({
    type: 'warning',
    title: 'Restore RAMEDIA backup',
    message: 'Restore a backup and replace the current local data?',
    detail: 'RAMEDIA will relaunch after the restore completes.',
    buttons: ['Cancel', 'Choose Backup…'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (confirmation.response === 1) await dbBackupService.restoreFromZip(mainWindow);
}

function buildApplicationMenu() {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{
      label: 'RAMEDIA',
      submenu: [
        { label: 'About RAMEDIA', click: () => showAboutDialog() },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { label: 'Quit RAMEDIA', click: () => void requestApplicationQuit() },
      ],
    }] : []),
    {
      label: '&File',
      submenu: [
        { label: '&Settings…', accelerator: 'CmdOrCtrl+,', click: () => openWorkspaceWindow({ kind: 'settings' }) },
        { type: 'separator' },
        { label: '&Backup Database…', accelerator: 'CmdOrCtrl+Shift+B', click: () => void showBackupResult() },
        { label: '&Restore Database…', click: () => void confirmAndRestoreBackup() },
        { type: 'separator' },
        ...(process.platform === 'darwin' ? [] : [
          { label: 'E&xit', click: () => void requestApplicationQuit() },
        ]),
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '&View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: 'F11' },
      ],
    },
    {
      label: '&Output',
      submenu: [
        { id: 'output-open', label: '&Open Output Windows', accelerator: 'CmdOrCtrl+Shift+O', click: () => { openConfiguredOutputWindows(); updateApplicationMenuState(); } },
        { id: 'output-close', label: '&Close Output Windows', accelerator: 'CmdOrCtrl+Shift+Alt+O', click: () => { closeAllOutputWindows(); updateApplicationMenuState(); } },
        { type: 'separator' },
        { id: 'output-black', type: 'checkbox', label: 'Toggle &Black Screen', accelerator: 'CmdOrCtrl+Shift+K', click: () => sendAppMenuCommand('toggle-black') },
        { id: 'output-clear', type: 'checkbox', label: 'Toggle &Clear Text', accelerator: 'CmdOrCtrl+Shift+C', click: () => sendAppMenuCommand('toggle-clear') },
        { id: 'output-logo', type: 'checkbox', label: 'Toggle &Logo Output', accelerator: 'CmdOrCtrl+Shift+L', click: () => sendAppMenuCommand('toggle-logo') },
      ],
    },
    {
      role: 'help',
      label: '&Help',
      submenu: [
        { label: 'Open &Logs Folder', click: () => void shell.openPath(app.getPath('logs')) },
        { type: 'separator' },
        { label: '&About RAMEDIA', click: () => showAboutDialog() },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  updateApplicationMenuState();
}

function showAboutDialog() {
  void showMainMessageBox({
    type: 'info',
    title: 'About RAMEDIA',
    message: `RAMEDIA ${app.getVersion()}`,
    detail: `Church presentation and media controller\n\nDatabase: ${DATABASE_PATH}`,
    buttons: ['OK'],
    defaultId: 0,
    noLink: true,
  });
}

function getMimeType(targetPath: string) {
  const ext = path.extname(targetPath).toLowerCase();
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.mjs') return 'application/javascript; charset=utf-8';
  return 'text/html; charset=utf-8';
}

async function proxyDevRenderer(res: ServerResponse<IncomingMessage>, pathname: string, search: string) {
  const target = new URL(`${pathname}${search}`, process.env.VITE_DEV_SERVER_URL!);
  const response = await fetch(target);
  res.writeHead(response.status, {
    'Content-Type': response.headers.get('content-type') || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

function normalizeRendererAssetPath(pathname: string) {
  const assetIndex = pathname.indexOf('/assets/');
  if (assetIndex > 0) return pathname.slice(assetIndex);
  return pathname;
}

function serveBuiltRenderer(res: ServerResponse<IncomingMessage>, pathname: string) {
  const distRoot = getRendererDistPath();
  const normalizedPathname = normalizeRendererAssetPath(pathname);
  const safePath = path.normalize(path.join(distRoot, normalizedPathname === '/' ? '/index.html' : normalizedPathname));
  if (!safePath.startsWith(distRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const targetPath = fs.existsSync(safePath) && fs.statSync(safePath).isFile()
    ? safePath
    : path.join(distRoot, 'index.html');

  if (normalizedPathname.startsWith('/assets/') && targetPath.endsWith('index.html')) {
    res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('Asset not found');
    return;
  }

  let body = fs.readFileSync(targetPath);
  if (targetPath.endsWith('index.html')) {
    body = Buffer.from(
      body
        .toString('utf8')
        .replace(/src="\.\/assets\//g, 'src="/assets/')
        .replace(/href="\.\/assets\//g, 'href="/assets/'),
      'utf8',
    );
  }

  res.writeHead(200, { 'Content-Type': getMimeType(targetPath), 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveMediaFileRequest(req: IncomingMessage, res: ServerResponse<IncomingMessage>, source: string | null) {
  if (!source) {
    res.writeHead(400, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('Missing media source');
    return;
  }

  const targetPath = toPhysicalPath(source);
  if (!targetPath || !fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('Media not found');
    return;
  }

  const stat = fs.statSync(targetPath);
  const contentType = getMimeType(targetPath);
  const range = req.headers.range;
  const byteRange = getMediaRange(range, stat.size);

  if (range && !byteRange) {
    res.writeHead(416, {
      'Content-Range': `bytes */${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }

  if (byteRange) {
    res.writeHead(206, {
      'Content-Type': contentType,
      'Content-Length': String(byteRange.end - byteRange.start + 1),
      'Content-Range': `bytes ${byteRange.start}-${byteRange.end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(targetPath, { start: byteRange.start, end: byteRange.end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': String(stat.size),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(targetPath).pipe(res);
}

function getMediaRecord(mediaId: string) {
  return db.select().from(schema.media).where(eq(schema.media.id, mediaId)).get();
}

function getPdfPageSource(media: { filepath: string; playbackSettings?: string | null }, pageNumber: number) {
  const parsed = parsePlaybackSettings(media.playbackSettings);
  const pageUrls = Array.isArray(parsed.pageUrls) ? parsed.pageUrls : [];
  return typeof pageUrls[pageNumber - 1] === 'string' && pageUrls[pageNumber - 1]
    ? pageUrls[pageNumber - 1]
    : media.filepath;
}

function serveMediaByIdRequest(req: IncomingMessage, res: ServerResponse<IncomingMessage>, pathParts: string[]) {
  const mediaId = pathParts[2];
  const action = pathParts[3];
  if (!mediaId || !action) {
    res.writeHead(400, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('Missing media id or action');
    return;
  }

  const media = getMediaRecord(mediaId);
  if (!media) {
    res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('Media not found');
    return;
  }

  if (action === 'stream') {
    serveMediaFileRequest(req, res, media.filepath);
    return;
  }

  if (action === 'thumbnail') {
    serveMediaFileRequest(req, res, media.thumbnail || media.filepath);
    return;
  }

  if (action === 'pdf-page') {
    const pageNumber = Math.max(1, Number(pathParts[4]) || 1);
    serveMediaFileRequest(req, res, getPdfPageSource(media, pageNumber));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
  res.end('Unknown media action');
}

function handleBrowserOutputRequest(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${browserOutputServerPort}`);
  const pathParts = requestUrl.pathname.split('/').filter(Boolean);

  if (requestUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (pathParts[0] === 'api' && pathParts[1] === 'remote') {
    void handleRemoteRequest(req, res, requestUrl, pathParts).catch((error) => {
      console.error('[Main] Remote request failed:', error);
      if (!res.headersSent) writeJson(res, 500, { error: 'Remote request failed.' });
      else res.end();
    });
    return;
  }

  if (pathParts[0] === 'api' && pathParts[1] === 'media-file') {
    serveMediaFileRequest(req, res, requestUrl.searchParams.get('src'));
    return;
  }

  if (pathParts[0] === 'api' && pathParts[1] === 'media') {
    serveMediaByIdRequest(req, res, pathParts);
    return;
  }

  if (pathParts[0] === 'api' && pathParts[1] === 'webrtc') {
    void handleBrowserOutputWebrtcRequest(req, res, pathParts).catch((error) => {
      console.error('[Main] Browser output WebRTC request failed:', error);
      if (!res.headersSent) {
        writeJson(res, 500, { error: 'WebRTC request failed' });
      } else {
        res.end();
      }
    });
    return;
  }

  if (pathParts[0] !== 'api' || pathParts[1] !== 'browser-output' || !pathParts[2]) {
    const rendererPathname = normalizeRendererAssetPath(requestUrl.pathname);
    if (process.env.VITE_DEV_SERVER_URL) {
      void proxyDevRenderer(res, rendererPathname, requestUrl.search);
      return;
    }
    serveBuiltRenderer(res, rendererPathname);
    return;
  }

  const pairingCode = pathParts[2].toUpperCase();
  const client = getBrowserClientByPairingCode(pairingCode);
  if (!client) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Unknown pairing code');
    return;
  }

  markBrowserClientPresence(client.id);

  if (pathParts[3] === 'state') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(getBrowserOutputStatePayload(client.id)));
    return;
  }

  if (pathParts[3] === 'events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');

    const clientConnections = browserOutputConnections.get(client.id) ?? new Set();
    clientConnections.add(res);
    browserOutputConnections.set(client.id, clientConnections);
    setBrowserClientConnections(client.id, clientConnections.size);
    sendSseEvent(res, 'state', getBrowserOutputStatePayload(client.id));

    const keepAlive = setInterval(() => {
      if (!res.writableEnded) {
        res.write(':keep-alive\n\n');
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      const connections = browserOutputConnections.get(client.id);
      connections?.delete(res);
      setBrowserClientConnections(client.id, connections?.size ?? 0);
      if (connections && connections.size === 0) {
        browserOutputConnections.delete(client.id);
      }
      res.end();
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

function ensureBrowserOutputServer() {
  if (browserOutputServer?.listening) return;

  browserOutputServer = http.createServer(handleBrowserOutputRequest);
  browserOutputServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      browserOutputServerPort += 1;
      browserOutputServer?.close();
      browserOutputServer = null;
      ensureBrowserOutputServer();
      return;
    }
    console.error('[Main] Browser output server error:', error);
  });
  browserOutputServer.listen(browserOutputServerPort, '0.0.0.0');
}

function getElectronOutputChannels(settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined)) {
  return settings.outputs
    .filter((output) => output.enabled && output.targetType === 'electron-display')
    .map((output) => resolveEffectiveOutputChannel(settings, output) || output);
}

function getNdiOutputChannels(settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined)) {
  return settings.outputs
    .filter((output) => output.enabled && output.targetType === 'ndi')
    .map((output) => resolveEffectiveOutputChannel(settings, output) || output);
}

function getOutputRoute(output: OutputChannel) {
  const params = new URLSearchParams({
    outputId: output.id,
    role: output.role,
    name: output.name,
  });
  return `/output?${params.toString()}`;
}

function getDisplayForOutput(output: OutputChannel) {
  const displays = screen.getAllDisplays();
  return (
    (output.targetDisplayId
      ? displays.find((display) => String(display.id) === String(output.targetDisplayId))
      : null)
    ?? screen.getPrimaryDisplay()
  );
}

function getPresentationSnapshotForOutput(outputId?: string | null) {
  if (!outputId || !songServiceRef) return presentationState;
  return {
    ...presentationState,
    currentSlide: songServiceRef.resolveSlideForOutput(presentationState.currentSlide, outputId),
    previousSlide: songServiceRef.resolveSlideForOutput(presentationState.previousSlide, outputId),
    nextSlide: songServiceRef.resolveSlideForOutput(presentationState.nextSlide, outputId),
  };
}

function getOutputSyncData(data: any, outputId: string) {
  if (data?.type === 'SLIDE_CHANGE') {
    return { ...data, payload: songServiceRef ? songServiceRef.resolveSlideForOutput(data.payload, outputId) : data.payload };
  }
  if (data?.type === 'STATE_SNAPSHOT') {
    return { ...data, payload: getPresentationSnapshotForOutput(outputId) };
  }
  return data;
}

function sendPresentationSnapshot(targetWindow: BrowserWindow, outputId?: string | null) {
  if (targetWindow.isDestroyed()) return;
  targetWindow.webContents.send('sync:event', {
    channel: 'STATE_UPDATE',
    data: { type: 'STATE_SNAPSHOT', payload: getPresentationSnapshotForOutput(outputId) },
  });
}

function getOutputStateSummary(settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined)) {
  const localOutputs = getElectronOutputChannels(settings);
  const windows = localOutputs
    .map((output) => outputWindows.get(output.id))
    .filter((win): win is BrowserWindow => !!win && !win.isDestroyed());
  return {
    isOpen: windows.length > 0,
    isFullscreen: windows.length > 0 && windows.every((win) => win.isFullScreen()),
    openCount: windows.length,
    totalLocalOutputs: localOutputs.length,
  };
}

function createOutputWindowForChannel(output: OutputChannel) {
  const targetDisplay = getDisplayForOutput(output);
  const outputSettings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined);
  const existingWindow = outputWindows.get(output.id);

  if (existingWindow && !existingWindow.isDestroyed()) {
    // Hanya panggil showInactive jika jendela tidak terlihat
    if (!existingWindow.isVisible()) {
      existingWindow.showInactive();
    }

    // Hanya panggil setFullScreen jika statusnya berubah
    if (existingWindow.isFullScreen() !== output.autoFullscreen) {
      existingWindow.setFullScreen(output.autoFullscreen);
    }

    // Hanya update bounds jika tidak fullscreen dan posisi berubah
    // (saat fullscreen, bounds diatur otomatis oleh sistem)
    if (!output.autoFullscreen) {
      const currentBounds = existingWindow.getBounds();
      if (
        currentBounds.x !== targetDisplay.bounds.x ||
        currentBounds.y !== targetDisplay.bounds.y ||
        currentBounds.width !== targetDisplay.bounds.width ||
        currentBounds.height !== targetDisplay.bounds.height
      ) {
        existingWindow.setBounds(targetDisplay.bounds);
      }
    }
    
    return existingWindow;
  }

  const win = new BrowserWindow({
    title: `RAMEDIA Output - ${output.name}`,
    icon: getAppIconImage(),
    width: targetDisplay.bounds.width || outputSettings.outputWidth,
    height: targetDisplay.bounds.height || outputSettings.outputHeight,
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    fullscreen: output.autoFullscreen,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  outputWindows.set(output.id, win);
  const outputRoute = getOutputRoute(output);

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(getRendererUrl(outputRoute));
  } else {
    win.loadFile(getRendererUrl('/output'), { hash: outputRoute });
  }

  win.once('ready-to-show', () => {
    win.showInactive();
    win.setBounds(targetDisplay.bounds);
    win.setFullScreen(output.autoFullscreen);
    sendPresentationSnapshot(win, output.id);
  });

  win.on('closed', () => {
    outputWindows.delete(output.id);
    updateApplicationMenuState();
  });

  return win;
}

function openConfiguredOutputWindows(options?: { onlyAutoOpen?: boolean; focus?: boolean }) {
  const settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined);
  const targets = getElectronOutputChannels(settings).filter((output) => !options?.onlyAutoOpen || output.autoOpenOnGoLive);
  targets.forEach((output) => {
    createOutputWindowForChannel(output);
  });
  presentationState = {
    ...presentationState,
    isBlack: false,
  };
  broadcastBrowserOutputState();
  broadcastRemoteState();
  updateApplicationMenuState();
  return getOutputStateSummary(settings);
}

function hasOpenLocalOutputWindows(settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined)) {
  return getElectronOutputChannels(settings).some((output) => {
    const win = outputWindows.get(output.id);
    return !!win && !win.isDestroyed();
  });
}

function closeAllOutputWindows() {
  for (const win of outputWindows.values()) {
    if (!win.isDestroyed()) {
      win.close();
    }
  }
  outputWindows.clear();
  presentationState = {
    ...presentationState,
    isBlack: true,
  };
  broadcastBrowserOutputState();
  broadcastRemoteState();
  updateApplicationMenuState();
  return true;
}

function toggleAllOutputWindowsFullscreen() {
  const settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined);
  const localOutputs = getElectronOutputChannels(settings);
  if (localOutputs.length === 0) return false;

  const windows = localOutputs.map((output) => outputWindows.get(output.id)).filter((win): win is BrowserWindow => !!win && !win.isDestroyed());
  if (windows.length === 0) {
    openConfiguredOutputWindows();
    return true;
  }

  const nextFullscreen = !windows.every((win) => win.isFullScreen());
  windows.forEach((win) => win.setFullScreen(nextFullscreen));
  return nextFullscreen;
}

function reconcileOutputWindows(settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined)) {
  const activeOutputs = new Map(getElectronOutputChannels(settings).map((output) => [output.id, output]));

  for (const [outputId, win] of outputWindows.entries()) {
    const output = activeOutputs.get(outputId);
    if (!output || win.isDestroyed()) {
      if (!win.isDestroyed()) win.close();
      outputWindows.delete(outputId);
      continue;
    }

    const targetDisplay = getDisplayForOutput(output);
    win.setBounds(targetDisplay.bounds);
    win.setFullScreen(output.autoFullscreen);
  }

  reconcileNdiOutputWindows(settings);
}

function getNdiRendererConfigKey(output: OutputChannel) {
  return JSON.stringify({
    resolution: output.ndiConfig.resolution,
    fps: output.ndiConfig.fps,
    alphaEnabled: output.ndiConfig.alphaEnabled,
    role: output.role,
    renderMode: output.renderMode,
    layoutType: output.layoutType,
  });
}

function closeNdiOutputWindow(outputId: string) {
  const runtime = ndiOutputWindows.get(outputId);
  ndiOutputWindows.delete(outputId);
  if (runtime) {
    clearInterval(runtime.frameTimer);
    if (!runtime.window.isDestroyed()) runtime.window.destroy();
  }
}

function createNdiOutputWindow(output: OutputChannel) {
  const width = output.ndiConfig.resolution === '720p' ? 1280 : 1920;
  const height = output.ndiConfig.resolution === '720p' ? 720 : 1080;
  const configKey = getNdiRendererConfigKey(output);
  const existing = ndiOutputWindows.get(output.id);
  if (existing && !existing.window.isDestroyed() && existing.configKey === configKey) return existing.window;
  if (existing) closeNdiOutputWindow(output.id);

  const win = new BrowserWindow({
    title: `RAMEDIA NDI Renderer - ${output.name}`,
    width,
    height,
    show: false,
    transparent: output.ndiConfig.alphaEnabled,
    backgroundColor: output.ndiConfig.alphaEnabled ? '#00000000' : '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      offscreen: true,
      backgroundThrottling: false,
    },
  });

  const frameTimer = setInterval(() => {
    if (!win.isDestroyed()) win.webContents.invalidate();
  }, Math.max(1, Math.round(1000 / output.ndiConfig.fps)));
  ndiOutputWindows.set(output.id, { window: win, configKey, frameTimer });
  win.webContents.setFrameRate(output.ndiConfig.fps);
  win.webContents.on('paint', (_event, _dirtyRect, image) => {
    if (image.isEmpty()) return;
    const size = image.getSize();
    const frame = size.width === width && size.height === height
      ? image
      : image.resize({ width, height, quality: 'best' });
    ndiRuntimeService.sendVideoFrame(output.id, frame.toBitmap());
  });
  win.webContents.once('did-finish-load', () => {
    sendPresentationSnapshot(win, output.id);
    win.webContents.invalidate();
  });
  win.on('closed', () => {
    const active = ndiOutputWindows.get(output.id);
    if (active?.window === win) {
      clearInterval(active.frameTimer);
      ndiOutputWindows.delete(output.id);
    }
  });

  const outputRoute = getOutputRoute(output);
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(getRendererUrl(outputRoute));
  } else {
    win.loadFile(getRendererUrl('/output'), { hash: outputRoute });
  }
  return win;
}

function reconcileNdiOutputWindows(settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined)) {
  const outputs = getNdiOutputChannels(settings);
  const activeIds = new Set(outputs.map((output) => output.id));
  for (const outputId of ndiOutputWindows.keys()) {
    if (!activeIds.has(outputId)) closeNdiOutputWindow(outputId);
  }

  ndiRuntimeService.reconcile(settings);
  if (!ndiRuntimeService.getSummary().helperAvailable) return;
  outputs.forEach(createNdiOutputWindow);
}

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function emptyLiveCaptureState() {
  return {
    active: false,
    sourceType: null,
    sourceId: null,
    sourceName: null,
    includeAudio: false,
    startedAt: null,
    error: null,
  };
}

function getCaptureSourceType(sourceId: string): 'screen' | 'window' {
  return sourceId.startsWith('screen:') ? 'screen' : 'window';
}

async function listCaptureSources() {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 360, height: 210 },
    fetchWindowIcons: true,
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    type: getCaptureSourceType(source.id),
    displayId: source.display_id,
    thumbnail: source.thumbnail.isEmpty() ? null : source.thumbnail.toDataURL(),
  }));
}

async function resolveActiveDisplayMediaSource() {
  if (!activeCaptureSource) return null;

  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 1, height: 1 },
  });

  return sources.find((source) => source.id === activeCaptureSource?.sourceId) ?? null;
}

function parsePlaybackSettings(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, any>;
    }
  } catch (error) {
    console.error('[Main] Failed to parse playback settings:', error);
  }

  return {};
}

function toPhysicalPath(source?: string | null) {
  if (!source) return '';

  try {
    return source.startsWith('file://') ? fileURLToPath(source) : source;
  } catch {
    return source.replace(/^file:\/\//, '');
  }
}

function getMediaRange(range: string | null | undefined, size: number) {
  if (!range) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;

  if (!match[1] && match[2]) {
    const suffixLength = Math.max(0, Number(match[2]) || 0);
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size) return null;

  const safeStart = Math.max(0, Math.min(start, size - 1));
  const safeEnd = Math.max(safeStart, Math.min(end, size - 1));
  return { start: safeStart, end: safeEnd };
}

function createMediaFileResponse(source: string | null, range: string | null | undefined) {
  if (!source) {
    return new Response('Missing media source', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const targetPath = toPhysicalPath(source);
  if (!targetPath || !fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    return new Response('Media not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const stat = fs.statSync(targetPath);
  const contentType = getMimeType(targetPath);
  const byteRange = getMediaRange(range, stat.size);

  if (range && !byteRange) {
    return new Response('Requested range not satisfiable', {
      status: 416,
      headers: {
        'Content-Range': `bytes */${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    });
  }

  if (byteRange) {
    const body = Readable.toWeb(fs.createReadStream(targetPath, { start: byteRange.start, end: byteRange.end })) as BodyInit;
    return new Response(body, {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(byteRange.end - byteRange.start + 1),
        'Content-Range': `bytes ${byteRange.start}-${byteRange.end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    });
  }

  const body = Readable.toWeb(fs.createReadStream(targetPath)) as BodyInit;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    },
  });
}

function collectPdfDerivedPaths(media: { id: string; filepath: string; thumbnail?: string | null; playbackSettings?: string | null }) {
  const parsed = parsePlaybackSettings(media.playbackSettings);
  const paths = new Set<string>();

  if (media.filepath) {
    paths.add(toPhysicalPath(media.filepath));
  }

  if (media.thumbnail) {
    paths.add(toPhysicalPath(media.thumbnail));
  }

  if (Array.isArray(parsed.pageUrls)) {
    for (const pageUrl of parsed.pageUrls) {
      if (typeof pageUrl === 'string' && pageUrl) {
        paths.add(toPhysicalPath(pageUrl));
      }
    }
  }

  if (typeof parsed.cacheDir === 'string' && parsed.cacheDir) {
    paths.add(parsed.cacheDir);
  }

  return Array.from(paths).filter(Boolean);
}

function deleteFileIfExists(targetPath: string) {
  if (!targetPath) return 0;

  try {
    if (!fs.existsSync(targetPath)) return 0;
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) return 0;
    fs.unlinkSync(targetPath);
    return stat.size;
  } catch (error) {
    console.error('[Main] Failed to delete file:', targetPath, error);
    return 0;
  }
}

function deleteDirectoryIfExists(targetPath: string) {
  if (!targetPath) return 0;

  try {
    if (!fs.existsSync(targetPath)) return 0;
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) return 0;

    let deletedBytes = 0;
    for (const entry of fs.readdirSync(targetPath)) {
      const entryPath = path.join(targetPath, entry);
      const entryStat = fs.statSync(entryPath);
      if (entryStat.isDirectory()) {
        deletedBytes += deleteDirectoryIfExists(entryPath);
      } else {
        deletedBytes += entryStat.size;
      }
    }

    fs.rmSync(targetPath, { recursive: true, force: true });
    return deletedBytes;
  } catch (error) {
    console.error('[Main] Failed to delete directory:', targetPath, error);
    return 0;
  }
}

function persistCompiledPdf(payload: { id?: string; filename: string; buffers: ArrayBuffer[]; width: number; height: number }, mediaService: { create: (data: any) => string; getById: (id: string) => any; update: (id: string, data: any) => void }) {
  const id = payload.id || crypto.randomUUID();
  const basePath = app.getPath('userData');
  const pdfDirName = `pdf_compiled_${id}`;
  const pdfDirPath = path.join(basePath, 'assets_documents', pdfDirName);
  const thumbnailsDir = path.join(basePath, 'thumbnails');

  if (fs.existsSync(pdfDirPath)) {
    fs.rmSync(pdfDirPath, { recursive: true, force: true });
  }

  fs.mkdirSync(pdfDirPath, { recursive: true });
  fs.mkdirSync(thumbnailsDir, { recursive: true });

  const pageUrls: string[] = [];
  payload.buffers.forEach((buffer, index) => {
    const pageFile = `page-${index + 1}.jpg`;
    const destPath = path.join(pdfDirPath, pageFile);
    fs.writeFileSync(destPath, Buffer.from(buffer));
    pageUrls.push(pathToFileURL(destPath).href);
  });

  let thumbnailPath = '';
  if (pageUrls.length > 0) {
    const thumbFilename = `thumb-${id}.jpg`;
    const thumbDest = path.join(thumbnailsDir, thumbFilename);
    fs.copyFileSync(path.join(pdfDirPath, 'page-1.jpg'), thumbDest);
    thumbnailPath = pathToFileURL(thumbDest).href;
  }

  const record = {
    id,
    filename: payload.filename,
    filepath: pageUrls[0] || '',
    mediaType: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 0,
    width: payload.width,
    height: payload.height,
    tags: '[]',
    thumbnail: thumbnailPath,
    playbackSettings: JSON.stringify({
      pageCount: pageUrls.length,
      aspectRatio: payload.width / payload.height,
      pageWidth: payload.width,
      pageHeight: payload.height,
      pageUrls,
      cacheDir: pdfDirPath,
    }),
  };

  if (payload.id && mediaService.getById(payload.id)) {
    const previous = mediaService.getById(payload.id);
    if (previous) {
      const previousPaths = collectPdfDerivedPaths(previous);
      for (const entry of previousPaths) {
        if (entry !== pdfDirPath && entry !== path.join(thumbnailsDir, `thumb-${id}.jpg`)) {
          if (fs.existsSync(entry) && fs.statSync(entry).isDirectory()) {
            deleteDirectoryIfExists(entry);
          } else {
            deleteFileIfExists(entry);
          }
        }
      }
    }
    mediaService.update(payload.id, record);
    return mediaService.getById(payload.id);
  }

  mediaService.create(record);
  return record;
}

async function importManagedAssets(options: {
  window: BrowserWindow;
  filterName: string;
  extensions: string[];
  targetDirName: string;
  sourcePaths?: string[];
  persist: (record: Record<string, any>) => string;
  createRecord: (args: {
    sourcePath: string;
    destPath: string;
    ext: string;
    assetUrl: string;
    fileSize: number;
    thumbnailsDir: string;
  }) => Promise<Record<string, any>>;
}) {
  let filePaths = options.sourcePaths || null;

  if (!filePaths) {
    const result = await dialog.showOpenDialog(options.window, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: options.filterName, extensions: options.extensions },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    filePaths = result.filePaths;
  }

  const allowedExtensions = new Set(options.extensions.map((extension) => `.${extension.toLowerCase()}`));
  filePaths = filePaths.filter((sourcePath) => allowedExtensions.has(path.extname(sourcePath).toLowerCase()));
  if (filePaths.length === 0) return null;

  const targetDir = path.join(app.getPath('userData'), options.targetDirName);
  const thumbnailsDir = path.join(app.getPath('userData'), 'thumbnails');

  ensureDirectory(targetDir);
  ensureDirectory(thumbnailsDir);

  const importedAssets = [];
  for (const sourcePath of filePaths) {
    const ext = path.extname(sourcePath).toLowerCase();
    const filename = path.basename(sourcePath, ext);
    const uniqueFilename = `${filename}-${crypto.randomUUID()}${ext}`;
    const destPath = path.join(targetDir, uniqueFilename);

    fs.copyFileSync(sourcePath, destPath);
    const stats = fs.statSync(destPath);
    const assetUrl = pathToFileURL(destPath).href;

    const record = await options.createRecord({
      sourcePath,
      destPath,
      ext,
      assetUrl,
      fileSize: stats.size,
      thumbnailsDir,
    });

    const id = options.persist(record);
    importedAssets.push({ ...record, id });
  }

  return importedAssets;
}

async function readPdfMetadata(filePath: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = path.join(app.getAppPath(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  const data = new Uint8Array(fs.readFileSync(filePath));
  const document = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  } as any).promise;

  let pageWidth = 0;
  let pageHeight = 0;

  if (document.numPages > 0) {
    const firstPage = await document.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    pageWidth = Math.round(viewport.width);
    pageHeight = Math.round(viewport.height);
  }

  await document.destroy();

  return {
    pageCount: document.numPages,
    pageWidth,
    pageHeight,
    aspectRatio: pageWidth > 0 && pageHeight > 0 ? pageWidth / pageHeight : null,
  };
}

function deleteManagedMedia(id: string, mediaService: { getById: (id: string) => any; delete: (id: string) => any }) {
  const media = mediaService.getById(id);
  if (media) {
    const parsed = parsePlaybackSettings(media.playbackSettings);

    if (media.mediaType === 'pdf') {
      const derivedPaths = collectPdfDerivedPaths(media);
      const directories = derivedPaths.filter((entry) => fs.existsSync(entry) && fs.statSync(entry).isDirectory());
      const files = derivedPaths.filter((entry) => !directories.includes(entry));

      for (const filePath of files) {
        deleteFileIfExists(filePath);
      }

      const cacheDir = typeof parsed.cacheDir === 'string' ? parsed.cacheDir : '';
      if (cacheDir) {
        deleteDirectoryIfExists(cacheDir);
      }
    } else {
      if (media.filepath) {
        deleteFileIfExists(toPhysicalPath(media.filepath));
      }

      if (media.thumbnail) {
        deleteFileIfExists(toPhysicalPath(media.thumbnail));
      }
    }
  }

  return mediaService.delete(id);
}

function getRendererUrl(pathname: string) {
  if (process.env.VITE_DEV_SERVER_URL) {
    return new URL(`#${pathname}`, process.env.VITE_DEV_SERVER_URL).toString();
  }
  return path.join(__dirname, '../dist/index.html');
}

const PRESET_EDITOR_BOUNDS_KEY = 'window.presetEditor.bounds';
const SONG_EDITOR_BOUNDS_KEY = 'window.songEditor.bounds';
const SETTINGS_WINDOW_BOUNDS_KEY = 'window.settings.bounds';
const MAIN_WINDOW_STATE_KEY = 'window.main.state';

type MainWindowState = {
  bounds: { x: number; y: number; width: number; height: number };
  isMaximized: boolean;
};

function boundsOverlapVisibleDisplay(bounds: MainWindowState['bounds']) {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return bounds.x < area.x + area.width
      && bounds.x + bounds.width > area.x
      && bounds.y < area.y + area.height
      && bounds.y + bounds.height > area.y;
  });
}

function getSavedMainWindowState(): MainWindowState | null {
  const raw = appSettingsServiceRef?.get(MAIN_WINDOW_STATE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const bounds = {
      x: Number(parsed?.bounds?.x),
      y: Number(parsed?.bounds?.y),
      width: Number(parsed?.bounds?.width),
      height: Number(parsed?.bounds?.height),
    };
    if (!Object.values(bounds).every(Number.isFinite) || bounds.width < 1200 || bounds.height < 760) return null;
    if (!boundsOverlapVisibleDisplay(bounds)) return null;
    return { bounds, isMaximized: parsed?.isMaximized === true };
  } catch {
    return null;
  }
}

function getDefaultMainWindowBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  const width = Math.min(1440, area.width);
  const height = Math.min(920, area.height);
  return {
    width,
    height,
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
  };
}

function saveMainWindowState(win: BrowserWindow) {
  if (win.isDestroyed()) return;
  const next: MainWindowState = {
    bounds: win.getNormalBounds(),
    isMaximized: win.isMaximized(),
  };
  appSettingsServiceRef?.set(MAIN_WINDOW_STATE_KEY, JSON.stringify(next));
}

function getPresetEditorBounds() {
  const raw = appSettingsServiceRef?.get(PRESET_EDITOR_BOUNDS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const values = [parsed?.x, parsed?.y, parsed?.width, parsed?.height].map(Number);
    if (!values.every(Number.isFinite) || values[2] < 1000 || values[3] < 700) return null;
    return { x: values[0], y: values[1], width: values[2], height: values[3] };
  } catch {
    return null;
  }
}

function openPresetEditorWindow(payload: OpenPresetEditorPayload) {
  const kind = payload?.kind === 'screen-layout' || payload?.kind === 'choose' ? payload.kind : 'content-theme';
  const id = typeof payload?.id === 'string' && payload.id.trim() ? payload.id.trim() : null;
  const key = `${kind}:${id || 'new'}`;
  const existing = presetEditorWindows.get(key)?.window;
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return { ok: true, key };
  }

  const savedBounds = getPresetEditorBounds();
  const referenceBounds = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : screen.getPrimaryDisplay().bounds;
  const targetDisplay = screen.getDisplayMatching(referenceBounds);
  const defaultWidth = Math.min(1480, Math.max(1100, targetDisplay.workArea.width - 80));
  const defaultHeight = Math.min(940, Math.max(760, targetDisplay.workArea.height - 80));
  const savedBoundsAreVisible = savedBounds && screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return savedBounds.x < area.x + area.width
      && savedBounds.x + savedBounds.width > area.x
      && savedBounds.y < area.y + area.height
      && savedBounds.y + savedBounds.height > area.y;
  });
  const bounds = savedBounds && savedBoundsAreVisible ? savedBounds : {
    width: defaultWidth,
    height: defaultHeight,
    x: targetDisplay.workArea.x + Math.round((targetDisplay.workArea.width - defaultWidth) / 2),
    y: targetDisplay.workArea.y + Math.round((targetDisplay.workArea.height - defaultHeight) / 2),
  };

  const win = new BrowserWindow({
    title: `${payload?.name || (kind === 'screen-layout' ? 'Screen Layout' : kind === 'content-theme' ? 'Content Theme' : 'Preset')} — RAMEDIA Editor`,
    icon: getAppIconImage(),
    ...bounds,
    minWidth: 1000,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  presetEditorWindows.set(key, { window: win, dirty: false, allowClose: false, confirmingClose: false });
  const query = new URLSearchParams({ kind });
  if (id) query.set('id', id);
  const route = `/preset-editor?${query.toString()}`;
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(getRendererUrl(route));
  } else {
    win.loadFile(getRendererUrl('/preset-editor'), { hash: route });
  }

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  let saveBoundsTimer: NodeJS.Timeout | null = null;
  const scheduleBoundsSave = () => {
    if (win.isDestroyed() || win.isMaximized() || win.isFullScreen()) return;
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      if (!win.isDestroyed()) appSettingsServiceRef?.set(PRESET_EDITOR_BOUNDS_KEY, JSON.stringify(win.getBounds()));
    }, 250);
  };
  win.on('move', scheduleBoundsSave);
  win.on('resize', scheduleBoundsSave);
  win.on('close', async (event) => {
    const editorState = presetEditorWindows.get(key);
    if (!editorState || editorState.allowClose || !editorState.dirty) return;
    event.preventDefault();
    if (editorState.confirmingClose) return;
    editorState.confirmingClose = true;
    const result = await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Unsaved preset changes',
      message: 'Discard changes to this preset?',
      detail: 'Your unsaved changes will be lost if you close the editor.',
      buttons: ['Keep Editing', 'Discard Changes'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    editorState.confirmingClose = false;
    if (result.response === 1 && !win.isDestroyed()) {
      editorState.allowClose = true;
      win.close();
    }
  });
  win.on('closed', () => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    presetEditorWindows.delete(key);
  });

  return { ok: true, key };
}

function getWorkspaceWindowBounds(settingsKey: string, minimumWidth: number, minimumHeight: number) {
  const raw = appSettingsServiceRef?.get(settingsKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const values = [parsed?.x, parsed?.y, parsed?.width, parsed?.height].map(Number);
    if (!values.every(Number.isFinite) || values[2] < minimumWidth || values[3] < minimumHeight) return null;
    return { x: values[0], y: values[1], width: values[2], height: values[3] };
  } catch {
    return null;
  }
}

function openWorkspaceWindow(payload: OpenWorkspaceWindowPayload) {
  const kind = payload?.kind === 'settings' ? 'settings' : payload?.kind === 'bible-settings' ? 'bible-settings' : 'song-editor';
  const id = kind === 'song-editor' && typeof payload?.id === 'string' && payload.id.trim() ? payload.id.trim() : null;
  const key = kind === 'settings' ? 'settings' : kind === 'bible-settings' ? 'bible-settings' : `song-editor:${id || 'new'}`;
  const existing = workspaceWindows.get(key)?.window;
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return { ok: true, key };
  }

  const minimumWidth = kind === 'settings' || kind === 'bible-settings' ? 1040 : 1100;
  const minimumHeight = kind === 'settings' || kind === 'bible-settings' ? 720 : 740;
  const boundsKey = kind === 'settings' ? SETTINGS_WINDOW_BOUNDS_KEY : kind === 'bible-settings' ? 'RAMEDIA_BIBLE_SETTINGS_WINDOW_BOUNDS' : SONG_EDITOR_BOUNDS_KEY;
  const savedBounds = getWorkspaceWindowBounds(boundsKey, minimumWidth, minimumHeight);
  const referenceBounds = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : screen.getPrimaryDisplay().bounds;
  const targetDisplay = screen.getDisplayMatching(referenceBounds);
  const defaultWidth = Math.min(kind === 'settings' || kind === 'bible-settings' ? 1420 : 1520, Math.max(minimumWidth, targetDisplay.workArea.width - 80));
  const defaultHeight = Math.min(960, Math.max(minimumHeight, targetDisplay.workArea.height - 80));
  const savedBoundsAreVisible = savedBounds && screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return savedBounds.x < area.x + area.width
      && savedBounds.x + savedBounds.width > area.x
      && savedBounds.y < area.y + area.height
      && savedBounds.y + savedBounds.height > area.y;
  });
  const bounds = savedBounds && savedBoundsAreVisible ? savedBounds : {
    width: defaultWidth,
    height: defaultHeight,
    x: targetDisplay.workArea.x + Math.round((targetDisplay.workArea.width - defaultWidth) / 2),
    y: targetDisplay.workArea.y + Math.round((targetDisplay.workArea.height - defaultHeight) / 2),
  };

  const title = kind === 'settings'
    ? 'Settings — RAMEDIA'
    : kind === 'bible-settings'
    ? 'Bible Settings — RAMEDIA'
    : `${id ? `Edit Song${payload?.name ? `: ${payload.name}` : ''}` : 'New Song'} — RAMEDIA`;
  const win = new BrowserWindow({
    title,
    icon: getAppIconImage(),
    ...bounds,
    minWidth: minimumWidth,
    minHeight: minimumHeight,
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  workspaceWindows.set(key, { window: win, dirty: false, allowClose: false, confirmingClose: false });
  const query = new URLSearchParams();
  if (id) query.set('id', id);
  const route = kind === 'settings' ? '/settings' : kind === 'bible-settings' ? '/bible-settings' : `/song-editor${id ? `?${query.toString()}` : ''}`;
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(getRendererUrl(route));
  else win.loadFile(getRendererUrl(route), { hash: route });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  let saveBoundsTimer: NodeJS.Timeout | null = null;
  const scheduleBoundsSave = () => {
    if (win.isDestroyed() || win.isMaximized() || win.isFullScreen()) return;
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      if (!win.isDestroyed()) appSettingsServiceRef?.set(boundsKey, JSON.stringify(win.getBounds()));
    }, 250);
  };
  win.on('move', scheduleBoundsSave);
  win.on('resize', scheduleBoundsSave);
  win.on('close', async (event) => {
    const state = workspaceWindows.get(key);
    if (!state || state.allowClose || !state.dirty) return;
    event.preventDefault();
    if (state.confirmingClose) return;
    state.confirmingClose = true;
    const subject = kind === 'settings' ? 'settings changes' : 'song changes';
    const result = await dialog.showMessageBox(win, {
      type: 'warning',
      title: `Unsaved ${subject}`,
      message: `Discard unsaved ${subject}?`,
      detail: 'Your unsaved changes will be lost if you close this window.',
      buttons: ['Keep Editing', 'Discard Changes'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    state.confirmingClose = false;
    if (result.response === 1 && !win.isDestroyed()) {
      state.allowClose = true;
      win.close();
    }
  });
  win.on('closed', () => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    workspaceWindows.delete(key);
  });

  return { ok: true, key };
}

const createMainWindow = () => {
  const savedState = getSavedMainWindowState();
  const win = new BrowserWindow({
    title: 'RAMEDIA',
    icon: getAppIconImage(),
    ...(savedState?.bounds ?? getDefaultMainWindowBounds()),
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: false,
    backgroundColor: '#080c12',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow = win;

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(getRendererUrl('/controller'));
  } else {
    win.loadFile(getRendererUrl('/controller'), { hash: '/controller' });
  }

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelLabel = ['debug', 'info', 'warn', 'error'][level] || `level-${level}`;
    console.log(`[Renderer:${levelLabel}] ${message} (${sourceId}:${line})`);
  });

  win.once('ready-to-show', () => {
    if (savedState?.isMaximized ?? true) win.maximize();
    win.show();
    win.focus();
  });

  win.webContents.on('did-finish-load', () => {
    if (!win.isVisible()) {
      if (savedState?.isMaximized ?? true) win.maximize();
      win.show();
      win.focus();
    }
  });

  let saveStateTimer: NodeJS.Timeout | null = null;
  const scheduleStateSave = () => {
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(() => saveMainWindowState(win), 250);
  };
  win.on('move', scheduleStateSave);
  win.on('resize', scheduleStateSave);
  win.on('maximize', scheduleStateSave);
  win.on('unmaximize', scheduleStateSave);
  win.on('close', (event) => {
    saveMainWindowState(win);
    if (applicationQuitApproved || runtimeShutdownStarted) return;
    event.preventDefault();
    void requestApplicationQuit();
  });
  win.on('closed', () => {
    if (saveStateTimer) clearTimeout(saveStateTimer);
    if (mainWindow === win) mainWindow = null;
  });
};

async function prepareProgramCaptureSource() {
  openConfiguredOutputWindows();

  const localOutputWindows = Array.from(outputWindows.values()).filter((win) => !win.isDestroyed());
  if (localOutputWindows.length === 0) {
    return { ok: false, error: 'No local output window is open' };
  }

  const sourceIds = new Set<string>();
  for (const win of localOutputWindows) {
    const sourceId = (win as unknown as { getMediaSourceId?: () => string }).getMediaSourceId?.();
    if (sourceId) sourceIds.add(sourceId);
  }

  let source = null as Awaited<ReturnType<typeof desktopCapturer.getSources>>[number] | null;
  try {
    for (let attempt = 0; attempt < 8 && !source; attempt += 1) {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 1, height: 1 },
      });

      source =
        sources.find((entry) => sourceIds.has(entry.id)) ??
        sources.find((entry) => /^RAMEDIA Output - /.test(entry.name)) ??
        sources.find((entry) => entry.name.toLowerCase().includes('rumedia')) ??
        null;

      if (!source) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  } catch (err) {
    console.error('[Main] Failed to get desktop capture sources:', err);
    return { ok: false, error: 'Failed to access screen capture sources. Please check OS screen recording permissions.' };
  }

  if (!source) {
    return { ok: false, error: 'Unable to find the local output window as a capture source' };
  }

  activeCaptureSource = {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: getCaptureSourceType(source.id),
    includeAudio: false,
  };

  return { ok: true, sourceId: source.id, sourceName: source.name };
}

function ensureWebrtcHostWindow() {
  if (webrtcHostWindow && !webrtcHostWindow.isDestroyed()) return webrtcHostWindow;

  webrtcHostWindow = new BrowserWindow({
    title: 'RAMEDIA WebRTC Host',
    icon: getAppIconImage(),
    width: 640,
    height: 360,
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    webrtcHostWindow.loadURL(getRendererUrl('/webrtc-host'));
  } else {
    webrtcHostWindow.loadFile(getRendererUrl('/webrtc-host'), { hash: '/webrtc-host' });
  }

  webrtcHostWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelLabel = ['debug', 'info', 'warn', 'error'][level] || `level-${level}`;
    console.log(`[WebRTC Host:${levelLabel}] ${message} (${sourceId}:${line})`);
  });

  webrtcHostWindow.on('closed', () => {
    webrtcHostWindow = null;
  });

  return webrtcHostWindow;
}

// This method will be called when Electron has finished initialization
app.on('ready', async () => {
  if (process.platform === 'darwin') {
    const appIcon = getAppIconImage();
    if (appIcon) app.dock?.setIcon(appIcon);
  }

  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const source = await resolveActiveDisplayMediaSource();

    if (!source) {
      console.warn('[Main] Display media requested without an active capture source');
      callback({});
      return;
    }

    console.log('[Main] Granting display media source:', source.id, source.name);
    callback({
      video: source,
    });
  }, { useSystemPicker: false });

  protocol.handle('ramedia-media', async (request) => {
    const requestUrl = new URL(request.url);
    const source = requestUrl.searchParams.get('src');

    try {
      return createMediaFileResponse(source, request.headers.get('range'));
    } catch (error) {
      console.error('[Main] Failed to load ramedia-media asset:', source, error);
      return new Response('Unable to load media', { status: 404 });
    }
  });

  try {
    await initDatabase();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Database] RAMEDIA could not initialize its database:', error);
    dialog.showErrorBox(
      'RAMEDIA could not start',
      `The application database could not be prepared. Your existing data was not deleted.\n\n${message}`,
    );
    app.quit();
    return;
  }

  const { appSettingsService } = await import('./database/appSettingsService');
  appSettingsServiceRef = appSettingsService;
  createMainWindow();
  buildApplicationMenu();

  const { songService } = await import('./database/songService');
  songServiceRef = songService;
  const { mediaService } = await import('./database/mediaService');
  const { themeService } = await import('./database/themeService');
  const { scheduleService } = await import('./database/scheduleService');
  const { templateService } = await import('./database/templateService');
  const { easyWorshipImportService } = await import('./database/easyWorshipImportService');
  ensureBrowserOutputServer();
  reconcileNdiOutputWindows(appSettingsService.getOutputSettings());

  // Listen to screen changes and auto-realign windows if offscreen
  const handleDisplayChange = () => {
    console.log('[Main] Display configuration changed. Re-evaluating screen metrics.');
    const displaysList = screen.getAllDisplays().map((display, index) => ({
      id: String(display.id),
      label: `${display.label || `Display ${index + 1}`} · ${display.size.width}x${display.size.height}`,
      isPrimary: display.id === screen.getPrimaryDisplay().id,
      width: display.size.width,
      height: display.size.height,
    }));

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screen:changed', displaysList);
    }

    const currentDisplays = screen.getAllDisplays();
    const settings = appSettingsServiceRef?.getOutputSettings() ?? sanitizeOutputSettings(undefined);
    const localOutputs = getElectronOutputChannels(settings);

    outputWindows.forEach((win, outputId) => {
      if (win.isDestroyed()) return;

      const output = localOutputs.find((o) => o.id === outputId);
      if (!output) return;

      const targetDisplay = getDisplayForOutput(output);
      const bounds = win.getBounds();

      // Check if the current window overlaps with any of the active displays
      const isInsideAnyScreen = currentDisplays.some((d) => {
        return (
          bounds.x >= d.bounds.x &&
          bounds.x < d.bounds.x + d.bounds.width &&
          bounds.y >= d.bounds.y &&
          bounds.y < d.bounds.y + d.bounds.height
        );
      });

      if (!isInsideAnyScreen) {
        console.log(`[Main] Output window "${output.name}" is off-screen. Realigning to display: ${targetDisplay.label}`);
        win.setBounds(targetDisplay.bounds);
        if (output.autoFullscreen) {
          win.setFullScreen(true);
        }
      }
    });
  };

  screen.on('display-added', handleDisplayChange);
  screen.on('display-removed', handleDisplayChange);
  screen.on('display-metrics-changed', handleDisplayChange);

  // Handle IPC calls here
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('system:getInfo', () => ({
    version: app.getVersion(),
    platform: process.platform,
    userDataPath: app.getPath('userData'),
    databasePath: DATABASE_PATH,
    logsPath: app.getPath('logs'),
  }));

  ipcMain.handle('system:openPath', async (_, target: 'userData' | 'database' | 'logs') => {
    if (target === 'database') {
      shell.showItemInFolder(DATABASE_PATH);
      return true;
    }
    const targetPath = target === 'logs' ? app.getPath('logs') : app.getPath('userData');
    const error = await shell.openPath(targetPath);
    if (error) throw new Error(error);
    return true;
  });

  ipcMain.handle('window:openOutput', () => {
    return openConfiguredOutputWindows();
  });

  ipcMain.handle('window:closeOutput', () => {
    return closeAllOutputWindows();
  });

  ipcMain.handle('window:toggleOutputFullscreen', () => {
    return toggleAllOutputWindowsFullscreen();
  });

  ipcMain.handle('window:getOutputState', () => {
    return getOutputStateSummary();
  });

  ipcMain.handle('presetEditor:open', (_, payload: OpenPresetEditorPayload) => openPresetEditorWindow(payload));

  ipcMain.on('presetEditor:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && win !== mainWindow && !win.isDestroyed()) win.close();
  });

  ipcMain.on('presetEditor:setDirty', (event, dirty: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const editorState = Array.from(presetEditorWindows.values()).find((item) => item.window === win);
    if (editorState) editorState.dirty = dirty === true;
  });

  ipcMain.on('presetEditor:saved', (event, payload: PresetEditorSavedPayload) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const editorState = win ? Array.from(presetEditorWindows.values()).find((item) => item.window === win) : null;
    if (editorState) editorState.dirty = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('presetEditor:saved', payload);
    }
  });

  ipcMain.handle('workspaceWindow:open', (_, payload: OpenWorkspaceWindowPayload) => openWorkspaceWindow(payload));

  ipcMain.on('workspaceWindow:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && win !== mainWindow && !win.isDestroyed()) win.close();
  });

  ipcMain.on('workspaceWindow:setDirty', (event, dirty: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const state = Array.from(workspaceWindows.values()).find((item) => item.window === win);
    if (state) state.dirty = dirty === true;
  });

  ipcMain.on('workspaceWindow:saved', (event, payload: WorkspaceWindowSavedPayload) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const state = win ? Array.from(workspaceWindows.values()).find((item) => item.window === win) : null;
    if (state) state.dirty = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('workspaceWindow:saved', payload);
    }
  });

  ipcMain.handle('screen:getDefaultProfile', () => {
    return appSettingsService.getDefaultScreenProfile();
  });

  ipcMain.handle('screen:setDefaultProfile', (_, profileId) => {
    appSettingsService.setDefaultScreenProfile(profileId);
    return true;
  });

  ipcMain.handle('screen:getDisplays', () => {
    return screen.getAllDisplays().map((display, index) => ({
      id: String(display.id),
      label: `${display.label || `Display ${index + 1}`} · ${display.size.width}x${display.size.height}`,
      isPrimary: display.id === screen.getPrimaryDisplay().id,
      width: display.size.width,
      height: display.size.height,
    }));
  });

  ipcMain.handle('capture:getScreenSources', async () => {
    return listCaptureSources();
  });

  ipcMain.handle('capture:setActiveSource', async (_, payload: { sourceId: string; sourceName: string; includeAudio?: boolean }) => {
    activeCaptureSource = {
      sourceId: payload.sourceId,
      sourceName: payload.sourceName,
      sourceType: getCaptureSourceType(payload.sourceId),
      includeAudio: !!payload.includeAudio,
    };

    return true;
  });

  ipcMain.handle('capture:clearActiveSource', () => {
    activeCaptureSource = null;
    return true;
  });

  ipcMain.handle('outputSettings:get', () => {
    return appSettingsService.getOutputSettings();
  });

  ipcMain.handle('outputSettings:set', (_, settings) => {
    const next = appSettingsService.setOutputSettings(sanitizeOutputSettings(settings));
    reconcileOutputWindows(next);
    for (const [outputId, win] of outputWindows.entries()) {
      if (win.isDestroyed()) continue;
      win.webContents.send('sync:event', {
        channel: 'STATE_UPDATE',
        data: { type: 'OUTPUT_SETTINGS_CHANGED', payload: next },
      });
      sendPresentationSnapshot(win, outputId);
    }
    for (const [outputId, runtime] of ndiOutputWindows.entries()) {
      const win = runtime.window;
      if (win.isDestroyed()) continue;
      win.webContents.send('sync:event', {
        channel: 'STATE_UPDATE',
        data: { type: 'OUTPUT_SETTINGS_CHANGED', payload: next },
      });
      sendPresentationSnapshot(win, outputId);
      win.webContents.invalidate();
    }
    broadcastBrowserOutputState();
    updateApplicationMenuState();
    return next;
  });

  ipcMain.handle('browserOutput:getRuntime', () => {
    return getBrowserOutputRuntimeSummary();
  });

  ipcMain.handle('remote:getRuntime', () => getRemoteRuntimeSummary());
  ipcMain.handle('remote:setSettings', (_, patch: Partial<RemoteSettings>) => {
    const next = setRemoteSettings(patch);
    broadcastRemoteState();
    return { ...getRemoteRuntimeSummary(), ...next };
  });
  ipcMain.handle('remote:regenerateCode', () => {
    remoteSessions.clear();
    for (const connections of remoteConnections.values()) connections.forEach((res) => res.end());
    remoteConnections.clear();
    setRemoteSettings({ accessCode: generateRemoteAccessCode() });
    return getRemoteRuntimeSummary();
  });
  ipcMain.handle('remote:revokeSession', (_, sessionId?: string | null) => {
    for (const [token, sessionRecord] of remoteSessions.entries()) {
      if (!sessionId || sessionRecord.id === sessionId) {
        remoteConnections.get(token)?.forEach((res) => res.end());
        remoteConnections.delete(token);
        remoteSessions.delete(token);
      }
    }
    return getRemoteRuntimeSummary();
  });

  ipcMain.handle('webrtc:prepareProgramCapture', async () => {
    return prepareProgramCaptureSource();
  });

  ipcMain.handle('webrtc:getPendingOffers', () => {
    cleanupStaleWebrtcPeers();
    return Array.from(browserOutputWebrtcPeers.values())
      .filter((peer) => !peer.answer)
      .map((peer) => ({
        peerId: peer.peerId,
        pairingCode: peer.pairingCode,
        offer: peer.offer,
      }));
  });

  ipcMain.handle('webrtc:sendAnswer', (_, payload: { peerId: string; answer: RTCSessionDescriptionInit }) => {
    const peer = browserOutputWebrtcPeers.get(payload.peerId);
    if (!peer) return false;
    peer.answer = payload.answer;
    peer.updatedAt = Date.now();
    return true;
  });

  ipcMain.handle('webrtc:sendHostIce', (_, payload: { peerId: string; candidate: RTCIceCandidateInit }) => {
    const peer = browserOutputWebrtcPeers.get(payload.peerId);
    if (!peer) return false;
    peer.hostIce.push(payload.candidate);
    peer.updatedAt = Date.now();
    return true;
  });

  ipcMain.handle('webrtc:getBrowserIce', (_, payload: { peerId: string; after: number }) => {
    const peer = browserOutputWebrtcPeers.get(payload.peerId);
    if (!peer) return { candidates: [], next: 0 };
    const after = Math.max(0, Number(payload.after) || 0);
    peer.updatedAt = Date.now();
    return {
      candidates: peer.browserIce.slice(after),
      next: peer.browserIce.length,
    };
  });

  ipcMain.handle('ndi:getRuntimeStatus', () => {
    return ndiRuntimeService.getSummary();
  });

  ipcMain.handle('ndi:startOutput', (_, outputId: string) => {
    const settings = appSettingsService.getOutputSettings();
    return ndiRuntimeService.startOutput(outputId, settings);
  });

  ipcMain.handle('ndi:stopOutput', (_, outputId: string) => {
    return ndiRuntimeService.stopOutput(outputId);
  });

  ipcMain.handle('audioSettings:getMasterVolume', () => {
    return appSettingsService.getAudioMasterVolume();
  });

  ipcMain.handle('audioSettings:setMasterVolume', (_, volume) => {
    appSettingsService.setAudioMasterVolume(volume);
    return true;
  });

  // Output renderers request their initial state only after React has mounted its
  // listener. This avoids losing the one-time ready-to-show snapshot.
  ipcMain.handle('sync:getPresentationSnapshot', (_, outputId?: string | null) => {
    return getPresentationSnapshotForOutput(outputId);
  });

  ipcMain.on('sync:broadcast', (event, { channel, data }) => {
    if (channel === 'REMOTE_COMMAND_RESULT' && data?.commandId) {
      const pending = pendingRemoteCommands.get(data.commandId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRemoteCommands.delete(data.commandId);
        pending.resolve(data as RemoteCommandResult);
      }
      return;
    }

    if (channel === 'REMOTE_CONTEXT_UPDATE' && data) {
      remoteControllerContext = {
        ...remoteControllerContext,
        ...(data as RemoteControllerContext),
        revision: Math.max(remoteControllerContext.revision + 1, Number((data as any).revision) || 0),
      };
      broadcastRemoteState();
      return;
    }

    if (channel === 'STATE_UPDATE' && data?.type) {
      console.log(`[IPC Sync] STATE_UPDATE type: ${data.type} (payload exists: ${!!data.payload})`);

      switch (data.type) {
        case 'STATE_SNAPSHOT': {
          const snapshot = data.payload || {};
          activeCaptureSource = snapshot.liveCapture?.active ? activeCaptureSource : null;
          presentationState = {
            ...presentationState,
            currentSlide: snapshot.currentSlide ?? null,
            previousSlide: snapshot.previousSlide ?? null,
            nextSlide: snapshot.nextSlide ?? null,
            isBlack: !!snapshot.isBlack,
            isClear: !!snapshot.isClear,
            isLogo: !!snapshot.isLogo,
            transitionMode: snapshot.transitionMode || presentationState.transitionMode,
            annotations: snapshot.annotations || {},
            pointer: snapshot.pointer || presentationState.pointer,
            liveCapture: snapshot.liveCapture || emptyLiveCaptureState(),
            mediaPlayback: snapshot.mediaPlayback ?? null,
            manualAlert: snapshot.manualAlert ?? presentationState.manualAlert,
            showName: snapshot.showName ?? null,
            slideIndex: Number.isFinite(snapshot.slideIndex) ? snapshot.slideIndex : 0,
            totalSlides: Number.isFinite(snapshot.totalSlides) ? snapshot.totalSlides : 0,
          };
          break;
        }
        case 'SLIDE_CHANGE':
          // Only auto-open if there's actually a slide to show. 
          // This prevents black screen popups when adding items or clearing state.
          if (data.payload && !hasOpenLocalOutputWindows()) {
            openConfiguredOutputWindows({ onlyAutoOpen: true, focus: false });
          }
          activeCaptureSource = null;
          presentationState = {
            ...presentationState,
            previousSlide: presentationState.currentSlide,
            currentSlide: data.payload,
            nextSlide: null,
            isBlack: false,
            isClear: false,
            isLogo: false,
            liveCapture: emptyLiveCaptureState(),
          };
          break;
        case 'MEDIA_PLAYBACK':
          presentationState = {
            ...presentationState,
            mediaPlayback: data.payload || null,
          };
          break;
        case 'CAPTURE_START':
          if (data.payload && !hasOpenLocalOutputWindows()) {
            openConfiguredOutputWindows({ onlyAutoOpen: true, focus: false });
          }
          presentationState = {
            ...presentationState,
            isBlack: false,
            isClear: false,
            isLogo: false,
            liveCapture: {
              ...emptyLiveCaptureState(),
              ...(data.payload || {}),
              active: true,
              error: null,
            },
          };
          if (data.payload?.sourceType === 'screen' || data.payload?.sourceType === 'window') {
            activeCaptureSource = {
              sourceId: data.payload.sourceId,
              sourceName: data.payload.sourceName,
              sourceType: data.payload.sourceType,
              includeAudio: !!data.payload.includeAudio,
            };
          }
          break;
        case 'CAPTURE_STOP':
          activeCaptureSource = null;
          presentationState = {
            ...presentationState,
            liveCapture: emptyLiveCaptureState(),
          };
          break;
        case 'CAPTURE_ERROR':
          presentationState = {
            ...presentationState,
            liveCapture: {
              ...presentationState.liveCapture,
              active: false,
              error: typeof data.payload === 'string' ? data.payload : 'Capture failed',
            },
          };
          break;
        case 'BLACK_TOGGLE':
          presentationState = {
            ...presentationState,
            isBlack: !!data.payload,
            ...(data.payload ? { isClear: false, isLogo: false } : {}),
          };
          break;
        case 'CLEAR_TOGGLE':
          presentationState = {
            ...presentationState,
            isClear: !!data.payload,
            ...(data.payload ? { isBlack: false, isLogo: false } : {}),
          };
          break;
        case 'LOGO_TOGGLE':
          if (data.payload && !hasOpenLocalOutputWindows()) {
            openConfiguredOutputWindows({ onlyAutoOpen: false, focus: false });
          }
          presentationState = {
            ...presentationState,
            isLogo: !!data.payload,
            ...(data.payload ? { isBlack: false, isClear: false } : {}),
          };
          break;
        case 'ALERT_SHOW':
          presentationState = {
            ...presentationState,
            manualAlert: data.payload || null,
          };
          if (Array.isArray(data.payload?.targetOutputIds)) {
            const targetIds = new Set(data.payload.targetOutputIds);
            getElectronOutputChannels()
              .filter((output) => targetIds.has(output.id))
              .forEach((output) => createOutputWindowForChannel(output));
          }
          break;
        case 'ALERT_HIDE':
          if (!data.payload?.id || (presentationState.manualAlert as any)?.id === data.payload.id) {
            presentationState = {
              ...presentationState,
              manualAlert: null,
            };
          }
          break;
        case 'POINTER_ENABLED':
          presentationState = {
            ...presentationState,
            pointer: {
              ...presentationState.pointer,
              enabled: !!data.payload,
              visible: data.payload ? presentationState.pointer.visible : false,
            },
          };
          break;
        case 'POINTER_MOVE':
          presentationState = {
            ...presentationState,
            pointer: {
              ...presentationState.pointer,
              x: typeof data.payload?.x === 'number' ? data.payload.x : presentationState.pointer.x,
              y: typeof data.payload?.y === 'number' ? data.payload.y : presentationState.pointer.y,
              visible: data.payload?.visible ?? true,
            },
          };
          break;
        case 'POINTER_HIDE':
          presentationState = {
            ...presentationState,
            pointer: {
              ...presentationState.pointer,
              visible: false,
            },
          };
          break;
        case 'TRANSITION_CHANGE':
          presentationState = {
            ...presentationState,
            transitionMode: data.payload || 'fade',
          };
          break;
        case 'ANNOTATIONS_SET':
          if (data.payload?.slideId) {
            presentationState = {
              ...presentationState,
              annotations: {
                ...presentationState.annotations,
                [data.payload.slideId]: Array.isArray(data.payload.annotations) ? data.payload.annotations : [],
              },
            };
          }
          break;
      }
      broadcastBrowserOutputState();
      broadcastRemoteState();
      updateApplicationMenuState();
    }

    const outputWindowWebContentsIds = new Set<number>();
    for (const [outputId, win] of outputWindows.entries()) {
      if (win.isDestroyed()) continue;
      outputWindowWebContentsIds.add(win.webContents.id);
      if (win.webContents.id !== event.sender.id) {
        win.webContents.send('sync:event', { channel, data: getOutputSyncData(data, outputId) });
      }
    }

    for (const [outputId, runtime] of ndiOutputWindows.entries()) {
      const win = runtime.window;
      if (win.isDestroyed()) continue;
      outputWindowWebContentsIds.add(win.webContents.id);
      if (win.webContents.id !== event.sender.id) {
        win.webContents.send('sync:event', { channel, data: getOutputSyncData(data, outputId) });
        win.webContents.invalidate();
      }
    }

    for (const win of BrowserWindow.getAllWindows()) {
      if (win.webContents.id !== event.sender.id && !win.isDestroyed() && !outputWindowWebContentsIds.has(win.webContents.id)) {
        win.webContents.send('sync:event', { channel, data });
      }
    }
  });

  // Bible
  ipcMain.handle('bible:getVersions', () => bibleManager.getAllVersions());
  ipcMain.handle('bible:getActiveVersion', () => bibleManager.getActiveVersion());
  ipcMain.handle('bible:setActiveVersion', (_, id: string) => bibleManager.setActiveVersion(id));
  ipcMain.handle('bible:deleteVersion', (_, id: string) => bibleManager.deleteTranslation(id));
  ipcMain.handle('bible:load', (_, versionId?: string) => bibleManager.loadBible(versionId));
  ipcMain.handle('bible:getActiveBuffer', () => bibleManager.getActiveBibleBuffer());
  ipcMain.handle('bible:getStorageStats', () => bibleManager.getStorageStats());
  ipcMain.handle('shell:openExternal', (_, url: string) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      void shell.openExternal(url);
    }
  });
  ipcMain.handle('bible:importFile', async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          title: 'Import File Alkitab (.xml, .json, .usfm, .sqlite, .bible)',
          filters: [
            { name: 'File Alkitab', extensions: ['xml', 'json', 'usfm', 'sqlite', 'bible', 'gz', 'xmm', 'fsb', 'zip'] },
            { name: 'Semua File', extensions: ['*'] },
          ],
          properties: ['openFile'],
        })
      : null;

    if (!result || result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    const code = path.basename(filePath, path.extname(filePath)).toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 12);
    const fileBuffer = fs.readFileSync(filePath);
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);

    const importedVersion = await bibleManager.importLocalBible(code, fileName, arrayBuffer, 'Imported');
    return importedVersion;
  });
  ipcMain.handle('bible:clearCache', () => bibleManager.clearBibleCache());
  ipcMain.handle('bible:setApiKey', (_, apiKey: string | null) => setCustomBibleBrainApiKey(apiKey));
  ipcMain.handle('bible:getCloudBibles', () => bibleManager.getCloudBibles());
  ipcMain.handle('bible:searchCloudBibles', (_, query: string) => bibleManager.searchCloudBibles(query));
  ipcMain.handle('bible:getCountries', (_, query?: string) => bibleManager.getBibleBrainCountries(query || ''));
  ipcMain.handle('bible:getLanguages', (_, payload?: { countryId?: string; query?: string }) =>
    bibleManager.getBibleBrainLanguages(payload?.countryId, payload?.query || '')
  );
  ipcMain.handle('bible:getBibles', (_, payload: { language: string; query?: string }) =>
    bibleManager.getBibleBrainBibles(payload.language, payload.query || '')
  );
  ipcMain.handle(
    'bible:downloadCloud',
    (event, payload: { abbr: string; name: string; filesetId: string; language?: string }) =>
      bibleManager.downloadCloudBible(payload.abbr, payload.name, payload.filesetId, (percent) => {
        event.sender.send('bible:downloadProgress', {
          code: payload.abbr,
          loaded: percent,
          total: 100,
          percent,
        });
      }, payload.language)
  );

  // AI Assistant IPC Handlers
  ipcMain.handle('ai:getStatus', () => aiService.getStatus());
  ipcMain.handle('ai:toggleEnable', (_, enabled: boolean) => aiService.setEnabled(enabled, mainWindow));
  ipcMain.handle('ai:cancelDownload', () => aiService.cancelDownload(mainWindow));
  ipcMain.handle('ai:formatLyric', (_, rawLyric: string, options?: any) => aiService.formatLyric(rawLyric, options));



  // Songs
  ipcMain.handle('song:getAll', () => songService.getAll());
  ipcMain.handle('song:getLibraryPage', (_, payload) => songService.getLibraryPage(payload));
  ipcMain.handle('song:getLibraryTags', () => songService.getLibraryTags());
  ipcMain.handle('song:getById', (_, payload: string | { id: string; role?: string | null; outputId?: string | null }) => {
    // Support both legacy string param and new object param with role
    const id = typeof payload === 'string' ? payload : payload.id;
    const role = typeof payload === 'object' ? (payload.role ?? null) : null;
    const outputId = typeof payload === 'object' ? (payload.outputId ?? null) : null;
    return songService.getById(id, role as any, outputId);
  });

  ipcMain.handle('song:search', (_, query) => songService.search(query));
  ipcMain.handle('song:create', (_, { title, lyrics, author }) => 
    songService.createFromLyrics(title, lyrics, author)
  );
  ipcMain.handle('song:update', (_, { id, data }) => songService.update(id, data));
  ipcMain.handle('song:delete', (_, id) => songService.delete(id));
  ipcMain.handle('song:scanEasyWorship', async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select EasyWorship Data Folder',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return easyWorshipImportService.scanFolder(result.filePaths[0]);
  });
  ipcMain.handle('song:importEasyWorship', async (_, payload: { folderPath: string; sourceIds: number[] }) => {
    return easyWorshipImportService.importFromFolder(payload.folderPath, payload.sourceIds);
  });
  ipcMain.handle('song:deleteEasyWorshipImports', async () => {
    return easyWorshipImportService.deleteImported();
  });

  // Media
  ipcMain.handle('media:getAll', async () => {
    return mediaService.getAll();
  });
  ipcMain.handle('media:getLibraryPage', (_, payload) => mediaService.getLibraryPage(payload));
  ipcMain.handle('media:getLibraryTags', () => mediaService.getLibraryTags());
  ipcMain.handle('media:getById', async (_, id) => {
    return mediaService.getById(id);
  });
  ipcMain.handle('media:create', (_, data) => mediaService.create(data));
  ipcMain.handle('media:update', (_, { id, data }) => mediaService.update(id, data));
  ipcMain.handle('media:delete', async (_, id) => deleteManagedMedia(id, mediaService));
  ipcMain.handle('media:cleanupOrphans', () => {
    const allMedia = mediaService.getAll();
    const scheduleItems = db.select({ mediaId: schema.scheduleItems.mediaId }).from(schema.scheduleItems).all();
    const slideLayers = db.select({ content: schema.slideLayers.content }).from(schema.slideLayers).all();
    const referencedMediaIds = new Set<string>();

    for (const item of scheduleItems) {
      if (item.mediaId) referencedMediaIds.add(item.mediaId);
    }

    const slideLayersContentString = slideLayers.map((layer) => layer.content).join(' ||| ');

    let deletedCount = 0;
    let savedBytes = 0;

    for (const media of allMedia) {
      const isRefSchedule = referencedMediaIds.has(media.id);
      const isRefSlide = slideLayersContentString.includes(media.filepath) || slideLayersContentString.includes(media.id);

      if (!isRefSchedule && !isRefSlide) {
        if (media.mediaType === 'pdf') {
          const paths = collectPdfDerivedPaths(media);
          const directories = paths.filter((entry) => fs.existsSync(entry) && fs.statSync(entry).isDirectory());
          const files = paths.filter((entry) => !directories.includes(entry));

          for (const filePath of files) {
            savedBytes += deleteFileIfExists(filePath);
          }
          for (const dirPath of directories) {
            savedBytes += deleteDirectoryIfExists(dirPath);
          }
        } else {
          savedBytes += deleteFileIfExists(toPhysicalPath(media.filepath));
          savedBytes += deleteFileIfExists(toPhysicalPath(media.thumbnail));
        }

        mediaService.delete(media.id);
        deletedCount++;
      }
    }

    return { deletedCount, savedBytes };
  });

  ipcMain.handle('media:importFile', async () => {
    return importManagedAssets({
      window: mainWindow as BrowserWindow,
      filterName: 'Media files',
      extensions: VISUAL_MEDIA_EXTENSIONS,
      targetDirName: 'assets_media',
      persist: (record) => mediaService.create(record),
      createRecord: async ({ sourcePath, ext, assetUrl, fileSize, thumbnailsDir }) => {
        const isVideo = ['.mp4', '.webm', '.mov'].includes(ext);
        const mediaType = isVideo ? 'video' : 'image';

        let thumbnailPath = '';
        try {
          const thumbnail = await nativeImage.createThumbnailFromPath(sourcePath, { width: 400, height: 400 });
          const thumbFilename = `thumb-${crypto.randomUUID()}.jpg`;
          const thumbDest = path.join(thumbnailsDir, thumbFilename);
          fs.writeFileSync(thumbDest, thumbnail.toJPEG(80));
          thumbnailPath = pathToFileURL(thumbDest).href;
        } catch (e) {
          console.error('[Main] Thumbnail generation failed:', e);
        }

        return {
          filename: path.basename(sourcePath),
          filepath: assetUrl,
          thumbnail: thumbnailPath,
          mediaType,
          fileSize,
          tags: '[]',
          playbackSettings: JSON.stringify({
            startTime: 0,
            endTime: 0,
            behavior: 'loop',
            scaling: 'cover',
            volume: isVideo ? 100 : 0,
            speed: 1.0,
          }),
        };
      },
    });
  });
  ipcMain.handle('media:importPdfFile', async () => {
    return importManagedAssets({
      window: mainWindow as BrowserWindow,
      filterName: 'PDF files',
      extensions: PDF_EXTENSIONS,
      targetDirName: 'assets_documents',
      persist: (record) => mediaService.create(record),
      createRecord: async ({ sourcePath, destPath, assetUrl, fileSize }) => {
        let metadata = {
          pageCount: 1,
          pageWidth: 0,
          pageHeight: 0,
          aspectRatio: null as number | null,
        };

        try {
          metadata = await readPdfMetadata(destPath);
        } catch (error) {
          console.error('[Main] Failed to read PDF metadata:', error);
        }

        return {
          filename: path.basename(sourcePath),
          filepath: assetUrl,
          thumbnail: '',
          mediaType: 'pdf',
          mimeType: 'application/pdf',
          fileSize,
          width: metadata.pageWidth || null,
          height: metadata.pageHeight || null,
          tags: '[]',
          playbackSettings: JSON.stringify({
            pageCount: metadata.pageCount,
            aspectRatio: metadata.aspectRatio,
            pageWidth: metadata.pageWidth,
            pageHeight: metadata.pageHeight,
          }),
        };
      },
    });
  });

  ipcMain.handle('media:selectPdfFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow as BrowserWindow, {
      title: 'Import PDF Decker',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF files', extensions: PDF_EXTENSIONS }],
    });
    return result.filePaths;
  });

  ipcMain.handle('media:saveCompiledPdf', async (_, payload: { filename: string, buffers: ArrayBuffer[], width: number, height: number }) => {
    return persistCompiledPdf(payload, mediaService);
  });
  ipcMain.handle('media:updateCompiledPdf', async (_, payload: { id: string, filename: string, buffers: ArrayBuffer[], width: number, height: number }) => {
    return persistCompiledPdf(payload, mediaService);
  });

  // Audio
  ipcMain.handle('audio:getAll', () => mediaService.getByType('audio'));
  ipcMain.handle('audio:getById', (_, id) => mediaService.getById(id));
  ipcMain.handle('audio:update', (_, { id, data }) => mediaService.update(id, data));
  ipcMain.handle('audio:delete', (_, id) => deleteManagedMedia(id, mediaService));
  ipcMain.handle('audio:readFile', (_, source: string) => {
    const targetPath = toPhysicalPath(source);
    if (!targetPath || !fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      throw new Error('Audio file not found');
    }

    const buffer = fs.readFileSync(targetPath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  });
  ipcMain.handle('audio:importFile', async () => {
    return importManagedAssets({
      window: mainWindow as BrowserWindow,
      filterName: 'Audio files',
      extensions: AUDIO_EXTENSIONS,
      targetDirName: 'assets_audio',
      persist: (record) => mediaService.create(record),
      createRecord: async ({ sourcePath, ext, assetUrl, fileSize }) => {
        const mimeByExt: Record<string, string> = {
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.ogg': 'audio/ogg',
        };

        return {
          filename: path.basename(sourcePath),
          filepath: assetUrl,
          thumbnail: '',
          mediaType: 'audio',
          mimeType: mimeByExt[ext] || 'audio/*',
          fileSize,
          tags: '[]',
          playbackSettings: JSON.stringify({
            playback: {
              volume: 100,
              loop: false,
              startTime: 0,
              endTime: 0,
              fadeInMs: 0,
              fadeOutMs: 0,
            },
          }),
        };
      },
    });
  });
  ipcMain.handle('audio:importFiles', async (_, sourcePaths: string[]) => {
    return importManagedAssets({
      window: mainWindow as BrowserWindow,
      filterName: 'Audio files',
      extensions: AUDIO_EXTENSIONS,
      targetDirName: 'assets_audio',
      sourcePaths,
      persist: (record) => mediaService.create(record),
      createRecord: async ({ sourcePath, ext, assetUrl, fileSize }) => {
        const mimeByExt: Record<string, string> = {
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.ogg': 'audio/ogg',
        };

        return {
          filename: path.basename(sourcePath),
          filepath: assetUrl,
          thumbnail: '',
          mediaType: 'audio',
          mimeType: mimeByExt[ext] || 'audio/*',
          fileSize,
          tags: '[]',
          playbackSettings: JSON.stringify({
            playback: {
              volume: 100,
              loop: false,
              startTime: 0,
              endTime: 0,
              fadeInMs: 0,
              fadeOutMs: 0,
            },
          }),
        };
      },
    });
  });

  // Themes
  ipcMain.handle('theme:getAll', () => themeService.getAll());
  ipcMain.handle('theme:create', (_, data) => themeService.create(data));
  ipcMain.handle('theme:update', (_, { id, data }) => themeService.update(id, data));
  ipcMain.handle('theme:delete', (_, id) => themeService.delete(id));

  // Schedules
  ipcMain.handle('schedule:getAll', () => scheduleService.getAll());
  ipcMain.handle('schedule:getById', (_, id) => scheduleService.getById(id));
  ipcMain.handle('schedule:create', (_, data) => scheduleService.create(data));
  ipcMain.handle('schedule:update', (_, { id, data }) => scheduleService.update(id, data));
  ipcMain.handle('schedule:delete', (_, id) => scheduleService.delete(id));
  
  // Schedule Items
  ipcMain.handle('schedule:addItem', (_, data) => scheduleService.addItem(data));
  ipcMain.handle('schedule:updateItem', (_, { id, data }) => scheduleService.updateItem(id, data));
  ipcMain.handle('schedule:deleteItem', (_, id) => scheduleService.deleteItem(id));
  ipcMain.handle('schedule:reorderItems', (_, { scheduleId, itemIds }) => 
    scheduleService.reorderItems(scheduleId, itemIds)
  );
  ipcMain.handle('schedule:duplicateItem', (_, itemId) => scheduleService.duplicateItem(itemId));
  ipcMain.handle('schedule:cloneSchedule', (_, { scheduleId, newName }) => 
    scheduleService.cloneSchedule(scheduleId, newName)
  );

  ipcMain.handle('template:getAll', () => templateService.getAll());
  ipcMain.handle('template:getLibraryPage', (_, payload) => templateService.getLibraryPage(payload));
  ipcMain.handle('template:getLibraryCategories', () => templateService.getLibraryCategories());
  ipcMain.handle('template:getById', (_, id) => templateService.getById(id));
  ipcMain.handle('template:create', async (_, data) => {
    const template = await templateService.create(data);
    return template?.id;
  });
  ipcMain.handle('template:update', (_, { id, data }) => templateService.update(id, data));
  ipcMain.handle('template:delete', async (_, id) => {
    const template = await templateService.getById(id);
    await templateService.delete(id);
    if (template?.previewUrl) {
      const previewDir = path.join(app.getPath('userData'), 'thumbnails', 'presets');
      const previewPath = toPhysicalPath(template.previewUrl);
      if (previewPath.startsWith(`${previewDir}${path.sep}`)) deleteFileIfExists(previewPath);
    }
  });
  ipcMain.handle('template:updatePreview', (_, { id, previewUrl }) => templateService.updatePreview(id, previewUrl || null));
  ipcMain.handle('presetPreview:save', (_, payload: { id: string; dataUrl: string; previousUrl?: string | null }) => {
    const match = /^data:image\/png;base64,([a-z0-9+/=]+)$/i.exec(payload?.dataUrl || '');
    if (!match) throw new Error('Invalid preset preview image.');
    const buffer = Buffer.from(match[1], 'base64');
    if (buffer.length > 5 * 1024 * 1024) throw new Error('Preset preview image is too large.');
    const safeId = String(payload.id || 'preset').replace(/[^a-z0-9_-]/gi, '-').slice(0, 96);
    const previewDir = path.join(app.getPath('userData'), 'thumbnails', 'presets');
    ensureDirectory(previewDir);
    const previewPath = path.join(previewDir, `${safeId}-${Date.now()}.png`);
    fs.writeFileSync(previewPath, buffer);
    if (payload.previousUrl) {
      const previousPath = toPhysicalPath(payload.previousUrl);
      if (previousPath.startsWith(`${previewDir}${path.sep}`) && previousPath !== previewPath) deleteFileIfExists(previousPath);
    }
    return pathToFileURL(previewPath).href;
  });
  ipcMain.handle('presetPreview:delete', (_, previewUrl: string) => {
    const previewDir = path.join(app.getPath('userData'), 'thumbnails', 'presets');
    const previewPath = toPhysicalPath(previewUrl);
    if (previewPath.startsWith(`${previewDir}${path.sep}`)) deleteFileIfExists(previewPath);
  });

  ipcMain.handle('db:backup', () => dbBackupService.backupToZip(mainWindow));
  ipcMain.handle('db:restore', () => dbBackupService.restoreFromZip(mainWindow));
  ipcMain.handle('db:getCacheStats', () => dbCacheService.getCacheStats());
  ipcMain.handle('db:listCacheAssets', () => dbCacheService.listCacheAssets());
  ipcMain.handle('db:deleteCacheAsset', (_, id) => dbCacheService.deleteCacheAsset(id));
  ipcMain.handle('db:clearUnusedCache', () => dbCacheService.clearUnusedCache());
  ipcMain.handle('db:deleteSong', (_, id) => songService.delete(id));
  ipcMain.handle('db:deleteSongsBatch', (_, ids: string[]) => {
    for (const id of ids) {
      songService.delete(id);
    }
  });

  ipcMain.handle('ai:runAutoTagging', async (event) => {
    return runAutoTaggingAndSeedPlaylists((progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:auto-tagging-progress', progress);
      }
    });
  });
});

function shutdownRuntime() {
  if (runtimeShutdownStarted) return;
  runtimeShutdownStarted = true;

  for (const outputId of [...ndiOutputWindows.keys()]) closeNdiOutputWindow(outputId);
  ndiRuntimeService.shutdown();

  for (const connections of browserOutputConnections.values()) {
    connections.forEach((response) => response.end());
  }
  browserOutputConnections.clear();
  for (const connections of remoteConnections.values()) {
    connections.forEach((response) => response.end());
  }
  remoteConnections.clear();

  for (const [commandId, pending] of pendingRemoteCommands.entries()) {
    clearTimeout(pending.timer);
    pending.resolve({ commandId, ok: false, error: 'RAMEDIA is shutting down.' });
  }
  pendingRemoteCommands.clear();

  if (browserOutputServer) {
    browserOutputServer.closeAllConnections?.();
    browserOutputServer.close();
    browserOutputServer = null;
  }

  closeDatabase();
}

app.on('before-quit', (event) => {
  if (applicationQuitApproved) return;
  console.log('[Lifecycle] Deferring quit until RAMEDIA confirms it is safe.');
  event.preventDefault();
  void requestApplicationQuit();
});
app.on('will-quit', shutdownRuntime);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
