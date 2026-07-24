import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, PaperPlaneTilt, X } from '@phosphor-icons/react';
import type { OutputAlertTone } from '../../core/models/types';
import { usePresentationStore } from '../../core/stores/usePresentationStore';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { useI18n } from '../../i18n';

const MESSAGE_LIMIT = 160;

export function QuickAlertPopover() {
  const { t } = useI18n();
  const outputs = useSettingsStore((state) => state.outputs);
  const enabledOutputs = useMemo(() => outputs.filter((output) => output.enabled), [outputs]);
  const { manualAlert, showAlert, hideAlert } = usePresentationStore();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<OutputAlertTone>('info');
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const [duration, setDuration] = useState('8000');
  const [selectedOutputIds, setSelectedOutputIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const presets: Array<{ label: string; text: string; tone: OutputAlertTone }> = useMemo(() => [
    { label: t('alert.presetAnnouncement'), text: t('alert.presetAnnouncementText'), tone: 'info' },
    { label: t('alert.presetParking'), text: t('alert.presetParkingText'), tone: 'neutral' },
    { label: t('alert.presetLostChild'), text: t('alert.presetLostChildText'), tone: 'warning' },
  ], [t]);

  const enabledOutputIds = useMemo(() => enabledOutputs.map((output) => output.id), [enabledOutputs]);
  const activeTargetCount = manualAlert?.targetOutputIds.length || 0;

  useEffect(() => {
    setSelectedOutputIds((current) => {
      const valid = current.filter((id) => enabledOutputIds.includes(id));
      if (valid.length > 0 || enabledOutputIds.length === 0) return valid;
      const primary = enabledOutputs.find((output) => output.isPrimary) || enabledOutputs[0];
      return primary ? [primary.id] : [];
    });
  }, [enabledOutputIds, enabledOutputs]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleOutput = (outputId: string) => {
    setValidationError(null);
    setSelectedOutputIds((current) => (
      current.includes(outputId)
        ? current.filter((id) => id !== outputId)
        : [...current, outputId]
    ));
  };

  const sendAlert = () => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      setValidationError(t('alert.writeMessageError'));
      return;
    }
    if (selectedOutputIds.length === 0) {
      setValidationError(t('alert.selectTargetError'));
      return;
    }

    showAlert({
      text: normalizedMessage,
      tone,
      targetOutputIds: selectedOutputIds,
      position,
      durationMs: duration === 'hold' ? null : Number(duration),
    });
    setValidationError(null);
  };

  const popup = typeof document === 'undefined' ? null : createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="theme-scope fixed inset-0 z-[80] flex items-center justify-center bg-background/[0.55] p-4 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('alert.quickAlert')}
            className="w-full max-w-[430px] overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-[0_28px_72px_rgba(0,0,0,0.42)]"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 27 }}
          >
          <div className="flex items-center justify-between border-b border-text/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell size={16} weight="bold" className="text-primary" />
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-text">{t('alert.quickAlert')}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className={`flex items-center gap-1.5 text-[10px] font-bold ${manualAlert ? 'text-success' : 'text-text/35'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${manualAlert ? 'bg-success' : 'bg-text/25'}`} />
                {manualAlert ? t('alert.activeOnScreens', { count: activeTargetCount }) : t('alert.notActive')}
              </span>
              <button
                type="button"
                aria-label={t('alert.closeQuickAlert')}
                onClick={() => setIsOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-md text-text/40 transition hover:bg-text/10 hover:text-text active:scale-[0.98]"
              >
                <X size={15} weight="bold" />
              </button>
            </div>
          </div>

          <div className="space-y-3.5 p-4">
            <label className="block space-y-1.5">
              <span className="flex items-center justify-between text-[10px] font-bold text-text/65">
                <span>{t('alert.message')}</span>
                <span className="font-mono text-text/35">{message.length} / {MESSAGE_LIMIT}</span>
              </span>
              <textarea
                autoFocus
                value={message}
                maxLength={MESSAGE_LIMIT}
                rows={3}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setValidationError(null);
                }}
                placeholder={t('alert.writeBriefInfoPlaceholder')}
                className="w-full resize-none rounded-lg border border-text/10 bg-text/[0.045] px-3 py-2 text-xs leading-5 text-text outline-none transition placeholder:text-text/30 focus:border-primary/60 focus:bg-text/[0.06] focus:ring-2 focus:ring-primary/10"
              />
            </label>

            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold text-text/65">{t('alert.displayOn')}</span>
              {enabledOutputs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {enabledOutputs.map((output) => {
                    const selected = selectedOutputIds.includes(output.id);
                    return (
                      <button
                        key={output.id}
                        type="button"
                        onClick={() => toggleOutput(output.id)}
                        className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-bold transition active:scale-[0.98] ${
                          selected
                            ? 'border-primary/50 bg-primary/[0.12] text-primary'
                            : 'border-text/10 bg-text/[0.035] text-text/55 hover:border-text/20 hover:bg-text/[0.07] hover:text-text'
                        }`}
                      >
                        <span className={`grid h-3.5 w-3.5 place-items-center rounded-full ${selected ? 'bg-primary text-black' : 'border border-text/20'}`}>
                          {selected ? <Check size={9} weight="bold" /> : null}
                        </span>
                        {output.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-text/15 px-3 py-2 text-[10px] text-text/45">
                  {t('alert.noActiveOutputs')}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1.5">
                <span className="block text-[10px] font-bold text-text/65">{t('alert.type')}</span>
                <select value={tone} onChange={(event) => setTone(event.target.value as OutputAlertTone)} className="h-8 w-full rounded-lg border border-text/10 bg-surface px-2 text-[10px] font-semibold text-text/70 outline-none focus:border-primary/60">
                  <option value="info">{t('alert.info')}</option>
                  <option value="warning">{t('alert.warning')}</option>
                  <option value="emergency">{t('alert.emergency')}</option>
                  <option value="neutral">{t('alert.neutral')}</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="block text-[10px] font-bold text-text/65">{t('alert.duration')}</span>
                <select value={duration} onChange={(event) => setDuration(event.target.value)} className="h-8 w-full rounded-lg border border-text/10 bg-surface px-2 text-[10px] font-semibold text-text/70 outline-none focus:border-primary/60">
                  <option value="5000">{t('alert.sec5')}</option>
                  <option value="8000">{t('alert.sec8')}</option>
                  <option value="15000">{t('alert.sec15')}</option>
                  <option value="30000">{t('alert.sec30')}</option>
                  <option value="hold">{t('alert.untilClosed')}</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="block text-[10px] font-bold text-text/65">{t('alert.position')}</span>
                <select value={position} onChange={(event) => setPosition(event.target.value === 'top' ? 'top' : 'bottom')} className="h-8 w-full rounded-lg border border-text/10 bg-surface px-2 text-[10px] font-semibold text-text/70 outline-none focus:border-primary/60">
                  <option value="bottom">{t('alert.bottom')}</option>
                  <option value="top">{t('alert.top')}</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setMessage(preset.text);
                    setTone(preset.tone);
                    setValidationError(null);
                  }}
                  className="h-7 rounded-md border border-text/10 bg-text/[0.025] px-2.5 text-[9px] font-bold text-text/45 transition hover:border-text/20 hover:bg-text/[0.07] hover:text-text active:scale-[0.98]"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {validationError ? (
              <p className="text-[10px] font-semibold text-error">{validationError}</p>
            ) : null}

            <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-text/10 pt-3">
              <button
                type="button"
                onClick={sendAlert}
                disabled={enabledOutputs.length === 0}
                className="control-button-primary flex h-9 items-center justify-center gap-2 px-4 text-[10px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <PaperPlaneTilt size={14} weight="fill" />
                {t('alert.sendAlert')}
              </button>
              <button
                type="button"
                onClick={hideAlert}
                disabled={!manualAlert}
                className="control-button h-9 px-3 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('alert.hideAlert')}
              </button>
            </div>
          </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={t('alert.quickAlert')}
        onClick={() => setIsOpen((current) => !current)}
        className={`relative flex h-10 items-center gap-2 rounded-lg border px-3 text-[11px] font-extrabold transition active:scale-[0.98] ${
          isOpen
            ? 'border-primary/50 bg-primary/[0.12] text-primary'
            : 'border-text/10 bg-surface text-text/60 hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
        }`}
      >
        <Bell size={16} weight={isOpen ? 'fill' : 'bold'} />
        {t('alert.alert')}
        {manualAlert ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" /> : null}
      </button>
      {popup}
    </>
  );
}
