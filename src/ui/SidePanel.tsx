import { useAppStore } from '../store/useAppStore';

const HINTS = {
  edit: 'Rozstawianie taboru na torach — dostępne w etapie E2.',
  drive: 'Ręczne manewry lokomotywą i shunterem — dostępne w etapie E4.',
  scenario: 'Nagrywanie i odtwarzanie scenariuszy — dostępne w etapie E5.',
} as const;

export function SidePanel() {
  const mode = useAppStore((s) => s.mode);
  return (
    <aside className="side-panel">
      <p>{HINTS[mode]}</p>
    </aside>
  );
}
