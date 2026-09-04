export type GraphNodeKind =
  | "start"
  | "collect"
  | "choice"
  | "compute"
  | "authorize"
  | "action"
  | "terminal";

export interface GraphEdgeDef {
  to: string;
  label?: string;
  /** Aresta desenhada tracejada no painel do grafo (retorno / exceção). */
  kind?: "default" | "loop" | "exception";
}

export interface GraphNodeDef {
  id: string;
  title: string;
  kind: GraphNodeKind;
  summary: string;
  next: GraphEdgeDef[];
}

/**
 * Grafo declarativo da contratação de financiamento.
 * A engine (engine.ts) caminha por ele; o painel do grafo desenha a mesma
 * estrutura, então nó novo aqui aparece automaticamente na UI.
 */
export const FINANCING_NODES: GraphNodeDef[] = [
  {
    id: "start",
    title: "Início da jornada",
    kind: "start",
    summary: "Carrega o cadastro do cliente e abre a solicitação.",
    next: [{ to: "purpose" }],
  },
  {
    id: "purpose",
    title: "Finalidade do crédito",
    kind: "choice",
    summary: "Escolha do produto: veículo, imóvel, pessoal ou consignado.",
    next: [{ to: "asset", label: "produto escolhido" }],
  },
  {
    id: "asset",
    title: "Valores da operação",
    kind: "collect",
    summary: "Valor do bem e entrada informados em linguagem natural.",
    next: [{ to: "credit_check" }],
  },
  {
    id: "credit_check",
    title: "Análise de crédito",
    kind: "compute",
    summary: "Score, comprometimento de renda e política de entrada mínima.",
    next: [
      { to: "offers", label: "aprovado" },
      { to: "remediation", label: "condicional", kind: "exception" },
      { to: "denied", label: "negado", kind: "exception" },
    ],
  },
  {
    id: "remediation",
    title: "Remediação",
    kind: "choice",
    summary: "Avalista, entrada maior ou valor menor para reabilitar o caso.",
    next: [{ to: "credit_check", label: "reanalisar", kind: "loop" }],
  },
  {
    id: "denied",
    title: "Crédito negado",
    kind: "terminal",
    summary: "Encerramento com motivo e orientação de reapresentação.",
    next: [],
  },
  {
    id: "offers",
    title: "Ofertas disponíveis",
    kind: "choice",
    summary: "Múltiplas condições elegíveis — o usuário escolhe clicando.",
    next: [{ to: "term", label: "oferta escolhida" }],
  },
  {
    id: "term",
    title: "Prazo",
    kind: "choice",
    summary: "Número de parcelas permitido pela oferta selecionada.",
    next: [{ to: "insurance", label: "prazo definido" }],
  },
  {
    id: "insurance",
    title: "Seguro prestamista",
    kind: "choice",
    summary: "Inclusão opcional do seguro no valor da parcela.",
    next: [{ to: "due_day", label: "definido" }],
  },
  {
    id: "due_day",
    title: "Vencimento",
    kind: "choice",
    summary: "Dia de vencimento das parcelas.",
    next: [{ to: "review", label: "definido" }],
  },
  {
    id: "review",
    title: "Conferência",
    kind: "compute",
    summary: "Consolida a proposta e checa as informações com o usuário.",
    next: [{ to: "authorize" }],
  },
  {
    id: "authorize",
    title: "Autorização",
    kind: "authorize",
    summary: "Aceite formal, ajuste da simulação ou cancelamento.",
    next: [
      { to: "sign", label: "autorizado" },
      { to: "offers", label: "ajustar", kind: "loop" },
      { to: "cancelled", label: "cancelar", kind: "exception" },
    ],
  },
  {
    id: "cancelled",
    title: "Contratação cancelada",
    kind: "terminal",
    summary: "Encerramento a pedido do cliente, sem efeitos contratuais.",
    next: [],
  },
  {
    id: "sign",
    title: "Emissão do contrato",
    kind: "action",
    summary: "Gera o instrumento com cláusulas e hash de assinatura.",
    next: [{ to: "deliver" }],
  },
  {
    id: "deliver",
    title: "Envio por e-mail",
    kind: "action",
    summary: "Dispara a cópia do contrato para o e-mail do cliente.",
    next: [{ to: "done" }],
  },
  {
    id: "done",
    title: "Contratação concluída",
    kind: "terminal",
    summary: "Contrato emitido e cópia entregue ao cliente.",
    next: [],
  },
];

export const NODE_BY_ID: Record<string, GraphNodeDef> = Object.fromEntries(
  FINANCING_NODES.map((node) => [node.id, node])
);

export function getNode(id: string): GraphNodeDef {
  const node = NODE_BY_ID[id];
  if (!node) throw new Error(`Nó desconhecido no grafo: ${id}`);
  return node;
}
