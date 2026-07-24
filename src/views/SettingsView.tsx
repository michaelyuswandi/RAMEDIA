import SettingsModal from '../components/modals/SettingsModal';

export default function SettingsView() {
  const closeWindow = () => {
    if (window.api?.workspaceWindow) window.api.workspaceWindow.close();
    else window.close();
  };

  return (
    <SettingsModal
      standalone
      onDirtyChange={(dirty) => window.api?.workspaceWindow?.setDirty(dirty)}
      onSaved={() => window.api?.workspaceWindow?.notifySaved({ kind: 'settings' })}
      onClose={closeWindow}
    />
  );
}

