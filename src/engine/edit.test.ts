import { describe, expect, it } from 'vitest';
import { stationTopology as topo } from '../data/station';
import {
  addVehicle,
  areCoupled,
  consistOf,
  couple,
  dragRange,
  fillEdge,
  findDropPosition,
  moveConsist,
  removeVehicle,
  settleConsist,
  touchingNeighbours,
  uncouple,
} from './edit';
import { pointAt } from './topology';
import { couplingGap, emptyState, findOverlap, vehicleLength, wagonCount, type StationState } from './vehicles';

const layout = topo.layout;
const on = { autoCouple: true };
const off = { autoCouple: false };
const wagon = vehicleLength(layout, 'wagon_rev');
const gap = couplingGap(layout);

const fill = (state: StationState, edge: string, n: number, type = 'wagon_rev', opts = on) =>
  fillEdge(topo, state, edge, type, n, 'auto', opts);

describe('fillEdge', () => {
  it('packs wagons from the buffer stop', () => {
    const { state, added } = fill(emptyState(layout), 'e63', 3);
    expect(added).toEqual(['R1', 'R2', 'R3']);
    expect(state.vehicles['R1']!.pos.s).toBeCloseTo(wagon / 2);
    expect(state.vehicles['R2']!.pos.s).toBeCloseTo(wagon * 1.5 + gap);
    expect(state.consists).toEqual([['R1', 'R2', 'R3']]);
  });

  it('packs towards the east end when it is nearer', () => {
    const { state } = fill(emptyState(layout), 'e65', 1);
    expect(state.vehicles['R1']!.pos.s).toBeCloseTo(topo.edgeLength.get('e65')! - wagon / 2);
  });

  it('follows explicit direction', () => {
    const { state } = fillEdge(topo, emptyState(layout), 'e63', 'wagon_rev', 1, 'right', on);
    expect(state.vehicles['R1']!.pos.s).toBeCloseTo(topo.edgeLength.get('e63')!);
  });

  it('continues behind existing vehicles and stops when the edge is full', () => {
    const first = fill(emptyState(layout), 'e69', 1).state;
    const { state, added } = fill(first, 'e69', 5);
    expect(added).toHaveLength(1); // hall track holds two wagons
    expect(wagonCount(layout, state, ['e69'])).toBe(2);
    expect(findOverlap(topo, state)).toBeNull();
  });

  it('does not couple when auto-coupling is off', () => {
    const { state } = fill(emptyState(layout), 'e63', 2, 'wagon_rev', off);
    expect(state.consists).toEqual([['R1'], ['R2']]);
    expect(touchingNeighbours(topo, state, 'R1')).toEqual(['R2']);
  });

  it('reproduces drawing 01-uklad.png', () => {
    let s = emptyState(layout);
    s = fill(s, 'e63', 8).state;
    s = fill(s, 'e65', 9).state;
    s = fill(s, 'e67', 11).state;
    s = fill(s, 'e69', 2).state;
    s = fill(s, 'e67b', 7).state;
    const counts = layout.counters.map((c) => wagonCount(layout, s, c.edges));
    expect(counts).toEqual([8, 9, 11, 9]);
    expect(findOverlap(topo, s)).toBeNull();
    // Rows end where they do on the drawing: tor 63 well before S1, tor 67 before X1.
    expect(pointAt(topo, 'e63', s.vehicles['R8']!.pos.s).x).toBeLessThan(370 - 20);
    expect(pointAt(topo, 'e67', s.vehicles['R28']!.pos.s).x).toBeLessThan(517 - 20);
  });
});

describe('drop, drag and remove', () => {
  it('drops onto the nearest track and snaps to a neighbour', () => {
    const s = fill(emptyState(layout), 'e63', 1).state;
    const target = findDropPosition(topo, s, 'wagon_dlugo', { x: 40 + wagon + gap + 25, y: 220 });
    expect(target?.pos.edge).toBe('e63');
    expect(target!.pos.s).toBeCloseTo(wagon * 1.5 + gap); // snapped to R1
  });

  it('moves the drop out of an occupied spot', () => {
    const s = fill(emptyState(layout), 'e63', 1).state;
    const target = findDropPosition(topo, s, 'wagon_dlugo', { x: 45, y: 213 });
    expect(target!.pos.s).toBeCloseTo(wagon * 1.5 + gap);
  });

  it('ignores drops far from tracks', () => {
    expect(findDropPosition(topo, emptyState(layout), 'wagon_rev', { x: 500, y: 60 })).toBeNull();
  });

  it('drags a consist and stops at obstacles', () => {
    let s = fill(emptyState(layout), 'e63', 2).state; // R1+R2 at the west end
    s = addVehicle(topo, s, 'wagon_dlugo', { edge: 'e63', s: 200 }, on).state;
    const range = dragRange(topo, s, 'R1')!;
    expect(range.lo).toBeCloseTo(0);
    expect(range.hi).toBeCloseTo(200 - wagon / 2 - gap - (2 * wagon + gap));
    s = moveConsist(topo, s, 'R2', 1000);
    expect(s.vehicles['R2']!.pos.s).toBeCloseTo(200 - wagon - gap);
    s = settleConsist(topo, s, 'R2', on);
    expect(consistOf(s, 'D1')).toEqual(['R1', 'R2', 'D1']);
  });

  it('snaps to a nearby vehicle after dragging', () => {
    let s = addVehicle(topo, emptyState(layout), 'wagon_rev', { edge: 'e63', s: 100 }, on).state;
    s = addVehicle(topo, s, 'wagon_rev', { edge: 'e63', s: 100 + wagon + gap + 8 }, on).state;
    expect(areCoupled(s, 'R1', 'R2')).toBe(false);
    s = settleConsist(topo, s, 'R2', on);
    expect(s.vehicles['R2']!.pos.s).toBeCloseTo(100 + wagon + gap);
    expect(areCoupled(s, 'R1', 'R2')).toBe(true);
  });

  it('removes a vehicle and splits its consist', () => {
    const s = removeVehicle(fill(emptyState(layout), 'e63', 3).state, 'R2');
    expect(s.vehicles['R2']).toBeUndefined();
    expect(s.consists).toEqual([['R1'], ['R3']]);
  });
});

describe('coupling', () => {
  it('uncouples and couples touching vehicles', () => {
    let s = fill(emptyState(layout), 'e63', 3).state;
    s = uncouple(s, 'R2', 'R3');
    expect(s.consists).toEqual([['R1', 'R2'], ['R3']]);
    s = couple(topo, s, 'R3', 'R2');
    expect(s.consists).toEqual([['R1', 'R2', 'R3']]);
  });

  it('refuses to couple vehicles that do not touch', () => {
    let s = addVehicle(topo, emptyState(layout), 'wagon_rev', { edge: 'e63', s: 50 }, on).state;
    s = addVehicle(topo, s, 'wagon_rev', { edge: 'e63', s: 150 }, on).state;
    expect(couple(topo, s, 'R1', 'R2')).toBe(s);
  });
});
