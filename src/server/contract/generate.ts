import { createHash, randomUUID } from "node:crypto";

import { PRODUCTS, buildSimulation } from "@/lib/graph/credit-policy";
import { formatCurrency, formatCpf, formatDate, formatRate } from "@/lib/format";
import { LENDER } from "@/lib/site-config";
import type { ConversationState } from "@/lib/types/chat";
import type { ClientProfile, Contract } from "@/lib/types/financing";

export function generateContract(
  state: ConversationState,
  client: ClientProfile
): Contract {
  const offer = state.offers.find(
    (item) => item.id === state.application.offerId
  );
  if (!offer) throw new Error("Nenhuma oferta selecionada para gerar contrato.");
  if (!state.assessment) throw new Error("Análise de crédito ausente.");

  const simulation =
    state.simulation ?? buildSimulation({ offer, application: state.application });

  const createdAt = new Date();
  const number = buildContractNumber(createdAt);
  const product = state.application.product ?? "pessoal";

  const clauses = buildClauses({
    client,
    simulation,
    productLabel: PRODUCTS[product].label,
    insurance: state.application.insurance === "com-prestamista",
  });

  const signatureHash = createHash("sha256")
    .update(
      JSON.stringify({
        number,
        cpf: client.cpf,
        simulation,
        createdAt: createdAt.toISOString(),
      })
    )
    .digest("hex");

  return {
    id: randomUUID(),
    number,
    createdAt: createdAt.toISOString(),
    client,
    product,
    simulation,
    insurance: state.application.insurance ?? "sem-prestamista",
    assessment: state.assessment,
    clauses,
    signatureHash,
  };
}

function buildContractNumber(date: Date) {
  const year = date.getFullYear();
  const serial = Math.floor(100000 + Math.random() * 899999);
  return `BS-${year}-${serial}`;
}

function buildClauses(params: {
  client: ClientProfile;
  simulation: Contract["simulation"];
  productLabel: string;
  insurance: boolean;
}) {
  const { client, simulation, productLabel, insurance } = params;

  const clauses = [
    {
      title: "Cláusula 1ª — Objeto",
      body: `O CREDOR concede ao DEVEDOR ${client.fullName}, inscrito no CPF ${formatCpf(client.cpf)}, um crédito na modalidade ${productLabel}, no valor principal de ${formatCurrency(simulation.financedAmount)}, destinado à finalidade declarada nesta contratação.`,
    },
    {
      title: "Cláusula 2ª — Condições financeiras",
      body: `Sobre o valor principal incide taxa de juros de ${formatRate(simulation.monthlyRate)} ao mês. O Custo Efetivo Total da operação é de ${formatRate(simulation.cetYearly)} ao ano, já considerando juros, tarifa de cadastro de ${formatCurrency(simulation.originationFee)}${insurance ? ", prêmio do seguro prestamista" : ""} e tributos aplicáveis.`,
    },
    {
      title: "Cláusula 3ª — Forma de pagamento",
      body: `O DEVEDOR pagará o crédito em ${simulation.termMonths} parcelas mensais e sucessivas de ${formatCurrency(simulation.installment)}, com o primeiro vencimento em ${formatDate(simulation.firstDueDate)} e os demais no dia ${simulation.dueDay} de cada mês subsequente. O total a pagar ao final do contrato é de ${formatCurrency(simulation.totalPayable)}.`,
    },
    {
      title: "Cláusula 4ª — Entrada",
      body:
        simulation.downPayment > 0
          ? `O DEVEDOR pagou, a título de entrada, o valor de ${formatCurrency(simulation.downPayment)} sobre o valor total de ${formatCurrency(simulation.assetValue)}, restando financiado o montante descrito na Cláusula 1ª.`
          : `A presente operação não contempla pagamento de entrada, sendo financiado o valor integral descrito na Cláusula 1ª.`,
    },
    {
      title: "Cláusula 5ª — Seguro prestamista",
      body: insurance
        ? `Fica contratado, por adesão facultativa e manifestação expressa do DEVEDOR, o seguro prestamista, com prêmio mensal de ${formatCurrency(simulation.insuranceMonthly)} já incluído no valor da parcela. A cobertura contempla morte por qualquer causa e invalidez permanente total por acidente, com quitação integral do saldo devedor.`
        : `O DEVEDOR foi informado sobre a disponibilidade do seguro prestamista e optou por não contratá-lo. A recusa não altera a taxa de juros nem qualquer outra condição desta operação.`,
    },
    {
      title: "Cláusula 6ª — Quitação antecipada",
      body: `É assegurado ao DEVEDOR o direito à liquidação antecipada, total ou parcial, do saldo devedor, com redução proporcional dos juros ainda não incorridos, sem cobrança de tarifa ou multa, nos termos da regulamentação vigente.`,
    },
    {
      title: "Cláusula 7ª — Direito de arrependimento",
      body: `Por se tratar de contratação realizada em canal digital, o DEVEDOR pode desistir desta operação em até 7 (sete) dias corridos contados desta data ou do recebimento do valor, o que ocorrer por último, sem qualquer ônus, mediante devolução integral dos valores eventualmente liberados.`,
    },
    {
      title: "Cláusula 8ª — Proteção de dados",
      body: `O tratamento dos dados pessoais do DEVEDOR observa a Lei 13.709/2018, tendo como bases legais a execução deste contrato e o legítimo interesse para a análise de risco de crédito. O titular pode solicitar acesso, correção, portabilidade e revisão de decisões automatizadas pelos canais oficiais do CREDOR.`,
    },
    {
      title: "Cláusula 9ª — Assinatura eletrônica",
      body: `As partes reconhecem a validade da assinatura eletrônica aposta a este instrumento, nos termos da MP 2.200-2/2001, sendo a integridade do documento garantida pelo hash registrado no momento da autorização.`,
    },
    {
      title: "Cláusula 10ª — Foro",
      body: `Fica eleito o foro da comarca de domicílio do DEVEDOR, ${client.address.city}/${client.address.state}, para dirimir eventuais controvérsias oriundas deste contrato.`,
    },
  ];

  return clauses;
}

export const LENDER_INFO = LENDER;
