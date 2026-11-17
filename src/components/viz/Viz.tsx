'use client';
import type { VizSpec } from '@lotwise/engine';
import { XYChart } from './XYChart';
import { Meters, Matrix, Timeline, GridViz, StackBars, ContainerViz, KpiTree, FlowViz } from './Simple';
import { QueueSim } from './QueueSim';
import { NetworkDiagram } from './Network';
import { MapPlot } from './MapPlot';
import { TreeDiagram } from './TreeDiagram';

/** Renders whatever live visual the engine describes for a result. */
export function Viz({ spec, onMapMove, height }: { spec: VizSpec; onMapMove?: (tableId: string, index: number, x: number, y: number) => void; height?: number }) {
  switch (spec.kind) {
    case 'xy': return <XYChart spec={spec} height={height} />;
    case 'queue': return <QueueSim spec={spec} />;
    case 'network': return <NetworkDiagram spec={spec} />;
    case 'map': return <MapPlot spec={spec} onMove={onMapMove ? (i, x, y) => onMapMove(spec.tableId, i, x, y) : undefined} />;
    case 'tree': return <TreeDiagram spec={spec} />;
    case 'flow': return <FlowViz spec={spec} />;
    case 'meters': return <Meters spec={spec} />;
    case 'matrix': return <Matrix spec={spec} />;
    case 'timeline': return <Timeline spec={spec} />;
    case 'grid': return <GridViz spec={spec} />;
    case 'stack': return <StackBars spec={spec} />;
    case 'container': return <ContainerViz spec={spec} />;
    case 'kpitree': return <KpiTree spec={spec} />;
  }
}
