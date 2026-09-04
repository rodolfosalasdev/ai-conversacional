import { getNode } from "@/lib/graph/financing-graph";
import {
  PRODUCTS,
  assessCredit,
  availableTerms,
  buildOffers,
  buildSimulation,
} from "@/lib/graph/credit-policy";
import { formatCurrency, formatDate, formatRate } from "@/lib/format";
import type {
  BranchOption,
  ConversationState,
  MessageBlock,
} from "@/lib/types/chat";
import type {
  ClientProfile,
  Contract,
  EmailDelivery,
  ProductId,
} from "@/lib/types/financing";

export type GraphEvent =
  | { type: "start" }
  | { type: "choice"; optionId: string }
  | { type: "input"; text: string; resolvedOptionId?: string };

export interface EngineTurn {
  nodeId: string;
  text: string;
  blocks?: MessageBlock[];
  options?: BranchOption[];
  /**
   * O texto livre casou com mais de uma opção (ou com nenhuma) e a engine
   * devolveu os caminhos possíveis para o usuário clicar.
   */
  needsDisambiguation?: boolean;
}

export interface EngineEffects {
  generateContract(
    state: ConversationState,
    client: ClientProfile
  ): Promise<Contract>;
  deliverContract(
    contract: Contract,
    client: ClientProfile
  ): Promise<EmailDelivery>;
}

export interface StepResult {
  state: ConversationState;
  turns: EngineTurn[];
}

export function createConversationState(id: string): ConversationState {
  return {
    id,
    currentNodeId: "start",
    application: { remediations: [] },
    offers: [],
    nodeStates: {
      start: { id: "start", status: "active" },
    },
    path: [],
    finished: false,
  };
}

/** Nós que pedem interação do usuário antes de seguir. */
const INTERACTIVE_KINDS = new Set(["choice", "collect", "authorize"]);

export async function stepGraph(params: {
  state: ConversationState;
  client: ClientProfile;
  event: GraphEvent;
  effects: EngineEffects;
}): Promise<StepResult> {
  const { client, event, effects } = params;
  let state = structuredClone(params.state);
  const turns: EngineTurn[] = [];

  if (event.type === "start") {
    state = markVisited(state, "start");
    return runUntilInteractive(state, client, "purpose", turns, effects);
  }

  const node = getNode(state.currentNodeId);

  // Texto livre: tenta casar com uma opção; se não conseguir, devolve as opções.
  if (event.type === "input") {
    const resolution = resolveInput(state, client, event);

    if (resolution.kind === "unresolved") {
      turns.push({
        nodeId: node.id,
        text: resolution.message,
        options: buildOptions(state, client, node.id),
        needsDisambiguation: true,
      });
      return { state, turns };
    }

    if (resolution.kind === "state-only") {
      state = resolution.state;
      // Continua no mesmo nó — ainda faltam dados para avançar.
      turns.push({
        nodeId: node.id,
        text: resolution.message,
        options: buildOptions(state, client, node.id),
      });
      return { state, turns };
    }

    state = resolution.state;
    return runUntilInteractive(state, client, resolution.next, turns, effects);
  }

  // Clique em uma opção.
  const applied = applyChoice(state, client, event.optionId);
  if (!applied) {
    turns.push({
      nodeId: node.id,
      text: "Essa opção não está mais disponível. Escolha uma das alternativas abaixo.",
      options: buildOptions(state, client, node.id),
      needsDisambiguation: true,
    });
    return { state, turns };
  }

  state = applied.state;
  return runUntilInteractive(state, client, applied.next, turns, effects);
}

/**
 * Caminha pelos nós automáticos (compute/action) até parar em um nó que
 * dependa do usuário ou em um terminal.
 */
