import type { StationLayout } from '../../engine/types';
import { LABEL_SIZE, VEHICLE_HEIGHT } from './style';

/** Space kept around the drawing (schematic units). */
const MARGIN = 16;

/**
 * Bounding box of the tracks, hall, labels and counters (without the legend and caption area),
 * as an SVG viewBox. Used by the presentation, which shows the legend and caption outside the SVG.
 */
export function schematicViewBox(layout: StationLayout): [number, number, number, number] {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };
  for (const n of layout.nodes) {
    add(n.x, n.y - VEHICLE_HEIGHT / 2);
    add(n.x, n.y + VEHICLE_HEIGHT / 2);
  }
  for (const e of layout.edges) for (const p of e.points ?? []) add(p.x, p.y);
  const { rect } = layout.hall;
  add(rect.x, rect.y);
  add(rect.x + rect.w, rect.y + rect.h);
  // Text: baseline at y, glyphs above it, descenders a little below.
  for (const t of [...layout.labels, ...layout.counters]) {
    add(t.x, t.y - LABEL_SIZE);
    add(t.x, t.y + LABEL_SIZE * 0.3);
  }
  const [vx, vy, vw, vh] = layout.viewBox;
  const x0 = Math.max(vx, Math.min(...xs) - MARGIN);
  const y0 = Math.max(vy, Math.min(...ys) - MARGIN);
  const x1 = Math.min(vx + vw, Math.max(...xs) + MARGIN);
  const y1 = Math.min(vy + vh, Math.max(...ys) + MARGIN);
  return [x0, y0, x1 - x0, y1 - y0];
}
