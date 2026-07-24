export type RemoteRole = 'presenter' | 'worship-leader' | 'operator' | 'viewer';

export interface RemotePermissions {
  navigate: boolean;
  toggles: boolean;
  addSongs: boolean;
  selectItems: boolean;
}

export interface RemoteSlideSummary {
  id: string;
  label: string;
  content: string;
}

export interface RemoteRundownItemSummary {
  id: string;
  title: string;
  subtitle: string | null;
  itemType: string;
  isSelected: boolean;
  isLive: boolean;
}

export interface RemoteControllerContext {
  revision: number;
  activeSchedule: { id: string; name: string; isTemporary: boolean } | null;
  currentItem: { id: string; title: string; itemType: string } | null;
  selectedItemId: string | null;
  slides: RemoteSlideSummary[];
  currentSlideId: string | null;
  rundown: RemoteRundownItemSummary[];
}

export interface RemoteSnapshot extends RemoteControllerContext {
  serverName: string;
  role: RemoteRole;
  permissions: RemotePermissions;
  isBlack: boolean;
  isClear: boolean;
  isLogo: boolean;
}

export type RemoteCommandType =
  | 'next-slide'
  | 'previous-slide'
  | 'go-to-slide'
  | 'toggle-black'
  | 'toggle-clear'
  | 'toggle-logo'
  | 'select-item'
  | 'add-song';

export interface RemoteCommand {
  commandId: string;
  type: RemoteCommandType;
  payload?: {
    slideId?: string;
    itemId?: string;
    songId?: string;
    position?: 'after-current' | 'end';
  };
}

export interface RemoteCommandResult {
  commandId: string;
  ok: boolean;
  error?: string;
}

export interface RemoteRoleSecurity {
  presenterPin: string;
  worshipLeaderPin: string;
  viewerPin: string;
  viewerRequirePin: boolean;
}

export interface RemoteSettings {
  enabled: boolean;
  accessCode: string;
  defaultRole: RemoteRole;
  security: RemoteRoleSecurity;
}

export interface RemoteRuntimeSummary extends RemoteSettings {
  isRunning: boolean;
  port: number;
  urls: string[];
  activeSessions: number;
  sessions: Array<{
    id: string;
    deviceName: string;
    role: RemoteRole;
    createdAt: string;
    lastSeen: string;
  }>;
}

export const REMOTE_ROLE_PERMISSIONS: Record<RemoteRole, RemotePermissions> = {
  presenter: { navigate: true, toggles: true, addSongs: false, selectItems: true },
  'worship-leader': { navigate: true, toggles: false, addSongs: true, selectItems: true },
  operator: { navigate: true, toggles: true, addSongs: true, selectItems: true },
  viewer: { navigate: false, toggles: false, addSongs: false, selectItems: false },
};
