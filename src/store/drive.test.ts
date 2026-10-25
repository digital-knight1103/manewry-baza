// Integration test of drive mode on the stores: the manoeuvres from docs/img/02–04 done "by hand"
// (clicking vehicles, switches and gaps, holding ◀/▶) instead of running scenario actions.
import { beforeEach, describe, expect, it } from 'vitest';
import type { ScreenSide } from '../engine/control';
import { consistOf } from '../engine/edit';
import { wagonCount } from '../engine/vehicles';
import { useAppStore } from './useAppStore';
import { useDriveStore } from './useDriveStore';
import { useStationStore } from './useStationStore';

const drive = () => useDriveStore.getState();
const st = () => useStationStore.getState();
const pos = (id: string) => st().state.vehicles[id]!.pos;
const consist = (id: string) => consistOf(st().state, id);

/** Holds ◀/▶ with 50 ms animation frames until `done` holds or the engine stops the consist. */
function hold(side: ScreenSide, done: () => boolean = () => false, maxTicks = 2000) {
  drive().setThrottle(side);
  for (let i = 0; i < maxTicks && drive().throttle && !done(); i++) drive().driveTick(0.05);
  const stoppedByEngine = drive().throttle === null;
  drive().setThrottle(null);
  return stoppedByEngine;
}

const switchState = (id: string) => st().state.switches[id];

/** Clicks a switch until it reaches the wanted state. */
function throwSwitch(id: string, index: number) {
  for (let i = 0; i < 3 && switchState(id) !== index; i++) drive().toggleSwitch(id);
  expect(switchState(id), st().message ?? '').toBe(index);
}

