import BibleSettingsModal from '../components/modals/BibleSettingsModal';

export default function BibleSettingsView() {
  const closeWindow = () => {
    if (window.api?.workspaceWindow) window.api.workspaceWindow.close();
    else window.close();
  };

  return (
    <BibleSettingsModal
      onClose={closeWindow}
    />
  );
}