async function runUntilInteractive(
  initialState: ConversationState,
  client: ClientProfile,
  startNodeId: string,
  turns: EngineTurn[],
  effects: EngineEffects
): Promise<StepResult> {
  let state = initialState;
  let nodeId: string | null = startNodeId;
  let guard = 0;

  while (nodeId && guard < 24) {
    guard += 1;

    const node = getNode(nodeId);
    state = enterNode(state, nodeId);

    if (node.kind === "terminal") {
      const turn = describeTerminal(state, client, nodeId);
      turns.push(turn);
      state = { ...state, finished: true };
      state = markVisited(state, nodeId);
      return { state, turns };
    }

    if (node.kind === "action") {
      const executed = await executeAction(state, client, nodeId, effects);
      state = executed.state;
      turns.push(executed.turn);
      state = markVisited(state, nodeId);
      nodeId = executed.next;
      continue;
    }

    if (node.kind === "compute") {
      const computed = compute(state, client, nodeId);
      state = computed.state;
      turns.push(computed.turn);
      state = markVisited(state, nodeId, computed.choiceLabel);
      nodeId = computed.next;
      continue;
    }

    if (INTERACTIVE_KINDS.has(node.kind)) {
      const prompt = describeInteractive(state, client, nodeId);
      turns.push(prompt);
      return { state, turns };
    }

    nodeId = node.next[0]?.to ?? null;
  }

  return { state, turns };
}

function enterNode(
  state: ConversationState,
  nodeId: string
): ConversationState {
  return {
    ...state,
    currentNodeId: nodeId,
    nodeStates: {
      ...state.nodeStates,
      [nodeId]: {
        ...(state.nodeStates[nodeId] ?? { id: nodeId, status: "pending" }),
        id: nodeId,
        status: "active",
      },
    },
  };
}

