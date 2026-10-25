import { describe, expect, it } from 'vitest';
import scenario from '../data/scenarios/wstawienie-na-naprawe.json';
import { stationTopology as topo } from '../data/station';
import { buildLines, fromU, lineOfEdge, projectOnLine, toU } from './lines';
import {
  couplingGap,
  emptyState,
  findOverlap,
  nextVehicleId,
  stateFromInitial,
  toInitialState,
  vehicleLength,
  wagonCount,
  type InitialState,
} from './vehicles';

const layout = topo.layout;
const initial = scenario.initialState as InitialState;

describe('track lines', () => {
  const lines = buildLines(topo, { S1: 0, S2: 0, X1: 0 });

  it('chains edges through active connections', () => {
    expect(lines.map((l) => l.id).sort()).toEqual(['e3W+e3E', 'e63+e65', 'e67+e67b+e69', 'eD1+eD2']);
  });

  it('follows switch states', () => {
    const diverted = buildLines(topo, { S1: 1, S2: 1, X1: 1 });
    expect(lineOfEdge(diverted, 'e63').id).toBe('e63+eD1+e67b+e69');
    expect(lineOfEdge(diverted, 'eD2').id).toBe('eD2+e3E');
    expect(lineOfEdge(diverted, 'e67').id).toBe('e67');
  });

  it('converts between edge positions and line coordinates', () => {
    const line = lineOfEdge(lines, 'e69');
    const u = toU(line, { edge: 'e69', s: 10 });
    expect(u).toBeCloseTo(topo.edgeLength.get('e67')! + topo.edgeLength.get('e67b')! + 10);
    const pos = fromU(line, u);
    expect(pos.edge).toBe('e69');
    expect(pos.s).toBeCloseTo(10);
  });

  it('handles segments running against the edge direction', () => {
    const line = lineOfEdge(buildLines(topo, { S1: 1, S2: 1, X1: 1 }), 'e3E');
    // e3E runs S2 → N3E, the line comes from the diagonal through S2, so same direction
    const pos = fromU(line, toU(line, { edge: 'e3E', s: 5 }));
    expect(pos).toEqual({ edge: 'e3E', s: expect.closeTo(5) as number });
  });

  it('projects points onto a line', () => {
    const line = lineOfEdge(lines, 'e63');
    const pr = projectOnLine(topo, line, { x: 100, y: 220 });
    expect(pr.u).toBeCloseTo(60);
    expect(pr.dist).toBeCloseTo(7);
  });
});

describe('initial state (placements)', () => {
  it('loads the example scenario', () => {
    const state = stateFromInitial(topo, initial);
    expect(Object.keys(state.vehicles)).toHaveLength(13);
    expect(state.consists).toContainEqual(['LOK1', 'R1', 'R2', 'R3', 'R4']);
    expect(state.vehicles['SH1']!.pos.edge).toBe('e69');
    expect(findOverlap(topo, state)).toBeNull();
  });

  it('lays vehicles from startOffset with coupling gaps', () => {
    const state = stateFromInitial(topo, initial);
    const lok = vehicleLength(layout, 'lokomotywa');
    const wagon = vehicleLength(layout, 'wagon_rev');
    expect(state.vehicles['LOK1']!.pos.s).toBeCloseTo(33 + lok / 2);
    expect(state.vehicles['R1']!.pos.s).toBeCloseTo(33 + lok + couplingGap(layout) + wagon / 2);
  });

  it('round-trips through toInitialState', () => {
    const state = stateFromInitial(topo, initial);
    const again = stateFromInitial(topo, toInitialState(topo, state));
    expect(again.consists).toEqual(state.consists);
    for (const [id, v] of Object.entries(state.vehicles)) {
      expect(again.vehicles[id]!.pos.edge).toBe(v.pos.edge);
      expect(again.vehicles[id]!.pos.s).toBeCloseTo(v.pos.s, 1);
    }
  });

  it('rejects vehicles that do not fit or overlap', () => {
    expect(() =>
      stateFromInitial(topo, {
        switches: {},
        placements: [{ edge: 'e69', startOffset: 60, vehicles: [{ id: 'X', type: 'platforma' }] }],
      }),
    ).toThrow(/nie mieści się/);
    expect(() =>
      stateFromInitial(topo, {
        switches: {},
        placements: [
          { edge: 'e63', startOffset: 0, vehicles: [{ id: 'A', type: 'wagon_rev' }] },
          { edge: 'e63', startOffset: 20, vehicles: [{ id: 'B', type: 'wagon_rev' }] },
        ],
      }),
    ).toThrow(/nachodzą/);
  });
});

describe('helpers', () => {
  it('counts only wagons on the given edges', () => {
    const state = stateFromInitial(topo, initial);
    expect(wagonCount(layout, state, ['e3W'])).toBe(4); // LOK1 not counted
    expect(wagonCount(layout, state, ['e65'])).toBe(3);
    expect(wagonCount(layout, state, ['e67b', 'e69'])).toBe(0); // shunter only
  });

  it('generates the next free id per type', () => {
    const state = stateFromInitial(topo, initial);
    expect(nextVehicleId(layout, state, 'wagon_rev')).toBe('R5');
    expect(nextVehicleId(layout, state, 'platforma')).toBe('PL2');
    expect(nextVehicleId(layout, emptyState(layout), 'wagon_zdrowy')).toBe('Z1');
  });
});
