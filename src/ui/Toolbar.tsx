import { useAppStore, type AppMode } from '../store/useAppStore';

const MODES: { id: AppMode; label: string }[] = [
  { id: 'edit', label: 'Edycja' },
  { id: 'drive', label: 'Jazda' },
  { id: 'scenario', label: 'Scenariusz' },
];

export function Toolbar({ title }: { title: string }) {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  return (
    <header className="toolbar">
      <h1>{title}</h1>
      <nav className="mode-switch" aria-label="Tryb aplikacji">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={m.id === mode ? 'active' : ''} aria-pressed={m.id === mode} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </nav>
      <button type="button" className="present" disabled title="Dostępne w kolejnych etapach">
        ▶ Prezentacja
      </button>
    </header>
  );
}
