import type { PointerEvent } from 'react';
import type { StationLayout, VehicleType } from '../engine/types';
import { LABEL_FONT, LABEL_SIZE, NAVY, OUTLINE_COLOR, RAIL_COLOR } from '../components/station/style';
import { artKind } from '../components/station/artKind';
import { VehicleArt } from '../components/station/VehicleArt';

// Legend placement in schematic units, matching docs/img/01-uklad.png.
const LEFT_X = 47;
const RIGHT_X = 531;
const TOP_Y = 35;
const ROW_STEP = 33;
const SWATCH_H = 20;
const TEXT_GAP = 12;
const HALL_ICON = { w: 106, h: 55, wallFromLeft: 85 };

interface Props {
  layout: StationLayout;
  /** When set, the legend doubles as the vehicle palette: entries can be dragged onto tracks. */
  onTypePointerDown?: (typeId: string, e: PointerEvent<SVGGElement>) => void;
  /** Only the wagon column: the right part of the header holds the step caption (scenario mode). */
  wagonsOnly?: boolean;
  /** Detailed vehicle drawings instead of plain swatches (view „szczegółowy”). */
  detailed?: boolean;
}

/** Legend drawn inside the station SVG: non-powered stock on the left, powered stock + hall on the right. */
export function Legend({ layout, onTypePointerDown, wagonsOnly = false, detailed = false }: Props) {
  const scale = layout.scalePxPerMeter;
  const wagons = layout.vehicleTypes.filter((t) => !t.powered);
  const powered = layout.vehicleTypes.filter((t) => t.powered);

  const swatch = (x: number, y: number, w: number, t: VehicleType) =>
    detailed ? (
      <g transform={`translate(${x + w / 2} ${y + SWATCH_H / 2})`}>
        <rect x={-w / 2 - 4} y={-SWATCH_H / 2 - 1} width={w + 8} height={SWATCH_H + 2} fill="transparent" />
        <VehicleArt kind={artKind(t)} length={w} color={t.color} />
      </g>
    ) : (
      <rect x={x} y={y} width={w} height={SWATCH_H} fill={t.color} stroke={OUTLINE_COLOR} strokeWidth={1} />
    );

  const entryProps = (t: VehicleType) =>
    onTypePointerDown
      ? { className: 'palette-entry', onPointerDown: (e: PointerEvent<SVGGElement>) => onTypePointerDown(t.id, e) }
      : {};
  const paletteTitle = onTypePointerDown && <title>Przeciągnij na tor, aby dodać</title>;

  const hallY = TOP_Y + powered.length * ROW_STEP + 8;
  const hall = layout.hall;

  return (
    <g className="legend" fontFamily={LABEL_FONT} fontSize={LABEL_SIZE} fill="#111">
      {wagons.map((t, i) => {
        const w = t.lengthM * scale;
        const y = TOP_Y + i * ROW_STEP;
        return (
          <g key={t.id} {...entryProps(t)}>
            {paletteTitle}
            {swatch(LEFT_X, y, w, t)}
            <text x={LEFT_X + w + TEXT_GAP} y={y + 15}>
              {t.name}
            </text>
          </g>
        );
      })}
      {!wagonsOnly &&
        powered.map((t, i) => {
          const y = TOP_Y + i * ROW_STEP;
          return (
            <g key={t.id} {...entryProps(t)}>
              {paletteTitle}
              {swatch(RIGHT_X + (t.lengthM * scale < 20 ? 4 : 0), y, t.lengthM * scale, t)}
              <text x={RIGHT_X + 79} y={y + 15}>
                {t.name}
              </text>
            </g>
          );
        })}
      {!wagonsOnly && (
        <g className="legend-hall">
          <rect x={RIGHT_X} y={hallY} width={HALL_ICON.w} height={HALL_ICON.h} rx={3} fill={hall.fill} stroke={NAVY} strokeWidth={1.6} />
          <line
            x1={RIGHT_X + HALL_ICON.wallFromLeft}
            y1={hallY}
            x2={RIGHT_X + HALL_ICON.wallFromLeft}
            y2={hallY + HALL_ICON.h}
            stroke={NAVY}
            strokeWidth={4}
            strokeOpacity={0.85}
          />
          <rect x={RIGHT_X + 11} y={hallY + 18} width={57} height={32} rx={1.5} fill="url(#pit-hatch)" stroke={OUTLINE_COLOR} />
          <path
            d={`M${RIGHT_X - 5} ${hallY + 30}H${RIGHT_X + 80}M${RIGHT_X - 5} ${hallY + 38}H${RIGHT_X + 80}`}
            stroke={RAIL_COLOR}
            strokeWidth={1.5}
          />
          <text x={RIGHT_X + HALL_ICON.w + 12} y={hallY + 27}>
            {hall.label}
          </text>
        </g>
      )}
    </g>
  );
}
