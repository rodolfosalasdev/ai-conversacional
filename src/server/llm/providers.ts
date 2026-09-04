import type { ModelId } from "@/lib/types/chat";

export type ProviderId =
  | "openai"
  | "groq"
  | "openrouter"
  | "cerebras"
  | "gemini"
  | "anthropic"
  | "ollama";

export interface ProviderDef {
  id: ProviderId;
  label: string;
  /** Todos falam o dialeto OpenAI, exceto a Anthropic. */
  api: "openai-compatible" | "anthropic";
  baseUrl: string;
  apiKeyEnv: string;
  /** Camada gratuita permanente, sem cartão de crédito. */
  free: boolean;
  models: Record<ModelId, string>;
  docsUrl: string;
}

/**
 * Ordem de tentativa. O primeiro provider com chave definida vence; se nenhum
 * tiver chave, o app cai no provider simulado.
 */
export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    label: "OpenAI",
    api: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    free: false,
    models: { gpt: "gpt-4o-mini" },
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "groq",
    label: "Groq",
    api: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    free: true,
    models: { gpt: "openai/gpt-oss-20b" },
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    api: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnv: "GEMINI_API_KEY",
    free: true,
    models: { gpt: "gemini-2.0-flash" },
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    api: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    free: true,
    models: { gpt: "openai/gpt-oss-20b:free" },
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    api: "openai-compatible",
    baseUrl: "https://api.cerebras.ai/v1",
    apiKeyEnv: "CEREBRAS_API_KEY",
    free: true,
    models: { gpt: "llama-3.3-70b" },
    docsUrl: "https://cloud.cerebras.ai",
  },
  {
    id: "anthropic",
    label: "Claude",
    api: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "CLAUDE_API_KEY",
    free: false,
    models: { gpt: "claude-sonnet-4-5" },
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    api: "openai-compatible",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
    apiKeyEnv: "OLLAMA_API_KEY",
    free: true,
    models: { gpt: "llama3.2" },
    docsUrl: "https://ollama.com",
  },
];

const PROVIDER_BY_ID = new Map(PROVIDERS.map((item) => [item.id, item]));

const PREFERENCE: ProviderId[] = [
  "groq",
  "gemini",
  "openrouter",
  "cerebras",
  "openai",
  "ollama",
  "anthropic",
];

/** Chave da Anthropic — CLAUDE_API_KEY é o nome preferido; ANTHROPIC_API_KEY ainda funciona. */
export function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
}

export interface ResolvedProvider {
  provider: ProviderDef;
  model: string;
  apiKey: string;
}

export function resolveProvider(modelId: ModelId = "gpt"): ResolvedProvider | null {
  return listConfiguredProviders(modelId)[0] ?? null;
}

/** Todos os providers configurados, na ordem de preferência (para fallback automático). */
export function listConfiguredProviders(modelId: ModelId = "gpt"): ResolvedProvider[] {
  const forced = process.env.LLM_PROVIDER as ProviderId | undefined;
  const order = forced ? [forced] : PREFERENCE;
  const resolved: ResolvedProvider[] = [];

  for (const providerId of order) {
    const provider = PROVIDER_BY_ID.get(providerId);
    if (!provider) continue;

    const apiKey =
      provider.id === "anthropic"
        ? getClaudeApiKey()
        : process.env[provider.apiKeyEnv];
    if (!apiKey && provider.id !== "ollama") continue;
    if (provider.id === "ollama" && !process.env.OLLAMA_BASE_URL) continue;

    const overrideEnv = `LLM_MODEL_${modelId.toUpperCase()}`;
    const model = process.env[overrideEnv] ?? provider.models[modelId];

    resolved.push({ provider, model, apiKey: apiKey ?? "ollama" });
  }

  return resolved;
}

/** Usado pela rota /api/health para mostrar o que está ativo na UI. */
export function providerStatus() {
  return PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    free: provider.free,
    configured:
      provider.id === "anthropic"
        ? Boolean(getClaudeApiKey())
        : Boolean(process.env[provider.apiKeyEnv]) ||
          (provider.id === "ollama" && Boolean(process.env.OLLAMA_BASE_URL)),
    apiKeyEnv: provider.apiKeyEnv,
    docsUrl: provider.docsUrl,
  }));
}
