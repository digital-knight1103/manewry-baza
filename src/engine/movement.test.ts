import { describe, expect, it } from 'vitest';
import { stationTopology as topo } from '../data/station';
import { applyAction } from './actions';
import { consistOf } from './edit';
import { buildLines, lineOfEdge, toU } from './lines';
import { drive, step } from './movement';
import { findRoute, findRouteForVehicle } from './route';
import { foulingVehicles, setSwitch } from './switches';
import { buildTopology } from './topology';
import type { StationLayout, SwitchStates } from './types';
import { couplingGap, stateFromInitial, vehicleLength, type Placement, type StationState } from './vehicles';

const layout = topo.layout;
const gap = couplingGap(layout);
const len = (edge: string) => topo.edgeLength.get(edge)!;
const vlen = (type: string) => vehicleLength(layout, type);

const station = (switches: SwitchStates, placements: Placement[]) => stateFromInitial(topo, { switches, placements });
const loco = (id = 'LOK1') => ({ id, type: 'lokomotywa' });
const rev = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ id: `R${from + i}`, type: 'wagon_rev' }));
const edgeOf = (s: StationState, id: string) => s.vehicles[id]!.pos.edge;

/** Runs an action that must succeed. */
function act(s: StationState, action: Parameters<typeof applyAction>[2]): StationState {
  const res = applyAction(topo, s, action);
  expect(res.error).toBeUndefined();
  return res.state;
}

/** Body ends of a vehicle on the line of its edge under the state's switches. */
function body(s: StationState, id: string) {
  const line = lineOfEdge(buildLines(topo, s.switches), edgeOf(s, id));
  const u = toU(line, s.vehicles[id]!.pos);
  const half = vlen(s.vehicles[id]!.type) / 2;
  return { line, u, a: u - half, b: u + half };
}

describe('1. tor 63 ↔ tor 65 przez S1=0', () => {
  it('jedzie z 63 na 65 i z powrotem', () => {
    let s = station({ S1: 0 }, [{ edge: 'e63', startOffset: 100, vehicles: [loco()] }]);
    let r = drive(topo, s, 'LOK1', 1, 300);
    expect(r.stop).toBeUndefined();
    expect(r.moved).toBeCloseTo(300);
    expect(r.state.vehicles.LOK1!.pos.edge).toBe('e65');
    expect(r.state.vehicles.LOK1!.pos.s).toBeCloseTo(100 + vlen('lokomotywa') / 2 + 300 - len('e63'));
    expect(r.dir).toBe(1);
    s = r.state;
    r = drive(topo, s, 'LOK1', -1, 300);
    expect(r.stop).toBeUndefined();
    expect(edgeOf(r.state, 'LOK1')).toBe('e63');
    expect(r.state.vehicles.LOK1!.pos.s).toBeCloseTo(100 + vlen('lokomotywa') / 2);
  });

  it('findRoute: bezpośrednio, S1=0', () => {
    const s = station({ S1: 1 }, [{ edge: 'e63', startOffset: 100, vehicles: [loco()] }]);
    const route = findRouteForVehicle(topo, s, 'LOK1', 'e65');
    expect(route.found && route.needsReversal).toBe(false);
    if (!route.found) return;
    expect(route.legs[0]!.edges).toEqual(['e63', 'e65']);
    expect(route.legs[0]!.switches).toEqual({ S1: 0 });
    expect(route.legs[0]!.dir).toBe(1);
  });
});

