import type { Vec } from '../../engine/geometry';
import type { Point } from '../../engine/types';

/** Where a vehicle is drawn: centre, unit axis (local +x, pointing to the screen right) and rotation. */
export interface VehicleFrame {
  centre: Point;
  axis: Vec;
  angleDeg: number;
}

/** Per-vehicle animation state carried between rendered frames. */
export interface VehicleMotion {
  centre: Point;
  /** Wheel rotation in degrees. */
  wheel: number;
  /** Last direction of travel along the local axis (0 = has not moved yet). */
  dir: 1 | -1 | 0;
  /** End the cab is at, fixed when the vehicle first appears. */
  facing: 1 | -1;
}

/** A jump longer than this between two frames is a teleport (step jump, undo), not driving. */
const TELEPORT = 40;
/** Movements shorter than this do not change the light direction (rounding noise). */
const MIN_MOVE = 0.05;

/** Frame of a body drawn as a rigid chord between the ends of its centreline (x axis to the screen right). */
export function frameOf(path: Point[]): VehicleFrame {
  const first = path[0]!;
  const last = path[path.length - 1]!;
  let dx = last.x - first.x;
  let dy = last.y - first.y;
  if (dx < -1e-6 || (Math.abs(dx) <= 1e-6 && dy < 0)) {
    dx = -dx;
    dy = -dy;
  }
  const len = Math.hypot(dx, dy) || 1;
  return {
    centre: { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 },
    axis: { x: dx / len, y: dy / len },
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

/**
 * Next animation state of every vehicle: wheels turn by the distance travelled (radius `wheelR`),
 * the direction of travel is remembered for the lights. A new vehicle gets its cab at the end away
 * from its consist (`neighbourSide`: on which side of the axis its coupled neighbours are).
 */
export function advanceMotion(
  prev: ReadonlyMap<string, VehicleMotion>,
  frames: ReadonlyMap<string, VehicleFrame>,
  neighbourSide: (id: string) => 1 | -1 | 0,
  wheelR: number,
): Map<string, VehicleMotion> {
  const next = new Map<string, VehicleMotion>();
  for (const [id, f] of frames) {
    const p = prev.get(id);
    if (!p) {
      next.set(id, { centre: f.centre, wheel: 0, dir: 0, facing: neighbourSide(id) === 1 ? -1 : 1 });
      continue;
    }
    const d = { x: f.centre.x - p.centre.x, y: f.centre.y - p.centre.y };
    const dist = Math.hypot(d.x, d.y);
    if (dist < MIN_MOVE || dist > TELEPORT) {
      next.set(id, { ...p, centre: f.centre });
      continue;
    }
    const along = d.x * f.axis.x + d.y * f.axis.y;
    const sign: 1 | -1 = along >= 0 ? 1 : -1;
    const wheel = (p.wheel + ((sign * dist) / wheelR) * (180 / Math.PI)) % 360;
    next.set(id, { centre: f.centre, wheel, dir: sign, facing: p.facing });
  }
  return next;
}

/** Pairs of coupled neighbours as "a|b" keys (sorted ids), to spot coupling and uncoupling. */
export function coupledPairs(consists: string[][]): Set<string> {
  const out = new Set<string>();
  for (const c of consists) {
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1]!;
      const b = c[i]!;
      out.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
  }
  return out;
}
