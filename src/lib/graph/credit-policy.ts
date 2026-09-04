import type {
  ClientProfile,
  CreditAssessment,
  FinancingApplication,
  Offer,
  ProductId,
  Simulation,
} from "@/lib/types/financing";

export const PRODUCTS: Record<
  ProductId,
  {
    label: string;
    description: string;
    /** Percentual mínimo de entrada exigido para o produto. */
    minDownPaymentRate: number;
    maxTermMonths: number;
    baseRate: number;
    assetLabel: string;
  }
> = {
  veiculo: {
    label: "Financiamento de veículo",
    description: "Carro ou moto, novo ou seminovo, com alienação fiduciária.",
    minDownPaymentRate: 0.2,
    maxTermMonths: 60,
    baseRate: 0.0159,
    assetLabel: "veículo",
  },
  imovel: {
    label: "Financiamento imobiliário",
    description: "Imóvel residencial com garantia de alienação fiduciária.",
    minDownPaymentRate: 0.2,
    maxTermMonths: 360,
    baseRate: 0.0092,
    assetLabel: "imóvel",
  },
  pessoal: {
    label: "Crédito pessoal",
    description: "Sem garantia, liberação rápida e uso livre do recurso.",
    minDownPaymentRate: 0,
    maxTermMonths: 48,
    baseRate: 0.0289,
    assetLabel: "projeto",
  },
  consignado: {
    label: "Crédito consignado",
    description: "Parcela descontada em folha, com a menor taxa da casa.",
    minDownPaymentRate: 0,
    maxTermMonths: 84,
    baseRate: 0.0134,
    assetLabel: "crédito",
  },
};

/** Teto de comprometimento de renda aceito pela política de crédito. */
const MAX_DEBT_TO_INCOME = 0.35;
const INSURANCE_RATE_PER_MONTH = 0.00035;

export function assessCredit(
  client: ClientProfile,
  application: FinancingApplication
): CreditAssessment {
  const maxInstallment = client.monthlyIncome * MAX_DEBT_TO_INCOME;
  const disposableIncome = client.monthlyIncome - client.monthlyDebts;
  const debtToIncome = client.monthlyDebts / client.monthlyIncome;

  const reasons: string[] = [];
  let status: CreditAssessment["status"] = "approved";
  let requiredDownPaymentRate = application.product
    ? PRODUCTS[application.product].minDownPaymentRate
    : 0.2;

  if (client.creditScore >= 700) {
    reasons.push(
      `Score ${client.creditScore} na faixa A — histórico de pagamentos sem restrições.`
    );
  } else if (client.creditScore >= 550) {
    status = "conditional";
    reasons.push(
      `Score ${client.creditScore} na faixa B — aprovação sujeita a reforço de garantia.`
    );
    requiredDownPaymentRate += 0.1;
  } else {
    status = "denied";
    reasons.push(
      `Score ${client.creditScore} abaixo do mínimo de 550 exigido pela política.`
    );
  }

  if (debtToIncome > MAX_DEBT_TO_INCOME) {
    if (status === "approved") status = "conditional";
    reasons.push(
      `Comprometimento atual de ${(debtToIncome * 100).toFixed(1)}% da renda, acima do limite de ${(MAX_DEBT_TO_INCOME * 100).toFixed(0)}%.`
    );
  } else {
    reasons.push(
      `Comprometimento atual de ${(debtToIncome * 100).toFixed(1)}% da renda, dentro do limite.`
    );
  }

  if (client.relationshipYears >= 3 && status !== "denied") {
    reasons.push(
      `Relacionamento de ${client.relationshipYears} anos garante desconto de relacionamento na taxa.`
    );
  }

  // Remediações escolhidas pelo usuário reabilitam um caso condicional.
  if (status === "conditional" && application.remediations.length > 0) {
    if (
      application.remediations.includes("avalista") ||
      application.remediations.includes("entrada-maior") ||
      application.remediations.includes("valor-menor")
    ) {
      status = "approved";
      reasons.push(
        "Restrição resolvida com a remediação escolhida — crédito reaprovado."
      );
    }
  }

  return {
    score: client.creditScore,
    disposableIncome,
    maxInstallment,
    debtToIncome,
    status,
    reasons,
    requiredDownPaymentRate,
  };
}