describe('2. tor 3 ↔ łącznik ↔ tor 63 (S2=1, X1=0, S1=1)', () => {
  it('wjazd składu ze stacji na tor 63 jak w scenariuszu', () => {
    let s = station({ S1: 0, S2: 0, X1: 0 }, [{ edge: 'e3W', startOffset: 33, vehicles: [loco(), ...rev(4)] }]);
    s = act(s, { type: 'driveTo', vehicle: 'LOK1', edge: 'e3E', offset: 50 });
    expect(edgeOf(s, 'R4')).toBe('e3E');
    for (const [sw, st] of [['S2', 1], ['X1', 0], ['S1', 1]] as const) s = act(s, { type: 'setSwitch', switch: sw, state: st });
    const route = findRouteForVehicle(topo, s, 'LOK1', 'e63');
    expect(route.found && !route.needsReversal && route.legs[0]!.edges).toEqual(['e3E', 'eD2', 'eD1', 'e63']);
    s = act(s, { type: 'driveTo', vehicle: 'LOK1', edge: 'e63', offset: 113 });
    for (const id of ['LOK1', 'R1', 'R2', 'R3', 'R4']) expect(edgeOf(s, id)).toBe('e63');
    expect(s.vehicles.LOK1!.pos.s).toBeCloseTo(113);
  });

  it('z toru 63 przez łącznik na tor 3E', () => {
    const s = station({ S1: 1, S2: 1, X1: 0 }, [{ edge: 'e63', startOffset: 150, vehicles: [loco(), ...rev(1)] }]);
    const r = drive(topo, s, 'LOK1', 1, 2000);
    // Runs until the front (R1) reaches the station exit at the end of tor 3.
    expect(r.stop?.reason).toBe('exit');
    expect(edgeOf(r.state, 'LOK1')).toBe('e3E');
    expect(body(r.state, 'R1').b).toBeCloseTo(body(r.state, 'R1').line.length);
  });
});

describe('3. tor 69 ↔ tor 63 bez zmiany kierunku (X1=1, S1=1)', () => {
  const hall = (switches: SwitchStates) =>
    station(switches, [{ edge: 'e69', startOffset: 5, vehicles: [{ id: 'SH1', type: 'shunter' }, ...rev(1)] }]);

  it('findRoute: bez zmiany kierunku, X1=1 i S1=1', () => {
    const route = findRouteForVehicle(topo, hall({ S1: 0, X1: 0 }), 'SH1', 'e63');
    expect(route.found).toBe(true);
    if (!route.found) return;
    expect(route.needsReversal).toBe(false);
    expect(route.legs).toHaveLength(1);
    expect(route.legs[0]!.edges).toEqual(['e69', 'e67b', 'eD1', 'e63']);
    expect(route.legs[0]!.switches).toEqual({ X1: 1, S1: 1 });
    expect(route.legs[0]!.dir).toBe(-1);
  });

  it('shunter z wagonem wyjeżdża z hali na tor 63 i wraca do hali', () => {
    let s = hall({ S1: 1, X1: 1 });
    let r = drive(topo, s, 'SH1', -1, 700);
    expect(r.stop).toBeUndefined();
    expect(edgeOf(r.state, 'SH1')).toBe('e63');
    expect(edgeOf(r.state, 'R1')).toBe('e63');
    s = r.state;
    expect(findRouteForVehicle(topo, s, 'SH1', 'e69')).toMatchObject({ found: true, needsReversal: false });
    r = drive(topo, s, 'SH1', 1, 2000);
    expect(r.stop?.reason).toBe('bufferStop');
    expect(edgeOf(r.state, 'R1')).toBe('e69');
    expect(r.state.vehicles.R1!.pos.s).toBeCloseTo(len('e69') - vlen('wagon_rev') / 2);
  });
});

describe('4. tor 67 zachodni ↔ tor 67 wschodni / 69 przez X1=0', () => {
  it('przejeżdża przez skrzyżowanie w obie strony', () => {
    let s = station({ X1: 0 }, [{ edge: 'e67', startOffset: 300, vehicles: [loco()] }]);
    let r = drive(topo, s, 'LOK1', 1, 400);
    expect(r.stop).toBeUndefined();
    expect(edgeOf(r.state, 'LOK1')).toBe('e67b');
    s = r.state;
    r = drive(topo, s, 'LOK1', -1, 400);
    expect(edgeOf(r.state, 'LOK1')).toBe('e67');
  });

  it('przy X1=1 tor 67 zachodni kończy się przed rozjazdem', () => {
    const s = station({ X1: 1 }, [{ edge: 'e67', startOffset: 300, vehicles: [loco()] }]);
    const r = drive(topo, s, 'LOK1', 1, 400);
    expect(r.stop).toMatchObject({ reason: 'switchAgainst', message: 'Rozjazd X1 ustawiony przeciwnie' });
    expect(body(r.state, 'LOK1').b).toBeCloseTo(len('e67'));
  });
});

