// Scenario format (SPEC rozdz. 10) and headless playback.
import { applyAction, type Action } from './actions';
import type { Topology } from './topology';
import { emptyState, stateFromInitial, type InitialState, type StationState } from './vehicles';

export interface ScenarioStep {
  title: string;
  bullets: string[];
  actions: Action[];
}

export interface Scenario {
  id: string;
  title: string;
  initialState: InitialState;
  steps: ScenarioStep[];
}

export interface ScenarioError {
  /** 0-based step index (-1 = initial state). */
  step: number;
  /** 0-based action index within the step (-1 = initial state). */
  action: number;
  message: string;
}

export interface ScenarioRun {
  /** State after the last executed action. */
  state: StationState;
  /** snapshots[0] = initial state, snapshots[i + 1] = state after step i (only completed steps). */
  snapshots: StationState[];
  error?: ScenarioError;
}

/** Executes the whole scenario, stopping at the first failing action. */
export function runScenario(topo: Topology, scenario: Scenario): ScenarioRun {
  let state: StationState;
  try {
    state = stateFromInitial(topo, scenario.initialState);
  } catch (e) {
    const message = `Stan początkowy: ${e instanceof Error ? e.message : String(e)}`;
    return { state: emptyState(topo.layout), snapshots: [], error: { step: -1, action: -1, message } };
  }
  const snapshots = [state];
  for (const [si, step] of scenario.steps.entries()) {
    for (const [ai, action] of step.actions.entries()) {
      const res = applyAction(topo, state, action);
      state = res.state;
      if (res.error)
        return { state, snapshots, error: { step: si, action: ai, message: `Krok ${si + 1}, akcja ${ai + 1}: ${res.error}` } };
    }
    snapshots.push(state);
  }
  return { state, snapshots };
}
