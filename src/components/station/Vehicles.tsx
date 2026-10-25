import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { ScreenSide } from '../../engine/control';
import { add, normalize, scale, sub } from '../../engine/geometry';
import { buildLines, lineOfEdge, linePath } from '../../engine/lines';
import type { Topology } from '../../engine/topology';
import type { Point, StationLayout } from '../../engine/types';
import { bodyOnLine, couplingGap, vehicleLength, vehicleType, type StationState, type Vehicle } from '../../engine/vehicles';
import { bandOutline, toPath } from './railGeometry';
import { OUTLINE_COLOR, PULSE_COLOR, SELECTION_COLOR, VEHICLE_HEIGHT, VEHICLE_STROKE } from './style';
import { artKind, artOutline } from './artKind';
import { VehicleArt } from './VehicleArt';
import { advanceMotion, coupledPairs, frameOf, type VehicleFrame, type VehicleMotion } from './vehicleMotion';

interface Props {
  topo: Topology;
  state: StationState;
  selectedId: string | null;
  /** Direction arrow next to the driven vehicle. */
  arrow?: { id: string; side: ScreenSide } | null;
  /** Vehicles drawn with a pulsing highlight (scenario playback). */
  pulseIds?: string[];
  /** Detailed drawings (bogies, cab, wheelsets) instead of plain coloured bands. */
  detailed?: boolean;
  onVehiclePointerDown?: (id: string, e: PointerEvent<SVGGElement>) => void;
}

interface Shape {
  vehicle: Vehicle;
  /** Centreline of the body from its lower to its higher line coordinate. */
  path: Point[];
  a: number;
  b: number;
  lineId: string;
}

/** Wheel radius of the detailed drawings (for the rotation per distance travelled). */
const WHEEL_R = 2.5;
/** How long the flash at a coupling / uncoupling lasts (matches the CSS animation). */
const FLASH_MS = 700;
/** More coupling changes at once than this are a jump (scenario step, undo), not a manoeuvre. */
const FLASH_MAX = 3;

interface Flash {
  key: string;
  at: Point;
}

function vehicleTitle(layout: StationLayout, v: Vehicle): string {
  const t = vehicleType(layout, v.type);
  return `${v.id} – ${t.name}${v.number ? `, nr ${v.number}` : ''}`;
}

/** Point between the facing ends of two vehicle bodies. */
function gapPoint(p: Shape, q: Shape): Point {
  const ends = (s: Shape) => [s.path[0]!, s.path[s.path.length - 1]!];
  let best: [Point, Point] = [p.path[0]!, q.path[0]!];
  let bestD = Infinity;
  for (const a of ends(p))
    for (const b of ends(q)) {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < bestD) {
        bestD = d;
        best = [a, b];
      }
    }
  return { x: (best[0].x + best[1].x) / 2, y: (best[0].y + best[1].y) / 2 };
}

/**
 * Animation state of the detailed drawings (wheel rotation, lights, cab end), advanced whenever
 * a new station state is rendered. Recomputed only for a new state object, so a repeated render
 * of the same state (StrictMode) does not turn the wheels twice.
 */
function useMotion(state: StationState, frames: Map<string, VehicleFrame>): Map<string, VehicleMotion> {
  const ref = useRef<{ state: StationState | null; motion: Map<string, VehicleMotion> }>({ state: null, motion: new Map() });
  if (ref.current.state !== state) {
    const neighbourSide = (id: string): 1 | -1 | 0 => {
      const consist = state.consists.find((c) => c.includes(id));
      const f = frames.get(id);
      if (!consist || consist.length < 2 || !f) return 0;
      let sum = 0;
      for (const other of consist) {
        const g = frames.get(other);
        if (other === id || !g) continue;
        sum += (g.centre.x - f.centre.x) * f.axis.x + (g.centre.y - f.centre.y) * f.axis.y;
      }
      return sum > 0 ? 1 : sum < 0 ? -1 : 0;
    };
    ref.current = { state, motion: advanceMotion(ref.current.motion, frames, neighbourSide, WHEEL_R) };
  }
  return ref.current.motion;
}

