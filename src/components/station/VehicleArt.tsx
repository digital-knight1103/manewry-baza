import type { ArtKind } from './artKind';
import { ACCENT, OUTLINE_COLOR } from './style';

/**
 * Detailed drawings of rolling stock in local coordinates: origin in the middle of the vehicle,
 * x along the vehicle (−length/2 … +length/2), y across it (screen down), total height ≈ 20 units
 * like the plain band of the schematic view. Couplers sit on y = 0 (the track centreline).
 */

const BODY_TOP = -7.5;
const BODY_BOTTOM = 4;
const WHEEL_Y = 6.4;
const WHEEL_R = 2.5;
const FRAME_COLOR = '#2b3440';
const WHEEL_COLOR = '#1f2937';
const SPOKE_COLOR = '#aab4c0';
const SHADOW = { dx: 1.2, dy: 1.8, opacity: 0.16 };

export interface ArtProps {
  kind: ArtKind;
  length: number;
  color: string;
  /** Rotation of the wheels in degrees (spins while the vehicle moves). */
  wheelAngle?: number;
  /** End the driver's cab is at (locomotive): +1 = +x, −1 = −x. */
  facing?: 1 | -1;
  /** Direction of travel: head light at that end, tail light at the other; 0 = lights off. */
  light?: 1 | -1 | 0;
}

function Wheel({ x, y = WHEEL_Y, r = WHEEL_R, angle }: { x: number; y?: number; r?: number; angle: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={WHEEL_COLOR} />
      <g transform={`rotate(${angle.toFixed(1)} ${x} ${y})`} stroke={SPOKE_COLOR} strokeWidth={0.6}>
        <line x1={x - r * 0.75} y1={y} x2={x + r * 0.75} y2={y} />
        <line x1={x} y1={y - r * 0.75} x2={x} y2={y + r * 0.75} />
      </g>
      <circle cx={x} cy={y} r={r * 0.28} fill={SPOKE_COLOR} />
    </g>
  );
}

/** Bogie: frame with two wheels. */
function Bogie({ x, angle, spread = 3.1 }: { x: number; angle: number; spread?: number }) {
  return (
    <g>
      <rect x={x - spread - 2.6} y={BODY_BOTTOM - 0.2} width={2 * spread + 5.2} height={2.6} rx={1} fill={FRAME_COLOR} />
      <Wheel x={x - spread} angle={angle} />
      <Wheel x={x + spread} angle={angle} />
    </g>
  );
}

/** Buffers and coupler hooks at both ends, on the centreline. */
function Buffers({ half }: { half: number }) {
  return (
    <g fill="#4b5563">
      <rect x={-half - 1.4} y={-1.3} width={1.6} height={2.6} rx={0.5} />
      <rect x={half - 0.2} y={-1.3} width={1.6} height={2.6} rx={0.5} />
    </g>
  );
}

function Shadow({ x, y, w, h, rx = 2 }: { x: number; y: number; w: number; h: number; rx?: number }) {
  return <rect x={x + SHADOW.dx} y={y + SHADOW.dy} width={w} height={h} rx={rx} fill="#0b1b2b" opacity={SHADOW.opacity} />;
}

function Lights({ half, light }: { half: number; light: 1 | -1 | 0 }) {
  if (light === 0) return null;
  const head = light * (half - 0.9);
  const tail = -light * (half - 0.9);
  return (
    <g pointerEvents="none">
      <circle cx={head + light * 3} cy={-2} r={5.5} fill="#ffe066" opacity={0.6} />
      <circle cx={head} cy={-2} r={1.6} fill="#fffde7" stroke="#f59e0b" strokeWidth={0.6} />
      <circle cx={tail} cy={-2} r={0.95} fill="#e53935" />
    </g>
  );
}

function Wagon({ length, color, wheelAngle = 0 }: ArtProps) {
  const half = length / 2;
  const bogieX = half - 6.5;
  const w = length - 1.6;
  return (
    <g>
      <Shadow x={-half + 0.8} y={BODY_TOP} w={w} h={BODY_BOTTOM - BODY_TOP + 4} />
      <Buffers half={half} />
      <Bogie x={-bogieX} angle={wheelAngle} />
      <Bogie x={bogieX} angle={wheelAngle} />
      <rect x={-half + 0.8} y={BODY_TOP} width={w} height={BODY_BOTTOM - BODY_TOP} rx={2.2} fill={color} stroke={OUTLINE_COLOR} strokeWidth={0.9} />
      {/* roof highlight and sliding door */}
      <line x1={-half + 2.6} y1={BODY_TOP + 1.6} x2={half - 2.6} y2={BODY_TOP + 1.6} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} />
      <g stroke={OUTLINE_COLOR} strokeOpacity={0.3} strokeWidth={0.6}>
        <line x1={-4.5} y1={BODY_TOP + 2.6} x2={-4.5} y2={BODY_BOTTOM - 1} />
        <line x1={4.5} y1={BODY_TOP + 2.6} x2={4.5} y2={BODY_BOTTOM - 1} />
      </g>
    </g>
  );
}

