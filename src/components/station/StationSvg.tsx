import type { Topology } from '../../engine/topology';
import type { SwitchStates } from '../../engine/types';
import { Legend } from '../../ui/Legend';
import { BufferStop } from './BufferStop';
import { Hall } from './Hall';
import { Labels } from './Labels';
import { SwitchMarker, SwitchRoute } from './Switch';
import { Track } from './Track';

interface Props {
  topo: Topology;
  switchStates: SwitchStates;
}

/** Static station schematic drawn entirely from station.json. */
export function StationSvg({ topo, switchStates }: Props) {
  const { layout } = topo;
  const stateOf = (id: string, fallback: number) => switchStates[id] ?? fallback;
  return (
    <svg
      className="station-svg"
      viewBox={layout.viewBox.join(' ')}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={layout.name}
    >
      <rect x={layout.viewBox[0]} y={layout.viewBox[1]} width={layout.viewBox[2]} height={layout.viewBox[3]} fill="#ffffff" />
      <Legend layout={layout} />
      <Hall hall={layout.hall} />
      {layout.switches.map((sw) => (
        <SwitchRoute key={sw.id} topo={topo} sw={sw} stateIndex={stateOf(sw.id, sw.default)} />
      ))}
      {layout.edges.map((e) => (
        <Track key={e.id} topo={topo} edgeId={e.id} />
      ))}
      {layout.nodes
        .filter((n) => n.type === 'bufferStop')
        .map((n) => (
          <BufferStop key={n.id} topo={topo} node={n} />
        ))}
      {layout.switches.map((sw) => (
        <SwitchMarker key={sw.id} topo={topo} sw={sw} stateIndex={stateOf(sw.id, sw.default)} />
      ))}
      <Labels labels={layout.labels} />
    </svg>
  );
}
