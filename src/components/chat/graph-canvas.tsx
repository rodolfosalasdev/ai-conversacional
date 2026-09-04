"use client";

import { useMemo } from "react";
import {
  Ban,
  CheckCircle2,
  CircleDot,
  Cog,
  Flag,
  GitBranch,
  Keyboard,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { GRAPH_NODE_SIZE, layoutGraph } from "@/lib/graph/layout";
import type { GraphNodeKind } from "@/lib/graph/financing-graph";
import { cn } from "@/lib/utils";
import type { ConversationState } from "@/lib/types/chat";

const KIND_ICON: Record<GraphNodeKind, typeof Cog> = {
  start: Flag,
  collect: Keyboard,
  choice: GitBranch,
  compute: Cog,
  authorize: ShieldCheck,
  action: Zap,
  terminal: CheckCircle2,
};

/** Desenho do grafo. Arestas em SVG, nós em DOM posicionados por cima. */
export function GraphCanvas({
  state,
  scale = 1,
}: {
  state: ConversationState | null;
  scale?: number;
}) {
  const layout = useMemo(() => layoutGraph(), []);

  const visited = new Set(state?.path ?? []);
  const current = state?.currentNodeId;

  const traversedEdges = useMemo(() => {
    const path = state?.path ?? [];
    const pairs = new Set<string>();
    for (let index = 0; index < path.length - 1; index += 1) {
      pairs.add(`${path[index]}->${path[index + 1]}`);
    }
    return pairs;
  }, [state?.path]);

  return (
    <div
      style={{
        width: layout.width * scale,
        height: layout.height * scale,
      }}
    >
      <div
        className="relative origin-top-left"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `scale(${scale})`,
        }}
      >
        <svg
          width={layout.width}
          height={layout.height}
          className="absolute inset-0"
          aria-hidden
        >
          <defs>
            <marker
              id="graph-arrow"
              viewBox="0 0 8 8"
              refX="6"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 7 4 L 0 7 z" className="fill-border" />
            </marker>
            <marker
              id="graph-arrow-active"
              viewBox="0 0 8 8"
              refX="6"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 7 4 L 0 7 z" className="fill-foreground" />
            </marker>
          </defs>

          {layout.edges.map((edge) => {
            const isTraversed = traversedEdges.has(edge.id);

            return (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                strokeWidth={isTraversed ? 1.8 : 1}
                strokeDasharray={
                  edge.kind === "default"
                    ? undefined
                    : isTraversed
                      ? "4 3"
                      : "3 4"
                }
                markerEnd={
                  isTraversed ? "url(#graph-arrow-active)" : "url(#graph-arrow)"
                }
                className={cn(
                  "transition-all duration-500",
                  isTraversed ? "stroke-foreground" : "stroke-border opacity-70"
                )}
              />
            );
          })}
        </svg>

        {layout.nodes.map(({ node, x, y }) => {
          const isCurrent = node.id === current;
          const isVisited = visited.has(node.id);
          const Icon = KIND_ICON[node.kind];
          const choiceLabel = state?.nodeStates[node.id]?.choiceLabel;
          const isDeadEnd = node.id === "denied" || node.id === "cancelled";

          return (
            <div
              key={node.id}
              title={node.summary}
              style={{
                left: x,
                top: y,
                width: GRAPH_NODE_SIZE.width,
                minHeight: GRAPH_NODE_SIZE.height,
              }}
              className={cn(
                "absolute flex flex-col justify-center gap-0.5 rounded-lg border px-2 py-1.5 transition-all duration-300",
                isCurrent
                  ? "border-foreground bg-foreground text-background shadow-md"
                  : isVisited
                    ? "border-foreground/30 bg-card"
                    : "border-dashed border-border bg-background/60",
                !isCurrent && !isVisited && "opacity-55",
                isDeadEnd && !isVisited && "border-destructive/25"
              )}
            >
              <div className="flex items-center gap-1.5">
                {isCurrent ? (
                  <CircleDot
                    className="size-3 shrink-0 animate-pulse"
                    aria-hidden
                  />
                ) : isVisited ? (
                  <CheckCircle2 className="size-3 shrink-0" aria-hidden />
                ) : isDeadEnd ? (
                  <Ban
                    className="size-3 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                ) : (
                  <Icon
                    className="size-3 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <span className="truncate text-[11px] font-medium">
                  {node.title}
                </span>
              </div>

              {choiceLabel ? (
                <span
                  className={cn(
                    "truncate pl-4.5 text-[10px]",
                    isCurrent ? "text-background/70" : "text-muted-foreground"
                  )}
                >
                  {choiceLabel}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function useGraphSize() {
  return useMemo(() => {
    const layout = layoutGraph();
    return { width: layout.width, height: layout.height, count: layout.nodes.length };
  }, []);
}
