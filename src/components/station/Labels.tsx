import type { TrackLabel } from '../../engine/types';
import { LABEL_FONT, LABEL_SIZE } from './style';

export function Labels({ labels }: { labels: TrackLabel[] }) {
  return (
    <g className="labels" fontFamily={LABEL_FONT} fontSize={LABEL_SIZE} fill="#111">
      {labels.map((l) => (
        <text key={l.text} x={l.x} y={l.y}>
          {l.text}
        </text>
      ))}
    </g>
  );
}
