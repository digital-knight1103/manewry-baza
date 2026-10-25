import type { Point } from './types';

export interface Vec {
  x: number;
  y: number;
}

export const sub = (a: Point, b: Point): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Point, b: Vec): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (v: Vec, k: number): Vec => ({ x: v.x * k, y: v.y * k });
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const length = (v: Vec): number => Math.hypot(v.x, v.y);
export const distance = (a: Point, b: Point): number => length(sub(a, b));

export function normalize(v: Vec): Vec {
  const len = length(v);
  if (len === 0) throw new Error('Cannot normalize a zero-length vector');
  return { x: v.x / len, y: v.y / len };
}

/** Left-hand normal (in SVG coordinates, y pointing down) of a unit vector. */
export const normal = (u: Vec): Vec => ({ x: -u.y, y: u.x });

/** Total length of a polyline. */
export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1]!, points[i]!);
  return total;
}

/** True when two directions are parallel (or anti-parallel) within `tolerance` (sine of angle). */
export function isParallel(a: Vec, b: Vec, tolerance = 0.05): boolean {
  return Math.abs(cross(normalize(a), normalize(b))) < tolerance;
}

/**
 * Intersection of line p + t·u with line q + k·v.
 * Returns null for parallel lines.
 */
export function intersectLines(p: Point, u: Vec, q: Point, v: Vec): Point | null {
  const denom = cross(u, v);
  if (Math.abs(denom) < 1e-9) return null;
  const t = cross(sub(q, p), v) / denom;
  return add(p, scale(u, t));
}
