// Types describing the station layout file (src/data/station.json).
// Coordinates are in schematic units (see `viewBox`), lengths of vehicles in metres.

export type NodeType = 'bufferStop' | 'switch' | 'boundary' | 'exit';

export interface StationNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
}

export interface Point {
  x: number;
  y: number;
}

export interface StationEdge {
  id: string;
  /** Human-readable name of this piece of track, e.g. "tor 67 (wschód)". */
  name?: string;
  /** Track number shown to the user ("63", "65", "łącznik", …). */
  track: string;
  from: string;
  to: string;
  /** Optional intermediate polyline points between `from` and `to`. */
  points?: Point[];
}

/** Pair of edge ids joined through a node. */
export type EdgeConnection = [string, string];

export interface Boundary {
  node: string;
  connections: EdgeConnection[];
}

export interface SwitchState {
  name: string;
  connections: EdgeConnection[];
}

export interface SwitchDef {
  id: string;
  node: string;
  /** Index into `states` used when no other state is given. */
  default: number;
  states: SwitchState[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hall {
  label: string;
  rect: Rect;
  wallX: number;
  channel: Rect;
  fill: string;
  channelFill: string;
}

export interface TrackLabel {
  text: string;
  x: number;
  y: number;
}

/** Wagon counter label; counts wagons whose centre lies on any of `edges`. */
export interface Counter {
  edges: string[];
  x: number;
  y: number;
}

export interface VehicleType {
  id: string;
  /** Prefix of generated vehicle ids, e.g. "R" → R1, R2, … */
  idPrefix: string;
  name: string;
  color: string;
  lengthM: number;
  /** Locomotive or shunter — only consists containing a powered vehicle can move. */
  powered?: boolean;
  /** Shunter only: maximum number of wagons it may move. */
  maxWagons?: number;
}

export interface StationLayout {
  name: string;
  viewBox: [number, number, number, number];
  scalePxPerMeter: number;
  couplingGapM: number;
  switchFoulingDistance: number;
  nodes: StationNode[];
  edges: StationEdge[];
  boundaries: Boundary[];
  switches: SwitchDef[];
  hall: Hall;
  labels: TrackLabel[];
  counters: Counter[];
  vehicleTypes: VehicleType[];
}

/** Current state index of every switch, keyed by switch id. */
export type SwitchStates = Record<string, number>;
