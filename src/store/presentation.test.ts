// Presentation mode: keyboard navigation title → steps → end over the built-in scenario.
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';
import { parsePresentationHash, presentationHash, usePresentationStore } from './usePresentationStore';
import { scenarioViewState, useScenarioStore } from './useScenarioStore';

const pres = () => usePresentationStore.getState();
const scn = () => useScenarioStore.getState();
const BUILT_IN_ID = 'wstawienie-na-naprawe';
const animating = () => scn().playback !== null && !scn().playback!.finished;

describe('tryb Prezentacja', () => {
  beforeEach(() => {
    pres().exit();
    useAppStore.getState().setMode('edit');
    expect(pres().start(BUILT_IN_ID)).toBe(true);
  });

  it('start otwiera ekran tytułowy w trybie Scenariusz', () => {
    expect(pres().presenting).toBe(true);
    expect(pres().screen).toBe('title');
    expect(useAppStore.getState().mode).toBe('scenario');
    expect(scn().activeId).toBe(BUILT_IN_ID);
    expect(scn().position).toBe(0);
  });

  it('nieznany scenariusz nie otwiera prezentacji', () => {
    pres().exit();
    expect(pres().start('nie-ma-takiego')).toBe(false);
    expect(pres().presenting).toBe(false);
  });

  it('→ animuje krok, drugie → kończy go natychmiast, kolejne zaczyna następny', () => {
    pres().next();
    expect(pres().screen).toBe('steps');
    expect(scn().playback?.step).toBe(0);
    expect(animating()).toBe(true);
    pres().next();
    expect(scn().playback).toBeNull();
    expect(scn().position).toBe(1);
    expect(scenarioViewState(scn())).toBe(scn().run.snapshots[1]);
    pres().next();
    expect(scn().playback?.step).toBe(1);
    expect(animating()).toBe(true);
  });

  it('po ostatnim kroku ekran „Koniec”; ← wraca do kroków, dalsze → nic nie robi', () => {
    const steps = scn().active()!.steps.length;
    // Title → step 1 starts; then every step takes two presses (start, finish).
    for (let i = 0; i < 2 * steps; i++) pres().next();
    expect(scn().position).toBe(steps);
    expect(pres().screen).toBe('steps');
    pres().next();
    expect(pres().screen).toBe('end');
    pres().next();
    expect(pres().screen).toBe('end');
    pres().prev();
    expect(pres().screen).toBe('steps');
    expect(scn().position).toBe(steps);
  });

  it('← pokazuje natychmiast stan po poprzednim kroku; z kroku 1 wraca do tytułu', () => {
    for (let i = 0; i < 5; i++) pres().next(); // step 3 animating
    expect(scn().playback?.step).toBe(2);
    pres().prev();
    expect(scn().playback).toBeNull();
    expect(scn().position).toBe(2);
    pres().prev();
    expect(scn().position).toBe(1);
    pres().prev();
    expect(pres().screen).toBe('title');
    expect(scn().position).toBe(0);
  });

  it('Home wraca do ekranu tytułowego, wyjście zatrzymuje animację', () => {
    pres().next();
    pres().next();
    pres().next();
    pres().home();
    expect(pres().screen).toBe('title');
    expect(scn().position).toBe(0);
    expect(scn().playback).toBeNull();
    pres().next();
    pres().exit();
    expect(pres().presenting).toBe(false);
    expect(scn().playback).toBeNull();
  });
});

describe('link bezpośredni do prezentacji', () => {
  it('#/prezentacja/<id>', () => {
    expect(parsePresentationHash('#/prezentacja/wstawienie-na-naprawe')).toBe('wstawienie-na-naprawe');
    expect(parsePresentationHash('#/prezentacja/abc/')).toBe('abc');
    expect(parsePresentationHash(presentationHash('mój scenariusz'))).toBe('mój scenariusz');
    expect(parsePresentationHash('#/prezentacja/')).toBeNull();
    expect(parsePresentationHash('')).toBeNull();
    expect(parsePresentationHash('#/inne/x')).toBeNull();
  });
});
