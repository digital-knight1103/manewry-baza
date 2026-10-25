import type { Hall as HallDef } from '../../engine/types';
import { OUTLINE_COLOR } from './style';

export function Hall({ hall }: { hall: HallDef }) {
  const { rect, channel } = hall;
  return (
    <g className="hall">
      <title>{hall.label}</title>
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={hall.fill} stroke={OUTLINE_COLOR} strokeWidth={1.2} />
      <line x1={hall.wallX} y1={rect.y} x2={hall.wallX} y2={rect.y + rect.h} stroke={OUTLINE_COLOR} strokeWidth={1.2} />
      <rect
        x={channel.x}
        y={channel.y}
        width={channel.w}
        height={channel.h}
        fill={hall.channelFill}
        stroke={OUTLINE_COLOR}
        strokeWidth={1}
      />
    </g>
  );
}