function Platform({ length, color, wheelAngle = 0 }: ArtProps) {
  const half = length / 2;
  const deckTop = -1.5;
  const sets = Math.max(1, Math.floor((length - 8) / 12));
  const step = (length - 10) / sets;
  return (
    <g>
      <Shadow x={-half + 0.8} y={-9} w={length - 1.6} h={15} />
      <Buffers half={half} />
      <Bogie x={-(half - 6.5)} angle={wheelAngle} />
      <Bogie x={half - 6.5} angle={wheelAngle} />
      <rect x={-half + 0.8} y={deckTop} width={length - 1.6} height={BODY_BOTTOM - deckTop + 0.4} rx={1.4} fill={color} stroke={OUTLINE_COLOR} strokeWidth={0.9} />
      {/* wheelsets carried on the deck */}
      {Array.from({ length: sets }, (_, i) => {
        const x = -half + 5 + step * (i + 0.5);
        return (
          <g key={i}>
            <circle cx={x} cy={deckTop - 4.4} r={4.4} fill="#4b5563" stroke={OUTLINE_COLOR} strokeWidth={0.7} />
            <circle cx={x} cy={deckTop - 4.4} r={2.6} fill="none" stroke="#9aa5b1" strokeWidth={0.7} />
            <circle cx={x} cy={deckTop - 4.4} r={0.9} fill="#d1d5db" />
          </g>
        );
      })}
    </g>
  );
}

function Loco({ length, color, wheelAngle = 0, facing = 1, light = 0 }: ArtProps) {
  const half = length / 2;
  const cabW = 13;
  const cabX = facing === 1 ? half - 1 - cabW : -half + 1;
  const hoodX = facing === 1 ? -half + 2 : -half + 1 + cabW;
  const hoodW = length - 3 - cabW;
  const winX = facing === 1 ? cabX + 3 : cabX + 2;
  return (
    <g>
      <Shadow x={-half + 0.8} y={BODY_TOP - 1} w={length - 1.6} h={BODY_BOTTOM - BODY_TOP + 5} />
      <Buffers half={half} />
      <Bogie x={-(half - 9)} angle={wheelAngle} spread={3.6} />
      <Bogie x={half - 9} angle={wheelAngle} spread={3.6} />
      {/* frame */}
      <rect x={-half + 0.6} y={BODY_BOTTOM - 2.4} width={length - 1.2} height={2.6} rx={0.8} fill={FRAME_COLOR} />
      {/* hood */}
      <rect x={hoodX} y={BODY_TOP + 2.5} width={hoodW} height={BODY_BOTTOM - BODY_TOP - 4.6} rx={1.8} fill={color} stroke={OUTLINE_COLOR} strokeWidth={0.9} />
      <g stroke={OUTLINE_COLOR} strokeOpacity={0.28} strokeWidth={0.6}>
        {Array.from({ length: Math.floor(hoodW / 6) - 1 }, (_, i) => {
          const x = hoodX + 6 * (i + 1);
          return <line key={i} x1={x} y1={BODY_TOP + 4} x2={x} y2={BODY_BOTTOM - 3.5} />;
        })}
      </g>
      {/* cab with window */}
      <rect x={cabX} y={BODY_TOP - 1} width={cabW} height={BODY_BOTTOM - BODY_TOP - 1} rx={2} fill={color} stroke={OUTLINE_COLOR} strokeWidth={0.9} />
      <rect x={winX} y={BODY_TOP + 0.8} width={cabW - 5} height={4.2} rx={0.8} fill="#dbeafe" stroke={OUTLINE_COLOR} strokeWidth={0.6} />
      <line x1={hoodX + 1} y1={BODY_TOP + 2.5} x2={hoodX + hoodW - 1} y2={BODY_TOP + 2.5} stroke="#ffffff" strokeOpacity={0.4} strokeWidth={0.8} />
      <Lights half={half} light={light} />
    </g>
  );
}

function Shunter({ length, color, wheelAngle = 0, light = 0 }: ArtProps) {
  const half = length / 2;
  return (
    <g>
      {/* halo: the 3 m shunter must stay visible next to 15 m wagons */}
      <rect x={-half - 3} y={-10} width={length + 6} height={20} rx={4} fill={ACCENT} fillOpacity={0.16} stroke={ACCENT} strokeWidth={1.4} />
      <rect x={-half} y={-5.5} width={length} height={9.5} rx={1.4} fill={color} stroke={OUTLINE_COLOR} strokeWidth={0.9} />
      <rect x={-half + 1} y={-8} width={length - 2} height={3.4} rx={0.8} fill="#dbeafe" stroke={OUTLINE_COLOR} strokeWidth={0.6} />
      <Wheel x={-half + 1.6} y={5.6} r={1.7} angle={wheelAngle} />
      <Wheel x={half - 1.6} y={5.6} r={1.7} angle={wheelAngle} />
      <Lights half={half + 0.4} light={light} />
    </g>
  );
}

export function VehicleArt(props: ArtProps) {
  switch (props.kind) {
    case 'wagon':
      return <Wagon {...props} />;
    case 'platform':
      return <Platform {...props} />;
    case 'loco':
      return <Loco {...props} />;
    case 'shunter':
      return <Shunter {...props} />;
  }
}
