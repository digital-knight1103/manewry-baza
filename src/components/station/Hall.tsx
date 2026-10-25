import type { Hall as HallDef } from '../../engine/types';
import { NAVY, OUTLINE_COLOR } from './style';

const SHADOW = { dx: 2.5, dy: 3.5 };
const WALL_WIDTH = 4;

/** Hall: soft shadow, building outline, end wall and the hatched inspection pit (kanał rewizyjny). */
export function Hall({ hall }: { hall: HallDef }) {
  const { rect, channel } = hall;
  return (
    <g className="hall">
      <title>{hall.label}</title>
      <defs>
        <pattern id="pit-hatch" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={5} height={5} fill={hall.channelFill} />
          <line x1={0} y1={0} x2={0} y2={5} stroke="#6b7280" strokeWidth={1.2} />
        </pattern>
      </defs>
      <rect x={rect.x + SHADOW.dx} y={rect.y + SHADOW.dy} width={rect.w} height={rect.h} rx={3} fill="#0b1b2b" opacity={0.12} />
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={3} fill={hall.fill} stroke={NAVY} strokeWidth={1.6} />
      {/* roof edge */}
      <line x1={rect.x + 3} y1={rect.y + 3.5} x2={rect.x + rect.w - 3} y2={rect.y + 3.5} stroke={NAVY} strokeOpacity={0.25} strokeWidth={1} />
      <rect x={hall.wallX - WALL_WIDTH / 2} y={rect.y} width={WALL_WIDTH} height={rect.h} fill={NAVY} opacity={0.85} />
      <rect
        x={channel.x}
        y={channel.y}
        width={channel.w}
        height={channel.h}
        rx={1.5}
        fill="url(#pit-hatch)"
        stroke={OUTLINE_COLOR}
        strokeWidth={1}
      />
    </g>
  );
}
