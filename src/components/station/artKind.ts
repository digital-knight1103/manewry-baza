import type { VehicleType } from '../../engine/types';

export type ArtKind = 'wagon' | 'platform' | 'loco' | 'shunter';

/** Which detailed drawing a vehicle type gets: powered short = shunter, powered = loco, long wagons = platform. */
export function artKind(t: VehicleType): ArtKind {
  if (t.powered) return t.lengthM < 8 ? 'shunter' : 'loco';
  return t.id.includes('platform') || t.lengthM >= 25 ? 'platform' : 'wagon';
}

/** Outline around a detailed vehicle (selection, pulse), in its local coordinates (see VehicleArt). */
export function artOutline(kind: ArtKind, length: number) {
  const pad = kind === 'shunter' ? 5 : 2.5;
  return { x: -length / 2 - pad, y: -11, width: length + 2 * pad, height: 22, rx: 4 };
}
