"use client";

import { useEffect, useState } from "react";
import { Database, Globe, MessagesSquare, Sparkles, Zap } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchHealth, type HealthPayload } from "@/lib/api-client";
import { APP_NAME } from "@/lib/site-config";

export function SiteHeader() {
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
          <MessagesSquare className="size-3.5" aria-hidden />
        </div>
        <span className="font-heading truncate text-sm font-semibold">
          {APP_NAME}
        </span>
        <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
          contratação de financiamento
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <StatusBadge
          icon={<Sparkles className="size-2.5" aria-hidden />}
          label={health?.llm.active?.label ?? "Determinístico"}
          tooltip={
            health?.llm.simulated
              ? "Nenhuma chave de LLM configurada. O grafo continua funcionando com o motor determinístico; adicione GROQ_API_KEY (grátis) no .env.local para respostas geradas."
              : `Provedor de LLM ativo: ${health?.llm.active?.label}.`
          }
        />

        <StatusBadge
          icon={<Database className="size-2.5" aria-hidden />}
          label={health?.rag.engine === "python" ? "RAG FastAPI" : "RAG local"}
          tooltip={
            health
              ? `${health.rag.documents} documentos e ${health.rag.chunks} chunks indexados. ${
                  health.rag.engine === "python"
                    ? "Servidor Python respondendo."
                    : "Usando o retriever BM25 em TypeScript."
                }`
              : "Carregando status do RAG…"
          }
        />

        <StatusBadge
          icon={<Globe className="size-2.5" aria-hidden />}
          label={health?.web.configured ? health.web.provider ?? "Web" : "Web off"}
          tooltip={
            health?.web.configured
              ? `Busca na web ativa via ${health.web.provider}. Usada no modo Web do chat.`
              : "Modo Web desativado. Adicione TAVILY_API_KEY ou SERPER_API_KEY no .env.local."
          }
        />

        <StatusBadge
          icon={<Zap className="size-2.5" aria-hidden />}
          label={health?.email.transport ?? "preview"}
          tooltip={
            health?.email.transport === "preview"
              ? "Sem provedor de e-mail configurado: a cópia do contrato fica disponível como pré-visualização no app."
              : `Transporte de e-mail: ${health?.email.transport}.`
          }
        />

        <ThemeToggle />
      </div>
    </header>
  );
}

function StatusBadge({
  icon,
  label,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="secondary"
            className="hidden cursor-default gap-1 text-[10px] font-normal md:inline-flex"
          >
            {icon}
            {label}
          </Badge>
        }
      />
      <TooltipContent className="max-w-64 text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