function markVisited(
  state: ConversationState,
  nodeId: string,
  choiceLabel?: string
): ConversationState {
  const path = state.path.includes(nodeId)
    ? state.path
    : [...state.path, nodeId];

  return {
    ...state,
    path,
    nodeStates: {
      ...state.nodeStates,
      [nodeId]: {
        id: nodeId,
        status: "done",
        choiceLabel:
          choiceLabel ?? state.nodeStates[nodeId]?.choiceLabel ?? undefined,
        visitedAt: new Date().toISOString(),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Opções clicáveis por nó
// ---------------------------------------------------------------------------

export function buildOptions(
  state: ConversationState,
  client: ClientProfile,
  nodeId: string
): BranchOption[] {
  switch (nodeId) {
    case "purpose":
      return (Object.keys(PRODUCTS) as ProductId[]).map((id) => ({
        id: `product:${id}`,
        label: PRODUCTS[id].label,
        description: PRODUCTS[id].description,
        badge: `a partir de ${formatRate(PRODUCTS[id].baseRate)} a.m.`,
        recommended: id === "veiculo",
      }));

    case "asset":
      return buildAssetOptions(state);

    case "remediation":
      return [
        {
          id: "remediation:entrada-maior",
          label: "Aumentar a entrada",
          description:
            "Elevar a entrada reduz o valor financiado e o risco da operação.",
          recommended: true,
        },
        {
          id: "remediation:avalista",
          label: "Incluir um avalista",
          description: "Um segundo participante reforça a garantia do contrato.",
        },
        {
          id: "remediation:valor-menor",
          label: "Reduzir o valor financiado",
          description: "Financiar um bem de menor valor para caber na política.",
        },
        {
          id: "remediation:desistir",
          label: "Encerrar a solicitação",
          description: "Interromper a análise por enquanto.",
          tone: "destructive",
        },
      ];

    case "offers":
      return state.offers.map((offer) => ({
        id: `offer:${offer.id}`,
        label: offer.name,
        description: `${offer.description} Entrada mínima de ${(offer.minDownPaymentRate * 100).toFixed(0)}%, até ${offer.maxTermMonths}x. ${offer.highlights.join(". ")}.`,
        badge: `${formatRate(offer.monthlyRate)} a.m.`,
        recommended: offer.recommended,
      }));

    case "term": {
      const offer = currentOffer(state);
      const product = state.application.product ?? "pessoal";
      if (!offer) return [];

      const financed =
        (state.application.assetValue ?? 0) - (state.application.downPayment ?? 0);

      return availableTerms(offer, product).map((term) => {
        const simulation = buildSimulation({
          offer,
          application: { ...state.application, termMonths: term },
        });
        const fitsBudget = simulation.installment <= (state.assessment?.maxInstallment ?? Infinity);

        return {
          id: `term:${term}`,
          label: `${term} parcelas`,
          description: fitsBudget
            ? `Total a pagar de ${formatCurrency(simulation.totalPayable)} sobre ${formatCurrency(financed)} financiados.`
            : `Parcela acima do limite de ${formatCurrency(state.assessment?.maxInstallment ?? 0)} da política.`,
          badge: formatCurrency(simulation.installment),
          recommended: fitsBudget && term === 48,
          tone: fitsBudget ? "default" : "destructive",
        } satisfies BranchOption;
      });
    }

    case "insurance": {
      const offer = currentOffer(state);
      const withInsurance = offer
        ? buildSimulation({
            offer,
            application: { ...state.application, insurance: "com-prestamista" },
          })
        : null;
      const without = offer
        ? buildSimulation({
            offer,
            application: { ...state.application, insurance: "sem-prestamista" },
          })
        : null;

      return [
        {
          id: "insurance:com-prestamista",
          label: "Com seguro prestamista",
          description:
            "Quita o saldo devedor em caso de morte ou invalidez permanente.",
          badge: withInsurance
            ? `${formatCurrency(withInsurance.installment)}/mês`
            : undefined,
          recommended: true,
        },
        {
          id: "insurance:sem-prestamista",
          label: "Sem seguro prestamista",
          description: "Parcela menor, sem cobertura em caso de sinistro.",
          badge: without ? `${formatCurrency(without.installment)}/mês` : undefined,
        },
      ];
    }

    case "due_day":
      return [5, 10, 15, 20, 25].map((day) => ({
        id: `dueday:${day}`,
        label: `Dia ${day}`,
        description: `Primeira parcela em ${formatDate(nextDueDatePreview(day))}.`,
        recommended: day === 10,
      }));

    case "authorize":
      return [
        {
          id: "authorize:accept",
          label: "Autorizar a contratação",
          description:
            "Confirmo que revisei os dados e autorizo a emissão do contrato.",
          recommended: true,
        },
        {
          id: "authorize:adjust",
          label: "Ajustar a simulação",
          description: "Voltar para a escolha de oferta, prazo e seguro.",
        },
        {
          id: "authorize:cancel",
          label: "Cancelar",
          description: "Encerrar sem contratar.",
          tone: "destructive",
        },
      ];

    default:
      return [];
  }
}

function buildAssetOptions(state: ConversationState): BranchOption[] {
  const { product, assetValue, downPayment } = state.application;
  if (!product) return [];

  const needsDownPayment = product === "veiculo" || product === "imovel";

  if (assetValue == null) {
    const suggestions =
      product === "imovel"
        ? [350_000, 500_000, 750_000]
        : product === "veiculo"
          ? [60_000, 90_000, 140_000]
          : [15_000, 30_000, 50_000];

    return suggestions.map((value) => ({
      id: `assetvalue:${value}`,
      label: formatCurrency(value),
      description: `Usar ${formatCurrency(value)} como valor de referência.`,
    }));
  }

  if (needsDownPayment && downPayment == null) {
    const minRate = PRODUCTS[product].minDownPaymentRate;
    return [minRate, minRate + 0.1, minRate + 0.2].map((rate) => ({
      id: `downpayment:${Math.round(rate * 100)}`,
      label: `${Math.round(rate * 100)}% de entrada`,
      description: `${formatCurrency(assetValue * rate)} à vista, financiando ${formatCurrency(assetValue * (1 - rate))}.`,
      recommended: rate === minRate + 0.1,
    }));
  }

  return [];
}

function nextDueDatePreview(day: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, day);
}

function currentOffer(state: ConversationState) {
  return state.offers.find((offer) => offer.id === state.application.offerId);
}

// ---------------------------------------------------------------------------
// Aplicação de escolhas
// ---------------------------------------------------------------------------

function applyChoice(
  state: ConversationState,
  client: ClientProfile,
  optionId: string
): { state: ConversationState; next: string } | null {
  const [kind, rawValue] = optionId.split(":");
  const application = { ...state.application };
  let choiceLabel = optionId;

  switch (kind) {
    case "product": {
      const product = rawValue as ProductId;
      if (!PRODUCTS[product]) return null;
      application.product = product;
      if (product === "pessoal" || product === "consignado") {
        application.downPayment = 0;
      }
      choiceLabel = PRODUCTS[product].label;
      return {
        state: markVisited(
          { ...state, application },
          "purpose",
          choiceLabel
        ),
        next: "asset",
      };
    }

    case "assetvalue": {
      application.assetValue = Number(rawValue);
      const next = needsMoreAssetData({ ...state, application })
        ? "asset"
        : "credit_check";
      return {
        state: { ...state, application },
        next,
      };
    }

    case "downpayment": {
      const rate = Number(rawValue) / 100;
      application.downPayment = Math.round((application.assetValue ?? 0) * rate);
      return {
        state: markVisited(
          { ...state, application },
          "asset",
          `entrada de ${rawValue}%`
        ),
        next: "credit_check",
      };
    }

    case "remediation": {
      if (rawValue === "desistir") {
        return { state, next: "cancelled" };
      }
      application.remediations = [...application.remediations, rawValue];

      if (rawValue === "entrada-maior") {
        const assetValue = application.assetValue ?? 0;
        application.downPayment = Math.round(
          Math.max(application.downPayment ?? 0, assetValue * 0.4)
        );
      }
      if (rawValue === "valor-menor") {
        application.assetValue = Math.round((application.assetValue ?? 0) * 0.7);
        application.downPayment = Math.round(
          (application.assetValue ?? 0) * 0.25
        );
      }
      if (rawValue === "avalista") {
        application.guarantorName = "Avalista indicado pelo cliente";
      }

      return {
        state: markVisited({ ...state, application }, "remediation", rawValue),
        next: "credit_check",
      };
    }

    case "offer": {
      const offer = state.offers.find((item) => item.id === rawValue);
      if (!offer) return null;
      application.offerId = offer.id;
      // Um prazo antigo pode não caber na nova oferta.
      if (application.termMonths && application.termMonths > offer.maxTermMonths) {
        application.termMonths = undefined;
      }
      return {
        state: markVisited({ ...state, application }, "offers", offer.name),
        next: "term",
      };
    }

    case "term": {
      application.termMonths = Number(rawValue);
      return {
        state: markVisited({ ...state, application }, "term", `${rawValue}x`),
        next: "insurance",
      };
    }

    case "insurance": {
      application.insurance = rawValue as typeof application.insurance;
      return {
        state: markVisited(
          { ...state, application },
          "insurance",
          rawValue === "com-prestamista" ? "com seguro" : "sem seguro"
        ),
        next: "due_day",
      };
    }

    case "dueday": {
      application.dueDay = Number(rawValue);
      return {
        state: markVisited(
          { ...state, application },
          "due_day",
          `dia ${rawValue}`
        ),
        next: "review",
      };
    }

    case "authorize": {
      if (rawValue === "accept") {
        return {
          state: markVisited(state, "authorize", "autorizado"),
          next: "sign",
        };
      }
      if (rawValue === "adjust") {
        return {
          state: markVisited(state, "authorize", "ajustar"),
          next: "offers",
        };
      }
      return {
        state: markVisited(state, "authorize", "cancelado"),
        next: "cancelled",
      };
    }

    default:
      return null;
  }
}

function needsMoreAssetData(state: ConversationState) {
  const { product, assetValue, downPayment } = state.application;
  if (!product) return true;
  if (assetValue == null) return true;
  if ((product === "veiculo" || product === "imovel") && downPayment == null) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Interpretação de texto livre
// ---------------------------------------------------------------------------

type InputResolution =
  | { kind: "unresolved"; message: string }
  | { kind: "state-only"; state: ConversationState; message: string }
  | { kind: "advance"; state: ConversationState; next: string };

function resolveInput(
  state: ConversationState,
  client: ClientProfile,
  event: Extract<GraphEvent, { type: "input" }>
): InputResolution {
  const nodeId = state.currentNodeId;

  // O modelo já resolveu para uma opção concreta.
  if (event.resolvedOptionId) {
    const applied = applyChoice(state, client, event.resolvedOptionId);
    if (applied) return { kind: "advance", ...applied };
  }

  if (nodeId === "asset") {
    return resolveAssetInput(state, event.text);
  }

  return {
    kind: "unresolved",
    message:
      "Encontrei mais de um caminho possível para essa resposta. Qual você prefere?",
  };
}

function resolveAssetInput(
  state: ConversationState,
  text: string
): InputResolution {
  const application = { ...state.application };
  const product = application.product;
  if (!product) {
    return {
      kind: "unresolved",
      message: "Antes preciso saber a finalidade do crédito.",
    };
  }

  const values = extractCurrencyValues(text);
  const lower = text.toLowerCase();

  if (application.assetValue == null && values.length > 0) {
    application.assetValue = values[0];
  }

  const needsDownPayment = product === "veiculo" || product === "imovel";

  if (needsDownPayment && application.downPayment == null) {
    if (/sem entrada|nenhuma entrada|zero de entrada/.test(lower)) {
      application.downPayment = 0;
    } else {
      const percentMatch = lower.match(/(\d{1,2})\s*%/);
      if (percentMatch && application.assetValue != null) {
        application.downPayment = Math.round(
          application.assetValue * (Number(percentMatch[1]) / 100)
        );
      } else if (values.length > 1) {
        application.downPayment = values[1];
      } else if (values.length === 1 && state.application.assetValue != null) {
        application.downPayment = values[0];
      }
    }
  }

  const nextState = { ...state, application };

  if (!needsMoreAssetData(nextState)) {
    return {
      kind: "advance",
      state: markVisited(
        nextState,
        "asset",
        formatCurrency(application.assetValue ?? 0)
      ),
      next: "credit_check",
    };
  }

  if (application.assetValue == null) {
    return {
      kind: "unresolved",
      message: `Não consegui identificar o valor do ${PRODUCTS[product].assetLabel}. Escreva algo como "120 mil" ou escolha uma referência abaixo.`,
    };
  }

  return {
    kind: "state-only",
    state: nextState,
    message: `Registrei ${formatCurrency(application.assetValue)} como valor do ${PRODUCTS[product].assetLabel}. Quanto você pretende dar de entrada?`,
  };
}

function extractCurrencyValues(text: string): number[] {
  const normalized = text.toLowerCase().replace(/r\$/g, " ");
  const pattern =
    /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(mil|k|milhão|milhões|milhoes|mi)?/g;

  const results: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    const raw = match[1];
    const suffix = match[2];

    let numeric: number;
    if (raw.includes(",")) {
      numeric = Number(raw.replace(/\./g, "").replace(",", "."));
    } else if (/\.\d{3}/.test(raw)) {
      numeric = Number(raw.replace(/\./g, ""));
    } else {
      numeric = Number(raw);
    }

    if (!Number.isFinite(numeric)) continue;
    if (suffix === "mil" || suffix === "k") numeric *= 1_000;
    if (suffix && ["milhão", "milhões", "milhoes", "mi"].includes(suffix)) {
      numeric *= 1_000_000;
    }

    // Percentuais e prazos curtos não são valores monetários.
    if (numeric < 1000) continue;
    results.push(numeric);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Nós automáticos
// ---------------------------------------------------------------------------

function compute(
  state: ConversationState,
  client: ClientProfile,
  nodeId: string
): { state: ConversationState; turn: EngineTurn; next: string; choiceLabel?: string } {
  if (nodeId === "credit_check") {
    const assessment = assessCredit(client, state.application);
    const offers =
      assessment.status === "denied"
        ? []
        : buildOffers(client, state.application, assessment);

    const nextState = { ...state, assessment, offers };

    const statusLabel =
      assessment.status === "approved"
        ? "aprovada"
        : assessment.status === "conditional"
          ? "condicional"
          : "negada";

    const text =
      assessment.status === "approved"
        ? `Análise concluída: proposta **aprovada**. Sua capacidade de pagamento comporta parcelas de até ${formatCurrency(assessment.maxInstallment)}.`
        : assessment.status === "conditional"
          ? `Análise concluída: proposta **condicional**. Consigo seguir, mas preciso de um reforço na operação.`
          : `Análise concluída: proposta **negada** pela política de crédito vigente.`;

    return {
      state: nextState,
      turn: {
        nodeId,
        text,
        blocks: [{ kind: "assessment", assessment }],
      },
      next:
        assessment.status === "approved"
          ? "offers"
          : assessment.status === "conditional"
            ? "remediation"
            : "denied",
      choiceLabel: statusLabel,
    };
  }

  if (nodeId === "review") {
    const offer = currentOffer(state);
    if (!offer) {
      return {
        state,
        turn: { nodeId, text: "Preciso que você escolha uma oferta antes." },
        next: "offers",
      };
    }

    const simulation = buildSimulation({ offer, application: state.application });
    const nextState = { ...state, simulation };

    const rows = [
      { label: "Titular", value: client.fullName },
      { label: "Produto", value: PRODUCTS[state.application.product ?? "pessoal"].label },
      { label: "Oferta", value: offer.name },
      { label: "Valor do bem", value: formatCurrency(simulation.assetValue) },
      { label: "Entrada", value: formatCurrency(simulation.downPayment) },
      { label: "Valor financiado", value: formatCurrency(simulation.financedAmount) },
      { label: "Prazo", value: `${simulation.termMonths} parcelas` },
      { label: "Taxa de juros", value: `${formatRate(simulation.monthlyRate)} a.m.` },
      { label: "Parcela mensal", value: formatCurrency(simulation.installment) },
      {
        label: "Seguro prestamista",
        value:
          state.application.insurance === "com-prestamista"
            ? `Incluso (${formatCurrency(simulation.insuranceMonthly)}/mês)`
            : "Não contratado",
      },
      { label: "Tarifa de cadastro", value: formatCurrency(simulation.originationFee) },
      { label: "Total a pagar", value: formatCurrency(simulation.totalPayable) },
      { label: "CET", value: `${formatRate(simulation.cetYearly)} ao ano` },
      { label: "1º vencimento", value: formatDate(simulation.firstDueDate) },
      { label: "E-mail para envio", value: client.email },
    ];

    return {
      state: nextState,
      turn: {
        nodeId,
        text: "Confira os dados da proposta antes de autorizar. Qualquer informação incorreta pode ser ajustada agora.",
        blocks: [
          { kind: "simulation", simulation },
          { kind: "summary", rows },
        ],
      },
      next: "authorize",
    };
  }

  return {
    state,
    turn: { nodeId, text: getNode(nodeId).summary },
    next: getNode(nodeId).next[0]?.to ?? "done",
  };
}

async function executeAction(
  state: ConversationState,
  client: ClientProfile,
  nodeId: string,
  effects: EngineEffects
): Promise<{ state: ConversationState; turn: EngineTurn; next: string }> {
  if (nodeId === "sign") {
    const contract = await effects.generateContract(state, client);
    return {
      state: { ...state, contract },
      turn: {
        nodeId,
        text: `Contrato **${contract.number}** emitido e assinado eletronicamente.`,
        blocks: [{ kind: "contract", contract }],
      },
      next: "deliver",
    };
  }

  if (nodeId === "deliver") {
    if (!state.contract) {
      return {
        state,
        turn: { nodeId, text: "Não há contrato emitido para enviar." },
        next: "done",
      };
    }

    const delivery = await effects.deliverContract(state.contract, client);
    return {
      state: { ...state, delivery },
      turn: {
        nodeId,
        text: `Cópia do contrato enviada para **${delivery.to}**.`,
        blocks: [{ kind: "delivery", delivery }],
      },
      next: "done",
    };
  }

  return {
    state,
    turn: { nodeId, text: getNode(nodeId).summary },
    next: getNode(nodeId).next[0]?.to ?? "done",
  };
}

function describeInteractive(
  state: ConversationState,
  client: ClientProfile,
  nodeId: string
): EngineTurn {
  const options = buildOptions(state, client, nodeId);

  switch (nodeId) {
    case "purpose":
      return {
        nodeId,
        text: `Olá, ${client.fullName.split(" ")[0]}. Já carreguei seu cadastro completo, então podemos ir direto ao ponto: qual é a finalidade do crédito?`,
        options,
      };

    case "asset": {
      const product = state.application.product ?? "pessoal";
      const config = PRODUCTS[product];

      if (state.application.assetValue == null) {
        return {
          nodeId,
          text: `Qual é o valor do ${config.assetLabel}? Pode escrever livremente — entendo formatos como "120 mil" ou "R$ 89.900".`,
          options,
        };
      }

      return {
        nodeId,
        text: `Quanto você pretende dar de entrada sobre ${formatCurrency(state.application.assetValue)}? A entrada mínima para este produto é de ${(config.minDownPaymentRate * 100).toFixed(0)}%.`,
        options,
      };
    }

    case "remediation":
      return {
        nodeId,
        text: "Existe mais de um caminho para destravar essa proposta. Qual deles faz mais sentido para você?",
        options,
      };

    case "offers":
      return {
        nodeId,
        text: `Encontrei ${state.offers.length} condições elegíveis para o seu perfil. Cada uma equilibra taxa, prazo e entrada de um jeito. Qual você prefere?`,
        options,
      };

    case "term":
      return {
        nodeId,
        text: "Em quantas parcelas você quer dividir? Já calculei o valor de cada cenário.",
        options,
      };

    case "insurance":
      return {
        nodeId,
        text: "O seguro prestamista é opcional. Quer incluí-lo na operação?",
        options,
      };

    case "due_day":
      return {
        nodeId,
        text: "Em qual dia do mês você prefere que a parcela vença?",
        options,
      };

    case "authorize":
      return {
        nodeId,
        text: "Você autoriza a contratação nas condições acima? A autorização gera o contrato e dispara a cópia para o seu e-mail.",
        options,
      };

    default:
      return { nodeId, text: getNode(nodeId).summary, options };
  }
}

function describeTerminal(
  state: ConversationState,
  client: ClientProfile,
  nodeId: string
): EngineTurn {
  if (nodeId === "denied") {
    const reasons = state.assessment?.reasons ?? [];
    return {
      nodeId,
      text: [
        "Não consigo aprovar essa contratação agora. Motivos considerados:",
        ...reasons.map((reason) => `- ${reason}`),
        "",
        "Você pode reapresentar a proposta em 90 dias ou com um avalista.",
      ].join("\n"),
    };
  }

  if (nodeId === "cancelled") {
    return {
      nodeId,
      text: "Contratação cancelada. Nenhum contrato foi emitido e nada foi registrado no seu CPF. É só me chamar quando quiser retomar.",
    };
  }

  return {
    nodeId,
    text: `Tudo pronto, ${client.fullName.split(" ")[0]}. O contrato foi emitido, assinado eletronicamente e a cópia já está a caminho do seu e-mail.`,
  };
}
