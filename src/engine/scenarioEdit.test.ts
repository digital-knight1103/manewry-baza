import { describe, expect, it } from 'vitest';
import example from '../data/scenarios/wstawienie-na-naprawe.json';
import { stationTopology as topo } from '../data/station';
import type { Action } from './actions';
import { drive } from './movement';
import { runScenario, type Scenario } from './scenario';
import {
  addStep,
  driveToAction,
  duplicateScenario,
  exportBundle,
  exportScenario,
  moveStep,
  newScenario,
  parseScenarioFile,
  recordAction,
  removeLastAction,
  removeStep,
  slugify,
  uniqueId,
  updateStep,
} from './scenarioEdit';
import { stateFromInitial, toInitialState } from './vehicles';

const example0 = example as unknown as Scenario;
const empty = (): Scenario => ({ id: 'test', title: 'Test', initialState: example0.initialState, steps: [] });
const drv = (offset: number): Action => ({ type: 'driveTo', vehicle: 'LOK1', edge: 'e3W', offset });

describe('nagrywanie akcji', () => {
  it('pierwsza akcja tworzy krok 1', () => {
    const sc = recordAction(empty(), { type: 'setSwitch', switch: 'S2', state: 1 });
    expect(sc.steps).toEqual([{ title: 'Krok 1', bullets: [], actions: [{ type: 'setSwitch', switch: 'S2', state: 1 }] }]);
  });

  it('kolejne przejazdy tego samego pojazdu łączą się w jeden driveTo', () => {
    let sc = recordAction(empty(), drv(80));
    sc = recordAction(sc, drv(120));
    expect(sc.steps[0]!.actions).toEqual([drv(120)]);
    sc = recordAction(sc, { type: 'setSwitch', switch: 'S2', state: 1 });
    sc = recordAction(sc, drv(150));
    expect(sc.steps[0]!.actions).toHaveLength(3);
  });

  it('akcje trafiają do ostatniego kroku', () => {
    let sc = recordAction(empty(), drv(80));
    sc = addStep(sc, 'Drugi');
    sc = recordAction(sc, drv(100));
    expect(sc.steps.map((s) => s.actions.length)).toEqual([1, 1]);
  });

  it('nagrany przejazd odtwarza się w to samo miejsce (zaokrąglenie offsetu)', () => {
    const start = stateFromInitial(topo, example0.initialState);
    const moved = drive(topo, start, 'LOK1', 1, 37.123456).state;
    const sc: Scenario = { ...empty(), steps: [{ title: 'k', bullets: [], actions: [driveToAction(moved, 'LOK1')] }] };
    const res = runScenario(topo, sc);
    expect(res.error).toBeUndefined();
    expect(res.state.vehicles.LOK1!.pos.s).toBeCloseTo(moved.vehicles.LOK1!.pos.s, 2);
  });

  it('cofnięcie ostatniej akcji', () => {
    const sc = recordAction(recordAction(empty(), drv(80)), { type: 'setSwitch', switch: 'S2', state: 1 });
    expect(removeLastAction(sc)!.steps[0]!.actions).toEqual([drv(80)]);
    expect(removeLastAction(empty())).toBeNull();
  });
});

describe('edycja kroków', () => {
  const three = () => addStep(addStep(addStep(empty(), 'A'), 'B'), 'C');

  it('zmiana tytułu i punktów opisu', () => {
    const sc = updateStep(three(), 1, { title: '  Nowy ', bullets: ['jeden', ' ', 'dwa '] });
    expect(sc.steps[1]).toMatchObject({ title: 'Nowy', bullets: ['jeden', 'dwa'] });
    expect(updateStep(three(), 0, { title: '' }).steps[0]!.title).toBe('Krok 1');
  });

  it('zmiana kolejności i usuwanie', () => {
    expect(moveStep(three(), 0, 1).steps.map((s) => s.title)).toEqual(['B', 'A', 'C']);
    expect(moveStep(three(), 2, 1).steps.map((s) => s.title)).toEqual(['A', 'B', 'C']);
    expect(removeStep(three(), 1).steps.map((s) => s.title)).toEqual(['A', 'C']);
  });
});

describe('lista scenariuszy', () => {
  it('identyfikatory z tytułu, bez kolizji', () => {
    expect(slugify('Wstawienie wagonów na naprawę – wersja 2')).toBe('wstawienie-wagonow-na-naprawe-wersja-2');
    expect(uniqueId('a', ['a', 'a-2'])).toBe('a-3');
    expect(newScenario('Mój', example0.initialState, ['moj']).id).toBe('moj-2');
  });

  it('duplikat jest niezależną kopią z nowym id', () => {
    const copy = duplicateScenario(example0, [example0.id]);
    expect(copy.id).toBe('wstawienie-na-naprawe-kopia');
    expect(copy.title).toBe('Wstawienie wagonów na naprawę (kopia)');
    expect(copy).not.toHaveProperty('_uwaga');
    copy.steps[0]!.bullets.push('zmiana');
    expect(example0.steps[0]!.bullets).toHaveLength(2);
  });
});

describe('eksport / import', () => {
  it('pojedynczy scenariusz i komplet wracają bez zmian', () => {
    const copy = duplicateScenario(example0, []);
    expect(parseScenarioFile(exportScenario(copy))).toEqual([copy]);
    expect(parseScenarioFile(exportBundle([copy, empty()]))).toEqual([copy, empty()]);
  });

  it('stan zapisany ze stacji wczytuje się jako stan początkowy', () => {
    const state = runScenario(topo, example0).state;
    const sc = { ...empty(), initialState: toInitialState(topo, state) };
    expect(runScenario(topo, parseScenarioFile(exportScenario(sc))[0]!).error).toBeUndefined();
  });

  it('czytelne błędy dla złych plików', () => {
    expect(() => parseScenarioFile('{')).toThrow('Plik nie jest poprawnym JSON-em');
    expect(() => parseScenarioFile('{"id":"x"}')).toThrow(/„id” lub „title”/);
    expect(() => parseScenarioFile(JSON.stringify({ ...empty(), steps: [{ title: 'a', actions: [{ type: 'fly' }] }] }))).toThrow(
      'Scenariusz, krok 1, akcja 1: nieznany typ akcji',
    );
  });
});
