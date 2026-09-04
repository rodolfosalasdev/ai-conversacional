"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus, Scan } from "lucide-react";

import { GraphCanvas, useGraphSize } from "@/components/chat/graph-canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ConversationState } from "@/lib/types/chat";

const MIN_SCALE = 0.5;
const MAX_SCALE = 1.6;

export function GraphPanel({ state }: { state: ConversationState | null }) {
  const size = useGraphSize();
  const containerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [autoFit, setAutoFit] = useState(true);

  // Enquanto o zoom estiver em automático, o grafo acompanha a largura do painel.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!autoFit) return;
      const available = entry.contentRect.width - 8;
      setScale(clamp(available / size.width, MIN_SCALE, 1));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [autoFit, size.width]);

  const visited = state?.path.length ?? 0;
  const progress = Math.round((visited / size.count) * 100);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">Grafo de decisão</p>
          <Badge variant="secondary" className="text-[10px]">
            {visited}/{size.count} nós
          </Badge>
        </div>

        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-2 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Diminuir zoom"
            onClick={() => {
              setAutoFit(false);
              setScale((value) => clamp(value - 0.15, MIN_SCALE, MAX_SCALE));
            }}
          >
            <Minus className="size-3" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Aumentar zoom"
            onClick={() => {
              setAutoFit(false);
              setScale((value) => clamp(value + 0.15, MIN_SCALE, MAX_SCALE));
            }}
          >
            <Plus className="size-3" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            aria-label="Ajustar à largura"
            onClick={() => setAutoFit(true)}
            className={cn(
              "gap-1 px-1.5 text-[10px]",
              autoFit && "bg-accent text-foreground"
            )}
          >
            <Scan className="size-3" aria-hidden />
            {autoFit ? "auto" : `${Math.round(scale * 100)}%`}
          </Button>

          <span className="flex-1" />

          <Dialog>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Expandir o grafo"
                >
                  <Maximize2 className="size-3" aria-hidden />
                </Button>
              }
            />
            <DialogContent className="max-h-[90svh] max-w-3xl overflow-hidden">
              <DialogHeader>
                <DialogTitle>Grafo de decisão da contratação</DialogTitle>
                <DialogDescription>
                  Caminho percorrido em destaque. Linhas tracejadas são desvios
                  de exceção e retornos.
                </DialogDescription>
              </DialogHeader>
              <div className="thin-scrollbar max-h-[70svh] overflow-auto p-1">
                <GraphCanvas state={state} scale={1} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div
        ref={containerRef}
        className="thin-scrollbar min-h-0 flex-1 overflow-auto p-1.5"
      >
        <GraphCanvas state={state} scale={scale} />
      </div>

      <div className="border-t border-border px-3 py-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <Legend className="bg-foreground" label="Atual" />
          <Legend
            className="bg-card ring-1 ring-foreground/30"
            label="Concluída"
          />
          <Legend
            className="bg-background ring-1 ring-border"
            label="Pendente"
          />
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-sm", className)} />
      {label}
    </span>
  );
}
