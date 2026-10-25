import { useStationStore } from './store/useStationStore';
import { SidePanel } from './ui/SidePanel';
import { StationView } from './ui/StationView';
import { Toolbar } from './ui/Toolbar';

export function App() {
  const name = useStationStore((s) => s.topo.layout.name);
  const message = useStationStore((s) => s.message);
  return (
    <div className="app">
      <Toolbar title="Symulator manewrów – baza wagonowa" />
      <main className="workspace">
        <section className="station">
          <StationView />
        </section>
        <SidePanel />
      </main>
      <footer className="status-bar" role="status">
        {message ?? name}
      </footer>
    </div>
  );
}
