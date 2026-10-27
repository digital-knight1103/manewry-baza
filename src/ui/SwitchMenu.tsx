import { useEffect, useRef } from 'react';
import type { SwitchDef } from '../engine/types';

interface Props {
  sw: SwitchDef;
  current: number;
  /** Position relative to the station panel (px). */
  left: number;
  top: number;
  onPick: (stateIndex: number) => void;
  onClose: () => void;
}

/** Small menu next to a switch with more than two states: pick the state by name. */
export function SwitchMenu({ sw, current, left, top, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[aria-checked="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="switch-menu" role="menu" aria-label={`Rozjazd ${sw.id}`} style={{ left, top }}>
      <div className="switch-menu-title">Rozjazd {sw.id}</div>
      {sw.states.map((st, i) => (
        <button
          key={i}
          type="button"
          role="menuitemradio"
          aria-checked={i === current}
          className={i === current ? 'current' : undefined}
          onClick={() => {
            onPick(i);
            onClose();
          }}
        >
          <span className="switch-menu-mark">{i === current ? '●' : ''}</span>
          {st.name}
        </button>
      ))}
    </div>
  );
}
