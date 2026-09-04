import type {
  Attachment,
  ChatMessage,
  ChatMode,
  ConversationState,
  ModelId,
} from "@/lib/types/chat";
import type { ClientProfile } from "@/lib/types/financing";

export interface TurnMeta {
  provider: string;
  model: string;
  simulated: boolean;
  ragEngine?: string;
  webEngine?: string;
  interpretation?: string;
}

export interface ConversationPayload {
  id: string;
  client: ClientProfile;
  state: ConversationState;
  messages: ChatMessage[];
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error ?? `Falha na requisição (${response.status})`);
  }

  return data as T;
}

export function createConversation(clientPresetId?: string) {
  return request<{ conversation: ConversationPayload; meta: TurnMeta }>(
    "/api/conversations",
    { method: "POST", body: JSON.stringify({ clientPresetId }) }
  );
}

export function sendTurn(params: {
  conversationId: string;
  mode: ChatMode;
  model: ModelId;
  input:
    | { kind: "text"; text: string }
    | { kind: "choice"; optionId: string };
  attachments?: Attachment[];
}) {
  return request<{
    messages: ChatMessage[];
    state: ConversationState;
    meta: TurnMeta;
  }>("/api/chat", { method: "POST", body: JSON.stringify(params) });
}

export function uploadFiles(files: File[]) {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);

  return request<{ attachments: Attachment[] }>("/api/upload", {
    method: "POST",
    body: formData,
  });
}

export interface HealthPayload {
  llm: {
    active: { id: string; label: string } | null;
    simulated: boolean;
    providers: {
      id: string;
      label: string;
      free: boolean;
      configured: boolean;
      apiKeyEnv: string;
      docsUrl: string;
    }[];
  };
  rag: {
    engine: "python" | "local";
    documents: number;
    chunks: number;
    service: { url: string; reachable: boolean } | null;
  };
  email: { transport: string };
  web: {
    configured: boolean;
    provider: string | null;
  };
}

export function fetchHealth() {
  return request<HealthPayload>("/api/health");
}

export interface KnowledgePayload {
  documents: {
    id: string;
    title: string;
    source: string;
    tags: string[];
    chunkCount: number;
    characters: number;
  }[];
  totals: { documents: number; chunks: number };
  ragServiceUrl: string | null;
}

export function fetchKnowledge() {
  return request<KnowledgePayload>("/api/knowledge");
}

export function searchKnowledge(query: string) {
  return request<{
    citations: {
      docId: string;
      title: string;
      snippet: string;
      score: number;
      source: string;
    }[];
    engine: string;
    note?: string;
  }>("/api/knowledge/search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}
