import { describe, expect, it } from 'vitest';
import example from '../data/scenarios/wstawienie-na-naprawe.json';
import { stationTopology as topo } from '../data/station';
import { applyAction } from './actions';
import { runScenario, type Scenario } from './scenario';
import { pointAt } from './topology';
import { stateFromInitial, vehicleLength, wagonCount } from './vehicles';

const scenario = example as unknown as Scenario;

describe('scenariusz przykładowy', () => {
  it('odtwarza się od początku do końca bez błędów', () => {
    const res = runScenario(topo, scenario);
    expect(res.error).toBeUndefined();
    expect(res.snapshots).toHaveLength(scenario.steps.length + 1);
  });

  it('stan końcowy: R1 w hali na torze 69, R2–R4 i platforma na torze 65, lokomotywa poza stacją', () => {
    const { state } = runScenario(topo, scenario);
    const { hall } = topo.layout;

    const r1 = state.vehicles.R1!;
    expect(r1.pos.edge).toBe('e69');
    const centre = pointAt(topo, r1.pos.edge, r1.pos.s);
    const half = vehicleLength(topo.layout, r1.type) / 2;
    expect(centre.x - half).toBeGreaterThanOrEqual(hall.rect.x);
    expect(centre.x + half).toBeLessThanOrEqual(hall.wallX);
    expect(wagonCount(topo.layout, state, ['e69'])).toBe(1);
    expect(state.consists.find((c) => c.includes('R1'))).toEqual(['R1']);

    for (const id of ['R2', 'R3', 'R4', 'PL1']) expect(state.vehicles[id]!.pos.edge, id).toBe('e65');
    expect(state.consists.find((c) => c.includes('R2'))).toEqual(['R2', 'R3', 'R4', 'PL1', 'D3', 'D4']);

    expect(state.vehicles.LOK1).toBeUndefined();
  });

  it('migawki odpowiadają rysunkom 03 i 04', () => {
    const { snapshots } = runScenario(topo, scenario);
    // Rys. 03: lokomotywa z czterema wagonami REV na torze 63, przed rozjazdem S1.
    const fig3 = snapshots[2]!;
    for (const id of ['LOK1', 'R1', 'R2', 'R3', 'R4']) expect(fig3.vehicles[id]!.pos.edge, id).toBe('e63');
    // Rys. 04: shunter na torze 63 przy S1, wagony REV dopięte do platformy na torze 65, hala pusta.
    const fig4 = snapshots[4]!;
    expect(fig4.vehicles.SH1!.pos.edge).toBe('e63');
    expect(fig4.vehicles.LOK1).toBeUndefined();
    expect(wagonCount(topo.layout, fig4, ['e65'])).toBe(7);
    expect(wagonCount(topo.layout, fig4, ['e69'])).toBe(0);
  });

  it('błędna akcja zatrzymuje odtwarzanie z numerem kroku i akcji', () => {
    const broken: Scenario = {
      ...scenario,
      steps: [
        scenario.steps[0]!,
        { title: 'zły krok', bullets: [], actions: [{ type: 'driveTo', vehicle: 'D1', edge: 'e63', offset: 200 }] },
      ],
    };
    const res = runScenario(topo, broken);
    expect(res.error).toMatchObject({ step: 1, action: 0 });
    expect(res.error!.message).toMatch(/^Krok 2, akcja 1: /);
    expect(res.snapshots).toHaveLength(2);
  });
});

describe('driveTo – komunikaty o nieosiągalnym punkcie', () => {
  const initial = stateFromInitial(topo, scenario.initialState);

  it('źle ustawiony rozjazd: nazwa rozjazdu i potrzebny stan', () => {
    // LOK1 with its wagons pulled beyond S2 onto track 3 east; S2 still straight.
    const beyond = applyAction(topo, initial, { type: 'driveTo', vehicle: 'LOK1', edge: 'e3E', offset: 50 }).state;
    const res = applyAction(topo, beyond, { type: 'driveTo', vehicle: 'LOK1', edge: 'eD2', offset: 50 });
    expect(res.error).toMatch(/rozjazd S2 ustawiony przeciwnie \(potrzebny stan: na łącznik/);
    expect(res.state).toBe(beyond);
  });

  it('punkt wymagający zmiany kierunku', () => {
    // LOK1 stoi na torze 3 (zachód); na tor 63 trzeba pojechać za S2 i wrócić łącznikiem.
    const res = applyAction(topo, initial, { type: 'driveTo', vehicle: 'LOK1', edge: 'e63', offset: 100 });
    expect(res.error).toMatch(/wymaga zmiany kierunku/);
  });

  it('driveTo zwraca wykonany ruch do animacji', () => {
    const res = applyAction(topo, initial, { type: 'driveTo', vehicle: 'LOK1', edge: 'e3W', offset: 100 });
    expect(res.error).toBeUndefined();
    expect(res.motion).toMatchObject({ vehicle: 'LOK1', dir: 1 });
    expect(res.motion!.distance).toBeCloseTo(100 - initial.vehicles.LOK1!.pos.s);
  });
});
