import type { Citation } from "@/lib/types/chat";

export interface WebSearchResult {
  citations: Citation[];
  /** Provedor que respondeu: tavily, serper ou none. */
  engine: "tavily" | "serper" | "none";
  note?: string;
}

const TIMEOUT_MS = Number(process.env.WEB_SEARCH_TIMEOUT_MS ?? 8000);

/**
 * Busca na web para o modo Web. Tavily é preferido (feito para LLM); Serper entra
 * como fallback. Sem chave configurada, devolve engine "none" com nota explicativa.
 */
export async function searchWeb(
  query: string,
  topK = 5
): Promise<WebSearchResult> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const serperKey = process.env.SERPER_API_KEY;

  if (tavilyKey) {
    try {
      const citations = await searchTavily(query, topK, tavilyKey);
      if (citations.length > 0) {
        return { citations, engine: "tavily" };
      }
    } catch (error) {
      if (!serperKey) {
        return {
          citations: [],
          engine: "none",
          note:
            error instanceof Error
              ? `Tavily falhou (${error.message}).`
              : "Tavily falhou.",
        };
      }
    }
  }

  if (serperKey) {
    try {
      const citations = await searchSerper(query, topK, serperKey);
      return {
        citations,
        engine: "serper",
        note: tavilyKey ? "Tavily indisponível; usando Serper." : undefined,
      };
    } catch (error) {
      return {
        citations: [],
        engine: "none",
        note:
          error instanceof Error
            ? `Serper falhou (${error.message}).`
            : "Serper falhou.",
      };
    }
  }

  return {
    citations: [],
    engine: "none",
    note:
      "Nenhuma chave de busca configurada. Adicione TAVILY_API_KEY ou SERPER_API_KEY no .env.local.",
  };
}

export function isWebSearchConfigured() {
  return Boolean(process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY);
}

export function webSearchProviderLabel() {
  if (process.env.TAVILY_API_KEY) return "Tavily";
  if (process.env.SERPER_API_KEY) return "Serper";
  return null;
}

export function formatWebResultsForPrompt(citations: Citation[]) {
  if (citations.length === 0) return "Nenhum resultado encontrado na web.";

  return citations
    .map(
      (citation, index) =>
        `[${index + 1}] ${citation.title}\nURL: ${citation.url ?? citation.source}\n${citation.snippet}`
    )
    .join("\n\n");
}

async function searchTavily(
  query: string,
  topK: number,
  apiKey: string
): Promise<Citation[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: topK,
      include_answer: false,
    }),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];

  return results.slice(0, topK).map(
    (item: Record<string, unknown>, index: number): Citation => ({
      docId: String(item.url ?? `web-${index}`),
      title: String(item.title ?? "Sem título"),
      snippet: String(item.content ?? "").slice(0, 600),
      score: Number(item.score ?? 1 - index * 0.1),
      source: String(item.url ?? "Web"),
      url: typeof item.url === "string" ? item.url : undefined,
    })
  );
}

async function searchSerper(
  query: string,
  topK: number,
  apiKey: string
): Promise<Citation[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    signal: controller.signal,
    body: JSON.stringify({ q: query, num: topK }),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  const organic = Array.isArray(data?.organic) ? data.organic : [];

  return organic.slice(0, topK).map(
    (item: Record<string, unknown>, index: number): Citation => ({
      docId: String(item.link ?? `web-${index}`),
      title: String(item.title ?? "Sem título"),
      snippet: String(item.snippet ?? "").slice(0, 600),
      score: Math.max(0.1, 1 - index * 0.15),
      source: String(item.link ?? "Web"),
      url: typeof item.link === "string" ? item.link : undefined,
    })
  );
}
