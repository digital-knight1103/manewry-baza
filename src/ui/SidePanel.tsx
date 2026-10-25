import { useAppStore } from '../store/useAppStore';
import { EditPanel } from './EditPanel';

const HINTS = {
  drive: 'Ręczne manewry lokomotywą i shunterem — dostępne w etapie E4.',
  scenario: 'Nagrywanie i odtwarzanie scenariuszy — dostępne w etapie E5.',
} as const;

export function SidePanel() {
  const mode = useAppStore((s) => s.mode);
  return <aside className="side-panel">{mode === 'edit' ? <EditPanel /> : <p className="muted">{HINTS[mode]}</p>}</aside>;
}