describe('4a. tor 67 zachodni ↔ łącznik ↔ tor 3E przez X1=2 (rozjazd krzyżowy)', () => {
  it('jedzie z toru 67 przez X1=2 i S2=1 na tor 3E i z powrotem', () => {
    let s = station({ X1: 2, S2: 1 }, [{ edge: 'e67', startOffset: 300, vehicles: [loco()] }]);
    let r = drive(topo, s, 'LOK1', 1, len('e67') - 300 + len('eD2') + 100);
    expect(r.stop).toBeUndefined();
    expect(edgeOf(r.state, 'LOK1')).toBe('e3E');
    s = r.state;
    r = drive(topo, s, 'LOK1', -1, len('eD2') + 200);
    expect(r.stop).toBeUndefined();
    expect(edgeOf(r.state, 'LOK1')).toBe('e67');
  });

  it('przy X1=0 skład z toru 67 jedzie prosto na tor 67 wschodni, nie na łącznik', () => {
    const s = station({ X1: 0, S2: 1 }, [{ edge: 'e67', startOffset: 300, vehicles: [loco()] }]);
    const r = drive(topo, s, 'LOK1', 1, 400);
    expect(r.stop).toBeUndefined();
    expect(edgeOf(r.state, 'LOK1')).toBe('e67b');
  });

  it('przy X1=1 skład z toru 67 zatrzymuje się przed X1', () => {
    const s = station({ X1: 1, S2: 1 }, [{ edge: 'e67', startOffset: 300, vehicles: [loco()] }]);
    const r = drive(topo, s, 'LOK1', 1, 400);
    expect(r.stop).toMatchObject({ reason: 'switchAgainst', switchId: 'X1' });
    expect(edgeOf(r.state, 'LOK1')).toBe('e67');
  });

  it('przy X1=2 łącznik od S1 i tor 67 wschodni kończą się przed X1', () => {
    for (const edge of ['eD1', 'e67b']) {
      const offset = edge === 'eD1' ? len('eD1') - 60 : 60;
      const s = station({ X1: 2, S1: 1 }, [{ edge, startOffset: offset, vehicles: [loco()] }]);
      const r = drive(topo, s, 'LOK1', edge === 'eD1' ? 1 : -1, 200);
      expect(r.stop).toMatchObject({ reason: 'switchAgainst', switchId: 'X1' });
      expect(edgeOf(r.state, 'LOK1')).toBe(edge);
    }
  });

  it('findRoute z toru 67 na tor 3 ustawia X1=2 i S2=1', () => {
    const s = station({ X1: 0, S2: 0 }, [{ edge: 'e67', startOffset: 300, vehicles: [loco()] }]);
    const route = findRouteForVehicle(topo, s, 'LOK1', 'e3E');
    expect(route.found).toBe(true);
    if (!route.found) return;
    expect(route.needsReversal).toBe(false);
    expect(route.legs).toHaveLength(1);
    expect(route.legs[0]).toMatchObject({ edges: ['e67', 'eD2', 'e3E'], switches: { X1: 2, S2: 1 }, dir: 1 });
  });

  it('„Ustaw drogę” + jazda: akcje setSwitch i driveTo z toru 67 na tor 3E', () => {
    let s = station({ X1: 0, S2: 0 }, [{ edge: 'e67', startOffset: 300, vehicles: [loco(), ...rev(2)] }]);
    s = act(s, { type: 'setSwitch', switch: 'X1', state: 2 });
    s = act(s, { type: 'setSwitch', switch: 'S2', state: 1 });
    s = act(s, { type: 'driveTo', vehicle: 'LOK1', edge: 'e3E', offset: 200 });
    for (const id of ['LOK1', 'R1', 'R2']) expect(edgeOf(s, id)).toBe('e3E');
  });
});