describe('tryb Jazda – przebieg z rysunków 02–04', () => {
  beforeEach(() => {
    useAppStore.getState().setMode('edit');
    st().loadExample();
    useAppStore.getState().setMode('drive');
    drive().setSpeed(40);
  });

  it('lokomotywa wstawia 4 wagony REV, shunter wstawia R1 na halę', () => {
    // --- Rysunek 02: lokomotywa z 4 wagonami REV na torze 3 (zachód).
    drive().clickVehicle('R1');
    expect(drive().driverId).toBeNull();
    expect(drive().inspectedId).toBe('R1');
    drive().clickVehicle('LOK1');
    expect(drive().driverId).toBe('LOK1');
    expect(consist('LOK1')).toHaveLength(5);

    // „Ustaw drogę” na tor 63: wymaga wyciągnięcia składu za S2 i zmiany kierunku.
    drive().startRoutePick();
    drive().routeTo('e63');
    expect(st().message).toMatch(/wymaga zmiany kierunku: jedź ▶ na: tor 3 \(wschód\)/);
    expect(st().message).toMatch(/S2 → na łącznik/);
    expect(drive().route).toContain('eD1');

    // Wyciągnięcie za rozjazd S2 – do wyjazdu ze stacji (koniec toru 3).
    expect(hold('right')).toBe(true);
    expect(st().message).toMatch(/Wyjazd ze stacji/);
    expect(consist('LOK1').every((id) => pos(id).edge === 'e3E')).toBe(true);

    // Po zmianie kierunku: ponownie „Ustaw drogę” → S2, X1, S1 ustawione, jedź ◀.
    drive().routeTo('e63');
    expect(st().message).toBe('Droga do: tor 63 ustawiona – jedź ◀');
    expect(st().state.switches).toMatchObject({ S2: 1, X1: 0, S1: 1 });

    // ◀ przez S2, łącznik (◀ = w górę-lewo), X1 i S1 na tor 63.
    hold('left', () => pos('LOK1').edge === 'e63' && pos('LOK1').s <= 113);
    expect(consist('LOK1').every((id) => pos(id).edge === 'e63')).toBe(true);
    expect(pos('LOK1').s).toBeLessThan(115);

    // --- Rysunek 03: S1 na prosto, dopchnięcie wagonów do platformy na torze 65.
    throwSwitch('S1', 0);
    expect(hold('right')).toBe(true);
    expect(st().message).toBe('Sprzęgnięto z pojazdem PL1');
    expect(consist('LOK1')).toEqual(['LOK1', 'R1', 'R2', 'R3', 'R4', 'PL1', 'D3', 'D4']);

    // Rozprzęgnięcie LOK1 | R1 (klik w przerwę) i powrót lokomotywy.
    drive().toggleCoupling('LOK1', 'R1');
    expect(consist('LOK1')).toEqual(['LOK1']);
    hold('left', () => pos('LOK1').edge === 'e63' && pos('LOK1').s <= 200);
    throwSwitch('S1', 1);
    expect(hold('right')).toBe(true); // łącznik, X1 (skrzyżowanie), S2 → wyjazd
    expect(pos('LOK1').edge).toBe('e3E');
    drive().leaveStation();
    expect(st().state.vehicles.LOK1).toBeUndefined();
    expect(drive().driverId).toBeNull();
    expect(wagonCount(st().topo.layout, st().state, ['e65'])).toBe(7);

    // --- Rysunek 04: shunter z toru 69 przez X1 i S1 na tor 63.
    drive().clickVehicle('SH1');
    drive().routeTo('e63');
    expect(st().state.switches).toMatchObject({ X1: 1, S1: 1 });
    expect(st().message).toBe('Droga do: tor 63 ustawiona – jedź ◀');
    hold('left', () => pos('SH1').edge === 'e63' && pos('SH1').s <= 305);
    expect(pos('SH1').edge).toBe('e63');

    // S1 na prosto, dojazd do R1 i sprzęgnięcie, odczepienie R1 od reszty.
    throwSwitch('S1', 0);
    expect(hold('right')).toBe(true);
    expect(st().message).toBe('Sprzęgnięto z pojazdem R1');
    drive().toggleCoupling('R1', 'R2');
    expect(consist('SH1')).toEqual(['SH1', 'R1']);

    // Shunter z jednym wagonem cofa na tor 63, droga do hali i wstawienie R1.
    hold('left', () => pos('SH1').edge === 'e63' && pos('SH1').s <= 250);
    drive().routeTo('e69');
    expect(st().state.switches).toMatchObject({ S1: 1, X1: 1 });
    expect(st().message).toBe('Droga do: tor 69 (hala) ustawiona – jedź ▶');
    hold('right', () => pos('R1').edge === 'e69' && pos('R1').s >= 38);
    expect(pos('R1').edge).toBe('e69');

    drive().toggleCoupling('SH1', 'R1');
    hold('left', () => pos('SH1').edge === 'e67b' && pos('SH1').s <= 320);
    expect(pos('SH1').edge).toBe('e67b');
    expect(consist('R1')).toEqual(['R1']);
    expect(wagonCount(st().topo.layout, st().state, ['e69'])).toBe(1);
  });

  it('komunikaty silnika: rozjazd ustawiony przeciwnie i zajęty rozjazd', () => {
    drive().clickVehicle('SH1');
    throwSwitch('X1', 1); // łącznik → tor 67/69, S1 zostaje na prosto
    expect(hold('left')).toBe(true);
    expect(st().message).toBe('Rozjazd S1 ustawiony przeciwnie');
    expect(pos('SH1').edge).toBe('eD1');
    drive().toggleSwitch('S1');
    expect(st().message).toBe('Rozjazd S1 zajęty – nie można przełożyć');
    expect(switchState('S1')).toBe(0);
  });

  it('komunikaty silnika: limit wagonów shuntera', () => {
    useAppStore.getState().setMode('edit');
    st().fillEdge('e67', 'wagon_rev', 3, 'auto');
    useAppStore.getState().setMode('drive');
    drive().clickVehicle('SH1');
    expect(hold('left')).toBe(true); // X1 „skrzyżowanie”: tor 69 → tor 67 (zachód)
    expect(st().message).toMatch(/^Sprzęgnięto z pojazdem R\d$/);
    expect(consist('SH1')).toHaveLength(6);
    const before = st().state;
    expect(hold('right')).toBe(true);
    expect(st().message).toBe('Shunter może pchać maks. 4 wagony');
    expect(st().state).toBe(before);
  });

  it('cofnij / ponów i reset do stanu początkowego', () => {
    const start = st().state;
    drive().clickVehicle('LOK1');
    hold('right', () => pos('LOK1').edge === 'e3E');
    const afterDrive = st().state;
    drive().toggleSwitch('S1');
    expect(switchState('S1')).toBe(1);

    drive().undo();
    expect(switchState('S1')).toBe(0);
    expect(st().state).toBe(afterDrive);
    drive().undo();
    expect(st().state).toBe(start);
    drive().redo();
    expect(st().state).toBe(afterDrive);

    drive().reset();
    expect(st().state).toBe(start);
    drive().undo();
    expect(st().state).toBe(afterDrive);
  });
});
