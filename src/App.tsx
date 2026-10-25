import { useAppStore } from './store/useAppStore';
import { useScenarioStore } from './store/useScenarioStore';
import { useStationStore } from './store/useStationStore';
import { useUndoKeys } from './ui/keyboard';
import { KeyLegend } from './ui/KeyLegend';
import { PlaybackBar } from './ui/PlaybackBar';
import { SidePanel } from './ui/SidePanel';
import { StationView } from './ui/StationView';
import { Toolbar } from './ui/Toolbar';

export function App() {
  const name = useStationStore((s) => s.topo.layout.name);
  const message = useStationStore((s) => s.message);
  const mode = useAppStore((s) => s.mode);
  const recording = useScenarioStore((s) => s.recording);
  const driving = mode === 'drive' || recording;
  const playback = mode === 'scenario' && !recording;
  useUndoKeys();
  return (
    <div className="app">
      <Toolbar title="Symulator manewrów – baza wagonowa" />
      <main className="workspace">
        <section className="station">
          <StationView />
          {driving && <KeyLegend undo={!recording} />}
        </section>
        <SidePanel />
      </main>
      <footer className="status-bar">
        {playback && <PlaybackBar />}
        <div role="status">{message ?? name}</div>
      </footer>
    </div>
  );
}
