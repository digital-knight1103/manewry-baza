import { useMemo, type PointerEvent } from 'react';
import { buildLines, lineOfEdge, linePath } from '../../engine/lines';
import type { Topology } from '../../engine/topology';
import type { Point, StationLayout } from '../../engine/types';
import { bodyOnLine, couplingGap, vehicleType, type StationState, type Vehicle } from '../../engine/vehicles';
import { bandOutline, toPath } from './railGeometry';
import { OUTLINE_COLOR, SELECTION_COLOR, VEHICLE_HEIGHT, VEHICLE_STROKE } from './style';

interface Props {
  topo: Topology;
  state: StationState;
  selectedId: string | null;
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

function vehicleTitle(layout: StationLayout, v: Vehicle): string {
  const t = vehicleType(layout, v.type);
  return `${v.id} – ${t.name}${v.number ? `, nr ${v.number}` : ''}`;
}

/** All vehicles on the schematic plus short coupling bars between coupled neighbours. */
export function Vehicles({ topo, state, selectedId, onVehiclePointerDown }: Props) {
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
    <g className="vehicles">
      {couplings.map((c) => (
        <path key={c.key} d={toPath(c.path)} stroke={OUTLINE_COLOR} strokeWidth={2} fill="none" />
      ))}
      {[...shapes.out.values()].map(({ vehicle: v, path }) => {
        const outline = toPath(bandOutline(path, VEHICLE_HEIGHT / 2)) + 'Z';
        const selected = v.id === selectedId;
        return (
          <g
            key={v.id}
            className={`vehicle${onVehiclePointerDown ? ' editable' : ''}`}
            data-vehicle={v.id}
            onPointerDown={onVehiclePointerDown && ((e) => onVehiclePointerDown(v.id, e))}
          >
            <title>{vehicleTitle(layout, v)}</title>
            {selected && (
              <path d={outline} fill="none" stroke={SELECTION_COLOR} strokeWidth={7} strokeOpacity={0.85} strokeLinejoin="round" />
            )}
            <path d={outline} fill={vehicleType(layout, v.type).color} stroke={OUTLINE_COLOR} strokeWidth={VEHICLE_STROKE} />
          </g>
        );
      })}
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