describe('5. tor 3 prosto przez S2=0, wyjazdy ze stacji', () => {
  it('jedzie na wschód do wyjazdu i zjeżdża ze stacji', () => {
    let s = station({ S2: 0 }, [{ edge: 'e3W', startOffset: 500, vehicles: [loco(), ...rev(2)] }]);
    const r = drive(topo, s, 'LOK1', 1, 1000);
    expect(r.stop).toMatchObject({ reason: 'exit', node: 'N3E' });
    expect(edgeOf(r.state, 'LOK1')).toBe('e3E');
    s = act(r.state, { type: 'remove', vehicles: ['LOK1', 'R1', 'R2'] });
    expect(Object.keys(s.vehicles)).toEqual([]);
    expect(s.consists).toEqual([]);
  });

  it('jedzie na zachód do wyjazdu N3W', () => {
    const s = station({ S2: 0 }, [{ edge: 'e3E', startOffset: 100, vehicles: [loco()] }]);
    const r = drive(topo, s, 'LOK1', -1, 2000);
    expect(r.stop).toMatchObject({ reason: 'exit', node: 'N3W' });
    expect(edgeOf(r.state, 'LOK1')).toBe('e3W');
    expect(r.state.vehicles.LOK1!.pos.s).toBeCloseTo(vlen('lokomotywa') / 2);
  });

  it('spawn wstawia skład przy węźle wyjazdu', () => {
    const s = station({}, []);
    const next = act(s, { type: 'spawn', exit: 'N3W', vehicles: [loco(), ...rev(2)] });
    expect(next.consists).toHaveLength(1);
    expect(consistOf(next, 'LOK1')).toHaveLength(3);
    // vehicles[0] is the front of the arriving train (deepest inside the station)
    expect(next.vehicles.R2!.pos.s).toBeCloseTo(vlen('wagon_rev') / 2);
    expect(next.vehicles.LOK1!.pos.s).toBeGreaterThan(next.vehicles.R1!.pos.s);
  });
});

describe('6. z toru 3 do hali ze zmianą kierunku na torze 63', () => {
  it('findRoute zgłasza zmianę kierunku na torze 63', () => {
    const s = station({ S1: 0, S2: 0, X1: 0 }, [{ edge: 'e3E', startOffset: 20, vehicles: [loco(), ...rev(4)] }]);
    const route = findRouteForVehicle(topo, s, 'LOK1', 'e69');
    expect(route.found).toBe(true);
    if (!route.found) return;
    expect(route.needsReversal).toBe(true);
    expect(route.reverseOn).toEqual(['e63']);
    expect(route.legs).toHaveLength(2);
    expect(route.legs[0]).toMatchObject({ edges: ['e3E', 'eD2', 'eD1', 'e63'], switches: { S2: 1, X1: 0, S1: 1 }, dir: -1 });
    expect(route.legs[1]).toMatchObject({ edges: ['e63', 'eD1', 'e67b', 'e69'], switches: { S1: 1, X1: 1 }, dir: 1 });
  });

  it('krótki pojazd zawraca już na łączniku', () => {
    const s = station({}, [{ edge: 'e3E', startOffset: 20, vehicles: [{ id: 'SH1', type: 'shunter' }] }]);
    const route = findRouteForVehicle(topo, s, 'SH1', 'e69');
    expect(route.found && route.reverseOn).toEqual(['eD1']);
  });

  it('wykonuje przejazd: 3E → łącznik → 63, X1=1, → 67 → 69', () => {
    let s = station({ S1: 0, S2: 0, X1: 0 }, [{ edge: 'e3E', startOffset: 30, vehicles: [loco(), ...rev(4)] }]);
    for (const [sw, st] of [['S2', 1], ['X1', 0], ['S1', 1]] as const) s = act(s, { type: 'setSwitch', switch: sw, state: st });
    s = act(s, { type: 'driveTo', vehicle: 'LOK1', edge: 'e63', offset: 100 });
    s = act(s, { type: 'setSwitch', switch: 'X1', state: 1 });
    const r = drive(topo, s, 'LOK1', 1, 2000);
    expect(r.stop?.reason).toBe('bufferStop');
    expect(edgeOf(r.state, 'R4')).toBe('e69');
    expect(edgeOf(r.state, 'R3')).toBe('e69');
    expect(edgeOf(r.state, 'LOK1')).toBe('e67b');
  });
});

