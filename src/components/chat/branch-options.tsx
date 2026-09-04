"use client";

import { Check, CornerDownRight, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BranchOption } from "@/lib/types/chat";

/**
 * Ramificação do grafo renderizada como cartões clicáveis. Aparece sempre que
 * o passo atual admite mais de uma resposta válida.
 */
export function BranchOptions({
  options,
  chosenOptionId,
  disabled,
  onChoose,
}: {
  options: BranchOption[];
  chosenOptionId?: string;
  disabled?: boolean;
  onChoose: (option: BranchOption) => void;
}) {
  if (options.length === 0) return null;

  const answered = Boolean(chosenOptionId);

  return (
    <div className="mt-3 space-y-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CornerDownRight className="size-3.5" aria-hidden />
        {answered
          ? "Caminho escolhido"
          : `${options.length} caminhos possíveis — escolha um para continuar`}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isChosen = option.id === chosenOptionId;
          const isDimmed = answered && !isChosen;

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled || answered}
              onClick={() => onChoose(option)}
              className={cn(
                "group/option relative flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left transition-all",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                !answered && "hover:border-foreground/25 hover:bg-accent",
                !answered && "active:translate-y-px",
                isChosen && "border-foreground/40 bg-accent",
                isDimmed && "pointer-events-none opacity-45",
                option.tone === "destructive" &&
                  !answered &&
                  "hover:border-destructive/40"
              )}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    option.tone === "destructive" && "text-destructive"
                  )}
                >
                  {option.label}
                </span>

                <div className="flex shrink-0 items-center gap-1.5">
                  {option.badge ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {option.badge}
                    </span>
                  ) : null}
                  {isChosen ? (
                    <Check className="size-3.5 text-foreground" aria-hidden />
                  ) : null}
                </div>
              </div>

              {option.description ? (
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {option.description}
                </span>
              ) : null}

              {option.recommended && !answered ? (
                <Badge
                  variant="secondary"
                  className="mt-1 gap-1 px-1.5 py-0 text-[10px] font-medium"
                >
                  <Sparkles className="size-2.5" aria-hidden />
                  Recomendado
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