/** Short flashes where vehicles have just been coupled or uncoupled. */
function useCouplingFlashes(consists: string[][], shapes: Map<string, Shape>): Flash[] {
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const prev = useRef<{ pairs: Set<string>; shapes: Map<string, Shape> } | null>(null);
  useEffect(() => {
    const pairs = coupledPairs(consists);
    const before = prev.current;
    prev.current = { pairs, shapes };
    if (!before) return;
    const changed = [...pairs].filter((p) => !before.pairs.has(p)).concat([...before.pairs].filter((p) => !pairs.has(p)));
    if (changed.length === 0 || changed.length > FLASH_MAX) return;
    const now = Date.now();
    const added: Flash[] = [];
    for (const pair of changed) {
      const [a, b] = pair.split('|') as [string, string];
      const p = shapes.get(a) ?? before.shapes.get(a);
      const q = shapes.get(b) ?? before.shapes.get(b);
      if (p && q) added.push({ key: `${pair}@${now}`, at: gapPoint(p, q) });
    }
    if (added.length === 0) return;
    setFlashes((f) => [...f, ...added]);
    // Not cleared on the next change: the flash must finish even while the train keeps moving.
    window.setTimeout(() => setFlashes((f) => f.filter((x) => !added.includes(x))), FLASH_MS);
  }, [consists, shapes]);
  return flashes;
}

/** All vehicles on the schematic plus short coupling bars between coupled neighbours. */
export function Vehicles({ topo, state, selectedId, arrow = null, pulseIds = [], detailed = false, onVehiclePointerDown }: Props) {
  const { layout } = topo;
  const shapes = useMemo(() => {
    const lines = buildLines(topo, state.switches);
    const out = new Map<string, Shape>();
    for (const v of Object.values(state.vehicles)) {
      const line = lineOfEdge(lines, v.pos.edge);
      const { a, b } = bodyOnLine(layout, line, v);
      out.set(v.id, { vehicle: v, path: linePath(topo, line, a, b), a, b, lineId: line.id });
    }
    return { out, lines };
  }, [topo, layout, state]);

  const frames = useMemo(() => new Map([...shapes.out].map(([id, s]) => [id, frameOf(s.path)])), [shapes]);
  const motion = useMotion(state, frames);
  const flashes = useCouplingFlashes(state.consists, shapes.out);

  const couplings = useMemo(() => {
    const bars: { key: string; path: Point[] }[] = [];
    const gap = couplingGap(layout);
    for (const consist of state.consists) {
      for (let i = 1; i < consist.length; i++) {
        const p = shapes.out.get(consist[i - 1]!);
        const q = shapes.out.get(consist[i]!);
        if (!p || !q || p.lineId !== q.lineId) continue;
        const line = shapes.lines.find((l) => l.id === p.lineId)!;
        const [from, to] = p.b <= q.a ? [p.b, q.a] : [q.b, p.a];
        if (to - from > gap * 3) continue; // not adjacent any more — nothing sensible to draw
        bars.push({ key: `${p.vehicle.id}-${q.vehicle.id}`, path: linePath(topo, line, from - 1, to + 1) });
      }
    }
    return bars;
  }, [topo, layout, state.consists, shapes]);

  return (
    <g className={`vehicles${detailed ? ' detailed' : ''}`}>
      {couplings.map((c) => (
        <path key={c.key} d={toPath(c.path)} stroke={OUTLINE_COLOR} strokeWidth={detailed ? 1.6 : 2} fill="none" />
      ))}
      {[...shapes.out.values()].map(({ vehicle: v, path }) => {
        const selected = v.id === selectedId;
        const pulse = pulseIds.includes(v.id);
        const type = vehicleType(layout, v.type);
        const groupProps = {
          className: `vehicle${onVehiclePointerDown ? ' editable' : ''}`,
          'data-vehicle': v.id,
          onPointerDown: onVehiclePointerDown && ((e: PointerEvent<SVGGElement>) => onVehiclePointerDown(v.id, e)),
        };
        if (detailed) {
          const f = frames.get(v.id)!;
          const m = motion.get(v.id);
          const kind = artKind(type);
          const length = vehicleLength(layout, v.type);
          const box = artOutline(kind, length);
          return (
            <g
              key={v.id}
              {...groupProps}
              transform={`translate(${f.centre.x.toFixed(2)} ${f.centre.y.toFixed(2)}) rotate(${f.angleDeg.toFixed(2)})`}
            >
              <title>{vehicleTitle(layout, v)}</title>
              {selected && <rect {...box} fill="none" stroke={SELECTION_COLOR} strokeWidth={4} strokeOpacity={0.9} />}
              <VehicleArt
                kind={kind}
                length={length}
                color={type.color}
                wheelAngle={m?.wheel ?? 0}
                facing={m?.facing ?? 1}
                light={type.powered ? (m?.dir ?? 0) : 0}
              />
              {pulse && <rect className="pulse" {...box} fill="none" stroke={PULSE_COLOR} strokeWidth={3.5} />}
            </g>
          );
        }
        const outline = toPath(bandOutline(path, VEHICLE_HEIGHT / 2)) + 'Z';
        return (
          <g key={v.id} {...groupProps}>
            <title>{vehicleTitle(layout, v)}</title>
            {selected && (
              <path
                d={outline}
                fill="none"
                stroke={SELECTION_COLOR}
                strokeWidth={7}
                strokeOpacity={0.85}
                strokeLinejoin="round"
              />
            )}
            <path d={outline} fill={type.color} stroke={OUTLINE_COLOR} strokeWidth={VEHICLE_STROKE} />
            {pulse && <path className="pulse" d={outline} fill="none" stroke={PULSE_COLOR} strokeWidth={6} strokeLinejoin="round" />}
          </g>
        );
      })}
      {flashes.map((f) => (
        <circle key={f.key} className="couple-flash" cx={f.at.x} cy={f.at.y} r={10} pointerEvents="none" />
      ))}
      {arrow && shapes.out.has(arrow.id) && <DirectionArrow path={shapes.out.get(arrow.id)!.path} side={arrow.side} />}
    </g>
  );
}