export function buildOffers(
  client: ClientProfile,
  application: FinancingApplication,
  assessment: CreditAssessment
): Offer[] {
  const product = application.product ?? "pessoal";
  const config = PRODUCTS[product];

  const relationshipDiscount = client.relationshipYears >= 3 ? 0.0012 : 0;
  const scoreDiscount = client.creditScore >= 750 ? 0.0018 : 0;
  const riskPremium = assessment.status === "conditional" ? 0.0045 : 0;

  const baseRate =
    config.baseRate - relationshipDiscount - scoreDiscount + riskPremium;

  const offers: Offer[] = [
    {
      id: "taxa-plena",
      name: "Taxa Plena",
      description:
        "Menor taxa do portfólio em troca de entrada maior e prazo curto.",
      monthlyRate: Number((baseRate - 0.0015).toFixed(5)),
      maxTermMonths: Math.min(config.maxTermMonths, 36),
      minDownPaymentRate: config.minDownPaymentRate + 0.1,
      originationFee: 690,
      highlights: [
        "Menor custo total de juros",
        "Sem tarifa de liquidação antecipada",
      ],
    },
    {
      id: "equilibrada",
      name: "Equilibrada",
      description:
        "Relação recomendada entre parcela cabível no bolso e custo total.",
      monthlyRate: Number(baseRate.toFixed(5)),
      maxTermMonths: config.maxTermMonths,
      minDownPaymentRate: config.minDownPaymentRate,
      originationFee: 890,
      highlights: [
        "Prazo flexível até o limite do produto",
        "Permite carência de 30 dias na 1ª parcela",
      ],
      recommended: true,
    },
    {
      id: "parcela-leve",
      name: "Parcela Leve",
      description:
        "Prazo estendido para reduzir a parcela mensal ao máximo possível.",
      monthlyRate: Number((baseRate + 0.0021).toFixed(5)),
      maxTermMonths: config.maxTermMonths,
      minDownPaymentRate: Math.max(config.minDownPaymentRate - 0.05, 0),
      originationFee: 1190,
      highlights: [
        "Menor parcela mensal",
        "Entrada reduzida frente às demais ofertas",
      ],
    },
  ];

  return offers;
}

/** Parcela pela Tabela Price. */
export function priceInstallment(
  principal: number,
  monthlyRate: number,
  months: number
) {
  if (months <= 0) return 0;
  if (monthlyRate <= 0) return principal / months;

  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function availableTerms(offer: Offer, product: ProductId): number[] {
  const candidates =
    product === "imovel"
      ? [120, 180, 240, 300, 360]
      : [12, 24, 36, 48, 60, 72, 84];

  return candidates.filter((term) => term <= offer.maxTermMonths);
}

export function buildSimulation(params: {
  offer: Offer;
  application: FinancingApplication;
}): Simulation {
  const { offer, application } = params;

  const assetValue = application.assetValue ?? 0;
  const downPayment = application.downPayment ?? 0;
  const termMonths = application.termMonths ?? offer.maxTermMonths;
  const financedAmount = Math.max(assetValue - downPayment, 0);

  const baseInstallment = priceInstallment(
    financedAmount + offer.originationFee,
    offer.monthlyRate,
    termMonths
  );

  const insuranceMonthly =
    application.insurance === "com-prestamista"
      ? financedAmount * INSURANCE_RATE_PER_MONTH
      : 0;

  const installment = baseInstallment + insuranceMonthly;
  const totalPayable = installment * termMonths;
  const totalInterest = totalPayable - financedAmount - offer.originationFee;

  // CET anual aproximado a partir da taxa mensal efetiva paga sobre o principal.
  const effectiveMonthlyRate = solveMonthlyRate(
    financedAmount,
    installment,
    termMonths
  );
  const cetYearly = Math.pow(1 + effectiveMonthlyRate, 12) - 1;

  const dueDay = application.dueDay ?? 10;
  const firstDueDate = nextDueDate(dueDay);

  return {
    offerId: offer.id,
    offerName: offer.name,
    assetValue,
    downPayment,
    financedAmount,
    termMonths,
    monthlyRate: offer.monthlyRate,
    installment,
    totalPayable,
    totalInterest,
    originationFee: offer.originationFee,
    insuranceMonthly,
    cetYearly,
    firstDueDate,
    dueDay,
  };
}

/** Bissecção para achar a taxa mensal que iguala parcela e principal. */
function solveMonthlyRate(
  principal: number,
  installment: number,
  months: number
) {
  if (principal <= 0 || installment <= 0 || months <= 0) return 0;

  let low = 0;
  let high = 1;

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const value = priceInstallment(principal, mid, months);
    if (value > installment) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return (low + high) / 2;
}

function nextDueDate(dueDay: number) {
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
  return due.toISOString();
}
