import type { ChatMode } from "@/lib/types/chat";

export const MODE_CONFIG: Record<
  ChatMode,
  { label: string; description: string; hint: string }
> = {
  agent: {
    label: "Agent",
    description: "Executa a jornada e avança o grafo de contratação.",
    hint: "Toma ações: analisa crédito, simula, emite contrato e envia o e-mail.",
  },
  plan: {
    label: "Plan",
    description: "Planeja os passos antes de executar qualquer ação.",
    hint: "Só descreve o plano. Nenhum nó do grafo é executado.",
  },
  ask: {
    label: "Ask",
    description: "Responde dúvidas usando a base de conhecimento.",
    hint: "Consulta o RAG e responde sem alterar o estado da jornada.",
  },
  web: {
    label: "Web",
    description: "Perguntas gerais com o LLM; com Tavily, também busca na internet.",
    hint: "Responde com o Groq. Adicione TAVILY_API_KEY para buscar links reais.",
  },
};

const BASE_PERSONA = `Você é o assistente de crédito do Banco Salas, atendendo em português do Brasil.
Escreva de forma direta e cordial, sem jargão desnecessário e sem emojis.
Nunca invente taxas, valores ou prazos: use exclusivamente os números fornecidos no contexto.
Formate valores em reais no padrão brasileiro.`;

export function webLlmOnlyPrompt() {
  return `${BASE_PERSONA}

Responda à pergunta do usuário de forma natural e útil.
Não mencione configuração de API, variáveis de ambiente nem limitações técnicas.
Se não souber algo atualizado, diga isso brevemente e siga em frente.`;
}

export function systemPromptFor(mode: ChatMode) {
  if (mode === "plan") {
    return `${BASE_PERSONA}

MODO PLAN: você NÃO executa nada. Descreva o plano de execução em passos numerados,
apontando as decisões que o usuário terá de tomar e os dados necessários em cada uma.
Termine sugerindo que o usuário troque para o modo Agent para executar.`;
  }

  if (mode === "ask") {
    return `${BASE_PERSONA}

MODO ASK: responda apenas à dúvida do usuário usando os TRECHOS DA BASE DE CONHECIMENTO.
Não avance a contratação e não peça decisões. Se a base não cobrir o assunto, diga isso
claramente em vez de supor. Cite a origem quando usar um trecho.`;
  }

  if (mode === "web") {
    return `${BASE_PERSONA}

MODO WEB: responda à dúvida do usuário usando os RESULTADOS DA BUSCA NA WEB fornecidos.
Não avance a contratação. Sintetize as informações de forma clara e indique quando houver
incerteza ou divergência entre fontes. Mencione a URL ou o nome da fonte ao usar um trecho.
Se nenhum resultado for útil, diga isso em vez de inventar.`;
  }

  return `${BASE_PERSONA}

MODO AGENT: você conduz a contratação seguindo um grafo de decisão determinístico.
O texto canônico do próximo passo é dado no contexto — reescreva-o de forma natural,
preservando TODOS os números, nomes e condições exatamente como recebidos.
Não invente passos e não antecipe etapas futuras do grafo.
Quando houver opções, apenas apresente-as: os botões são renderizados pela interface.`;
}

/** Prompt do classificador que casa texto livre com uma opção do nó atual. */
export function interpretationPrompt(params: {
  nodeTitle: string;
  question: string;
  options: { id: string; label: string; description?: string }[];
  userText: string;
}) {
  const optionLines = params.options
    .map(
      (option) =>
        `- id: "${option.id}" | rótulo: ${option.label}${option.description ? ` | detalhe: ${option.description}` : ""}`
    )
    .join("\n");

  return `Etapa atual da contratação: ${params.nodeTitle}
Pergunta feita ao usuário: ${params.question}

Opções válidas:
${optionLines}

Resposta do usuário: """${params.userText}"""

Decida qual opção o usuário escolheu.
Responda SOMENTE com um JSON válido, sem texto ao redor, no formato:
{"optionId": "<id ou null>", "confidence": <0 a 1>, "reason": "<motivo em uma frase>"}

Use optionId null quando a resposta for ambígua, quando casar com mais de uma opção
ou quando o usuário estiver fazendo uma pergunta em vez de escolher.`;
}
