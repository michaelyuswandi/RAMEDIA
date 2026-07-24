import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Broadcast,
  Check,
  CircleNotch,
  DeviceMobile,
  Eye,
  ListBullets,
  MagnifyingGlass,
  MusicNotes,
  Plus,
  SignOut,
  TelevisionSimple,
  WifiHigh,
  WifiSlash,
  X,
} from '@phosphor-icons/react';
import type { RemoteCommandType, RemoteSnapshot } from '../core/remote/types';
import { useI18n } from '../i18n';

type RemoteTab = 'live' | 'rundown' | 'library';
type SongResult = { id: string; title: string; author: string | null; rawLyrics?: string | null };

const TOKEN_KEY = 'rumedia.remote.token';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function getApiError(response: Response) {
  try {
    const payload = await response.json();
    return payload?.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ${
      connected
        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
        : 'border-amber-400/25 bg-amber-400/10 text-amber-200'
    }`}>
      {connected ? <WifiHigh size={15} weight="bold" /> : <WifiSlash size={15} weight="bold" />}
      {connected ? 'Connected' : 'Reconnecting'}
    </div>
  );
}

interface PublicRoleInfo {
  role: 'operator' | 'presenter' | 'worship-leader' | 'viewer';
  label: string;
  description: string;
  securityType: 'master_code' | 'pin' | 'open';
  requireInput: boolean;
}

function PairingScreen({ onPaired }: { onPaired: (token: string, snapshot: RemoteSnapshot) => void }) {
  const { t } = useI18n();
  const [selectedRole, setSelectedRole] = useState<'operator' | 'presenter' | 'worship-leader' | 'viewer' | null>(null);
  const [roles, setRoles] = useState<PublicRoleInfo[]>([]);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [deviceName, setDeviceName] = useState('Web Remote');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPublic, setIsLoadingPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchPublicConfig = async () => {
      try {
        const response = await fetch('/api/remote/public');
        if (response.ok) {
          const data = await response.json();
          if (active && Array.isArray(data?.roles)) {
            setRoles(data.roles);
          }
        }
      } catch {
        // Fallback roles
      } finally {
        if (active) setIsLoadingPublic(false);
      }
    };
    void fetchPublicConfig();
    return () => { active = false; };
  }, []);

  const activeRoleInfo = roles.find((r) => r.role === selectedRole) || null;

  const pair = async (event?: React.FormEvent, targetRole?: 'operator' | 'presenter' | 'worship-leader' | 'viewer') => {
    if (event) event.preventDefault();
    const roleToAuth = targetRole || selectedRole;
    if (!roleToAuth) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/remote/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: roleToAuth,
          code: code.trim().toUpperCase(),
          pin: pin.trim(),
          deviceName: deviceName.trim() || 'Web Remote',
        }),
      });
      if (!response.ok) throw new Error(await getApiError(response));
      const payload = await response.json() as { token: string; snapshot: RemoteSnapshot };
      localStorage.setItem(TOKEN_KEY, payload.token);
      onPaired(payload.token, payload.snapshot);
    } catch (pairError) {
      setError(pairError instanceof Error ? pairError.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleSelect = (roleInfo: PublicRoleInfo) => {
    setError(null);
    setCode('');
    setPin('');
    setSelectedRole(roleInfo.role);
    if (!roleInfo.requireInput) {
      void pair(undefined, roleInfo.role);
    }
  };

  const roleIcons = {
    operator: <Broadcast size={24} weight="duotone" className="text-amber-400" />,
    presenter: <TelevisionSimple size={24} weight="duotone" className="text-emerald-400" />,
    'worship-leader': <MusicNotes size={24} weight="duotone" className="text-purple-400" />,
    viewer: <Eye size={24} weight="duotone" className="text-blue-400" />,
  };

  const roleLabels: Record<string, string> = {
    operator: t('remoteControlWorkspace.roleOperator'),
    presenter: t('remoteControlWorkspace.rolePresenter'),
    'worship-leader': t('remoteControlWorkspace.roleWorshipLeader'),
    viewer: t('remoteControlWorkspace.roleViewer'),
  };

  const roleDescs: Record<string, string> = {
    operator: t('remoteControlWorkspace.roleOperatorDesc'),
    presenter: t('remoteControlWorkspace.rolePresenterDesc'),
    'worship-leader': t('remoteControlWorkspace.roleWorshipLeaderDesc'),
    viewer: t('remoteControlWorkspace.roleViewerDesc'),
  };

  return (
    <main className="min-h-[100dvh] bg-[#101214] px-4 py-8 text-zinc-100 sm:grid sm:place-items-center sm:px-6">
      <div className="mx-auto w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-[#181b1e] shadow-[0_24px_80px_-36px_rgba(0,0,0,0.9)]">
        <div className="border-b border-white/[0.08] px-6 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Broadcast size={23} weight="duotone" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">RAMEDIA WEB REMOTE</p>
              <h1 className="text-xl font-semibold tracking-tight">{t('remoteControlWorkspace.selectAccessRole')}</h1>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          {isLoadingPublic ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : !selectedRole ? (
            <div className="grid gap-3">
              <p className="text-xs text-zinc-400 mb-1">{t('remoteControlWorkspace.selectRolePrompt')}</p>
              {(roles.length > 0 ? roles : [
                { role: 'operator', label: t('remoteControlWorkspace.roleOperator'), description: t('remoteControlWorkspace.roleOperatorDesc'), securityType: 'master_code', requireInput: true },
                { role: 'presenter', label: t('remoteControlWorkspace.rolePresenter'), description: t('remoteControlWorkspace.rolePresenterDesc'), securityType: 'pin', requireInput: true },
                { role: 'worship-leader', label: t('remoteControlWorkspace.roleWorshipLeader'), description: t('remoteControlWorkspace.roleWorshipLeaderDesc'), securityType: 'pin', requireInput: true },
                { role: 'viewer', label: t('remoteControlWorkspace.roleViewer'), description: t('remoteControlWorkspace.roleViewerDesc'), securityType: 'open', requireInput: false },
              ] as PublicRoleInfo[]).map((r) => (
                <button
                  key={r.role}
                  onClick={() => handleRoleSelect(r)}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-[#121417] p-4 text-left transition hover:border-emerald-500/40 hover:bg-[#1b1e22] active:scale-[0.98]"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/5">
                    {roleIcons[r.role]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{roleLabels[r.role] || r.label}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        r.securityType === 'master_code' ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' :
                        r.securityType === 'pin' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' :
                        'border-zinc-500/30 bg-zinc-500/10 text-zinc-400'
                      }`}>
                        {r.securityType === 'master_code' ? t('remoteControlWorkspace.masterCodeBadge') : r.securityType === 'pin' ? t('remoteControlWorkspace.pinCodeBadge') : t('remoteControlWorkspace.publicAccessBadge')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{roleDescs[r.role] || r.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={pair} autoComplete="off" className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5">
                    {roleIcons[selectedRole]}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('remoteControlWorkspace.connectingAs')}</p>
                    <p className="text-base font-semibold text-white">{roleLabels[selectedRole] || selectedRole}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  {t('remoteControlWorkspace.changeRole')}
                </button>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-zinc-300">{t('remoteControlWorkspace.deviceNameLabel')}</span>
                <input
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#111315] px-4 text-sm outline-none transition focus:border-emerald-500/55"
                  placeholder={t('remoteControlWorkspace.deviceNamePlaceholder')}
                  autoComplete="off"
                />
              </label>

              {activeRoleInfo?.securityType === 'master_code' ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-300">{t('remoteControlWorkspace.masterCodeLabel')}</span>
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8))}
                    className="h-14 w-full rounded-xl border border-white/10 bg-[#111315] px-4 text-center font-mono text-2xl font-bold tracking-[0.28em] outline-none transition focus:border-emerald-500/55"
                    placeholder="------"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-zinc-500">{t('remoteControlWorkspace.connectDeviceDesc')}</p>
                </label>
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-300">PIN Akses {roleLabels[selectedRole] || selectedRole}</span>
                  <input
                    type="password"
                    maxLength={8}
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    className="h-14 w-full rounded-xl border border-white/10 bg-[#111315] px-4 text-center font-mono text-2xl font-bold tracking-[0.3em] outline-none transition focus:border-emerald-500/55"
                    placeholder="••••"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </label>
              )}

              {error && <p className="rounded-xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-xs text-red-200">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-bold text-emerald-950 transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-55"
              >
                {isSubmitting ? <CircleNotch size={19} className="animate-spin" /> : <DeviceMobile size={20} weight="bold" />}
                {isSubmitting ? t('remoteControlWorkspace.verifying') : t('remoteControlWorkspace.loginAs', { role: roleLabels[selectedRole] || selectedRole })}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

function ViewerPanel({ snapshot }: { snapshot: RemoteSnapshot }) {
  const { t } = useI18n();
  const currentIndex = snapshot.slides.findIndex((slide) => slide.id === snapshot.currentSlideId);
  const currentSlide = snapshot.slides[currentIndex] || null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-400/30 bg-blue-400/10 p-4 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-300">
          <Eye size={18} weight="bold" />
          {t('remoteControlWorkspace.viewOnlyMonitoring')}
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#171a1d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">NOW LIVE</span>
            <h2 className="text-xl font-bold text-white mt-1">{snapshot.currentItem?.title || 'Belum Ada Item Live'}</h2>
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-400">
            {snapshot.slides.length ? `${Math.max(0, currentIndex) + 1} / ${snapshot.slides.length}` : '0 / 0'}
          </span>
        </div>

        <div className="aspect-video bg-[#08090a] grid place-items-center p-8 sm:p-12">
          <div className="w-full h-full grid place-items-center rounded-2xl border border-white/5 bg-zinc-950/80 px-6 text-center">
            {snapshot.isBlack ? (
              <p className="text-base font-bold uppercase tracking-[0.25em] text-zinc-600">OUTPUT BLACKOUT</p>
            ) : snapshot.isClear ? (
              <p className="text-base font-bold uppercase tracking-[0.25em] text-zinc-600">OUTPUT CLEAR</p>
            ) : snapshot.isLogo ? (
              <p className="text-base font-bold uppercase tracking-[0.25em] text-zinc-500">LOGO DISPLAY</p>
            ) : currentSlide ? (
              <p className="whitespace-pre-line text-[clamp(1.1rem,4vw,2.2rem)] font-bold leading-relaxed text-white drop-shadow-md">
                {currentSlide.content}
              </p>
            ) : (
              <p className="text-sm text-zinc-500">Menunggu slide aktif...</p>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#171a1d]">
        <div className="border-b border-white/10 px-5 py-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Schedule Rundown (Read-Only)</h3>
        </div>
        <div className="divide-y divide-white/5">
          {snapshot.rundown.map((item, idx) => (
            <div key={item.id} className={`flex items-center justify-between px-5 py-3.5 ${item.isLive ? 'bg-emerald-400/10' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-zinc-500">{String(idx + 1).padStart(2, '0')}</span>
                <span className={`text-sm font-semibold ${item.isLive ? 'text-emerald-300' : 'text-zinc-200'}`}>{item.title}</span>
              </div>
              {item.isLive && (
                <span className="rounded-md border border-emerald-400/30 bg-emerald-400/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">LIVE</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LivePanel({
  snapshot,
  connected,
  pendingCommand,
  sendCommand,
}: {
  snapshot: RemoteSnapshot;
  connected: boolean;
  pendingCommand: string | null;
  sendCommand: (type: RemoteCommandType, payload?: Record<string, string>) => Promise<boolean>;
}) {
  const currentIndex = snapshot.slides.findIndex((slide) => slide.id === snapshot.currentSlideId);
  const currentSlide = snapshot.slides[currentIndex] || null;
  const canPrevious = snapshot.permissions.navigate && currentIndex > 0;
  const canNext = snapshot.permissions.navigate && snapshot.slides.length > 0 && currentIndex < snapshot.slides.length - 1;
  const disabled = !connected || Boolean(pendingCommand);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#171a1d]">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live
            </div>
            <h2 className="mt-2 truncate text-xl font-semibold tracking-tight">{snapshot.currentItem?.title || 'No item live'}</h2>
            <p className="mt-1 text-sm text-zinc-500">{currentSlide?.label || 'Select an item from the rundown'}</p>
          </div>
          <span className="shrink-0 font-mono text-xs text-zinc-500">
            {snapshot.slides.length ? `${Math.max(0, currentIndex) + 1}/${snapshot.slides.length}` : '0/0'}
          </span>
        </div>
        <div className="aspect-video bg-[#090a0b] p-6 sm:p-10">
          <div className="grid h-full place-items-center overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-950 px-4 text-center shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]">
            {snapshot.isBlack ? (
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-600">Black output</p>
            ) : snapshot.isClear ? (
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-600">Clear output</p>
            ) : snapshot.isLogo ? (
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">Logo output</p>
            ) : currentSlide ? (
              <p className="whitespace-pre-line text-[clamp(0.9rem,3vw,1.55rem)] font-semibold leading-[1.35] text-white">{currentSlide.content}</p>
            ) : (
              <p className="text-sm text-zinc-600">Output is waiting for a slide</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => void sendCommand('previous-slide')}
            disabled={disabled || !canPrevious}
            className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#1b1e21] text-zinc-100 transition hover:border-white/20 hover:bg-[#202428] active:scale-[0.98] disabled:opacity-30"
          >
            <ArrowLeft size={32} weight="bold" />
            <span className="text-xs font-bold uppercase tracking-[0.12em]">Previous</span>
          </button>
          <button
            onClick={() => void sendCommand('next-slide')}
            disabled={disabled || !canNext}
            className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/12 text-emerald-100 transition hover:bg-emerald-400/18 active:scale-[0.98] disabled:opacity-30"
          >
            <ArrowRight size={32} weight="bold" />
            <span className="text-xs font-bold uppercase tracking-[0.12em]">Next</span>
          </button>
        </div>
        {snapshot.permissions.toggles && (
          <div className="grid grid-cols-3 gap-2">
            {([
              ['toggle-black', 'Black', snapshot.isBlack],
              ['toggle-clear', 'Clear', snapshot.isClear],
              ['toggle-logo', 'Logo', snapshot.isLogo],
            ] as const).map(([type, label, active]) => (
              <button
                key={type}
                onClick={() => void sendCommand(type)}
                disabled={disabled}
                className={`min-h-16 rounded-xl border px-2 text-xs font-bold uppercase tracking-[0.1em] transition active:scale-[0.98] disabled:opacity-35 ${
                  active
                    ? 'border-emerald-400/50 bg-emerald-400/16 text-emerald-200'
                    : 'border-white/10 bg-[#171a1d] text-zinc-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SlidesPanel({ snapshot, connected, sendCommand }: {
  snapshot: RemoteSnapshot;
  connected: boolean;
  sendCommand: (type: RemoteCommandType, payload?: Record<string, string>) => Promise<boolean>;
}) {
  return (
    <section>
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Active schedule</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{snapshot.activeSchedule?.name || 'No schedule loaded'}</h2>
      </div>
      {snapshot.rundown.length === 0 ? (
        <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 text-center">
          <div>
            <ListBullets size={34} className="mx-auto text-zinc-600" />
            <p className="mt-4 font-semibold text-zinc-300">Rundown kosong</p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/10 bg-[#171a1d]">
          {snapshot.rundown.map((item, index) => (
            <button
              key={item.id}
              onClick={() => void sendCommand('select-item', { itemId: item.id })}
              disabled={!connected || !snapshot.permissions.selectItems}
              className={`grid w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.035] active:scale-[0.995] disabled:cursor-default ${item.isLive ? 'bg-emerald-400/[0.07]' : ''}`}
            >
              <span className="font-mono text-xs text-zinc-600">{String(index + 1).padStart(2, '0')}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-zinc-100">{item.title}</span>
                <span className="mt-1 block truncate text-xs text-zinc-500">{item.subtitle || item.itemType}</span>
              </span>
              {item.isLive ? (
                <span className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">Live</span>
              ) : item.isSelected ? (
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">Selected</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {snapshot.slides.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Slides</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {snapshot.slides.map((slide) => {
              const active = slide.id === snapshot.currentSlideId;
              return (
                <button
                  key={slide.id}
                  onClick={() => void sendCommand('go-to-slide', { slideId: slide.id })}
                  disabled={!connected || !snapshot.permissions.navigate}
                  className={`overflow-hidden rounded-xl border text-left transition active:scale-[0.98] ${active ? 'border-emerald-400/55 bg-emerald-400/[0.08]' : 'border-white/10 bg-[#171a1d] hover:border-white/20'}`}
                >
                  <div className="aspect-video bg-zinc-950 px-4 py-3">
                    <p className="line-clamp-4 whitespace-pre-line text-center text-xs font-medium leading-5 text-zinc-300">{slide.content}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.08] px-3 py-2.5">
                    <span className="text-xs font-semibold text-zinc-300">{slide.label}</span>
                    {active && <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">Live</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function LibraryPanel({ token, snapshot, connected, sendCommand }: {
  token: string;
  snapshot: RemoteSnapshot;
  connected: boolean;
  sendCommand: (type: RemoteCommandType, payload?: Record<string, string>) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<SongResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSong, setSelectedSong] = useState<SongResult | null>(null);
  const [position, setPosition] = useState<'after-current' | 'end'>('after-current');
  const [addedTitle, setAddedTitle] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/remote/library/songs?q=${encodeURIComponent(query)}&limit=40`, {
          headers: authHeaders(token),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await getApiError(response));
        const page = await response.json() as { items: SongResult[]; total: number };
        setSongs(page.items || []);
        setTotal(page.total || 0);
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') setError((loadError as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, token]);

  const addSong = async () => {
    if (!selectedSong || isAdding) return;
    const songTitle = selectedSong.title;
    setIsAdding(true);
    try {
      const added = await sendCommand('add-song', { songId: selectedSong.id, position });
      if (!added) return;
      setAddedTitle(songTitle);
      setSelectedSong(null);
      window.setTimeout(() => setAddedTitle(null), 3500);
    } finally {
      setIsAdding(false);
    }
  };

  if (!snapshot.permissions.addSongs) {
    return (
      <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-white/12 px-6 text-center">
        <div>
          <MusicNotes size={36} className="mx-auto text-zinc-600" />
          <h2 className="mt-4 font-semibold">Library tidak tersedia untuk role ini</h2>
        </div>
      </div>
    );
  }

  return (
    <section>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Song Library</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Add song to rundown</h2>
        </div>
        <p className="font-mono text-xs text-zinc-500">{total} songs</p>
      </div>
      <label className="relative mt-5 block">
        <MagnifyingGlass size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari judul, lirik, atau penulis…"
          className="h-[52px] w-full rounded-xl border border-white/10 bg-[#171a1d] pl-11 pr-11 text-sm outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/45 focus:ring-2 focus:ring-emerald-400/10"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white">
            <X size={16} />
          </button>
        )}
      </label>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200">{error}</p>
      ) : loading ? (
        <div className="mt-4 divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/10 bg-[#171a1d]">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-4">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-white/6" />
              <div className="flex-1 space-y-2"><div className="h-3 w-2/5 animate-pulse rounded bg-white/7" /><div className="h-2.5 w-1/4 animate-pulse rounded bg-white/5" /></div>
            </div>
          ))}
        </div>
      ) : songs.length === 0 ? (
        <div className="mt-4 grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/12 text-center">
          <div><MagnifyingGlass size={32} className="mx-auto text-zinc-600" /><p className="mt-3 text-sm text-zinc-400">Lagu tidak ditemukan.</p></div>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/10 bg-[#171a1d]">
          {songs.map((song) => (
            <div key={song.id} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{song.title}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{song.author || 'Unknown author'}</p>
              </div>
              <button
                onClick={() => setSelectedSong(song)}
                disabled={!connected}
                aria-label={`Add ${song.title}`}
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-zinc-300 transition hover:border-emerald-400/35 hover:bg-emerald-400/10 hover:text-emerald-200 active:scale-[0.96] disabled:opacity-35"
              >
                <Plus size={20} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedSong && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 grid items-end bg-black/70 p-3 backdrop-blur-sm sm:place-items-center">
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#1a1d20] p-5 shadow-[0_28px_80px_-30px_rgba(0,0,0,0.9)] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-zinc-500">Add song</p><h3 className="mt-2 text-xl font-semibold">{selectedSong.title}</h3><p className="mt-1 text-sm text-zinc-500">{selectedSong.author || 'Unknown author'}</p></div>
                <button onClick={() => setSelectedSong(null)} className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white"><X size={18} /></button>
              </div>
              <div className="mt-6 space-y-2">
                <p className="mb-3 text-xs font-semibold text-zinc-400">Tambahkan sebagai</p>
                {([
                  ['after-current', 'Play next', 'Tepat setelah item aktif'],
                  ['end', 'Add to end', 'Di bagian akhir rundown'],
                ] as const).map(([value, title, description]) => (
                  <button key={value} onClick={() => setPosition(value)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${position === value ? 'border-emerald-400/45 bg-emerald-400/[0.08]' : 'border-white/10 bg-[#141619]'}`}>
                    <span className={`grid h-5 w-5 place-items-center rounded-full border ${position === value ? 'border-emerald-400 bg-emerald-400 text-emerald-950' : 'border-zinc-600'}`}>{position === value && <Check size={13} weight="bold" />}</span>
                    <span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs text-zinc-500">{description}</span></span>
                  </button>
                ))}
              </div>
              <button disabled={isAdding} onClick={() => void addSong()} className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-bold text-emerald-950 transition hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-wait disabled:opacity-55">{isAdding ? <CircleNotch size={19} className="animate-spin" /> : <Plus size={19} weight="bold" />} {isAdding ? 'Adding…' : 'Add to Rundown'}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addedTitle && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-400/25 bg-[#1b2a22] px-4 py-3 text-sm font-semibold text-emerald-100 shadow-xl">
            <Check size={18} weight="bold" /> {addedTitle} added
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function RemoteView() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [snapshot, setSnapshot] = useState<RemoteSnapshot | null>(null);
  const [tab, setTab] = useState<RemoteTab>('live');
  const [connected, setConnected] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setSnapshot(null);
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const hydrate = async () => {
      try {
        const response = await fetch('/api/remote/state', { headers: authHeaders(token) });
        if (response.status === 401) {
          if (active) clearSession();
          return;
        }
        if (!response.ok) throw new Error(await getApiError(response));
        const next = await response.json() as RemoteSnapshot;
        if (active) { setSnapshot(next); setConnected(true); setError(null); }
      } catch (hydrateError) {
        if (active) { setConnected(false); setError((hydrateError as Error).message); }
      }
    };
    void hydrate();
    const source = new EventSource(`/api/remote/events?token=${encodeURIComponent(token)}`);
    source.addEventListener('state', (event) => {
      if (!active) return;
      setSnapshot(JSON.parse(event.data) as RemoteSnapshot);
      setConnected(true);
      setPendingCommand(null);
      setError(null);
    });
    source.onerror = () => { if (active) setConnected(false); };
    const fallback = window.setInterval(() => void hydrate(), 5000);
    return () => { active = false; source.close(); window.clearInterval(fallback); };
  }, [token, clearSession]);

  const sendCommand = useCallback(async (type: RemoteCommandType, payload?: Record<string, string>) => {
    if (!token || !connected) return false;
    const commandId = crypto.randomUUID();
    setPendingCommand(commandId);
    setError(null);
    try {
      const response = await fetch('/api/remote/commands', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ commandId, type, payload }),
      });
      if (response.status === 401) { clearSession(); return false; }
      if (!response.ok) throw new Error(await getApiError(response));
      window.setTimeout(() => setPendingCommand((current) => current === commandId ? null : current), 2500);
      return true;
    } catch (commandError) {
      setPendingCommand(null);
      setError((commandError as Error).message || 'Command failed.');
      return false;
    }
  }, [token, connected, clearSession]);

  const availableTabs = useMemo(() => {
    if (!snapshot) return [];
    if (snapshot.role === 'viewer') return [];
    const list: Array<{ id: RemoteTab; label: string; icon: any }> = [
      { id: 'live', label: 'Live', icon: TelevisionSimple },
      { id: 'rundown', label: 'Rundown', icon: ListBullets },
    ];
    if (snapshot.permissions.addSongs) {
      list.push({ id: 'library', label: 'Library', icon: MusicNotes });
    }
    return list;
  }, [snapshot]);

  if (!token) return <PairingScreen onPaired={(nextToken, nextSnapshot) => { setToken(nextToken); setSnapshot(nextSnapshot); setConnected(true); }} />;

  if (!snapshot) {
    return <div className="grid min-h-[100dvh] place-items-center bg-[#101214] text-zinc-300"><div className="text-center"><CircleNotch size={28} className="mx-auto animate-spin text-emerald-300" /><p className="mt-4 text-sm">Connecting to RAMEDIA…</p>{error && <button onClick={clearSession} className="mt-4 text-xs text-red-300 underline">Pair again</button>}</div></div>;
  }

  const isViewer = snapshot.role === 'viewer';

  return (
    <div className="min-h-[100dvh] bg-[#101214] text-zinc-100 selection:bg-emerald-400/25">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#101214]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/12 text-emerald-300"><Broadcast size={19} weight="duotone" /></div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">RAMEDIA Remote</p>
              <p className="truncate text-[10px] uppercase tracking-[0.14em] text-zinc-500">{snapshot.serverName} · <span className="text-emerald-400 font-semibold">{snapshot.role.toUpperCase()}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2"><StatusPill connected={connected} /><button onClick={clearSession} title="Disconnect" className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white active:scale-[0.96]"><SignOut size={18} /></button></div>
        </div>
      </header>

      {isViewer ? (
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ViewerPanel snapshot={snapshot} />
        </div>
      ) : (
        <div className="mx-auto max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:pb-10 lg:pt-8">
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1">
              {availableTabs.map((item) => (
                <button key={item.id} onClick={() => setTab(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] ${tab === item.id ? 'bg-emerald-400/10 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.14)]' : 'text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200'}`}>
                  <item.icon size={19} weight={tab === item.id ? 'fill' : 'regular'} />
                  {item.label}
                </button>
              ))}
              <div className="mt-6 border-t border-white/[0.08] pt-5">
                <p className="px-4 text-[10px] font-bold uppercase tracking-[0.17em] text-zinc-600">Access Role</p>
                <p className="mt-2 px-4 text-xs font-bold uppercase tracking-wider text-emerald-400">{snapshot.role.replace('-', ' ')}</p>
              </div>
            </nav>
          </aside>

          <main className="min-w-0">
            {error && <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200"><span>{error}</span><button onClick={() => setError(null)}><X size={16} /></button></div>}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                {tab === 'live' && <LivePanel snapshot={snapshot} connected={connected} pendingCommand={pendingCommand} sendCommand={sendCommand} />}
                {tab === 'rundown' && <SlidesPanel snapshot={snapshot} connected={connected} sendCommand={sendCommand} />}
                {tab === 'library' && <LibraryPanel token={token} snapshot={snapshot} connected={connected} sendCommand={sendCommand} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      )}

      {!isViewer && availableTabs.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#15181a]/96 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
          <div className={`mx-auto grid max-w-md gap-1 ${availableTabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {availableTabs.map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold uppercase tracking-[0.08em] transition active:scale-[0.96] ${tab === item.id ? 'bg-emerald-400/10 text-emerald-300' : 'text-zinc-500'}`}>
                <item.icon size={20} weight={tab === item.id ? 'fill' : 'regular'} />
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
