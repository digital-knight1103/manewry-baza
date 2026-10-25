import { formatWagonCount } from '../../engine/counters';
import type { StationLayout } from '../../engine/types';
import { wagonCount, type StationState } from '../../engine/vehicles';
import { LABEL_FONT, LABEL_SIZE } from './style';

/** Wagon counters ("8 wagonów") at the positions given in station.json; empty tracks show nothing. */
export function Counters({ layout, state }: { layout: StationLayout; state: StationState }) {
  return (
    <g className="counters" fontFamily={LABEL_FONT} fontSize={LABEL_SIZE - 1} fontWeight={500} fill="#334155" pointerEvents="none">
      {layout.counters.map((c) => {
        const n = wagonCount(layout, state, c.edges);
        if (n === 0) return null;
        return (
          <text key={c.edges.join('+')} x={c.x} y={c.y}>
            {formatWagonCount(n)}
          </text>
        );
      })}
    </g>
  );
}
