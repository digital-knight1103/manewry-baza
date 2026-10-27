import { describe, expect, it } from 'vitest';
import exampleScenario from '../data/scenarios/wstawienie-na-naprawe.json';
import { stationTopology as topo } from '../data/station';
import { applyAction } from './actions';
import { vehicleGaps } from './control';
import { couple, dragRange, moveConsist, touchingNeighbours, uncouple } from './edit';
import { drive, REPAIR_BLOCK_MESSAGE } from './movement';
import { setStatus, startRepairProblem, vehiclesUnder } from './repair';
import { runScenario, type Scenario } from './scenario';
import { parseScenarioFile } from './scenarioEdit';
import { animateAction, LIFT_MS } from './scenarioRunner';
import {
  findOverlap,
  inRepair,
  stateFromInitial,
  toInitialState,
  wagonCount,
  type Placement,
  type StationState,
} from './vehicles';

const layout = topo.layout;
const station = (placements: Placement[]) => stateFromInitial(topo, { switches: { X1: 0 }, placements });
const wagon = (id = 'R1') => ({ id, type: 'wagon_rev' });
const shunter = (id = 'SH1') => ({ id, type: 'shunter' });
/** R1 alone on track 69, centred over the inspection pit (body 902–935, pit 890–947). */
const overPit: Placement = { edge: 'e69', startOffset: 22, vehicles: [wagon()] };
/** R1 already in repair, so that other vehicles may be placed under it. */
const repairing: Placement = { ...overPit, vehicles: [{ ...wagon(), status: 'naprawa' }] };
const shunterUnder: Placement = { edge: 'e69', startOffset: 30, vehicles: [shunter()] };

function lifted(extra: Placement[] = []): StationState {
  const res = setStatus(topo, station([overPit, ...extra]), 'R1', 'naprawa');
  expect(res.error).toBeUndefined();
  return res.state;
}

const x = (s: StationState, id: string) => {
  const v = s.vehicles[id]!;
  const e = topo.edges.get(v.pos.edge)!;
  return topo.nodes.get(e.from)!.x + v.pos.s; // all edges used here are horizontal, from west to east
};

describe('rozpoczęcie naprawy', () => {
  it('wagon nad kanałem, rozprzęgnięty – status „naprawa”', () => {
    const s = lifted();
    expect(inRepair(s.vehicles.R1)).toBe(true);
  });

  it('odmowa poza kanałem rewizyjnym', () => {
    const s = station([{ edge: 'e67b', startOffset: 100, vehicles: [wagon()] }]);
    const res = setStatus(topo, s, 'R1', 'naprawa');
    expect(res.error).toMatch(/nad kanałem rewizyjnym/);
    expect(res.state).toBe(s);
  });

  it('odmowa, gdy wagon jest sprzęgnięty; po rozprzęgnięciu – można', () => {
    const s = station([{ edge: 'e69', startOffset: 2, vehicles: [shunter(), wagon()] }]);
    expect(startRepairProblem(topo, s, 'R1')).toMatch(/rozprzęgnij.*SH1/);
    expect(setStatus(topo, s, 'R1', 'naprawa').error).toBeDefined();
    const apart = uncouple(s, 'SH1', 'R1');
    expect(setStatus(topo, apart, 'R1', 'naprawa').error).toBeUndefined();
  });

  it('odmowa dla lokomotywy i shuntera', () => {
    const s = station([{ edge: 'e69', startOffset: 30, vehicles: [shunter()] }]);
    expect(setStatus(topo, s, 'SH1', 'naprawa').error).toMatch(/tylko wagon/);
  });

  it('licznik toru 69 nadal liczy wagon w naprawie', () => {
    expect(wagonCount(layout, lifted(), ['e67b', 'e69'])).toBe(1);
  });
});

