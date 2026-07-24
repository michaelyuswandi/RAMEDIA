import { useState } from 'react';
import {
  ArrowClockwise,
  Broadcast,
  Check,
  Copy,
  DeviceMobile,
  LinkSimple,
  ShieldCheck,
  Trash,
  WifiHigh,
} from '@phosphor-icons/react';
import type { RemoteRuntimeSummary, RemoteSettings } from '../../../core/remote/types';
import { useI18n } from '../../../i18n';

interface RemoteControlSettingsWorkspaceProps {
  runtime: RemoteRuntimeSummary | null;
  onRuntimeChange: (runtime: RemoteRuntimeSummary) => void;
}

export function RemoteControlSettingsWorkspace({ runtime, onRuntimeChange }: RemoteControlSettingsWorkspaceProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copy = async (value: string, id: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const update = async (patch: Partial<RemoteSettings>) => {
    if (!window.api?.remote) return;
    setBusy('settings');
    setError(null);
    try {
      onRuntimeChange(await window.api.remote.setSettings(patch));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update Remote Control.');
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    if (!window.api?.remote) return;
    if (!confirm('Regenerate the pairing code? All paired web remotes will be disconnected.')) return;
    setBusy('code');
    setError(null);
    try {
      onRuntimeChange(await window.api.remote.regenerateCode());
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : 'Failed to regenerate code.');
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (sessionId?: string) => {
    if (!window.api?.remote) return;
    setBusy(sessionId || 'all');
    setError(null);
    try {
      onRuntimeChange(await window.api.remote.revokeSession(sessionId || null));
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke remote.');
    } finally {
      setBusy(null);
    }
  };

  if (!runtime) {
    return (
      <div className="p-6">
        <div className="max-w-5xl animate-pulse space-y-4"><div className="h-28 rounded-2xl bg-text/5" /><div className="h-52 rounded-2xl bg-text/5" /></div>
      </div>
    );
  }

  const primaryUrl = runtime.urls.find((url) => !url.includes('localhost')) || runtime.urls[0] || `http://localhost:${runtime.port}/remote`;

  return (
    <div className="p-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="max-w-5xl space-y-6">
        <section className="grid gap-5 rounded-2xl border border-text/8 bg-black/10 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${runtime.enabled ? 'bg-emerald-500/12 text-emerald-400' : 'bg-text/5 text-text/35'}`}>
              <Broadcast size={22} weight="duotone" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-text">{t('remoteControlWorkspace.title')}</h3>
                <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.13em] ${runtime.enabled ? 'border-emerald-500/25 bg-emerald-500/8 text-emerald-400' : 'border-text/10 text-text/35'}`}>
                  {runtime.enabled ? t('remoteControlWorkspace.acceptingConnections') : t('remoteControlWorkspace.disabled')}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-text/50">
                {t('remoteControlWorkspace.description')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void update({ enabled: !runtime.enabled })}
            disabled={busy === 'settings'}
            role="switch"
            aria-checked={runtime.enabled}
            className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors active:scale-[0.98] disabled:opacity-50 ${runtime.enabled ? 'border-emerald-400/40 bg-emerald-500/25' : 'border-text/15 bg-text/5'}`}
            aria-label={runtime.enabled ? 'Disable Web Remote' : 'Enable Web Remote'}
          >
            <span className={`pointer-events-none absolute left-1 top-1 h-6 w-6 rounded-full transition-transform duration-200 ${runtime.enabled ? 'translate-x-6 bg-emerald-300' : 'translate-x-0 bg-text/40'}`} />
          </button>
        </section>

        {error && <div className="rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-xs text-red-300">{error}</div>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
          <section className="rounded-2xl border border-text/8 bg-black/10 p-5">
            <div className="flex items-center gap-2"><LinkSimple size={17} className="text-primary" /><h3 className="text-sm font-semibold text-text">{t('remoteControlWorkspace.connectDevice')}</h3></div>
            <p className="mt-2 text-xs leading-5 text-text/45">{t('remoteControlWorkspace.connectDeviceDesc')}</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/35">{t('remoteControlWorkspace.pairingCode')}</label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex h-14 flex-1 items-center rounded-xl border border-text/10 bg-background px-4 font-mono text-2xl font-bold tracking-[0.24em] text-text">{runtime.accessCode}</div>
                  <button onClick={() => void copy(runtime.accessCode, 'code')} className="grid h-14 w-14 place-items-center rounded-xl border border-text/10 text-text/55 transition hover:bg-text/5 hover:text-text active:scale-[0.98]" title="Copy pairing code">{copied === 'code' ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}</button>
                  <button onClick={() => void regenerate()} disabled={busy === 'code'} className="grid h-14 w-14 place-items-center rounded-xl border border-text/10 text-text/55 transition hover:bg-text/5 hover:text-text active:scale-[0.98] disabled:opacity-45" title="Regenerate pairing code"><ArrowClockwise size={20} className={busy === 'code' ? 'animate-spin' : ''} /></button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/35">{t('remoteControlWorkspace.remoteAddress')}</label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-xl border border-text/10 bg-background px-4 py-3 font-mono text-xs text-text/65"><span className="block truncate">{primaryUrl}</span></div>
                  <button onClick={() => void copy(primaryUrl, 'link')} className="flex h-11 items-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-4 text-xs font-bold text-primary transition hover:bg-primary/12 active:scale-[0.98]">{copied === 'link' ? <Check size={16} /> : <Copy size={16} />} {copied === 'link' ? t('remoteControlWorkspace.copied') : t('remoteControlWorkspace.copyAddress')}</button>
                </div>
              </div>

              <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-4 py-3 text-xs leading-5 text-text/50">
                {t('remoteControlWorkspace.sameNetworkWarning', { port: runtime.port })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-text/8 bg-black/10 p-5">
            <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-primary" /><h3 className="text-sm font-semibold text-text">{t('remoteControlWorkspace.securityTitle')}</h3></div>
            <p className="mt-2 text-xs leading-5 text-text/45">{t('remoteControlWorkspace.securityDesc')}</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-text/8 bg-background/45 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-text">{t('remoteControlWorkspace.roleOperator')}</span>
                    <p className="text-[10px] text-text/40">{t('remoteControlWorkspace.connectDeviceDesc')} ({runtime.accessCode})</p>
                  </div>
                  <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">{t('remoteControlWorkspace.masterCodeBadge')}</span>
                </div>
              </div>

              <div className="rounded-xl border border-text/8 bg-background/45 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-text">{t('remoteControlWorkspace.presenterPinLabel')}</span>
                    <p className="text-[10px] text-text/40">{t('remoteControlWorkspace.presenterPinDesc')}</p>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={runtime.security?.presenterPin || ''}
                    onChange={(e) => void update({ security: { ...runtime.security, presenterPin: e.target.value.trim() } })}
                    className="h-8 w-24 rounded-lg border border-text/10 bg-background px-3 text-center font-mono text-xs font-bold text-text outline-none focus:border-primary/50"
                    placeholder="1234"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-text/8 bg-background/45 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-text">{t('remoteControlWorkspace.worshipLeaderPinLabel')}</span>
                    <p className="text-[10px] text-text/40">{t('remoteControlWorkspace.worshipLeaderPinDesc')}</p>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={runtime.security?.worshipLeaderPin || ''}
                    onChange={(e) => void update({ security: { ...runtime.security, worshipLeaderPin: e.target.value.trim() } })}
                    className="h-8 w-24 rounded-lg border border-text/10 bg-background px-3 text-center font-mono text-xs font-bold text-text outline-none focus:border-primary/50"
                    placeholder="5678"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-text/8 bg-background/45 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-text">{t('remoteControlWorkspace.viewerPinLabel')}</span>
                    <p className="text-[10px] text-text/40">{t('remoteControlWorkspace.viewerPinDesc')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void update({ security: { ...runtime.security, viewerRequirePin: !runtime.security?.viewerRequirePin } })}
                      className={`relative h-6 w-11 rounded-full border transition ${runtime.security?.viewerRequirePin ? 'border-emerald-400/40 bg-emerald-500/25' : 'border-text/15 bg-text/5'}`}
                    >
                      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition ${runtime.security?.viewerRequirePin ? 'translate-x-5 bg-emerald-300' : 'translate-x-0 bg-text/40'}`} />
                    </button>
                    {runtime.security?.viewerRequirePin && (
                      <input
                        type="text"
                        maxLength={6}
                        value={runtime.security?.viewerPin || ''}
                        onChange={(e) => void update({ security: { ...runtime.security, viewerPin: e.target.value.trim() } })}
                        className="h-8 w-20 rounded-lg border border-text/10 bg-background px-2 text-center font-mono text-xs font-bold text-text outline-none focus:border-primary/50"
                        placeholder="0000"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-text/8 bg-black/10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-text/8 px-5 py-4">
            <div><div className="flex items-center gap-2"><WifiHigh size={17} className="text-primary" /><h3 className="text-sm font-semibold text-text">{t('remoteControlWorkspace.pairedDevices')}</h3></div><p className="mt-1 text-[11px] text-text/40">{t('remoteControlWorkspace.activeSessions', { count: runtime.activeSessions })}</p></div>
            {runtime.sessions.length > 0 && <button onClick={() => void revoke()} disabled={busy === 'all'} className="flex items-center gap-2 rounded-lg border border-red-400/15 px-3 py-2 text-[11px] font-bold text-red-400 transition hover:bg-red-400/8 active:scale-[0.98]"><Trash size={15} /> {t('remoteControlWorkspace.revokeAll')}</button>}
          </div>
          {runtime.sessions.length === 0 ? (
            <div className="grid min-h-36 place-items-center px-6 text-center"><div><DeviceMobile size={27} className="mx-auto text-text/25" /><p className="mt-3 text-xs text-text/40">{t('remoteControlWorkspace.noPairedDevices')}</p></div></div>
          ) : (
            <div className="divide-y divide-text/8">
              {runtime.sessions.map((session) => (
                <div key={session.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
                  <div className="min-w-0"><p className="truncate text-xs font-semibold text-text">{session.deviceName}</p><p className="mt-1 text-[10px] capitalize text-text/40">{session.role.replace('-', ' ')} · Last seen {new Date(session.lastSeen).toLocaleTimeString()}</p></div>
                  <button onClick={() => void revoke(session.id)} disabled={busy === session.id} className="grid h-9 w-9 place-items-center rounded-lg text-text/35 transition hover:bg-red-400/8 hover:text-red-400 active:scale-[0.96]" title="Revoke device"><Trash size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
