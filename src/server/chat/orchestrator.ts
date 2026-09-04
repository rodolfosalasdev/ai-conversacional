import { randomUUID } from "node:crypto";

import { buildOptions, stepGraph, type EngineTurn } from "@/lib/graph/engine";
import { FINANCING_NODES, getNode } from "@/lib/graph/financing-graph";
import { MODE_CONFIG, systemPromptFor, webLlmOnlyPrompt } from "@/lib/prompts/system";
import { generateContract } from "@/server/contract/generate";
import { deliverContractEmail } from "@/server/email/send";
import { complete, formatLlmFailureMessage, isLlmConfigured } from "@/server/llm";
import { formatCitationsForPrompt, searchKnowledge } from "@/server/rag/client";
import {
  formatWebResultsForPrompt,
  isWebSearchConfigured,
  searchWeb,
} from "@/server/web/search";
import { interpretChoice, looksLikeQuestion } from "@/server/chat/interpret";
import type { ConversationRecord } from "@/server/store/conversation-store";
import type {
  Attachment,
  ChatMessage,
  ChatMode,
  ModelId,
} from "@/lib/types/chat";

export type TurnInput =
  | { kind: "start" }
  | { kind: "text"; text: string }
  | { kind: "choice"; optionId: string };

export interface TurnParams {
  record: ConversationRecord;
  input: TurnInput;
  mode: ChatMode;
  model: ModelId;
  attachments?: Attachment[];
}

export interface TurnOutput {
  record: ConversationRecord;
  newMessages: ChatMessage[];
  meta: {
    provider: string;
    model: string;
    simulated: boolean;
    ragEngine?: string;
    webEngine?: string;
    interpretation?: string;
  };
}

export async function runTurn(params: TurnParams): Promise<TurnOutput> {
  const { record, input, mode, model } = params;

  const newMessages: ChatMessage[] = [];
  let userMessage: ChatMessage | null = null;

  if (input.kind === "text") {
    userMessage = {
      id: randomUUID(),
      role: "user",
      content: input.text,
      createdAt: new Date().toISOString(),
      mode,
      model,
      attachments: params.attachments,
    };
    newMessages.push(userMessage);
  }

  if (input.kind === "choice") {
    const options = buildOptions(
      record.state,
      record.client,
      record.state.currentNodeId
    );
    const chosen = options.find((option) => option.id === input.optionId);

    userMessage = {
      id: randomUUID(),
      role: "user",
      content: chosen?.label ?? input.optionId,
      createdAt: new Date().toISOString(),
      mode,
      model,
    };
    newMessages.push(userMessage);

    // Trava os botões da última pergunta respondida.
    const lastWithOptions = [...record.messages]
      .reverse()
      .find((message) => message.options?.length);
    if (lastWithOptions) lastWithOptions.chosenOptionId = input.optionId;
  }

  if (mode === "ask") {
    const answer = await answerQuestion({
      question: input.kind === "text" ? input.text : "Resumo da jornada atual",
      model,
      record,
      attachments: params.attachments,
    });
    newMessages.push(answer.message);
    return finalize(record, newMessages, answer.meta);
  }

  if (mode === "web") {
    const answer = await answerWebQuestion({
      question: input.kind === "text" ? input.text : "Resumo da jornada atual",
      model,
      record,
      attachments: params.attachments,
    });
    newMessages.push(answer.message);
    return finalize(record, newMessages, answer.meta);
  }

  if (mode === "plan") {
    const answer = await buildPlan({
      request: input.kind === "text" ? input.text : "Planejar a contratação",
      model,
      record,
    });
    newMessages.push(answer.message);
    return finalize(record, newMessages, answer.meta);
  }

  return runAgentTurn(params, newMessages);
}

// ---------------------------------------------------------------------------
// Modo Agent
// ---------------------------------------------------------------------------

