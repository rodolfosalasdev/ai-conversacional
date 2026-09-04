import type { ChatMode } from "@/lib/types/chat";

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: "Iniciar jornada" | "Simular" | "Entender" | "Documentos" | "Web";
  /** Modo sugerido ao aplicar o prompt. */
  mode: ChatMode;
}

/**
 * Biblioteca de prompts para iniciar a jornada de contratação sem digitar do zero.
 * Clicar em um item preenche o composer (e troca o modo, quando faz sentido).
 */
export const PROMPT_LIBRARY: PromptTemplate[] = [
  {
    id: "start-vehicle",
    title: "Financiar um carro",
    description: "Abre a jornada de veículo já com valor e entrada.",
    prompt:
      "Quero financiar um carro seminovo de R$ 92.000 dando R$ 25.000 de entrada. Me mostre as condições disponíveis.",
    category: "Iniciar jornada",
    mode: "agent",
  },
  {
    id: "start-property",
    title: "Financiar um imóvel",
    description: "Jornada imobiliária com prazo longo.",
    prompt:
      "Preciso de financiamento imobiliário para um apartamento de R$ 620 mil, tenho R$ 150 mil de entrada.",
    category: "Iniciar jornada",
    mode: "agent",
  },
  {
    id: "start-personal",
    title: "Crédito pessoal rápido",
    description: "Produto sem garantia, liberação imediata.",
    prompt:
      "Quero um crédito pessoal de R$ 30 mil para reformar minha casa, com a menor parcela possível.",
    category: "Iniciar jornada",
    mode: "agent",
  },
  {
    id: "start-payroll",
    title: "Consignado com a menor taxa",
    description: "Desconto em folha e taxa reduzida.",
    prompt:
      "Sou CLT e quero simular um consignado de R$ 40 mil no maior prazo possível.",
    category: "Iniciar jornada",
    mode: "agent",
  },
  {
    id: "compare-terms",
    title: "Comparar prazos",
    description: "Pede o trade-off entre parcela e custo total.",
    prompt:
      "Compare o custo total entre 36, 48 e 60 parcelas e me diga qual compensa mais.",
    category: "Simular",
    mode: "ask",
  },
  {
    id: "lowest-installment",
    title: "Menor parcela possível",
    description: "Otimiza a simulação pelo caixa mensal.",
    prompt:
      "Qual combinação de oferta, prazo e entrada me dá a menor parcela mensal sem estourar a política de crédito?",
    category: "Simular",
    mode: "plan",
  },
  {
    id: "explain-cet",
    title: "O que é o CET?",
    description: "Consulta à base de conhecimento via RAG.",
    prompt:
      "O que entra no cálculo do CET e por que ele é maior que a taxa de juros nominal?",
    category: "Entender",
    mode: "ask",
  },
  {
    id: "explain-insurance",
    title: "Vale a pena o prestamista?",
    description: "Explica a cobertura e o impacto na parcela.",
    prompt:
      "Explique o que o seguro prestamista cobre e em que situação ele não vale a pena.",
    category: "Entender",
    mode: "ask",
  },
  {
    id: "explain-denied",
    title: "Por que uma proposta é negada?",
    description: "Política de crédito e critérios de score.",
    prompt:
      "Quais critérios levam uma proposta a ser negada e o que posso fazer para reverter?",
    category: "Entender",
    mode: "ask",
  },
  {
    id: "plan-journey",
    title: "Planejar a contratação",
    description: "Modo plan: passos antes de executar.",
    prompt:
      "Antes de contratar, me mostre o passo a passo completo da jornada e quais decisões eu vou precisar tomar.",
    category: "Iniciar jornada",
    mode: "plan",
  },
  {
    id: "required-docs",
    title: "Documentos necessários",
    description: "Lista da base de conhecimento.",
    prompt:
      "Quais documentos eu preciso enviar para um financiamento de veículo?",
    category: "Documentos",
    mode: "ask",
  },
  {
    id: "early-payoff",
    title: "Quitação antecipada",
    description: "Regras de desconto de juros futuros.",
    prompt:
      "Como funciona a quitação antecipada e qual desconto eu teria ao pagar tudo no 12º mês?",
    category: "Documentos",
    mode: "ask",
  },
  {
    id: "web-selic",
    title: "Taxa Selic hoje",
    description: "Busca informação atualizada na web.",
    prompt: "Qual é a taxa Selic atual e quando foi a última reunião do Copom?",
    category: "Web",
    mode: "web",
  },
  {
    id: "web-compare-banks",
    title: "Comparar bancos",
    description: "Pesquisa condições de mercado na internet.",
    prompt:
      "Quais bancos estão oferecendo as menores taxas de financiamento de veículo no Brasil hoje?",
    category: "Web",
    mode: "web",
  },
  {
    id: "web-fgts",
    title: "FGTS para imóvel",
    description: "Regras atualizadas via busca web.",
    prompt:
      "Quais são as regras atuais para usar o FGTS na compra do primeiro imóvel?",
    category: "Web",
    mode: "web",
  },
];

export const PROMPT_CATEGORIES = [
  "Iniciar jornada",
  "Simular",
  "Entender",
  "Documentos",
  "Web",
] as const;
