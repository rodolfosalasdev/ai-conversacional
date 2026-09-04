import {
  FINANCING_NODES,
  type GraphNodeDef,
  getNode,
} from "@/lib/graph/financing-graph";

export interface LaidOutNode {
  node: GraphNodeDef;
  rank: number;
  lane: number;
  x: number;
  y: number;
}

export interface LaidOutEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: "default" | "loop" | "exception";
  path: string;
}

export interface GraphLayout {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
}

const NODE_WIDTH = 150;
const NODE_HEIGHT = 44;
const ROW_GAP = 30;
const LANE_GAP = 14;
const PADDING = 10;
/** Faixa à direita reservada para as arestas de retorno contornarem os nós. */
const LOOP_MARGIN = 22;

/**
 * Layout em camadas de cima para baixo. O rank vem do caminho mais longo
 * ignorando arestas de retorno; ramos de exceção ganham uma pista lateral.
 */
export function layoutGraph(): GraphLayout {
  const ranks = computeRanks();
  const lanes = computeLanes();

  const maxLane = Math.max(...Object.values(lanes));
  const minLane = Math.min(...Object.values(lanes));
  const laneSpan = maxLane - minLane;

  const width =
    PADDING * 2 +
    NODE_WIDTH +
    laneSpan * (NODE_WIDTH + LANE_GAP) +
    LOOP_MARGIN;
  const maxRank = Math.max(...Object.values(ranks));
  const height = PADDING * 2 + (maxRank + 1) * NODE_HEIGHT + maxRank * ROW_GAP;

  const nodes: LaidOutNode[] = FINANCING_NODES.map((node) => {
    const rank = ranks[node.id] ?? 0;
    const lane = lanes[node.id] ?? 0;
    return {
      node,
      rank,
      lane,
      x: PADDING + (lane - minLane) * (NODE_WIDTH + LANE_GAP),
      y: PADDING + rank * (NODE_HEIGHT + ROW_GAP),
    };
  });

  const positions = new Map(nodes.map((item) => [item.node.id, item]));

  const edges: LaidOutEdge[] = [];
  for (const node of FINANCING_NODES) {
    for (const edge of node.next) {
      const from = positions.get(node.id);
      const to = positions.get(edge.to);
      if (!from || !to) continue;

      edges.push({
        id: `${node.id}->${edge.to}`,
        from: node.id,
        to: edge.to,
        label: edge.label,
        kind: edge.kind ?? "default",
        path: buildEdgePath(from, to, edge.kind ?? "default"),
      });
    }
  }

  return { nodes, edges, width, height };
}

export const GRAPH_NODE_SIZE = {
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
} as const;

function buildEdgePath(
  from: LaidOutNode,
  to: LaidOutNode,
  kind: "default" | "loop" | "exception"
) {
  const startX = from.x + NODE_WIDTH / 2;
  const startY = from.y + NODE_HEIGHT;
  const endX = to.x + NODE_WIDTH / 2;
  const endY = to.y;

  // Retorno para um nó acima: contorna pela lateral direita.
  if (kind === "loop" || to.rank <= from.rank) {
    const sideX = Math.max(from.x + NODE_WIDTH, to.x + NODE_WIDTH) + LANE_GAP / 2;
    const exitY = from.y + NODE_HEIGHT / 2;
    const enterY = to.y + NODE_HEIGHT / 2;
    return [
      `M ${from.x + NODE_WIDTH} ${exitY}`,
      `L ${sideX} ${exitY}`,
      `L ${sideX} ${enterY}`,
      `L ${to.x + NODE_WIDTH} ${enterY}`,
    ].join(" ");
  }

  if (Math.abs(startX - endX) < 1) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  const midY = (startY + endY) / 2;
  return [
    `M ${startX} ${startY}`,
    `C ${startX} ${midY} ${endX} ${midY} ${endX} ${endY}`,
  ].join(" ");
}

function computeRanks(): Record<string, number> {
  const ranks: Record<string, number> = { start: 0 };
  // Relaxa as arestas repetidamente; o grafo é pequeno, então converge rápido.
  for (let pass = 0; pass < FINANCING_NODES.length; pass += 1) {
    let changed = false;
    for (const node of FINANCING_NODES) {
      const rank = ranks[node.id];
      if (rank == null) continue;

      for (const edge of node.next) {
        if (edge.kind === "loop") continue;

        // Terminais de exceção descem uma linha extra para não dividir a
        // camada com o nó seguinte do caminho principal.
        const step =
          edge.kind === "exception" && getNode(edge.to).kind === "terminal"
            ? 2
            : 1;

        const candidate = rank + step;
        if ((ranks[edge.to] ?? -1) < candidate) {
          ranks[edge.to] = candidate;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  for (const node of FINANCING_NODES) {
    if (ranks[node.id] == null) ranks[node.id] = 0;
  }

  return ranks;
}

/**
 * Caminho principal na pista 0 e todo desvio de exceção na pista 1. Como os
 * terminais de exceção ganham uma linha extra no rank, duas pistas bastam —
 * o grafo cabe na largura de um painel lateral.
 */
function computeLanes(): Record<string, number> {
  const lanes: Record<string, number> = {};

  for (const node of FINANCING_NODES) {
    for (const edge of node.next) {
      if (edge.kind === "exception") lanes[edge.to] = 1;
    }
  }

  for (const node of FINANCING_NODES) {
    if (lanes[node.id] == null) lanes[node.id] = 0;
  }

  return lanes;
}
