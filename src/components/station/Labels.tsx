import type { TrackLabel } from '../../engine/types';
import { GLYPH_WIDTH, LABEL_FONT, NAVY } from './style';

const PLATE_SIZE = 13;
const PAD = { x: 6, y: 4 };

/** Track names on navy plates (tabliczki); x, y from station.json = start of the text baseline. */
export function Labels({ labels }: { labels: TrackLabel[] }) {
  return (
    <g className="labels" fontFamily={LABEL_FONT} fontSize={PLATE_SIZE} fontWeight={600} pointerEvents="none">
      {labels.map((l) => {
        const w = l.text.length * PLATE_SIZE * GLYPH_WIDTH + 2 * PAD.x;
        const h = PLATE_SIZE + 2 * PAD.y;
        const y = l.y - PLATE_SIZE * 0.8 - PAD.y;
        return (
          <g key={l.text}>
            <rect x={l.x - PAD.x + 1} y={y + 1.5} width={w} height={h} rx={4} fill="#0b1b2b" opacity={0.15} />
            <rect x={l.x - PAD.x} y={y} width={w} height={h} rx={4} fill={NAVY} />
            <text x={l.x - PAD.x + w / 2} y={l.y - 1} textAnchor="middle" fill="#ffffff" letterSpacing={0.3}>
              {l.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
