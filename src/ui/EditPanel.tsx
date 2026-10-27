import { useState } from 'react';
import { areCoupled, consistOf, touchingNeighbours, type FillDirection } from '../engine/edit';
import { vehicleType } from '../engine/vehicles';
import { useScenarioStore } from '../store/useScenarioStore';
import { useStationStore } from '../store/useStationStore';
import { Icon } from './icons';
import { RepairControls } from './RepairControls';

const DIRECTIONS: { id: FillDirection; label: string }[] = [
  { id: 'auto', label: 'do najbliższego końca toru' },
  { id: 'left', label: 'w lewo' },
  { id: 'right', label: 'w prawo' },
];

/** Side panel of the edit mode: quick fill, selected vehicle details, station-wide actions. */
export function EditPanel() {
  return (
    <div className="edit-panel">
      <p className="hint">
        Przeciągnij pojazd z legendy na tor. Kliknij pojazd, aby go zaznaczyć; przeciągnij go, aby przesunąć skład wzdłuż toru.
      </p>
      <SelectedVehicle />
      <QuickFill />
      <StationActions />
    </div>
  );
}

function QuickFill() {
  const layout = useStationStore((s) => s.topo.layout);
  const fillEdge = useStationStore((s) => s.fillEdge);
  const [edgeId, setEdgeId] = useState(layout.edges[0]?.id ?? '');
  const [typeId, setTypeId] = useState(layout.vehicleTypes.find((t) => !t.powered)?.id ?? '');
  const [count, setCount] = useState(8);
  const [direction, setDirection] = useState<FillDirection>('auto');

  return (
    <section>
      <h2>Szybkie wypełnienie</h2>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          if (count > 0) fillEdge(edgeId, typeId, count, direction);
        }}
      >
        <label>
          Tor
          <select value={edgeId} onChange={(e) => setEdgeId(e.target.value)}>
            {layout.edges.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name ?? e.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Typ
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {layout.vehicleTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Liczba
          <input type="number" min={1} max={40} value={count} onChange={(e) => setCount(Math.max(0, Math.floor(Number(e.target.value))))} />
        </label>
        <label>
          Dosuń
          <select value={direction} onChange={(e) => setDirection(e.target.value as FillDirection)}>
            {DIRECTIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary">
          Dodaj
        </button>
      </form>
    </section>
  );
}

function SelectedVehicle() {
  const topo = useStationStore((s) => s.topo);
  const state = useStationStore((s) => s.state);
  const selectedId = useStationStore((s) => s.selectedId);
  const { removeVehicle, setNumber, couple, uncouple, setStatus } = useStationStore.getState();
  const v = selectedId ? state.vehicles[selectedId] : undefined;

  if (!v) {
    return (
      <section>
        <h2>Zaznaczony pojazd</h2>
        <p className="muted">Brak — kliknij pojazd na schemacie.</p>
      </section>
    );
  }

  const type = vehicleType(topo.layout, v.type);
  const consist = consistOf(state, v.id);
  const neighbours = touchingNeighbours(topo, state, v.id);
  const edge = topo.edges.get(v.pos.edge);

  return (
    <section>
      <h2>Zaznaczony pojazd</h2>
      <div className="vehicle-head">
        <span className="swatch" style={{ background: type.color }} />
        <strong>{v.id}</strong> <span className="muted">{type.name}</span>
      </div>
      <p className="muted">{edge?.name ?? v.pos.edge}</p>
      <label className="stacked">
        Numer wagonu
        <input
          type="text"
          key={v.id}
          defaultValue={v.number ?? ''}
          placeholder="np. 31 51 4630 123-4"
          onBlur={(e) => setNumber(v.id, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </label>
      <div className="couplings">
        <span>Sprzęgnięty z:</span>
        {neighbours.length === 0 && <span className="muted"> brak sąsiadów</span>}
        <ul>
          {neighbours.map((n) =>
            areCoupled(state, v.id, n) ? (
              <li key={n}>
                {n} <button type="button" onClick={() => uncouple(v.id, n)}>Rozprzęgnij</button>
              </li>
            ) : (
              <li key={n}>
                {n} <span className="muted">(niesprzęgnięty)</span>{' '}
                <button type="button" onClick={() => couple(v.id, n)}>Sprzęgnij</button>
              </li>
            ),
          )}
        </ul>
        {consist.length > 1 && <p className="muted">Skład: {consist.join(' – ')}</p>}
      </div>
      <RepairControls vehicleId={v.id} onSetStatus={setStatus} />
      <button type="button" className="danger" onClick={() => removeVehicle(v.id)}>
        <Icon name="trash" /> Usuń (Del)
      </button>
    </section>
  );
}

function StationActions() {
  const autoCouple = useStationStore((s) => s.autoCouple);
  const { setAutoCouple, clear, loadExample } = useStationStore.getState();
  const target = useScenarioStore((s) => s.active());
  const readOnly = useScenarioStore((s) => s.isReadOnly(s.activeId));
  return (
    <section>
      <h2>Stacja</h2>
      <label className="checkbox">
        <input type="checkbox" checked={autoCouple} onChange={(e) => setAutoCouple(e.target.checked)} />
        Sprzęgaj stykające się pojazdy
      </label>
      <div className="button-column">
        <button type="button" onClick={loadExample}>
          Wczytaj stan początkowy scenariusza
        </button>
        <button
          type="button"
          disabled={!target || readOnly}
          title={
            !target || readOnly
              ? 'Wybierz edytowalny scenariusz w trybie Scenariusz (wbudowany: „Duplikuj”)'
              : `Stan stacji stanie się stanem początkowym scenariusza „${target.title}”`
          }
          onClick={() => useScenarioStore.getState().saveInitialFromStation()}
        >
          Zapisz jako stan początkowy scenariusza
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (window.confirm('Usunąć wszystkie pojazdy ze stacji?')) clear();
          }}
        >
          Wyczyść stację
        </button>
      </div>
    </section>
  );
}
