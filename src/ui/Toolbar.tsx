import { useAppStore, type AppMode, type ViewStyle } from '../store/useAppStore';
import { useScenarioStore } from '../store/useScenarioStore';
import { Icon } from './icons';
import { openPresentation } from './presentationControl';

const MODES: { id: AppMode; label: string }[] = [
  { id: 'edit', label: 'Edycja' },
  { id: 'drive', label: 'Jazda' },
  { id: 'scenario', label: 'Scenariusz' },
];

const VIEWS: { id: ViewStyle; label: string; title: string }[] = [
  { id: 'schematic', label: 'schematyczny', title: 'Pojazdy jako kolorowe prostokąty' },
  { id: 'detailed', label: 'szczegółowy', title: 'Pojazdy z wózkami, kabiną i kołami' },
];

/** Logo mark: two rails and sleepers. */
function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <g stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round">
        <path d="M9 7 7 25M23 7l2 18" />
      </g>
      <g stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round">
        <path d="M8 11h16M7.6 16h16.8M7.2 21h17.6" />
      </g>
    </svg>
  );
}

export function Toolbar({ title }: { title: string }) {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const scenario = useScenarioStore((s) => s.active());
  const ready = !!scenario && scenario.steps.length > 0;
  return (
    <header className="toolbar">
      <div className="brand">
        <Mark />
        <h1>{title}</h1>
      </div>
      <nav className="segmented" aria-label="Tryb aplikacji">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={m.id === mode ? 'active' : ''} aria-pressed={m.id === mode} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </nav>
      <div className="view-switch">
        <span>Widok:</span>
        <div className="segmented small" role="group" aria-label="Widok pojazdów">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={v.id === view ? 'active' : ''}
              aria-pressed={v.id === view}
              title={v.title}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="present"
        disabled={!ready}
        title={ready ? `Prezentacja scenariusza „${scenario.title}” na pełnym ekranie` : 'Wybierz w trybie Scenariusz scenariusz z krokami'}
        onClick={() => scenario && openPresentation(scenario.id)}
      >
        <Icon name="present" /> Prezentacja
      </button>
    </header>
  );
}
