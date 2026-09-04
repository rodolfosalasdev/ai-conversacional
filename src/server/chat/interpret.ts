import { complete, extractJson, isLlmConfigured } from "@/server/llm";
import { interpretationPrompt } from "@/lib/prompts/system";
import type { BranchOption, ModelId } from "@/lib/types/chat";

export interface Interpretation {
  optionId: string | null;
  confidence: number;
  source: "heuristic" | "llm" | "none";
  reason?: string;
}

/** Palavras que identificam cada opção sem precisar de modelo. */
const KEYWORDS: Record<string, string[]> = {
  "product:veiculo": ["carro", "veiculo", "veículo", "moto", "automovel", "automóvel", "auto", "picape", "suv"],
  "product:imovel": ["imovel", "imóvel", "casa", "apartamento", "apto", "terreno", "imobiliario", "imobiliário"],
  "product:pessoal": ["pessoal", "livre", "reforma", "viagem", "sem garantia", "dinheiro na conta"],
  "product:consignado": ["consignado", "folha", "inss", "desconto em folha", "aposentado"],

  "remediation:entrada-maior": ["entrada maior", "aumentar entrada", "aumentar a entrada", "dar mais entrada", "mais entrada"],
  "remediation:avalista": ["avalista", "fiador", "garantidor", "co-devedor", "codevedor"],
  "remediation:valor-menor": ["valor menor", "reduzir valor", "financiar menos", "bem mais barato", "carro mais barato"],
  "remediation:desistir": ["desistir", "encerrar", "parar", "deixa pra la", "deixa pra lá"],

  "offer:taxa-plena": ["taxa plena", "menor taxa", "menor juros", "juros menor", "mais barata", "menor custo"],
  "offer:equilibrada": ["equilibrada", "equilibrado", "recomendada", "meio termo", "intermediaria", "intermediária", "balanceada"],
  "offer:parcela-leve": ["parcela leve", "menor parcela", "parcela menor", "parcela baixa", "mais leve"],

  "insurance:com-prestamista": ["com seguro", "quero o seguro", "quero seguro", "incluir seguro", "prestamista sim", "sim", "quero", "pode incluir", "inclui"],
  "insurance:sem-prestamista": ["sem seguro", "nao quero seguro", "não quero seguro", "dispenso", "nao", "não", "sem prestamista", "recuso"],

  "authorize:accept": ["autorizo", "autorizar", "confirmo", "confirmar", "pode emitir", "pode seguir", "aceito", "concordo", "fechado", "sim", "manda ver", "pode gerar"],
  "authorize:adjust": ["ajustar", "mudar", "alterar", "voltar", "rever", "trocar oferta", "outra oferta", "recalcular"],
  "authorize:cancel": ["cancelar", "desistir", "nao quero", "não quero", "para tudo", "encerrar"],
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Casamento determinístico entre o texto e as opções do nó atual.
 * Só devolve um vencedor quando ele é isolado — empate vira ambiguidade,
 * que é justamente o caso em que a UI mostra os botões.
 */
export function interpretHeuristically(
  text: string,
  options: BranchOption[]
): Interpretation {
  if (options.length === 0) return { optionId: null, confidence: 0, source: "none" };

  const normalized = normalize(text);
  const scores = new Map<string, number>();

  const bump = (optionId: string, amount: number) => {
    scores.set(optionId, (scores.get(optionId) ?? 0) + amount);
  };

  for (const option of options) {
    // Rótulo literal presente no texto é o sinal mais forte.
    const label = normalize(option.label);
    if (normalized.includes(label)) bump(option.id, 3);

    for (const keyword of KEYWORDS[option.id] ?? []) {
      const normalizedKeyword = normalize(keyword);
      if (!normalized.includes(normalizedKeyword)) continue;
      // Palavras muito curtas ("sim", "nao") valem menos para evitar falso positivo.
      bump(option.id, normalizedKeyword.length <= 3 ? 1 : 2.5);
    }

    // Opções numéricas: prazo, dia de vencimento, valor e percentual de entrada.
    const [kind, rawValue] = option.id.split(":");
    if (["term", "dueday", "assetvalue", "downpayment"].includes(kind)) {
      const numbers = normalized.match(/\d+(?:[.,]\d+)?/g) ?? [];
      const target = Number(rawValue);
      for (const candidate of numbers) {
        const value = Number(candidate.replace(/\./g, "").replace(",", "."));
        if (value === target) bump(option.id, 3);
        if (kind === "assetvalue" && Math.abs(value * 1000 - target) < 1) {
          bump(option.id, 3);
        }
      }
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    return { optionId: null, confidence: 0, source: "none" };
  }

  const [bestId, bestScore] = ranked[0];
  const runnerUp = ranked[1]?.[1] ?? 0;

  if (bestScore >= 2.5 && bestScore > runnerUp) {
    return {
      optionId: bestId,
      confidence: Math.min(0.95, 0.6 + (bestScore - runnerUp) / 10),
      source: "heuristic",
    };
  }

  return {
    optionId: null,
    confidence: 0,
    source: "none",
    reason:
      ranked.length > 1 && bestScore === runnerUp
        ? "A resposta casou com mais de uma opção."
        : "Nenhuma opção casou com confiança suficiente.",
  };
}

/** Heurística primeiro (grátis e instantânea); modelo apenas no caso duvidoso. */
export async function interpretChoice(params: {
  text: string;
  options: BranchOption[];
  nodeTitle: string;
  question: string;
  model: ModelId;
}): Promise<Interpretation> {
  const heuristic = interpretHeuristically(params.text, params.options);
  if (heuristic.optionId) return heuristic;

  if (params.options.length === 0 || !isLlmConfigured(params.model)) {
    return heuristic;
  }

  const result = await complete({
    model: params.model,
    system:
      "Você é um classificador de intenção. Responda apenas com JSON válido, sem comentários.",
    messages: [
      {
        role: "user",
        content: interpretationPrompt({
          nodeTitle: params.nodeTitle,
          question: params.question,
          options: params.options,
          userText: params.text,
        }),
      },
    ],
    temperature: 0,
    maxTokens: 200,
    json: true,
  });

  if (result.simulated) return heuristic;

  const parsed = extractJson<{
    optionId: string | null;
    confidence: number;
    reason?: string;
  }>(result.text);

  if (!parsed?.optionId) return heuristic;

  const isValid = params.options.some((option) => option.id === parsed.optionId);
  if (!isValid) return heuristic;
  if ((parsed.confidence ?? 0) < 0.55) return heuristic;

  return {
    optionId: parsed.optionId,
    confidence: parsed.confidence ?? 0.7,
    source: "llm",
    reason: parsed.reason,
  };
}

/** Distingue uma pergunta ("quanto custa o seguro?") de uma escolha. */
export function looksLikeQuestion(text: string) {
  const normalized = normalize(text);
  if (normalized.includes("?")) return true;

  return /^(o que|oque|qual|quais|quanto|quantos|como|por que|porque|pq|quando|onde|existe|tem como|vale a pena|me explica|explica|explique|posso)\b/.test(
    normalized
  );
}
