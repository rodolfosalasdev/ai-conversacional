"use client";

import { useState } from "react";
import { Search, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MODE_CONFIG } from "@/lib/prompts/system";
import { PROMPT_CATEGORIES, PROMPT_LIBRARY } from "@/lib/prompts/library";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/lib/types/chat";

/** Biblioteca de prompts: clicar aplica o texto e o modo sugerido no composer. */
export function PromptLibraryPanel({
  onApply,
}: {
  onApply: (prompt: string, mode: ChatMode) => void;
}) {
  const [query, setQuery] = useState("");

  const normalized = query.trim().toLowerCase();
  const filtered = PROMPT_LIBRARY.filter((template) =>
    normalized
      ? `${template.title} ${template.description} ${template.prompt}`
          .toLowerCase()
          .includes(normalized)
      : true
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar prompt…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {PROMPT_CATEGORIES.map((category) => {
          const items = filtered.filter(
            (template) => template.category === category
          );
          if (items.length === 0) return null;

          return (
            <section key={category}>
              <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {category}
              </p>
              <div className="space-y-1.5">
                {items.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onApply(template.prompt, template.mode)}
                    className={cn(
                      "group/prompt w-full rounded-lg border border-border bg-card p-2.5 text-left transition-all",
                      "hover:border-foreground/25 hover:bg-accent active:translate-y-px",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <Wand2
                          className="size-3 text-muted-foreground"
                          aria-hidden
                        />
                        {template.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[9px] uppercase"
                      >
                        {MODE_CONFIG[template.mode].label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Nenhum prompt encontrado para “{query}”.
          </p>
        ) : null}
      </div>
    </div>
  );
}
