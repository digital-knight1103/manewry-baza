import { useAppStore } from '../store/useAppStore';
import { DrivePanel } from './DrivePanel';
import { EditPanel } from './EditPanel';

export function SidePanel() {
  const mode = useAppStore((s) => s.mode);
  return (
    <aside className="side-panel">
      {mode === 'edit' && <EditPanel />}
      {mode === 'drive' && <DrivePanel />}
      {mode === 'scenario' && <p className="muted">Nagrywanie i odtwarzanie scenariuszy — dostępne w etapie E5.</p>}
    </aside>
  );
}
