// Animated playback of scenario actions. Every action is first executed instantly (applyAction),
// which fixes its end state and any error; the animation only spreads that change over time.
// Pure functions: the UI calls advanceStep every animation frame with the elapsed time.
import { applyAction, highlightEdges, type Action, type ActionResult } from './actions';
import { consistOf } from './edit';
import { buildLines, lineOfEdge } from './lines';
import { drive, type Dir } from './movement';
import { actionError, type Scenario, type ScenarioError } from './scenario';
import type { Topology } from './topology';
import { bodyOnLine, type StationState } from './vehicles';

/** Driving speed at playback speed 1× (units per second), as in drive mode. */
export const DRIVE_SPEED = 40;
/** How long a switch being thrown stays highlighted. */
export const SWITCH_MS = 700;
/** Pause after coupling / uncoupling. */
export const COUPLING_MS = 500;
/** Wagon body rising onto / lowering from the jacks (matches the drawing animation). */
export const LIFT_MS = 500;
/** Pause around a consist entering or leaving the station. */
export const STATION_MS = 600;

export interface ActionHighlight {
  vehicles: string[];
  edges: string[];
}

export interface ActionAnimation {
  action: Action;
  /** State before the action. */
  start: StationState;
  /** Instant result: end state (and error) of the action. */
  result: ActionResult;
  /** Duration at speed 1×. */
  durationMs: number;
  /** Edges the consist travels over (drive actions). */
  route?: string[];
  /** Switch being thrown (setSwitch). */
  switchId?: string;
  /** Vehicles / track to draw attention to. */
  highlight?: ActionHighlight;
}

/** Edges covered by the consist of `vehicleId` while it drives `distance` in `dir`, in line order. */
export function travelledEdges(topo: Topology, state: StationState, vehicleId: string, dir: Dir, distance: number): string[] {
  const v = state.vehicles[vehicleId];
  if (!v || distance <= 0) return [];
  const line = lineOfEdge(buildLines(topo, state.switches), v.pos.edge);
  const onLine = (edge: string) => line.segments.some((s) => s.edge === edge);
  const ld = line.segments.find((s) => s.edge === v.pos.edge)!.reversed ? -dir : dir;
  const bodies = consistOf(state, vehicleId)
    .filter((id) => onLine(state.vehicles[id]!.pos.edge))
    .map((id) => bodyOnLine(topo.layout, line, state.vehicles[id]!));
  const lo = Math.min(...bodies.map((b) => b.a)) + Math.min(0, ld * distance);
  const hi = Math.max(...bodies.map((b) => b.b)) + Math.max(0, ld * distance);
  return line.segments.filter((s) => s.u0 < hi && s.u0 + s.length > lo).map((s) => s.edge);
}

/** Prepares the animated version of an action. */
export function animateAction(topo: Topology, state: StationState, action: Action): ActionAnimation {
  const result = applyAction(topo, state, action);
  const base = { action, start: state, result };
  if (result.motion) {
    const { vehicle, dir, distance } = result.motion;
    return { ...base, durationMs: (distance / DRIVE_SPEED) * 1000, route: travelledEdges(topo, state, vehicle, dir, distance) };
  }
  if (result.error) return { ...base, durationMs: 0 };
  switch (action.type) {
    case 'setSwitch':
      return { ...base, durationMs: SWITCH_MS, switchId: action.switch };
    case 'couple':
    case 'uncouple':
      return { ...base, durationMs: COUPLING_MS, highlight: { vehicles: [...action.between], edges: [] } };
    case 'spawn':
      return { ...base, durationMs: STATION_MS, highlight: { vehicles: action.vehicles.map((v) => v.id), edges: [] } };
    case 'remove':
      return { ...base, durationMs: STATION_MS, highlight: { vehicles: [...action.vehicles], edges: [] } };
    case 'setStatus':
      return { ...base, durationMs: LIFT_MS };
    case 'wait':
      return { ...base, durationMs: Math.max(0, action.ms) };
    case 'highlight':
      return {
        ...base,
        durationMs: Math.max(0, action.ms),
        highlight: {
          vehicles: action.vehicles ?? [],
          edges: action.track !== undefined ? highlightEdges(topo, action.track) : [],
        },
      };
    default:
      return { ...base, durationMs: 0 };
  }
}

/** Station state `elapsedMs` (at speed 1×) into the animation. */
export function frameAt(topo: Topology, anim: ActionAnimation, elapsedMs: number): StationState {
  if (elapsedMs >= anim.durationMs) return anim.result.state;
  const { motion } = anim.result;
  if (motion) {
    const part = motion.distance * (Math.max(0, elapsedMs) / anim.durationMs);
    return drive(topo, anim.start, motion.vehicle, motion.dir, part, { autoCouple: false }).state;
  }
  // Leaving vehicles stay visible (highlighted) until the end of the pause.
  return anim.action.type === 'remove' ? anim.start : anim.result.state;
}

/** Progress of one step being played. */
export interface StepPlayback {
  step: number;
  /** Index of the action being animated; equals the number of actions once finished. */
  action: number;
  anim: ActionAnimation | null;
  /** Time into `anim` (ms at speed 1×). */
  elapsed: number;
  /** State to display. */
  state: StationState;
  finished: boolean;
  error?: ScenarioError;
}

/** Starts playing step `step` from `state` (the snapshot before that step). */
export const startStep = (step: number, state: StationState): StepPlayback => ({
  step,
  action: 0,
  anim: null,
  elapsed: 0,
  state,
  finished: false,
});

/** Advances the step by `dtMs` (already multiplied by the playback speed); Infinity finishes it. */
export function advanceStep(topo: Topology, scenario: Scenario, pb: StepPlayback, dtMs: number): StepPlayback {
  if (pb.finished) return pb;
  const actions = scenario.steps[pb.step]?.actions ?? [];
  let { action, anim, elapsed, state } = pb;
  let budget = Math.max(0, dtMs);
  for (;;) {
    if (!anim) {
      if (action >= actions.length) return { ...pb, action, anim: null, elapsed: 0, state, finished: true };
      anim = animateAction(topo, state, actions[action]!);
      elapsed = 0;
    }
    const left = anim.durationMs - elapsed;
    if (budget < left) {
      elapsed += budget;
      return { ...pb, action, anim, elapsed, state: frameAt(topo, anim, elapsed) };
    }
    budget -= left;
    state = anim.result.state;
    if (anim.result.error)
      return {
        ...pb,
        action,
        anim: null,
        elapsed: 0,
        state,
        finished: true,
        error: actionError(pb.step, action, anim.result.error),
      };
    action++;
    anim = null;
  }
}
