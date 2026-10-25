import stationJson from './station.json';
import { buildTopology } from '../engine/topology';
import type { StationLayout } from '../engine/types';

// JSON imports widen tuples and string unions; buildTopology validates the actual shape.
export const stationLayout = stationJson as unknown as StationLayout;
export const stationTopology = buildTopology(stationLayout);
