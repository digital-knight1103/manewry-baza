import { useAppStore } from './store/useAppStore';
import { useStationStore } from './store/useStationStore';
import { useUndoKeys } from './ui/keyboard';
import { KeyLegend } from './ui/KeyLegend';
import { SidePanel } from './ui/SidePanel';
import { StationView } from './ui/StationView';
import { Toolbar } from './ui/Toolbar';

export function App() {
  const name = useStationStore((s) => s.topo.layout.name);
  const message = useStationStore((s) => s.message);
  const driving = useAppStore((s) => s.mode === 'drive');
  useUndoKeys();
  return (
    <div className="app">
      <Toolbar title="Symulator manewrów – baza wagonowa" />
      <main className="workspace">
        <section className="station">
          <StationView />
          {driving && <KeyLegend />}
        </section>
        <SidePanel />
      </main>
      <footer className="status-bar" role="status">
        {message ?? name}
      </footer>
    </div>
  );
}