describe('7. zatrzymanie przed źle ustawionym rozjazdem', () => {
  it('z toru 65 przy S1=1', () => {
    const s = station({ S1: 1 }, [{ edge: 'e65', startOffset: 100, vehicles: [loco()] }]);
    const r = drive(topo, s, 'LOK1', -1, 500);
    expect(r.stop).toMatchObject({ reason: 'switchAgainst', switchId: 'S1', message: 'Rozjazd S1 ustawiony przeciwnie' });
    expect(edgeOf(r.state, 'LOK1')).toBe('e65');
    expect(r.state.vehicles.LOK1!.pos.s).toBeCloseTo(vlen('lokomotywa') / 2);
    expect(r.moved).toBeCloseTo(100);
  });

  it('z łącznika do toru 3 przy S2=0', () => {
    const s = station({ S2: 0, X1: 0 }, [{ edge: 'eD2', startOffset: 10, vehicles: [loco(), ...rev(1)] }]);
    const r = drive(topo, s, 'LOK1', 1, 500);
    expect(r.stop).toMatchObject({ reason: 'switchAgainst', message: 'Rozjazd S2 ustawiony przeciwnie' });
    expect(body(r.state, 'R1').b).toBeCloseTo(len('eD1') + len('eD2'));
  });

  it('z toru 69 w stronę łącznika przy X1=0 skład jedzie na tor 67 zachodni', () => {
    const s = station({ X1: 0, S1: 1 }, [{ edge: 'e69', startOffset: 30, vehicles: [{ id: 'SH1', type: 'shunter' }] }]);
    const r = drive(topo, s, 'SH1', -1, 500);
    expect(r.stop).toBeUndefined();
    expect(edgeOf(r.state, 'SH1')).toBe('e67');
  });

  it('nie rusza, gdy czoło stoi już przy rozjeździe ustawionym przeciwnie', () => {
    const s = station({ S1: 1 }, [{ edge: 'e65', startOffset: 0, vehicles: [loco()] }]);
    const r = drive(topo, s, 'LOK1', -1, 10);
    expect(r.moved).toBe(0);
    expect(r.stop?.reason).toBe('switchAgainst');
    expect(r.state).toBe(s);
  });
});

describe('8. blokada przełożenia zajętego rozjazdu', () => {
  const blocked = (sw: string, p: Placement, switches: SwitchStates = {}) => {
    const s = station(switches, [p]);
    expect(foulingVehicles(topo, s, sw)).toContain(p.vehicles[0]!.id);
    const res = setSwitch(topo, s, sw, 1 - (s.switches[sw] ?? 0));
    expect(res.error).toBe(`Rozjazd ${sw} zajęty – nie można przełożyć`);
    expect(res.state).toBe(s);
  };

  it('S1: wagon na końcu toru 63 lub na początku toru 65', () => {
    blocked('S1', { edge: 'e63', startOffset: len('e63') - vlen('wagon_rev') - 10, vehicles: rev(1) });
    blocked('S1', { edge: 'e65', startOffset: 5, vehicles: rev(1) });
  });

  it('X1: wagon na łączniku przy skrzyżowaniu lub stojący na nim', () => {
    blocked('X1', { edge: 'eD1', startOffset: len('eD1') - vlen('wagon_rev') - 15, vehicles: rev(1) });
    blocked('X1', { edge: 'e67', startOffset: len('e67') - 10, vehicles: rev(1) }, { X1: 0 });
  });

  it('S2: wagon na torze 3 zachodnim przy rozjeździe', () => {
    blocked('S2', { edge: 'e3W', startOffset: len('e3W') - vlen('wagon_rev') - 5, vehicles: rev(1) });
  });

  it('pozwala przełożyć, gdy pojazd stoi poza strefą', () => {
    const s = station({}, [{ edge: 'e63', startOffset: len('e63') - vlen('wagon_rev') - 25, vehicles: rev(1) }]);
    const res = setSwitch(topo, s, 'S1', 1);
    expect(res.error).toBeUndefined();
    expect(res.state.switches.S1).toBe(1);
  });
});

describe('9. skład dłuższy niż łącznik', () => {
  it('przechodzi przez dwa rozjazdy naraz, wagony na trzech odcinkach', () => {
    const s0 = station({ S1: 1, S2: 1, X1: 0 }, [{ edge: 'e3E', startOffset: 5, vehicles: [loco(), ...rev(6)] }]);
    const ids = ['LOK1', ...rev(6).map((v) => v.id)];
    const s = act(s0, { type: 'driveTo', vehicle: 'LOK1', edge: 'eD1', offset: 150 });
    const edges = new Set(ids.map((id) => edgeOf(s, id)));
    expect(edges).toEqual(new Set(['eD1', 'eD2', 'e3E']));
    // Consecutive vehicles keep exactly the coupling gap along the track.
    for (let i = 1; i < ids.length; i++) expect(body(s, ids[i]!).a - body(s, ids[i - 1]!).b).toBeCloseTo(gap);
    const r = drive(topo, s, 'LOK1', -1, 400);
    expect(r.stop?.reason).toBeUndefined();
    for (const id of ids) expect(edgeOf(r.state, id)).toBe('e63');
  });
});

