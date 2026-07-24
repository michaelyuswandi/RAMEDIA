import { useEffect } from 'react';
import { usePresentationStore } from '../core/stores/usePresentationStore';
import { sync } from '../core/sync';
import { RoleOutputSurface } from '../components/common/RoleOutputSurface';
import { isScreenProfileId, type ScreenProfileId } from '../core/screens/screenProfiles';
import { useSettingsStore } from '../core/stores/useSettingsStore';
import { resolveEffectiveOutputChannel } from '../core/models/outputSettings';

function readOutputContext(): { outputId: string | null; role: ScreenProfileId; name: string | null } {
  const rawHash = window.location.hash || '#/output';
  const queryIndex = rawHash.indexOf('?');
  const query = queryIndex >= 0 ? rawHash.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(query);
  const roleParam = params.get('role');
  const nameParam = params.get('name');
  const outputIdParam = params.get('outputId');
  return {
    outputId: outputIdParam || null,
    role: isScreenProfileId(roleParam) ? roleParam : 'audience',
    name: nameParam || null,
  };
}

export default function OutputView() {
  const { currentSlide, previousSlide, nextSlide, isBlack, isClear, isLogo, pointer, transitionMode, annotations, liveCapture, mediaPlayback, manualAlert, receiveUpdate, setCaptureError } = usePresentationStore();
  const settings = useSettingsStore();
  const outputContext = readOutputContext();
  const rawOutputConfig = outputContext.outputId
    ? settings.outputs.find((output) => output.id === outputContext.outputId) || null
    : null;
  const outputConfig = resolveEffectiveOutputChannel(settings, rawOutputConfig);
  const resolvedRole = outputConfig?.role || outputContext.role;
  const resolvedName = outputConfig?.name || outputContext.name || undefined;
  const transparentBackground = outputConfig?.targetType === 'ndi' && !!outputConfig.ndiConfig.alphaEnabled;

  // Listen for sync events
  useEffect(() => {
    const unsub = sync.subscribe('STATE_UPDATE', (msg) => {
      receiveUpdate(msg.type, msg.payload);
    });

    // ready-to-show can fire before this component subscribes. Pull the latest
    // state after subscribing so an already-live slide is never missed.
    if (window.api?.sync?.getPresentationSnapshot) {
      window.api.sync.getPresentationSnapshot(outputContext.outputId)
        .then((snapshot) => receiveUpdate('STATE_SNAPSHOT', snapshot))
        .catch((error) => console.error('[Output] Failed to load presentation snapshot:', error));
    }

    return unsub;
  }, [outputContext.outputId, receiveUpdate]);

  return (
    <div className={`h-[100dvh] w-screen overflow-hidden ${transparentBackground ? 'bg-transparent' : 'bg-black'}`}>
      <RoleOutputSurface
        role={resolvedRole}
        outputConfig={outputConfig}
        outputName={resolvedName}
        currentSlide={currentSlide}
        previousSlide={previousSlide}
        nextSlide={nextSlide}
        isBlack={isBlack}
        isClear={isClear}
        isLogo={isLogo}
        logoOutput={settings.logoOutput}
        pointer={pointer}
        annotations={annotations}
        transitionMode={transitionMode}
        liveCapture={liveCapture}
        mediaPlayback={mediaPlayback}
        manualAlert={manualAlert}
        onCaptureError={setCaptureError}
        transparentBackground={transparentBackground}
      />
    </div>
  );
}
