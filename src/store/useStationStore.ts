import { create } from 'zustand';
import { stationLayout, stationTopology } from '../data/station';
import { defaultSwitchStates, type Topology } from '../engine/topology';
import type { SwitchStates } from '../engine/types';

interface StationStore {
  topo: Topology;
  switchStates: SwitchStates;
}

export const useStationStore = create<StationStore>(() => ({
  topo: stationTopology,
  switchStates: defaultSwitchStates(stationLayout),
}));
