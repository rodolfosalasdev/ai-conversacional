import { listConfiguredProviders } from "@/server/llm/providers";
import type { ModelId } from "@/lib/types/chat";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteParams {
  model: ModelId;
  system: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Pede JSON puro na resposta (usado pelo classificador de opções). */
  json?: boolean;
  signal?: AbortSignal;
}

export interface CompleteResult {
  text: string;
  provider: string;
  model: string;
  /** Nenhum provider configurado — o chamador deve usar o texto canônico. */
  simulated: boolean;
  error?: string;
}

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 20_000);

export function isLlmConfigured(model: ModelId) {
  return listConfiguredProviders(model).length > 0;
}

/** Mensagem amigável quando todas as tentativas de LLM falham. */
export function formatLlmFailureMessage(error?: string) {
  if (!error) {
    return "Não foi possível contactar nenhum modelo configurado. Verifique as chaves no `.env.local` e reinicie o servidor.";
  }

  if (/credit balance is too low|insufficient.*credit|billing/i.test(error)) {
    return [
      "A conta **Anthropic está sem créditos**.",
      "",
      "Remova `CLAUDE_API_KEY` do `.env.local` e use só `GROQ_API_KEY` (grátis), ou adicione créditos em console.anthropic.com.",
    ].join("\n");
  }

  if (/401|authentication|invalid.*api.*key|x-api-key/i.test(error)) {
    return "Chave de API inválida ou expirada. Verifique `GROQ_API_KEY` em console.groq.com/keys.";
  }

  return `Falha ao contactar o modelo: ${error.slice(0, 280)}`;
}

/**
 * Chama o provider resolvido para o modelo lógico. Qualquer falha (sem chave,
 * rate limit, timeout) devolve `simulated: true` em vez de lançar — a jornada
 * precisa continuar funcionando sem LLM.
 */
export async function complete(
  params: CompleteParams
): Promise<CompleteResult> {
  const candidates = listConfiguredProviders(params.model);

  if (candidates.length === 0) {
    return {
      text: "",
      provider: "simulado",
      model: "deterministico",
      simulated: true,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  params.signal?.addEventListener("abort", () => controller.abort());

  const failures: string[] = [];

  try {
    for (const resolved of candidates) {
      try {
        const text =
          resolved.provider.api === "anthropic"
            ? await callAnthropic(resolved, params, controller.signal)
            : await callOpenAiCompatible(resolved, params, controller.signal);

        return {
          text: text.trim(),
          provider: resolved.provider.label,
          model: resolved.model,
          simulated: false,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha desconhecida";
        failures.push(`${resolved.provider.label}: ${message}`);
      }
    }

    const last = candidates.at(-1)!;

    return {
      text: "",
      provider: last.provider.label,
      model: last.model,
      simulated: true,
      error: failures.join(" → "),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiCompatible(
  resolved: NonNullable<ReturnType<typeof resolveProvider>>,
  params: CompleteParams,
  signal: AbortSignal
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${resolved.apiKey}`,
  };

  if (resolved.provider.id === "openrouter") {
    headers["HTTP-Referer"] =
      process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000";
    headers["X-Title"] = "AI Conversacional";
  }

  const response = await fetch(`${resolved.provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: resolved.model,
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens ?? 700,
      messages: [
        { role: "system", content: params.system },
        ...params.messages,
      ],
      ...(params.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `${resolved.provider.label} respondeu ${response.status}: ${detail.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`${resolved.provider.label} devolveu resposta vazia`);
  }

  return content;
}

async function callAnthropic(
  resolved: NonNullable<ReturnType<typeof resolveProvider>>,
  params: CompleteParams,
  signal: AbortSignal
) {
  const response = await fetch(`${resolved.provider.baseUrl}/messages`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": resolved.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: resolved.model,
      max_tokens: params.maxTokens ?? 700,
      temperature: params.temperature ?? 0.3,
      system: params.system,
      messages: params.messages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Anthropic respondeu ${response.status}: ${detail.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const content = data?.content?.[0]?.text;
  if (typeof content !== "string") {
    throw new Error("Anthropic devolveu resposta vazia");
  }

  return content;
}

/** Extrai o primeiro objeto JSON de uma resposta que pode vir com ```json. */
export function extractJson<T>(text: string): T | null {
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