/** Semi-transparent vehicle preview while dragging from the palette. */
export function VehicleGhost({ path, color, valid }: { path: Point[]; color: string; valid: boolean }) {
  return (
    <path
      d={toPath(bandOutline(path, VEHICLE_HEIGHT / 2)) + 'Z'}
      fill={color}
      fillOpacity={valid ? 0.75 : 0.35}
      stroke={OUTLINE_COLOR}
      strokeDasharray={valid ? undefined : '4 3'}
      strokeWidth={VEHICLE_STROKE}
      pointerEvents="none"
    />
  );
}

const ARROW = { gap: 3, length: 11, halfWidth: 6.5 };

/** Triangle just beyond the end of a vehicle body, pointing to the screen side it will drive to. */
function DirectionArrow({ path, side }: { path: Point[]; side: ScreenSide }) {
  if (path.length < 2) return null;
  const first = path[0]!;
  const last = path[path.length - 1]!;
  const dx = last.x - first.x;
  // Same convention as the engine: ▶ = right, or down on vertical track.
  const lastIsRight = Math.abs(dx) > 0.1 ? dx > 0 : last.y > first.y;
  const atLast = (side === 'right') === lastIsRight;
  const end = atLast ? last : first;
  const dir = normalize(atLast ? sub(last, path[path.length - 2]!) : sub(first, path[1]!));
  const base = add(end, scale(dir, ARROW.gap));
  const tip = add(base, scale(dir, ARROW.length));
  const side1 = add(base, { x: -dir.y * ARROW.halfWidth, y: dir.x * ARROW.halfWidth });
  const side2 = add(base, { x: dir.y * ARROW.halfWidth, y: -dir.x * ARROW.halfWidth });
  return (
    <path
      className="direction-arrow"
      d={toPath([tip, side1, side2]) + 'Z'}
      fill="#E53935"
      stroke="#ffffff"
      strokeWidth={1}
      pointerEvents="none"
    />
  );
}
