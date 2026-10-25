import { describe, expect, it } from 'vitest';
import { advanceMotion, coupledPairs, frameOf, type VehicleFrame } from './vehicleMotion';

const frames = (entries: [string, VehicleFrame][]) => new Map(entries);

describe('frameOf', () => {
  it('points the local axis to the screen right whatever the path direction', () => {
    const f = frameOf([
      { x: 30, y: 10 },
      { x: 0, y: 0 },
    ]);
    expect(f.axis.x).toBeGreaterThan(0);
    expect(f.centre).toEqual({ x: 15, y: 5 });
    expect(f.angleDeg).toBeCloseTo((Math.atan2(10, 30) * 180) / Math.PI);
  });

  it('points down on vertical track', () => {
    const { axis } = frameOf([{ x: 0, y: 10 }, { x: 0, y: 0 }]);
    expect(Math.abs(axis.x)).toBe(0);
    expect(axis.y).toBe(1);
  });
});

describe('advanceMotion', () => {
  const at = (x: number): VehicleFrame => ({ centre: { x, y: 0 }, axis: { x: 1, y: 0 }, angleDeg: 0 });

  it('puts the cab of a new vehicle away from its consist', () => {
    const m = advanceMotion(new Map(), frames([['L', at(0)], ['S', at(50)]]), (id) => (id === 'L' ? 1 : 0), 2);
    expect(m.get('L')).toMatchObject({ facing: -1, dir: 0, wheel: 0 });
    expect(m.get('S')!.facing).toBe(1);
  });

  it('turns the wheels by the distance travelled and remembers the direction', () => {
    const m0 = advanceMotion(new Map(), frames([['L', at(0)]]), () => 0, 2);
    const m1 = advanceMotion(m0, frames([['L', at(-Math.PI)]]), () => 0, 2);
    expect(m1.get('L')!.dir).toBe(-1);
    expect(m1.get('L')!.wheel).toBeCloseTo(-90);
    // Standing still keeps the direction (head light stays on).
    const m2 = advanceMotion(m1, frames([['L', at(-Math.PI)]]), () => 0, 2);
    expect(m2.get('L')!.dir).toBe(-1);
  });

  it('ignores teleports (step jumps)', () => {
    const m0 = advanceMotion(new Map(), frames([['L', at(0)]]), () => 0, 2);
    const m1 = advanceMotion(m0, frames([['L', at(500)]]), () => 0, 2);
    expect(m1.get('L')).toMatchObject({ wheel: 0, dir: 0, centre: { x: 500, y: 0 } });
  });
});

describe('coupledPairs', () => {
  it('lists neighbours with sorted ids', () => {
    expect([...coupledPairs([['B', 'A', 'C'], ['D']])]).toEqual(['A|B', 'A|C']);
  });
});
