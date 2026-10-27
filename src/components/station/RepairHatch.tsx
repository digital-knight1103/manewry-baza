/** Id of the hatch pattern of wagons in repair (defined by Vehicles, also used by the legend). */
export const REPAIR_HATCH_ID = 'repair-hatch';

/**
 * Hatched fill of a wagon in repair in the schematic view: translucent, so that a shunter driving
 * under the lifted wagon stays visible.
 */
export function RepairHatch({ id, color }: { id: string; color: string }) {
  return (
    <pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width={6} height={6} fill={color} fillOpacity={0.45} />
      <line x1={0} y1={0} x2={0} y2={6} stroke={color} strokeWidth={2.4} />
    </pattern>
  );
}
