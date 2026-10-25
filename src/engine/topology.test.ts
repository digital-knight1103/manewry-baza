import { describe, expect, it } from 'vitest';
import { stationLayout } from '../data/station';
import { activeConnections, buildTopology, defaultSwitchStates, directionAwayFrom, pointAt, validateStation } from './topology';
import type { StationLayout } from './types';

const layout = stationLayout;

describe('station.json', () => {
  it('is valid', () => {
    expect(validateStation(layout)).toEqual([]);
  });

  it('has all tracks from the drawings', () => {
    const tracks = new Set(layout.edges.map((e) => e.track));
    for (const t of ['3', '63', '65', '67', '69', 'łącznik']) expect(tracks).toContain(t);
  });
});

describe('validateStation', () => {
  it('reports missing nodes and edges', () => {
    const broken: StationLayout = {
      ...layout,
      edges: [...layout.edges, { id: 'eX', track: '1', from: 'N63W', to: 'NOPE' }],
      switches: [{ id: 'SX', node: 'S1', default: 3, states: [{ name: 'a', connections: [['e63', 'e69']] }] }],
    };
    const errors = validateStation(broken);
    expect(errors).toContain('Odcinek eX: brak węzła NOPE');
    expect(errors).toContain('Rozjazd SX: stan domyślny 3 poza zakresem');
    expect(errors).toContain('Rozjazd SX (stan 0): odcinek e69 nie dochodzi do węzła S1');
    expect(() => buildTopology(broken)).toThrow(/Błędny układ stacji/);
  });
});

describe('topology', () => {
  const topo = buildTopology(layout);

  it('indexes edges at nodes', () => {
    expect(topo.edgesAtNode.get('S1')?.sort()).toEqual(['e63', 'e65', 'eD1']);
    expect(topo.edgesAtNode.get('X1')?.sort()).toEqual(['e67', 'e67b', 'eD1', 'eD2']);
    expect(topo.edgesAtNode.get('N63W')).toEqual(['e63']);
  });

  it('computes edge lengths', () => {
    expect(topo.edgeLength.get('e63')).toBeCloseTo(330);
    expect(topo.edgeLength.get('eD1')).toBeCloseTo(Math.hypot(147, 57));
  });

  it('finds points along an edge and clamps to its ends', () => {
    expect(pointAt(topo, 'e63', 100)).toEqual({ x: 140, y: 213 });
    expect(pointAt(topo, 'e63', -5)).toEqual({ x: 40, y: 213 });
    expect(pointAt(topo, 'e63', 1e6)).toEqual({ x: 370, y: 213 });
  });

  it('follows polyline points', () => {
    const bent = buildTopology({
      ...layout,
      edges: [{ id: 'b', track: 'x', from: 'N63W', to: 'N67W', points: [{ x: 100, y: 213 }] }],
      switches: [],
      boundaries: [],
      counters: [],
    });
    expect(bent.edgeLength.get('b')).toBeCloseTo(60 + Math.hypot(60, 57));
    expect(pointAt(bent, 'b', 30)).toEqual({ x: 70, y: 213 });
  });

  it('gives direction away from a node', () => {
    const d = directionAwayFrom(topo, 'e63', 'S1');
    expect(d.x).toBeCloseTo(-1);
    expect(d.y).toBeCloseTo(0);
  });

  it('uses default switch states', () => {
    const states = defaultSwitchStates(layout);
    expect(states).toEqual({ S1: 0, S2: 0, X1: 0 });
    expect(activeConnections(topo, 'S1', states)).toEqual([['e63', 'e65']]);
    expect(activeConnections(topo, 'X1', { ...states, X1: 1 })).toEqual([['eD1', 'e67b']]);
  });
});