async function runAgentTurn(
  params: TurnParams,
  newMessages: ChatMessage[]
): Promise<TurnOutput> {
  const { record, input, mode, model } = params;

  const meta: TurnOutput["meta"] = {
    provider: "simulado",
    model: "deterministico",
    simulated: true,
  };

  const currentNodeId = record.state.currentNodeId;
  const currentOptions = buildOptions(record.state, record.client, currentNodeId);

  let event: Parameters<typeof stepGraph>[0]["event"];

  if (input.kind === "start") {
    event = { type: "start" };
  } else if (input.kind === "choice") {
    event = { type: "choice", optionId: input.optionId };
  } else {
    // Pergunta no meio da jornada: responde pelo RAG e devolve as opções.
    const interpretation = await interpretChoice({
      text: input.text,
      options: currentOptions,
      nodeTitle: getNode(currentNodeId).title,
      question: lastAssistantQuestion(record) ?? getNode(currentNodeId).summary,
      model,
    });

    meta.interpretation = interpretation.optionId
      ? `${interpretation.source} → ${interpretation.optionId}`
      : `${interpretation.source} → ambíguo`;

    if (!interpretation.optionId && looksLikeQuestion(input.text)) {
      const answer = await answerQuestion({
        question: input.text,
        model,
        record,
        attachments: params.attachments,
      });

      answer.message.options = currentOptions;
      answer.message.nodeId = currentNodeId;
      answer.message.content = `${answer.message.content}\n\nVoltando à contratação: ${lastAssistantQuestion(record) ?? ""}`.trim();

      newMessages.push(answer.message);
      return finalize(record, newMessages, { ...meta, ...answer.meta });
    }

    event = {
      type: "input",
      text: input.text,
      resolvedOptionId: interpretation.optionId ?? undefined,
    };
  }

  const result = await stepGraph({
    state: record.state,
    client: record.client,
    event,
    effects: {
      async generateContract(state, client) {
        return generateContract(state, client);
      },
      async deliverContract(contract, client) {
        return deliverContractEmail(contract, client);
      },
    },
  });

  record.state = result.state;

  const naturalized = await naturalizeTurns({
    turns: result.turns,
    model,
    mode,
    record,
    userText: input.kind === "text" ? input.text : undefined,
  });

  meta.provider = naturalized.provider;
  meta.model = naturalized.model;
  meta.simulated = naturalized.simulated;

  newMessages.push(...naturalized.messages);
  return finalize(record, newMessages, meta);
}

/**
 * A engine produz o texto canônico. O modelo reescreve apenas o último turno,
 * e só assumimos a reescrita se todos os números do original sobreviverem.
 */
