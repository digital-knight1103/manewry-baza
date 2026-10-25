import type { Action } from '../engine/actions';
import type { Topology } from '../engine/topology';

/** One-line Polish description of a scenario action for the step list. */
export function describeAction(topo: Topology, action: Action): string {
  const edge = (id: string) => topo.edges.get(id)?.name ?? id;
  switch (action.type) {
    case 'setSwitch': {
      const sw = topo.layout.switches.find((s) => s.id === action.switch);
      return `Rozjazd ${action.switch} → ${sw?.states[action.state]?.name ?? `stan ${action.state}`}`;
    }
    case 'driveTo':
      return `${action.vehicle} jedzie na: ${edge(action.edge)} (${Math.round(action.offset)})`;
    case 'driveAndCouple':
      return `${action.vehicle} dojeżdża i sprzęga się z ${action.to}`;
    case 'couple':
      return `Sprzęgnięcie ${action.between.join(' – ')}`;
    case 'uncouple':
      return `Rozprzęgnięcie ${action.between.join(' | ')}`;
    case 'spawn':
      return `Wjazd na stację (${action.exit}): ${action.vehicles.map((v) => v.id).join(', ')}`;
    case 'remove':
      return `Zjazd ze stacji: ${action.vehicles.join(', ')}`;
    case 'wait':
      return `Pauza ${(action.ms / 1000).toLocaleString('pl-PL')} s`;
    case 'highlight': {
      const what = [...(action.vehicles ?? []), ...(action.track !== undefined ? [`tor ${action.track}`] : [])];
      return `Wyróżnienie: ${what.join(', ')}`;
    }
  }
}
