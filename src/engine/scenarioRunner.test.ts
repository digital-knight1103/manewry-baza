import { describe, expect, it } from 'vitest';
import example from '../data/scenarios/wstawienie-na-naprawe.json';
import { stationTopology as topo } from '../data/station';
import { runScenario, type Scenario } from './scenario';
import { advanceStep, animateAction, DRIVE_SPEED, frameAt, startStep, SWITCH_MS, type StepPlayback } from './scenarioRunner';
import { stateFromInitial } from './vehicles';

const scenario = example as unknown as Scenario;
const initial = stateFromInitial(topo, scenario.initialState);

/** Plays a step with fixed animation frames; returns the end and the frames seen. */
function playStep(sc: Scenario, step: number, from: typeof initial, frameMs = 16) {
  let pb: StepPlayback = startStep(step, from);
  const frames: StepPlayback[] = [];
  for (let i = 0; i < 100_000 && !pb.finished; i++) {
    pb = advanceStep(topo, sc, pb, frameMs);
    frames.push(pb);
  }
  return { pb, frames };
}

describe('animowane odtwarzanie', () => {
  it('animacja przejazdu przechodzi przez stany pośrednie i kończy się stanem natychmiastowym', () => {
    const action = { type: 'driveTo', vehicle: 'LOK1', edge: 'e3W', offset: 160.5 } as const;
    const anim = animateAction(topo, initial, action);
    expect(anim.durationMs).toBeCloseTo((100 / DRIVE_SPEED) * 1000);
    expect(anim.route).toEqual(['e3W']);
    const half = frameAt(topo, anim, anim.durationMs / 2);
    expect(half.vehicles.LOK1!.pos.s).toBeCloseTo(110.5);
    expect(frameAt(topo, anim, anim.durationMs)).toBe(anim.result.state);
  });

  it('przełożenie rozjazdu: podświetlenie rozjazdu przez SWITCH_MS', () => {
    const moved = runScenario(topo, { ...scenario, steps: scenario.steps.slice(0, 1) }).state;
    const anim = animateAction(topo, moved, { type: 'setSwitch', switch: 'S1', state: 1 });
    expect(anim).toMatchObject({ switchId: 'S1', durationMs: SWITCH_MS });
    expect(frameAt(topo, anim, 0).switches.S1).toBe(1);
  });

  it('każdy krok scenariusza przykładowego kończy się dokładnie migawką z odtwarzania natychmiastowego', () => {
    const { snapshots } = runScenario(topo, scenario);
    scenario.steps.forEach((_, i) => {
      const { pb, frames } = playStep(scenario, i, snapshots[i]!);
      expect(pb.error, `krok ${i + 1}`).toBeUndefined();
      expect(pb.state, `krok ${i + 1}`).toEqual(snapshots[i + 1]);
      // Real animation, not a jump: several frames per step.
      expect(frames.length, `krok ${i + 1}`).toBeGreaterThan(10);
    });
  });

  it('podczas przejazdu dostępna jest droga do podświetlenia', () => {
    const { snapshots } = runScenario(topo, scenario);
    const { frames } = playStep(scenario, 1, snapshots[1]!);
    const routes = frames.map((f) => f.anim?.route).filter(Boolean);
    expect(routes).toContainEqual(['e63', 'eD1', 'eD2', 'e3E']);
  });

  it('pomijanie kroku (Infinity) daje ten sam stan', () => {
    const { snapshots } = runScenario(topo, scenario);
    const pb = advanceStep(topo, scenario, startStep(4, snapshots[4]!), Infinity);
    expect(pb.finished).toBe(true);
    expect(pb.state).toEqual(snapshots[5]);
  });

  it('błąd w animacji zatrzymuje krok z numerem kroku i akcji', () => {
    const broken: Scenario = {
      ...scenario,
      steps: [
        {
          title: 'zły',
          bullets: [],
          actions: [
            { type: 'wait', ms: 100 },
            { type: 'setSwitch', switch: 'S9', state: 0 },
          ],
        },
      ],
    };
    let pb = startStep(0, initial);
    pb = advanceStep(topo, broken, pb, 50);
    expect(pb.finished).toBe(false);
    pb = advanceStep(topo, broken, pb, 100);
    expect(pb.finished).toBe(true);
    expect(pb.error).toMatchObject({ step: 0, action: 1 });
  });
});
