// Scenario mode on the stores: playback of the built-in scenario and recording manoeuvres done in drive mode.
import { beforeEach, describe, expect, it } from 'vitest';
import { runScenario } from '../engine/scenario';
import { useAppStore } from './useAppStore';
import { useDriveStore } from './useDriveStore';
import { captionStepIndex, scenarioViewState, useScenarioStore } from './useScenarioStore';
import { useStationStore } from './useStationStore';

const scn = () => useScenarioStore.getState();
const st = () => useStationStore.getState();
const drive = () => useDriveStore.getState();
const BUILT_IN_ID = 'wstawienie-na-naprawe';

/** Runs the animation loop with 16 ms frames until playback stops. */
function runFrames(max = 200_000) {
  for (let i = 0; i < max && (scn().playback || scn().gap > 0); i++) scn().tick(16);
}

describe('tryb Scenariusz – odtwarzanie', () => {
  beforeEach(() => {
    useAppStore.getState().setMode('scenario');
    scn().select(BUILT_IN_ID);
    scn().setSpeed(4);
  });

  it('scenariusz wbudowany jest dostępny i tylko do odczytu', () => {
    expect(scn().isReadOnly(BUILT_IN_ID)).toBe(true);
    expect(scn().run.error).toBeUndefined();
    scn().addStep('nie wolno');
    expect(scn().active()!.steps).toHaveLength(5);
    expect(st().message).toMatch(/tylko do odczytu/);
  });

  it('każdy scenariusz wbudowany (src/data/scenarios) odtwarza się bez błędów i ma unikalne id', () => {
    const ids = scn().builtIn.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of scn().builtIn) {
      const run = runScenario(st().topo, s);
      expect(run.error, `${s.id}: ${run.error?.message}`).toBeUndefined();
      expect(run.snapshots).toHaveLength(s.steps.length + 1);
    }
  });

  it('▶ Odtwórz przechodzi płynnie przez wszystkie kroki do stanu końcowego', () => {
    const before = st().state;
    scn().play();
    expect(captionStepIndex(scn())).toBe(0);
    runFrames();
    expect(scn().position).toBe(5);
    expect(scn().playback).toBeNull();
    expect(scenarioViewState(scn())).toEqual(scn().run.state);
    expect(scenarioViewState(scn()).vehicles.R1!.pos.edge).toBe('e69');
    // Playback does not touch the station being edited.
    expect(st().state).toBe(before);
  });

  it('⏭ / ⏮ / skok do kroku / ⟲', () => {
    scn().next(); // starts animating step 1
    expect(scn().playback?.step).toBe(0);
    scn().next(); // skips to its end
    expect(scn().position).toBe(1);
    scn().jumpTo(4);
    expect(scenarioViewState(scn())).toBe(scn().run.snapshots[4]);
    expect(captionStepIndex(scn())).toBe(3);
    scn().prev();
    expect(scn().position).toBe(3);
    scn().restart();
    expect(scn().position).toBe(0);
  });

  it('⏸ Pauza zatrzymuje animację w miejscu', () => {
    scn().playStep(1);
    for (let i = 0; i < 20; i++) scn().tick(16);
    scn().pause();
    const frozen = scenarioViewState(scn());
    for (let i = 0; i < 20; i++) scn().tick(16);
    expect(scenarioViewState(scn())).toBe(frozen);
    scn().play();
    scn().tick(16);
    expect(scenarioViewState(scn())).not.toBe(frozen);
  });
});

describe('tryb Scenariusz – nagrywanie', () => {
  beforeEach(() => {
    useAppStore.getState().setMode('edit');
    st().loadExample();
    useAppStore.getState().setMode('scenario');
    scn().select(BUILT_IN_ID);
    scn().duplicate();
  });

  it('duplikat jest edytowalny; nowy krok i edycja opisu', () => {
    const id = scn().activeId;
    expect(scn().isReadOnly(id)).toBe(false);
    scn().addStep('Etap 2');
    scn().updateStep(5, { bullets: ['punkt A', 'punkt B'] });
    scn().moveStep(5, -1);
    expect(scn().active()!.steps[4]).toMatchObject({ title: 'Etap 2', bullets: ['punkt A', 'punkt B'], actions: [] });
    scn().removeStep(4);
    expect(scn().active()!.steps).toHaveLength(5);
  });

  it('manewry w trybie nagrywania zapisują się jako akcje i odtwarzają się tak samo', () => {
    scn().create('Mój scenariusz');
    const start = st().state;
    scn().startRecording();
    expect(scn().recording).toBe(true);
    expect(scn().active()!.initialState).toEqual(expect.objectContaining({ switches: start.switches }));

    // LOK1 pulls the REV wagons beyond S2, S2 to the connector, then back up the connector.
    drive().clickVehicle('LOK1');
    drive().setThrottle('right');
    for (let i = 0; i < 200; i++) drive().driveTick(0.05);
    drive().setThrottle(null);
    drive().setThrottle('right'); // continuing the same drive merges into one driveTo
    for (let i = 0; i < 150; i++) drive().driveTick(0.05);
    drive().setThrottle(null);
    drive().toggleSwitch('S2');
    scn().addStep('Na łącznik');
    drive().setThrottle('left');
    for (let i = 0; i < 40; i++) drive().driveTick(0.05);
    drive().setThrottle(null);
    drive().toggleCoupling('LOK1', 'R1');

    const steps = scn().active()!.steps;
    expect(steps.map((s) => s.title)).toEqual(['Krok 1', 'Na łącznik']);
    expect(steps[0]!.actions.map((a) => a.type)).toEqual(['driveTo', 'setSwitch']);
    expect(steps[1]!.actions.map((a) => a.type)).toEqual(['driveTo', 'uncouple']);

    const replay = runScenario(st().topo, scn().active()!);
    expect(replay.error).toBeUndefined();
    for (const [id, v] of Object.entries(st().state.vehicles)) {
      expect(replay.state.vehicles[id]!.pos.edge, id).toBe(v.pos.edge);
      expect(replay.state.vehicles[id]!.pos.s, id).toBeCloseTo(v.pos.s, 2);
    }
    expect(replay.state.consists).toEqual(st().state.consists);

    scn().undoRecorded();
    expect(scn().active()!.steps[1]!.actions).toHaveLength(1);
    expect(st().state.consists.some((c) => c.includes('LOK1') && c.includes('R1'))).toBe(true);

    scn().stopRecording();
    expect(scn().recording).toBe(false);
  });

  it('najechanie z auto-sprzęganiem zapisuje się jako driveAndCouple', () => {
    scn().create('Sprzęganie');
    scn().startRecording();
    drive().clickVehicle('SH1');
    drive().setThrottle('left');
    for (let i = 0; i < 2000 && drive().throttle; i++) drive().driveTick(0.05);
    const actions = scn().active()!.steps[0]!.actions;
    expect(actions[actions.length - 1]).toEqual({ type: 'driveAndCouple', vehicle: 'SH1', to: 'D6' });
    scn().stopRecording();
  });

  it('eksport i import scenariusza', () => {
    const { text } = scn().exportActive()!;
    const id = scn().activeId;
    scn().remove();
    expect(
      scn()
        .scenarios()
        .some((s) => s.id === id),
    ).toBe(false);
    scn().importFile(text);
    expect(scn().activeId).toBe(id);
    scn().importFile('nie json');
    expect(st().message).toMatch(/^Import nieudany/);
  });
});
