import { StationSvg } from './components/station/StationSvg';
import { useStationStore } from './store/useStationStore';
import { SidePanel } from './ui/SidePanel';
import { Toolbar } from './ui/Toolbar';

export function App() {
  const topo = useStationStore((s) => s.topo);
  const switchStates = useStationStore((s) => s.switchStates);
  return (
    <div className="app">
      <Toolbar title="Symulator manewrów – baza wagonowa" />
      <main className="workspace">
        <section className="station">
          <StationSvg topo={topo} switchStates={switchStates} />
        </section>
        <SidePanel />
      </main>
      <footer className="status-bar">{topo.layout.name} — schemat statyczny</footer>
    </div>
  );
}