describe('10. kozioł, kolizja, sprzęganie, shunter', () => {
  it.each([
    ['e63', 100, -1, 'N63W'],
    ['e65', 100, 1, 'N65E'],
    ['e67', 100, -1, 'N67W'],
    ['e69', 10, 1, 'N69E'],
  ] as const)('kozioł oporowy na %s', (edge, offset, dir, node) => {
    const s = station({ S1: 0, X1: 0 }, [{ edge, startOffset: offset, vehicles: [loco()] }]);
    const r = drive(topo, s, 'LOK1', dir, 2000);
    expect(r.stop).toMatchObject({ reason: 'bufferStop', node });
    const b = body(r.state, 'LOK1');
    expect(dir < 0 ? b.a : b.b - b.line.length).toBeCloseTo(0);
  });

  it('kolizja zatrzymuje skład w odstępie sprzęgowym i sprzęga', () => {
    const s = station({}, [
      { edge: 'e65', startOffset: 10, vehicles: [loco()] },
      { edge: 'e65', startOffset: 200, vehicles: rev(2) },
    ]);
    const r = drive(topo, s, 'LOK1', 1, 500, { autoCouple: true });
    expect(r.stop).toMatchObject({ reason: 'collision', vehicle: 'R1', coupled: true });
    expect(body(r.state, 'R1').a - body(r.state, 'LOK1').b).toBeCloseTo(gap);
    expect(consistOf(r.state, 'LOK1')).toEqual(['LOK1', 'R1', 'R2']);
    // The merged consist moves together.
    const pushed = drive(topo, r.state, 'LOK1', 1, 50);
    expect(pushed.state.vehicles.R2!.pos.s).toBeCloseTo(r.state.vehicles.R2!.pos.s + 50);
  });

  it('bez auto-sprzęgania tylko się zatrzymuje', () => {
    const s = station({}, [
      { edge: 'e65', startOffset: 10, vehicles: [loco()] },
      { edge: 'e65', startOffset: 200, vehicles: rev(2) },
    ]);
    const r = drive(topo, s, 'LOK1', 1, 500, { autoCouple: false });
    expect(r.stop).toMatchObject({ reason: 'collision', coupled: false, message: 'Kolizja z pojazdem R1' });
    expect(consistOf(r.state, 'LOK1')).toEqual(['LOK1']);
  });

  it('kolizja przez rozjazd z pojazdem na sąsiednim odcinku', () => {
    const s = station({ S1: 0 }, [
      { edge: 'e63', startOffset: 100, vehicles: [loco()] },
      { edge: 'e65', startOffset: 50, vehicles: rev(1) },
    ]);
    const r = drive(topo, s, 'LOK1', 1, 500, { autoCouple: true });
    expect(r.stop).toMatchObject({ reason: 'collision', coupled: true });
    expect(consistOf(r.state, 'R1')).toContain('LOK1');
  });

  it('nie wjeżdża na skrzyżowanie zajęte przez pojazd z innej drogi', () => {
    const s = station({ X1: 0, S1: 1 }, [
      { edge: 'eD1', startOffset: 10, vehicles: [loco()] },
      { edge: 'e67', startOffset: len('e67') - 20, vehicles: rev(1) },
    ]);
    const r = drive(topo, s, 'LOK1', 1, 500);
    expect(r.stop).toMatchObject({ reason: 'blocked', vehicle: 'R1', node: 'X1' });
    expect(edgeOf(r.state, 'LOK1')).toBe('eD1');
  });

  it('rozprzęgnięcie: część bez pojazdu trakcyjnego zostaje na miejscu', () => {
    let s = station({}, [{ edge: 'e65', startOffset: 10, vehicles: [loco(), ...rev(2)] }]);
    s = act(s, { type: 'uncouple', between: ['R1', 'R2'] });
    expect(consistOf(s, 'LOK1')).toEqual(['LOK1', 'R1']);
    const r2 = s.vehicles.R2!.pos;
    const r = drive(topo, s, 'LOK1', -1, 5);
    expect(r.moved).toBeCloseTo(5);
    expect(r.state.vehicles.R2!.pos).toEqual(r2);
    const idle = drive(topo, r.state, 'R2', 1, 10);
    expect(idle.moved).toBe(0);
    expect(idle.stop).toMatchObject({ reason: 'noTraction' });
  });

  it('shunter z 5 wagonami nie rusza, z 4 rusza', () => {
    const five = station({}, [{ edge: 'e65', startOffset: 10, vehicles: [{ id: 'SH1', type: 'shunter' }, ...rev(5)] }]);
    const r = drive(topo, five, 'SH1', 1, 10);
    expect(r.moved).toBe(0);
    expect(r.state).toBe(five);
    expect(r.stop).toMatchObject({ reason: 'shunterLimit', message: 'Shunter może pchać maks. 4 wagony' });
    const four = station({}, [{ edge: 'e65', startOffset: 10, vehicles: [{ id: 'SH1', type: 'shunter' }, ...rev(4)] }]);
    expect(drive(topo, four, 'SH1', 1, 10).moved).toBeCloseTo(10);
  });

  it('step = drive o speed·dt', () => {
    const s = station({}, [{ edge: 'e65', startOffset: 10, vehicles: [loco()] }]);
    const r = step(topo, s, 'LOK1', 1, 0.5, 40);
    expect(r.moved).toBeCloseTo(20);
  });
});

