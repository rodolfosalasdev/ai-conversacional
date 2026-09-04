import type {
  Contract,
  CreditAssessment,
  EmailDelivery,
  FinancingApplication,
  Offer,
  Simulation,
} from "@/lib/types/financing";

export type ChatMode = "agent" | "plan" | "ask" | "web";
/** Modelo lógico disponível na UI. Sonnet foi removido temporariamente. */
export type ModelId = "gpt";

export type MessageRole = "user" | "assistant" | "system";

/** Bloco extra renderizado abaixo do texto de uma mensagem do assistente. */
export type MessageBlock =
  | { kind: "assessment"; assessment: CreditAssessment }
  | { kind: "simulation"; simulation: Simulation }
  | { kind: "summary"; rows: { label: string; value: string }[] }
  | { kind: "contract"; contract: Contract }
  | { kind: "delivery"; delivery: EmailDelivery }
  | { kind: "plan"; steps: string[] };

export interface BranchOption {
  id: string;
  label: string;
  description?: string;
  /** Texto curto exibido à direita (ex.: "1,49% a.m."). */
  badge?: string;
  recommended?: boolean;
  tone?: "default" | "destructive";
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  /** Trecho textual extraído, usado como contexto adicional para o modelo. */
  excerpt?: string;
}

export interface Citation {
  docId: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
  /** Presente em citações do modo Web — link clicável na UI. */
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  /** Nó do grafo que produziu a mensagem. */
  nodeId?: string;
  mode?: ChatMode;
  model?: ModelId;
  blocks?: MessageBlock[];
  citations?: Citation[];
  attachments?: Attachment[];
  /** Preenchido quando o passo exige uma escolha do usuário. */
  options?: BranchOption[];
  /** Marca a mensagem cuja escolha já foi feita, travando os botões. */
  chosenOptionId?: string;
  pending?: boolean;
}

export interface GraphNodeState {
  id: string;
  status: "pending" | "active" | "done" | "skipped";
  /** Rótulo do caminho escolhido, exibido na aresta do grafo. */
  choiceLabel?: string;
  visitedAt?: string;
}

export interface ConversationState {
  id: string;
  currentNodeId: string;
  application: FinancingApplication;
  assessment?: CreditAssessment;
  offers: Offer[];
  simulation?: Simulation;
  contract?: Contract;
  delivery?: EmailDelivery;
  nodeStates: Record<string, GraphNodeState>;
  /** Ordem real de visitação, usada para desenhar o caminho no grafo. */
  path: string[];
  finished: boolean;
}

export interface ChatTurnResult {
  state: ConversationState;
  messages: ChatMessage[];
}
