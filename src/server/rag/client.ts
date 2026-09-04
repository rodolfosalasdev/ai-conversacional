import { searchLocal } from "@/server/rag/local-retriever";
import type { Citation } from "@/lib/types/chat";

export interface RagResult {
  citations: Citation[];
  /** "python" quando o serviço FastAPI respondeu; "local" no fallback BM25 em TS. */
  engine: "python" | "local";
  note?: string;
}

const RAG_URL = process.env.RAG_SERVICE_URL;
const RAG_TIMEOUT_MS = Number(process.env.RAG_TIMEOUT_MS ?? 4000);

/**
 * Tenta o serviço Python (embeddings + BM25 híbrido). Se ele estiver fora do ar
 * ou não configurado, usa o retriever BM25 local para não quebrar a jornada.
 */
export async function searchKnowledge(
  query: string,
  topK = 4
): Promise<RagResult> {
  if (RAG_URL) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

      const response = await fetch(`${RAG_URL.replace(/\/$/, "")}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: topK }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (response.ok) {
        const data = await response.json();
        const citations: Citation[] = (data?.results ?? []).map(
          (item: Record<string, unknown>) => ({
            docId: String(item.doc_id ?? ""),
            title: String(item.title ?? ""),
            snippet: String(item.snippet ?? ""),
            score: Number(item.score ?? 0),
            source: String(item.source ?? ""),
          })
        );
        return { citations, engine: "python" };
      }
    } catch (error) {
      return {
        citations: await searchLocal(query, topK),
        engine: "local",
        note:
          error instanceof Error
            ? `Serviço Python indisponível (${error.message}); usando BM25 local.`
            : "Serviço Python indisponível; usando BM25 local.",
      };
    }
  }

  return {
    citations: await searchLocal(query, topK),
    engine: "local",
    note: RAG_URL
      ? "Serviço Python respondeu com erro; usando BM25 local."
      : undefined,
  };
}

export function formatCitationsForPrompt(citations: Citation[]) {
  if (citations.length === 0) return "Nenhum trecho relevante encontrado.";

  return citations
    .map(
      (citation, index) =>
        `[${index + 1}] ${citation.title} (fonte: ${citation.source})\n${citation.snippet}`
    )
    .join("\n\n");
}
