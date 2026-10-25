import { useAppStore } from '../store/useAppStore';
import { DrivePanel } from './DrivePanel';
import { EditPanel } from './EditPanel';
import { ScenarioPanel } from './ScenarioPanel';

export function SidePanel() {
  const mode = useAppStore((s) => s.mode);
  return (
    <aside className="side-panel">
      {mode === 'edit' && <EditPanel />}
      {mode === 'drive' && <DrivePanel />}
      {mode === 'scenario' && <ScenarioPanel />}
    </aside>
  );
}
