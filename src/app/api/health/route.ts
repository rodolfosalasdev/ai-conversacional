import { providerStatus, resolveProvider } from "@/server/llm/providers";
import { loadKnowledgeBase } from "@/server/rag/knowledge-base";
import { isWebSearchConfigured, webSearchProviderLabel } from "@/server/web/search";
import { handleRouteError, jsonOk } from "@/server/http/json";

/** Diagnóstico exibido no cabeçalho: provider de LLM, RAG e e-mail ativos. */
export async function GET() {
  try {
    const providers = providerStatus();
    const resolved = resolveProvider("gpt");
    const active = resolved
      ? { id: resolved.provider.id, label: resolved.provider.label }
      : null;
    const { docs, chunks } = await loadKnowledgeBase();

    const ragUrl = process.env.RAG_SERVICE_URL;
    let ragService: { url: string; reachable: boolean; detail?: unknown } | null =
      null;

    if (ragUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const response = await fetch(`${ragUrl.replace(/\/$/, "")}/health`, {
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        ragService = {
          url: ragUrl,
          reachable: response.ok,
          detail: response.ok ? await response.json() : undefined,
        };
      } catch {
        ragService = { url: ragUrl, reachable: false };
      }
    }

    return jsonOk({
      llm: {
        active: active ? { id: active.id, label: active.label } : null,
        simulated: !resolved,
        providers,
      },
      rag: {
        engine: ragService?.reachable ? "python" : "local",
        documents: docs.length,
        chunks: chunks.length,
        service: ragService,
      },
      email: {
        transport: process.env.RESEND_API_KEY
          ? "resend"
          : process.env.SMTP_HOST
            ? "smtp"
            : process.env.EMAIL_TRANSPORT === "ethereal"
              ? "ethereal"
              : "preview",
      },
      web: {
        configured: isWebSearchConfigured(),
        provider: webSearchProviderLabel(),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
