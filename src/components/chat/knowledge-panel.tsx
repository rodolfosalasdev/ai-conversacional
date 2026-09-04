"use client";

import { useEffect, useState } from "react";
import { Database, FileText, Loader2, Search, Server } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchKnowledge,
  searchKnowledge,
  type KnowledgePayload,
} from "@/lib/api-client";

/** Inspeciona a base de conhecimento e testa o RAG sem sair do chat. */
export function KnowledgePanel({ ragEngine }: { ragEngine?: string }) {
  const [knowledge, setKnowledge] = useState<KnowledgePayload | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<
    { docId: string; title: string; snippet: string; score: number }[] | null
  >(null);

  useEffect(() => {
    fetchKnowledge()
      .then(setKnowledge)
      .catch(() => setKnowledge(null));
  }, []);

  async function runSearch() {
    if (query.trim().length < 2) return;

    setSearching(true);
    try {
      const response = await searchKnowledge(query.trim());
      setResults(response.citations);
      if (response.note) toast.info(response.note);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao consultar o RAG."
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Database className="size-3.5 text-muted-foreground" aria-hidden />
            Base de conhecimento
          </p>
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Server className="size-2.5" aria-hidden />
            {ragEngine === "python" ? "FastAPI" : "BM25 local"}
          </Badge>
        </div>

        <div className="flex gap-1.5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void runSearch();
            }}
            placeholder="Testar o retriever…"
            className="h-8 text-xs"
          />
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Buscar"
            disabled={searching}
            onClick={() => void runSearch()}
          >
            {searching ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Search className="size-3.5" aria-hidden />
            )}
          </Button>
        </div>
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        {results ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {results.length} resultados
              </p>
              <button
                type="button"
                onClick={() => setResults(null)}
                className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                limpar
              </button>
            </div>

            {results.map((result, index) => (
              <div
                key={`${result.docId}-${index}`}
                className="rounded-lg border border-border bg-card p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-medium">{result.title}</p>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {(result.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 line-clamp-5 text-[11px] leading-relaxed text-muted-foreground">
                  {result.snippet}
                </p>
              </div>
            ))}

            {results.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhum trecho relevante para essa consulta.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1.5">
            {knowledge?.documents.map((document) => (
              <div
                key={document.id}
                className="rounded-lg border border-border bg-card p-2.5"
              >
                <p className="flex items-start gap-1.5 text-[11px] font-medium">
                  <FileText
                    className="mt-0.5 size-3 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  {document.title}
                </p>
                <p className="mt-1 pl-4.5 text-[10px] text-muted-foreground">
                  {document.source}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1 pl-4.5">
                  {document.tags.slice(0, 4).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="px-1 py-0 text-[9px]"
                    >
                      {tag}
                    </Badge>
                  ))}
                  <span className="text-[9px] text-muted-foreground">
                    {document.chunkCount} chunks
                  </span>
                </div>
              </div>
            )) ?? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Carregando documentos…
              </p>
            )}
          </div>
        )}
      </div>

      {knowledge ? (
        <div className="border-t border-border px-3 py-2">
          <p className="text-[10px] text-muted-foreground">
            {knowledge.totals.documents} documentos ·{" "}
            {knowledge.totals.chunks} chunks indexados
            {knowledge.ragServiceUrl ? ` · ${knowledge.ragServiceUrl}` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