async function naturalizeTurns(params: {
  turns: EngineTurn[];
  model: ModelId;
  mode: ChatMode;
  record: ConversationRecord;
  userText?: string;
}) {
  const { turns, model, mode, record, userText } = params;

  const messages: ChatMessage[] = turns.map((turn) => ({
    id: randomUUID(),
    role: "assistant" as const,
    content: turn.text,
    createdAt: new Date().toISOString(),
    nodeId: turn.nodeId,
    mode,
    model,
    blocks: turn.blocks,
    options: turn.options,
  }));

  const last = messages.at(-1);
  if (!last || !isLlmConfigured(model) || process.env.LLM_NATURALIZE === "0") {
    return {
      messages,
      provider: "simulado",
      model: "deterministico",
      simulated: true,
    };
  }

  const optionList = (last.options ?? [])
    .map((option) => `- ${option.label}${option.badge ? ` (${option.badge})` : ""}`)
    .join("\n");

  const result = await complete({
    model,
    system: systemPromptFor("agent"),
    messages: [
      {
        role: "user",
        content: [
          `Cliente: ${record.client.fullName}.`,
          userText ? `Mensagem do cliente: """${userText}"""` : "",
          `Etapa do grafo: ${getNode(last.nodeId ?? "start").title}.`,
          optionList ? `Opções que a interface já vai exibir como botões:\n${optionList}` : "",
          "",
          "Texto canônico do passo:",
          `"""${last.content}"""`,
          "",
          "Reescreva o texto canônico de forma natural e cordial, em no máximo 3 frases.",
          "Preserve TODOS os números, percentuais, valores e nomes exatamente como aparecem.",
          "Não repita a lista de opções: ela já vira botões na interface.",
          "Responda apenas com o texto final, sem aspas e sem preâmbulo.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    temperature: 0.4,
    maxTokens: 320,
  });

  if (!result.simulated && result.text && preservesNumbers(last.content, result.text)) {
    last.content = result.text;
  }

  return {
    messages,
    provider: result.provider,
    model: result.model,
    simulated: result.simulated,
  };
}

/** Guarda-corpo: a reescrita precisa manter todos os números do texto original. */
function preservesNumbers(original: string, rewritten: string) {
  const digitsOf = (text: string) =>
    (text.match(/\d[\d.,]*/g) ?? []).map((value) =>
      value.replace(/[.,]$/, "").replace(/\./g, "")
    );

  const expected = new Set(digitsOf(original));
  if (expected.size === 0) return true;

  const present = new Set(digitsOf(rewritten));
  for (const value of expected) {
    if (!present.has(value)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Modo Ask (RAG)
// ---------------------------------------------------------------------------

async function answerQuestion(params: {
  question: string;
  model: ModelId;
  record: ConversationRecord;
  attachments?: Attachment[];
}) {
  const { question, model, record } = params;

  const rag = await searchKnowledge(question, 4);
  const context = formatCitationsForPrompt(rag.citations);

  const attachmentContext = (params.attachments ?? [])
    .filter((attachment) => attachment.excerpt)
    .map((attachment) => `Anexo "${attachment.name}":\n${attachment.excerpt}`)
    .join("\n\n");

  const result = await complete({
    model,
    system: systemPromptFor("ask"),
    messages: [
      {
        role: "user",
        content: [
          `Pergunta: ${question}`,
          "",
          "TRECHOS DA BASE DE CONHECIMENTO:",
          context,
          attachmentContext ? `\nANEXOS DO USUÁRIO:\n${attachmentContext}` : "",
          "",
          `Contexto da jornada atual: etapa "${getNode(record.state.currentNodeId).title}".`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    temperature: 0.2,
    maxTokens: 600,
  });

  const content = result.simulated
    ? buildExtractiveAnswer(question, rag.citations)
    : result.text;

  const message: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    mode: "ask",
    model,
    citations: rag.citations,
  };

  return {
    message,
    meta: {
      provider: result.provider,
      model: result.model,
      simulated: result.simulated,
      ragEngine: rag.engine,
    },
  };
}

// ---------------------------------------------------------------------------
// Modo Web (busca na internet)
// ---------------------------------------------------------------------------

async function answerWebQuestion(params: {
  question: string;
  model: ModelId;
  record: ConversationRecord;
  attachments?: Attachment[];
}) {
  const { question, model, record } = params;

  const attachmentContext = (params.attachments ?? [])
    .filter((attachment) => attachment.excerpt)
    .map((attachment) => `Anexo "${attachment.name}":\n${attachment.excerpt}`)
    .join("\n\n");

  // Sem Tavily/Serper: responde com o LLM e deixa claro que não houve busca web.
  if (!isWebSearchConfigured()) {
    if (!isLlmConfigured(model)) {
      const message: ChatMessage = {
        id: randomUUID(),
        role: "assistant",
        content: [
          "Para usar o modo **Web**, configure pelo menos uma destas chaves no `.env.local`:",
          "",
          "- `GROQ_API_KEY` — responde com o modelo (grátis, já recomendado)",
          "- `TAVILY_API_KEY` — [tavily.com](https://tavily.com) (busca real na web)",
          "- `SERPER_API_KEY` — [serper.dev](https://serper.dev) (Google Search API)",
          "",
          "O `GROQ_API_KEY` sozinho já permite respostas do modelo; para **fontes da internet**, adicione também `TAVILY_API_KEY`.",
          "",
          "Reinicie o servidor depois de salvar.",
        ].join("\n"),
        createdAt: new Date().toISOString(),
        mode: "web",
        model,
      };

      return {
        message,
        meta: {
          provider: "simulado",
          model: "deterministico",
          simulated: true,
          webEngine: "none",
        },
      };
    }

    const result = await complete({
      model,
      system: webLlmOnlyPrompt(),
      messages: [
        {
          role: "user",
          content: [
            `Pergunta: ${question}`,
            attachmentContext ? `\nANEXOS DO USUÁRIO:\n${attachmentContext}` : "",
            "",
            `Contexto da jornada atual: etapa "${getNode(record.state.currentNodeId).title}".`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      temperature: 0.4,
      maxTokens: 700,
    });

    const message: ChatMessage = {
      id: randomUUID(),
      role: "assistant",
      content: result.simulated
        ? formatLlmFailureMessage(result.error)
        : result.text,
      createdAt: new Date().toISOString(),
      mode: "web",
      model,
    };

    return {
      message,
      meta: {
        provider: result.provider,
        model: result.model,
        simulated: result.simulated,
        webEngine: "none",
      },
    };
  }

  const web = await searchWeb(question, 5);
  const context = formatWebResultsForPrompt(web.citations);

  const result = await complete({
    model,
    system: systemPromptFor("web"),
    messages: [
      {
        role: "user",
        content: [
          `Pergunta: ${question}`,
          "",
          "RESULTADOS DA BUSCA NA WEB:",
          context,
          attachmentContext ? `\nANEXOS DO USUÁRIO:\n${attachmentContext}` : "",
          "",
          `Contexto da jornada atual: etapa "${getNode(record.state.currentNodeId).title}".`,
          web.note ? `\nNota do retriever: ${web.note}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    temperature: 0.3,
    maxTokens: 700,
  });

  const content = result.simulated
    ? buildExtractiveWebAnswer(question, web.citations, web.note)
    : result.text;

  const message: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    mode: "web",
    model,
    citations: web.citations.length > 0 ? web.citations : undefined,
  };

  return {
    message,
    meta: {
      provider: result.provider,
      model: result.model,
      simulated: result.simulated,
      webEngine: web.engine,
    },
  };
}

function buildExtractiveWebAnswer(
  question: string,
  citations: { title: string; snippet: string; source: string; url?: string }[],
  note?: string
) {
  if (citations.length === 0) {
    return [
      `Não encontrei resultados na web sobre "${question}".`,
      note ? `\n${note}` : "",
      "",
      "Tente reformular a pergunta ou verifique se a chave de busca está válida.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const body = citations
    .slice(0, 3)
    .map((citation) => {
      const link = citation.url ?? citation.source;
      return `**${citation.title}**\n${link}\n\n${citation.snippet}`;
    })
    .join("\n\n---\n\n");

  return [
    "Nenhum provedor de LLM respondeu, então segue um resumo direto dos resultados da web:",
    "",
    body,
  ].join("\n");
}

/** Sem LLM, a resposta é extractiva: devolve os trechos recuperados. */
function buildExtractiveAnswer(
  question: string,
  citations: { title: string; snippet: string; source: string }[]
) {
  if (citations.length === 0) {
    return `Não encontrei nada na base de conhecimento sobre "${question}". Reformule a pergunta ou adicione um documento em \`knowledge-base/\`.`;
  }

  const body = citations
    .slice(0, 2)
    .map((citation) => `**${citation.title}**\n\n${citation.snippet}`)
    .join("\n\n---\n\n");

  return [
    "Nenhum provedor de LLM está configurado, então segue a resposta direto da base de conhecimento:",
    "",
    body,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Modo Plan
// ---------------------------------------------------------------------------

async function buildPlan(params: {
  request: string;
  model: ModelId;
  record: ConversationRecord;
}) {
  const { request, model, record } = params;

  const remaining = remainingSteps(record.state.currentNodeId);
  const steps = remaining.map(
    (node) => `**${node.title}** — ${node.summary}`
  );

  const result = await complete({
    model,
    system: systemPromptFor("plan"),
    messages: [
      {
        role: "user",
        content: [
          `Pedido do usuário: ${request}`,
          "",
          `Etapa atual: ${getNode(record.state.currentNodeId).title}`,
          "",
          "Etapas restantes do grafo de contratação:",
          ...remaining.map(
            (node, index) => `${index + 1}. ${node.title} — ${node.summary}`
          ),
          "",
          "Escreva uma introdução de no máximo 3 frases explicando o plano.",
          "Não repita a lista numerada: a interface já a exibe.",
        ].join("\n"),
      },
    ],
    temperature: 0.4,
    maxTokens: 320,
  });

  const intro = result.simulated
    ? `Modo Plan: nada será executado. ${MODE_CONFIG.plan.hint} A jornada a partir da etapa "${getNode(record.state.currentNodeId).title}" tem ${remaining.length} passos:`
    : result.text;

  const message: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: `${intro}\n\nTroque para o modo **Agent** quando quiser executar.`,
    createdAt: new Date().toISOString(),
    mode: "plan",
    model,
    blocks: [{ kind: "plan", steps }],
  };

  return {
    message,
    meta: {
      provider: result.provider,
      model: result.model,
      simulated: result.simulated,
    },
  };
}

/** Percurso "feliz" a partir do nó atual, ignorando exceções e retornos. */
function remainingSteps(fromNodeId: string) {
  const order = FINANCING_NODES.filter(
    (node) => !["denied", "cancelled"].includes(node.id)
  );

  const startIndex = order.findIndex((node) => node.id === fromNodeId);
  const slice = startIndex === -1 ? order : order.slice(startIndex);

  return slice.filter((node) => node.kind !== "start");
}

function lastAssistantQuestion(record: ConversationRecord) {
  return [...record.messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.options?.length)
    ?.content;
}

function finalize(
  record: ConversationRecord,
  newMessages: ChatMessage[],
  meta: TurnOutput["meta"]
): TurnOutput {
  record.messages = [...record.messages, ...newMessages];
  return { record, newMessages, meta };
}