describe('wagon w naprawie – blokada ruchu i sprzęgania', () => {
  it('nie da się go przesunąć ani sprzęgnąć', () => {
    // A wagon touching R1 from the west.
    const s = lifted([{ edge: 'e67b', startOffset: 363 + 22 - 4.4 - 33, vehicles: [wagon('R2')] }]);
    expect(dragRange(topo, s, 'R1')).toBeNull();
    expect(moveConsist(topo, s, 'R1', 10)).toBe(s);
    expect(touchingNeighbours(topo, s, 'R1')).toEqual([]);
    expect(touchingNeighbours(topo, s, 'R2')).toEqual([]);
    expect(couple(topo, s, 'R2', 'R1')).toBe(s);
    expect(applyAction(topo, s, { type: 'couple', between: ['R2', 'R1'] }).error).toBeDefined();
    expect(vehicleGaps(topo, s).some((g) => g.a === 'R1' || g.b === 'R1')).toBe(false);
  });

  it('auto-sprzęganie przy najechaniu pomija wagon w naprawie', () => {
    const s = lifted([{ edge: 'e67b', startOffset: 300, vehicles: [{ id: 'LOK1', type: 'lokomotywa' }] }]);
    const r = drive(topo, s, 'LOK1', 1, 500, { autoCouple: true });
    expect(r.stop?.reason).toBe('repair');
    expect(r.state.consists.find((c) => c.includes('R1'))).toEqual(['R1']);
  });
});

describe('przejazd pod wagonem w naprawie', () => {
  it('samotny shunter przejeżdża pod wagonem w obie strony', () => {
    let s = lifted([{ edge: 'e67b', startOffset: 300, vehicles: [shunter()] }]);
    // East: under R1 up to the buffer stop of track 69.
    let r = drive(topo, s, 'SH1', 1, 500);
    expect(r.stop?.reason).toBe('bufferStop');
    expect(x(r.state, 'SH1')).toBeCloseTo(960 - 3.3);
    s = r.state;
    // Back west: under R1 again, out of the hall onto track 67.
    r = drive(topo, s, 'SH1', -1, 200);
    expect(r.stop).toBeUndefined();
    expect(r.state.vehicles.SH1!.pos.edge).toBe('e67b');
    expect(x(r.state, 'SH1')).toBeCloseTo(960 - 3.3 - 200);
  });

  it('shunter stojący pod wagonem: stan poprawny (zapis / odczyt), bez sprzęgania', () => {
    const s = station([repairing, shunterUnder]);
    expect(vehiclesUnder(topo, s, 'R1')).toEqual(['SH1']);
    expect(findOverlap(topo, s)).toBeNull();
    const again = stateFromInitial(topo, toInitialState(topo, s));
    expect(inRepair(again.vehicles.R1)).toBe(true);
    expect(again.vehicles.SH1!.pos.s).toBeCloseTo(s.vehicles.SH1!.pos.s);
  });

  it('shunter z wagonem zatrzymuje się przed wagonem w naprawie', () => {
    const s = lifted([{ edge: 'e67b', startOffset: 250, vehicles: [wagon('R2'), shunter()] }]);
    const r = drive(topo, s, 'SH1', 1, 500);
    expect(r.stop?.reason).toBe('repair');
    expect(r.stop?.message).toBe(REPAIR_BLOCK_MESSAGE);
    expect(r.stop?.vehicle).toBe('R1');
    // Front (the shunter) stops a coupling gap before the wagon body (x = 902).
    expect(x(r.state, 'SH1') + 3.3).toBeCloseTo(902 - layout.couplingGapM * layout.scalePxPerMeter);
  });

  it('lokomotywa zatrzymuje się przed wagonem w naprawie (także od strony kozła)', () => {
    const s = lifted([{ edge: 'e67b', startOffset: 250, vehicles: [{ id: 'LOK1', type: 'lokomotywa' }] }]);
    const r = drive(topo, s, 'LOK1', 1, 500);
    expect(r.stop?.reason).toBe('repair');
    const res = applyAction(topo, s, { type: 'driveTo', vehicle: 'LOK1', edge: 'e69', offset: 60 });
    expect(res.error).toContain(REPAIR_BLOCK_MESSAGE);
  });
});

describe('zakończenie naprawy', () => {
  it('odmowa, gdy pod wagonem stoi shunter; po wyjeździe – można, z nowym typem', () => {
    let s = station([repairing, shunterUnder]);
    const refused = setStatus(topo, s, 'R1', null);
    expect(refused.error).toMatch(/Pod wagonem R1 stoi SH1/);
    expect(refused.state).toBe(s);
    s = drive(topo, s, 'SH1', -1, 100).state;
    const kept = setStatus(topo, s, 'R1', null);
    expect(kept.error).toBeUndefined();
    expect(kept.state.vehicles.R1).toMatchObject({ type: 'wagon_rev' });
    expect(inRepair(kept.state.vehicles.R1)).toBe(false);
    const healthy = setStatus(topo, s, 'R1', null, 'wagon_zdrowy');
    expect(healthy.state.vehicles.R1!.type).toBe('wagon_zdrowy');
    expect(healthy.state.vehicles.R1!.status).toBeUndefined();
  });

  it('nowy typ musi być typem wagonu', () => {
    expect(setStatus(topo, lifted(), 'R1', null, 'lokomotywa').error).toBeDefined();
  });
});

