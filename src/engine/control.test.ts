import { describe, expect, it } from 'vitest';
import { stationTopology as topo } from '../data/station';
import { consistAtExit, dirForSide, driveTowards, leadingSide, screenSideOf, vehicleGaps } from './control';
import { uncouple } from './edit';
import { stateFromInitial } from './vehicles';

const loco = { id: 'LOK1', type: 'lokomotywa' };
const rev = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `R${i + 1}`, type: 'wagon_rev' }));

describe('kierunek ekranowy', () => {
  it('na torach poziomych ▶ = w prawo', () => {
    expect(screenSideOf(topo, 'e63', 1)).toBe('right');
    expect(screenSideOf(topo, 'e63', -1)).toBe('left');
    expect(screenSideOf(topo, 'e3E', 1)).toBe('right');
  });

  it('na łączniku ◀ = w górę-lewo, ▶ = w dół-prawo', () => {
    // eD1 runs from S1 (upper left) to X1 (lower right).
    expect(screenSideOf(topo, 'eD1', 1)).toBe('right');
    expect(screenSideOf(topo, 'eD2', -1)).toBe('left');
    expect(dirForSide(topo, { edge: 'eD1', s: 10 }, 'left')).toBe(-1);
  });

  it('jazda ◀ z toru 3 przez S2 i łącznik zachowuje kierunek ekranowy', () => {
    let s = stateFromInitial(topo, { switches: { S2: 1, X1: 0, S1: 1 }, placements: [{ edge: 'e3E', startOffset: 100, vehicles: [loco] }] });
    s = driveTowards(topo, s, 'LOK1', 'left', 150).state;
    expect(s.vehicles.LOK1!.pos.edge).toBe('eD2');
    s = driveTowards(topo, s, 'LOK1', 'left', 400).state;
    expect(s.vehicles.LOK1!.pos.edge).toBe('e63');
  });

  it('lokomotywa prowadzi z dala od swoich wagonów', () => {
    const s = stateFromInitial(topo, { switches: {}, placements: [{ edge: 'e63', startOffset: 100, vehicles: [loco, ...rev(2)] }] });
    expect(leadingSide(topo, s, 'LOK1')).toBe('left');
  });
});

describe('przerwy między pojazdami', () => {
  it('zwraca stykające się pary ze stanem sprzęgu', () => {
    let s = stateFromInitial(topo, { switches: {}, placements: [{ edge: 'e63', startOffset: 100, vehicles: [loco, ...rev(2)] }] });
    s = uncouple(s, 'R1', 'R2');
    const gaps = vehicleGaps(topo, s);
    expect(gaps.map(({ a, b, coupled }) => ({ a, b, coupled }))).toEqual([
      { a: 'LOK1', b: 'R1', coupled: true },
      { a: 'R1', b: 'R2', coupled: false },
    ]);
    expect(gaps[0]!.path.length).toBeGreaterThanOrEqual(2);
  });

  it('pojazdy oddalone nie mają przerwy sprzęgowej', () => {
    const s = stateFromInitial(topo, {
      switches: {},
      placements: [
        { edge: 'e63', startOffset: 10, vehicles: [loco] },
        { edge: 'e63', startOffset: 200, vehicles: rev(1) },
      ],
    });
    expect(vehicleGaps(topo, s)).toEqual([]);
  });
});

describe('wyjazd ze stacji', () => {
  it('rozpoznaje skład stojący na końcu toru 3', () => {
    const s = stateFromInitial(topo, { switches: {}, placements: [{ edge: 'e3E', startOffset: 200, vehicles: [loco] }] });
    expect(consistAtExit(topo, s, 'LOK1')).toBeNull();
    const at = driveTowards(topo, s, 'LOK1', 'right', 1000);
    expect(at.stop?.reason).toBe('exit');
    expect(consistAtExit(topo, at.state, 'LOK1')).toBe('N3E');
  });
});
