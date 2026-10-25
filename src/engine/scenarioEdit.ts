// Pure operations on scenario data: recording actions, editing steps, managing the scenario list,
// import / export. Scenarios are plain JSON (SPEC rozdz. 10); every function returns a new object.
import type { Action } from './actions';
import type { Scenario, ScenarioStep } from './scenario';
import type { InitialState, StationState } from './vehicles';

const round2 = (x: number) => Math.round(x * 100) / 100;

/** driveTo action that brings `vehicleId` back to where it stands now (recording a finished drive). */
export function driveToAction(state: StationState, vehicleId: string): Action {
  const v = state.vehicles[vehicleId];
  if (!v) throw new Error(`Nieznany pojazd ${vehicleId}`);
  return { type: 'driveTo', vehicle: vehicleId, edge: v.pos.edge, offset: round2(v.pos.s) };
}

export const defaultStepTitle = (index: number) => `Krok ${index + 1}`;

const withSteps = (scenario: Scenario, steps: ScenarioStep[]): Scenario => ({ ...scenario, steps });

/**
 * Appends a recorded action to the last step (creating the first step if needed). Consecutive
 * drives of the same vehicle are merged into one driveTo: nothing happened in between, so the
 * final point is reachable directly along the same track.
 */
export function recordAction(scenario: Scenario, action: Action): Scenario {
  const steps = scenario.steps.length > 0 ? [...scenario.steps] : [{ title: defaultStepTitle(0), bullets: [], actions: [] }];
  const last = steps[steps.length - 1]!;
  const prev = last.actions[last.actions.length - 1];
  const merge = action.type === 'driveTo' && prev?.type === 'driveTo' && prev.vehicle === action.vehicle;
  const actions = merge ? [...last.actions.slice(0, -1), action] : [...last.actions, action];
  steps[steps.length - 1] = { ...last, actions };
  return withSteps(scenario, steps);
}

/** Removes the last action of the last step; null when there is none. */
export function removeLastAction(scenario: Scenario): Scenario | null {
  const last = scenario.steps[scenario.steps.length - 1];
  if (!last || last.actions.length === 0) return null;
  return withSteps(scenario, [...scenario.steps.slice(0, -1), { ...last, actions: last.actions.slice(0, -1) }]);
}

export const addStep = (scenario: Scenario, title: string, bullets: string[] = []): Scenario =>
  withSteps(scenario, [
    ...scenario.steps,
    { title: title.trim() || defaultStepTitle(scenario.steps.length), bullets, actions: [] },
  ]);

export function updateStep(scenario: Scenario, index: number, patch: Partial<Pick<ScenarioStep, 'title' | 'bullets'>>): Scenario {
  const step = scenario.steps[index];
  if (!step) return scenario;
  const next: ScenarioStep = { ...step, ...patch };
  if (patch.title !== undefined) next.title = patch.title.trim() || defaultStepTitle(index);
  if (patch.bullets) next.bullets = patch.bullets.map((b) => b.trim()).filter(Boolean);
  return withSteps(
    scenario,
    scenario.steps.map((s, i) => (i === index ? next : s)),
  );
}

export const removeStep = (scenario: Scenario, index: number): Scenario =>
  withSteps(
    scenario,
    scenario.steps.filter((_, i) => i !== index),
  );

/** Moves a step up (delta -1) or down (+1); out-of-range moves are ignored. */
export function moveStep(scenario: Scenario, index: number, delta: -1 | 1): Scenario {
  const to = index + delta;
  if (!scenario.steps[index] || to < 0 || to >= scenario.steps.length) return scenario;
  const steps = [...scenario.steps];
  [steps[index], steps[to]] = [steps[to]!, steps[index]!];
  return withSteps(scenario, steps);
}

const PL_CHARS: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };

/** URL-friendly id from a title: "Wstawienie wagonów" → "wstawienie-wagonow". */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL_CHARS[c]!)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'scenariusz';
}

/** `base`, or `base-2`, `base-3`… — the first one not in `taken`. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

export const newScenario = (title: string, initialState: InitialState, taken: Iterable<string>): Scenario => ({
  id: uniqueId(slugify(title), taken),
  title,
  initialState,
  steps: [],
});

/** Editable copy with a new id; drops non-format fields such as "_uwaga". */
export function duplicateScenario(scenario: Scenario, taken: Iterable<string>): Scenario {
  const copy: Scenario = structuredClone({
    id: scenario.id,
    title: scenario.title,
    initialState: scenario.initialState,
    steps: scenario.steps,
  });
  return { ...copy, id: uniqueId(`${scenario.id}-kopia`, taken), title: `${scenario.title} (kopia)` };
}

// --- Import / export -------------------------------------------------------------------------

const ACTION_TYPES = new Set<Action['type']>([
  'setSwitch',
  'driveTo',
  'driveAndCouple',
  'couple',
  'uncouple',
  'spawn',
  'remove',
  'wait',
  'highlight',
]);

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function toScenario(x: unknown, where: string): Scenario {
  if (!isObject(x) || typeof x.id !== 'string' || !x.id || typeof x.title !== 'string')
    throw new Error(`${where}: brak pola „id” lub „title”`);
  const initial = x.initialState;
  if (!isObject(initial) || !Array.isArray(initial.placements) || (initial.switches !== undefined && !isObject(initial.switches)))
    throw new Error(`${where}: nieprawidłowy „initialState”`);
  if (!Array.isArray(x.steps)) throw new Error(`${where}: brak listy „steps”`);
  const steps = x.steps.map((st, i): ScenarioStep => {
    if (!isObject(st) || typeof st.title !== 'string' || !Array.isArray(st.actions))
      throw new Error(`${where}, krok ${i + 1}: brak pola „title” lub „actions”`);
    st.actions.forEach((a, j) => {
      if (!isObject(a) || !ACTION_TYPES.has(a.type as Action['type']))
        throw new Error(`${where}, krok ${i + 1}, akcja ${j + 1}: nieznany typ akcji`);
    });
    const bullets = Array.isArray(st.bullets) ? st.bullets.filter((b): b is string => typeof b === 'string') : [];
    return { title: st.title, bullets, actions: st.actions as Action[] };
  });
  return {
    id: x.id,
    title: x.title,
    initialState: {
      switches: (initial.switches as InitialState['switches']) ?? {},
      placements: initial.placements as InitialState['placements'],
    },
    steps,
  };
}

/** Marker of a file with several scenarios. */
export const BUNDLE_FORMAT = 'manewry-baza/scenariusze';

/** Accepts one scenario, an array of them or an exported bundle; throws with a Polish message. */
export function parseScenarioFile(text: string): Scenario[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Plik nie jest poprawnym JSON-em');
  }
  const list = isObject(data) && Array.isArray(data.scenarios) ? data.scenarios : Array.isArray(data) ? data : [data];
  if (list.length === 0) throw new Error('Plik nie zawiera scenariuszy');
  return list.map((x, i) => toScenario(x, list.length > 1 ? `Scenariusz ${i + 1}` : 'Scenariusz'));
}

export const exportScenario = (scenario: Scenario): string => JSON.stringify(scenario, null, 2);

export const exportBundle = (scenarios: Scenario[]): string => JSON.stringify({ format: BUNDLE_FORMAT, scenarios }, null, 2);
