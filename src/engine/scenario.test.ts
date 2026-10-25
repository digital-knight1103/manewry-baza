import { describe, expect, it } from 'vitest';
import example from '../data/scenarios/wstawienie-na-naprawe.json';
import { stationTopology as topo } from '../data/station';
import { runScenario, type Scenario } from './scenario';
import { wagonCount } from './vehicles';

const scenario = example as unknown as Scenario;

describe('scenariusz przykładowy', () => {
  it('odtwarza się od początku do końca bez błędów', () => {
    const res = runScenario(topo, scenario);
    expect(res.error).toBeUndefined();
    expect(res.snapshots).toHaveLength(scenario.steps.length + 1);
  });

  it('stan końcowy: wagon R1 w hali na torze 69', () => {
    const { state } = runScenario(topo, scenario);
    expect(state.vehicles.R1!.pos.edge).toBe('e69');
    expect(wagonCount(topo.layout, state, ['e69'])).toBe(1);
    expect(state.vehicles.LOK1).toBeUndefined();
    expect(state.consists.find((c) => c.includes('R1'))).toEqual(['R1']);
  });

  it('błędna akcja zatrzymuje odtwarzanie z numerem kroku i akcji', () => {
    const broken: Scenario = {
      ...scenario,
      steps: [scenario.steps[0]!, { title: 'zły krok', bullets: [], actions: [{ type: 'driveTo', vehicle: 'D1', edge: 'e63', offset: 200 }] }],
    };
    const res = runScenario(topo, broken);
    expect(res.error).toMatchObject({ step: 1, action: 0 });
    expect(res.error!.message).toMatch(/^Krok 2, akcja 1: /);
    expect(res.snapshots).toHaveLength(2);
  });
});
