import { describe, expect, it } from 'vitest';
import { stationLayout } from '../../data/station';
import { buildTopology } from '../../engine/topology';
import { edgeStub, railLines } from './railGeometry';

const topo = buildTopology(stationLayout);

describe('railLines', () => {
  it('offsets a straight track by half gauge', () => {
    const [a, b] = railLines(topo, 'e3E', 4);
    // S2 is joined by the diagonal, so the cut there follows the diagonal; the exit end is square
    expect(a[a.length - 1]).toEqual({ x: 990, y: 337 });
    expect(b[b.length - 1]).toEqual({ x: 990, y: 329 });
  });

  it('cuts diagonal rails on the horizontal track line', () => {
    const [a, b] = railLines(topo, 'eD1', 4);
    expect(a[0]!.y).toBeCloseTo(213);
    expect(b[0]!.y).toBeCloseTo(213);
    expect(Math.abs(a[0]!.x - b[0]!.x)).toBeGreaterThan(15);
  });

  it('makes rails of collinear edges meet at a switch', () => {
    const [a63] = railLines(topo, 'e63', 4);
    const [a65] = railLines(topo, 'e65', 4);
    const end63 = a63[a63.length - 1]!;
    const start65 = a65[0]!;
    expect(end63.x).toBeCloseTo(start65.x);
    expect(end63.y).toBeCloseTo(start65.y);
  });
});

describe('edgeStub', () => {
  it('starts at the given node', () => {
    expect(edgeStub(topo, 'e63', 'S1', 30)).toEqual([
      { x: 370, y: 213 },
      { x: 340, y: 213 },
    ]);
  });
});
