import type { PointerEvent } from 'react';
import { consistAtExit, sideArrow, type ScreenSide } from '../engine/control';
import { areCoupled, consistOf, touchingNeighbours } from '../engine/edit';
import { formatWagonCount } from '../engine/counters';
import { isWagon, vehicleType } from '../engine/vehicles';
import { SPEED_DEFAULT, SPEED_MAX, SPEED_MIN, useDriveStore } from '../store/useDriveStore';
import { useStationStore } from '../store/useStationStore';
import { useDriveControls } from './keyboard';

/** Side panel of the drive mode: driven vehicle, controls, routes, history, vehicle info. Also used while recording a scenario (without history). */
export function DrivePanel({ history = true }: { history?: boolean }) {
  useDriveControls();
  return (
    <div className="drive-panel">
      <p className="hint">
        Kliknij lokomotywę lub shunter, aby nim jechać. Kliknij kółko rozjazdu, aby go przełożyć. Kliknij przerwę
        między pojazdami, aby je rozprzęgnąć (✂) lub sprzęgnąć.
      </p>
      <Driver />
      <Controls />
      {history && <History />}
      <Inspected />
    </div>
  );
}

function Driver() {
  const topo = useStationStore((s) => s.topo);
  const state = useStationStore((s) => s.state);
  const driverId = useDriveStore((s) => s.driverId);
  const v = driverId ? state.vehicles[driverId] : undefined;
  if (!v) {
    return (
      <section>
        <h2>Pojazd prowadzący</h2>
        <p className="muted">Brak — kliknij lokomotywę lub shunter na schemacie.</p>
      </section>
    );
  }
  const type = vehicleType(topo.layout, v.type);
  const consist = consistOf(state, v.id);
  const wagons = consist.filter((id) => isWagon(topo.layout, state.vehicles[id]!.type)).length;
  return (
    <section>
      <h2>Pojazd prowadzący</h2>
      <div className="vehicle-head">
        <span className="swatch" style={{ background: type.color }} />
        <strong>{v.id}</strong> <span className="muted">{type.name}</span>
      </div>
      <p className="muted">{topo.edges.get(v.pos.edge)?.name ?? v.pos.edge}</p>
      <p>
        {wagons === 0 ? 'Bez wagonów' : `Ciągnie / pcha: ${formatWagonCount(wagons)}`}
        {type.maxWagons !== undefined && <span className="muted"> (maks. {type.maxWagons})</span>}
      </p>
      {consist.length > 1 && <p className="muted">Skład: {consist.join(' – ')}</p>}
    </section>
  );
}

function Controls() {
  const topo = useStationStore((s) => s.topo);
  const state = useStationStore((s) => s.state);
  const autoCouple = useStationStore((s) => s.autoCouple);
  const driverId = useDriveStore((s) => s.driverId);
  const throttle = useDriveStore((s) => s.throttle);
  const speed = useDriveStore((s) => s.speed);
  const pickingRoute = useDriveStore((s) => s.pickingRoute);
  const drive = useDriveStore.getState();
  const hasDriver = driverId !== null && state.vehicles[driverId] !== undefined;
  const atExit = hasDriver && consistAtExit(topo, state, driverId) !== null;

  const holdButton = (side: ScreenSide) => ({
    type: 'button' as const,
    className: `drive-button${throttle === side ? ' active' : ''}`,
    disabled: !hasDriver,
    title: side === 'left' ? 'Jedź w lewo (trzymaj, klawisz ←)' : 'Jedź w prawo (trzymaj, klawisz →)',
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drive.setThrottle(side);
    },
    onPointerUp: () => useDriveStore.getState().throttle === side && drive.setThrottle(null),
    onPointerCancel: () => useDriveStore.getState().throttle === side && drive.setThrottle(null),
  });

  return (
    <section>
      <h2>Jazda</h2>
      <div className="drive-buttons">
        <button {...holdButton('left')}>{sideArrow('left')}</button>
        <button type="button" className="drive-button stop" disabled={!hasDriver} title="Stop (Spacja)" onClick={() => drive.setThrottle(null)}>
          ■
        </button>
        <button {...holdButton('right')}>{sideArrow('right')}</button>
      </div>
      <label className="stacked">
        <span>
          Prędkość: <strong>{(speed / SPEED_DEFAULT).toFixed(1).replace('.', ',')}×</strong>
        </span>
        <input
          type="range"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={5}
          value={speed}
          onChange={(e) => drive.setSpeed(Number(e.target.value))}
          onKeyDown={(e) => (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.preventDefault()}
        />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={autoCouple} onChange={(e) => useStationStore.getState().setAutoCouple(e.target.checked)} />
        Auto-sprzęganie przy najechaniu
      </label>
      <div className="button-column">
        <button
          type="button"
          className={pickingRoute ? 'primary' : ''}
          disabled={!hasDriver}
          title="Wybierz tor docelowy – aplikacja ustawi rozjazdy"
          onClick={pickingRoute ? drive.cancelRoutePick : drive.startRoutePick}
        >
          {pickingRoute ? 'Kliknij tor docelowy… (Esc – anuluj)' : 'Ustaw drogę'}
        </button>
        <button type="button" disabled={!atExit} title="Skład stojący na końcu toru 3 opuszcza stację" onClick={drive.leaveStation}>
          Zjedź ze stacji
        </button>
      </div>
    </section>
  );
}

function History() {
  const canUndo = useStationStore((s) => s.past.length > 0 || (s.pending !== null && s.pending !== s.state));
  const canRedo = useStationStore((s) => s.future.length > 0);
  const hasStart = useDriveStore((s) => s.startState !== null);
  const drive = useDriveStore.getState();
  return (
    <section>
      <h2>Historia</h2>
      <div className="button-row">
        <button type="button" disabled={!canUndo} onClick={drive.undo} title="Ctrl+Z">
          ↶ Cofnij
        </button>
        <button type="button" disabled={!canRedo} onClick={drive.redo} title="Ctrl+Y">
          ↷ Ponów
        </button>
      </div>
      <button type="button" className="danger" disabled={!hasStart} onClick={drive.reset} title="Stan z chwili wejścia w tryb Jazda">
        Reset do stanu początkowego
      </button>
    </section>
  );
}

function Inspected() {
  const topo = useStationStore((s) => s.topo);
  const state = useStationStore((s) => s.state);
  const inspectedId = useDriveStore((s) => s.inspectedId);
  const driverId = useDriveStore((s) => s.driverId);
  const v = inspectedId && inspectedId !== driverId ? state.vehicles[inspectedId] : undefined;
  if (!v) return null;
  const type = vehicleType(topo.layout, v.type);
  const consist = consistOf(state, v.id);
  const neighbours = touchingNeighbours(topo, state, v.id);
  return (
    <section>
      <h2>Informacje o pojeździe</h2>
      <div className="vehicle-head">
        <span className="swatch" style={{ background: type.color }} />
        <strong>{v.id}</strong> <span className="muted">{type.name}</span>
      </div>
      {v.number && <p>Numer: {v.number}</p>}
      <p className="muted">{topo.edges.get(v.pos.edge)?.name ?? v.pos.edge}</p>
      <p>
        {neighbours.length === 0
          ? 'Stoi osobno'
          : neighbours.map((n) => `${areCoupled(state, v.id, n) ? 'sprzęgnięty z' : 'styka się z'} ${n}`).join(', ')}
      </p>
      {consist.length > 1 && <p className="muted">Skład: {consist.join(' – ')}</p>}
    </section>
  );
}