describe('dowolny układ z pliku (bez nazw rozjazdów w kodzie)', () => {
  // Edge "b" points towards the switch (B → W), so the direction flips when entering it.
  const tiny: StationLayout = {
    ...layout,
    nodes: [
      { id: 'A', x: 0, y: 0, type: 'bufferStop' },
      { id: 'W', x: 200, y: 0, type: 'switch' },
      { id: 'B', x: 500, y: 0, type: 'bufferStop' },
      { id: 'C', x: 500, y: 100, type: 'exit' },
    ],
    edges: [
      { id: 'a', track: '1', from: 'A', to: 'W' },
      { id: 'b', track: '1', from: 'B', to: 'W' },
      { id: 'c', track: '2', from: 'W', to: 'C' },
    ],
    boundaries: [],
    switches: [{ id: 'W7', node: 'W', default: 0, states: [{ name: 'p', connections: [['a', 'b']] }, { name: 'l', connections: [['a', 'c']] }] }],
    counters: [],
  };
  const t = buildTopology(tiny);
  const s0 = stateFromInitial(t, { switches: { W7: 0 }, placements: [{ edge: 'a', startOffset: 100, vehicles: [loco()] }] });

  it('kierunek na nowym odcinku zależy od końców odcinków', () => {
    const r = drive(t, s0, 'LOK1', 1, 200);
    expect(r.state.vehicles.LOK1!.pos.edge).toBe('b');
    expect(r.dir).toBe(-1);
    const back = drive(t, r.state, 'LOK1', 1, 200);
    expect(back.state.vehicles.LOK1!.pos.edge).toBe('a');
    expect(back.dir).toBe(-1);
  });

  it('rozjazd o dowolnej nazwie', () => {
    const r = drive(t, { ...s0, switches: { W7: 1 } }, 'LOK1', 1, 1000);
    expect(r.stop).toMatchObject({ reason: 'exit', node: 'C' });
    const against = stateFromInitial(t, { switches: { W7: 1 }, placements: [{ edge: 'b', startOffset: 100, vehicles: [loco()] }] });
    expect(drive(t, against, 'LOK1', 1, 1000).stop?.message).toBe('Rozjazd W7 ustawiony przeciwnie');
    expect(findRoute(t, against, { edge: 'b', s: 150 }, 'a')).toMatchObject({ found: true, legs: [{ switches: { W7: 0 }, dir: 1 }] });
    // From "b" the only way to "c" is to run onto "a" and reverse there.
    expect(findRoute(t, against, { edge: 'b', s: 150 }, 'c')).toMatchObject({ found: true, needsReversal: true, reverseOn: ['a'] });
  });
});
