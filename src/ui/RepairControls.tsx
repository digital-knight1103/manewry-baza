import { useState } from 'react';
import { endRepairProblem, startRepairProblem, typeAfterRepair } from '../engine/repair';
import { inRepair, isWagon, REPAIR_STATUS, statusDef, vehicleType, type VehicleStatus } from '../engine/vehicles';
import { useStationStore } from '../store/useStationStore';

interface Props {
  vehicleId: string;
  /** Applies the change (edit mode: station store; drive mode / recording: drive store, which records it). */
  onSetStatus: (id: string, status: VehicleStatus | null, newType?: string) => void;
}

/** „Rozpocznij naprawę” / „Zakończ naprawę” in the panel of a wagon; nothing for powered vehicles. */
export function RepairControls({ vehicleId, onSetStatus }: Props) {
  const topo = useStationStore((s) => s.topo);
  const state = useStationStore((s) => s.state);
  const [choosing, setChoosing] = useState<string | null>(null);
  const v = state.vehicles[vehicleId];
  if (!v || !isWagon(topo.layout, v.type)) return null;

  const status = statusDef(topo.layout, REPAIR_STATUS);
  const say = (message: string) => useStationStore.getState().setMessage(message);

  if (!inRepair(v)) {
    const problem = startRepairProblem(topo, state, v.id);
    return (
      <div className="repair">
        <button
          type="button"
          title={problem ?? 'Podnieś wagon na podnośnikach nad kanałem rewizyjnym'}
          onClick={() => (problem ? say(problem) : onSetStatus(v.id, REPAIR_STATUS))}
        >
          Rozpocznij naprawę
        </button>
      </div>
    );
  }

  const current = vehicleType(topo.layout, v.type);
  const after = typeAfterRepair(topo);
  const afterType = after && after !== v.type ? vehicleType(topo.layout, after) : undefined;
  const finish = (newType?: string) => {
    setChoosing(null);
    onSetStatus(v.id, null, newType);
  };

  return (
    <div className="repair">
      <p className="repair-badge">
        <span className="swatch hatched" style={{ background: status.color }} />
        {status.name}
      </p>
      {choosing === v.id ? (
        <div className="repair-choice">
          <span>Typ wagonu po naprawie:</span>
          <div className="button-column">
            <button type="button" onClick={() => finish()}>
              Bez zmian ({current.name})
            </button>
            {afterType && (
              <button type="button" className="primary" onClick={() => finish(afterType.id)}>
                {afterType.name}
              </button>
            )}
            <button type="button" onClick={() => setChoosing(null)}>
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            const problem = endRepairProblem(topo, state, v.id);
            if (problem) say(problem);
            else setChoosing(v.id);
          }}
        >
          Zakończ naprawę
        </button>
      )}
    </div>
  );
}