describe('akcja scenariusza setStatus', () => {
  it('przykładowy scenariusz: krok 6 – R1 w naprawie, shunter przejechał pod nim na tor 67', () => {
    const run = runScenario(topo, exampleScenario as unknown as Scenario);
    expect(run.error).toBeUndefined();
    expect(run.snapshots).toHaveLength(7);
    expect(inRepair(run.snapshots[5]!.vehicles.R1)).toBe(false);
    const after = run.snapshots[6]!;
    expect(inRepair(after.vehicles.R1)).toBe(true);
    expect(after.vehicles.SH1!.pos.edge).toBe('e67');
  });

  it('migawki: włączenie i zakończenie naprawy ze zmianą typu', () => {
    const scenario: Scenario = {
      id: 't',
      title: 't',
      initialState: { switches: {}, placements: [overPit] },
      steps: [
        { title: 'a', bullets: [], actions: [{ type: 'setStatus', vehicle: 'R1', status: 'naprawa' }] },
        { title: 'b', bullets: [], actions: [{ type: 'setStatus', vehicle: 'R1', status: null, newType: 'wagon_zdrowy' }] },
      ],
    };
    const run = runScenario(topo, scenario);
    expect(run.error).toBeUndefined();
    expect(run.snapshots.map((s) => [s.vehicles.R1!.type, s.vehicles.R1!.status ?? null])).toEqual([
      ['wagon_rev', null],
      ['wagon_rev', 'naprawa'],
      ['wagon_zdrowy', null],
    ]);
  });

  it('błąd odtwarzania, gdy warunki niespełnione', () => {
    const scenario: Scenario = {
      id: 't',
      title: 't',
      initialState: { switches: {}, placements: [{ edge: 'e67b', startOffset: 10, vehicles: [wagon()] }] },
      steps: [{ title: 'a', bullets: [], actions: [{ type: 'setStatus', vehicle: 'R1', status: 'naprawa' }] }],
    };
    expect(runScenario(topo, scenario).error?.message).toMatch(/Krok 1, akcja 1: .*kanałem/);
  });

  it('animacja podniesienia trwa LIFT_MS', () => {
    const anim = animateAction(topo, station([overPit]), { type: 'setStatus', vehicle: 'R1', status: 'naprawa' });
    expect(anim.durationMs).toBe(LIFT_MS);
    expect(inRepair(anim.result.state.vehicles.R1)).toBe(true);
  });

  it('walidacja importu', () => {
    const file = (action: object) =>
      JSON.stringify({ id: 'x', title: 'x', initialState: { placements: [] }, steps: [{ title: 'a', actions: [action] }] });
    expect(() => parseScenarioFile(file({ type: 'setStatus', vehicle: 'R1', status: 'naprawa' }))).not.toThrow();
    expect(() => parseScenarioFile(file({ type: 'setStatus', vehicle: 'R1', status: null, newType: 'wagon_zdrowy' }))).not.toThrow();
    expect(() => parseScenarioFile(file({ type: 'setStatus', vehicle: 'R1', status: 'zepsuty' }))).toThrow(/status/);
    expect(() => parseScenarioFile(file({ type: 'setStatus', status: 'naprawa' }))).toThrow(/vehicle/);
    expect(() => parseScenarioFile(file({ type: 'setStatus', vehicle: 'R1', status: 'naprawa', newType: 'x' }))).toThrow(/newType/);
  });

  it('stan początkowy: wagon w naprawie nie może być w składzie', () => {
    expect(() =>
      stateFromInitial(topo, {
        switches: {},
        placements: [{ edge: 'e69', startOffset: 2, vehicles: [shunter(), { ...wagon(), status: 'naprawa' }] }],
      }),
    ).toThrow(/nie może być sprzęgnięty/);
  });
});
