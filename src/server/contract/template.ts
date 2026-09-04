import { PRODUCTS } from "@/lib/graph/credit-policy";
import { formatCpf, formatCurrency, formatDate, formatRate } from "@/lib/format";
import { LENDER } from "@/lib/site-config";
import type { Contract } from "@/lib/types/financing";

export function contractSubject(contract: Contract) {
  return `Sua via do contrato ${contract.number} — ${PRODUCTS[contract.product].label}`;
}

/** Corpo em HTML com estilos inline, para sobreviver a qualquer cliente de e-mail. */
export function contractHtml(contract: Contract) {
  const { simulation, client } = contract;

  const summaryRows: [string, string][] = [
    ["Contrato", contract.number],
    ["Produto", PRODUCTS[contract.product].label],
    ["Oferta", simulation.offerName],
    ["Valor do bem", formatCurrency(simulation.assetValue)],
    ["Entrada", formatCurrency(simulation.downPayment)],
    ["Valor financiado", formatCurrency(simulation.financedAmount)],
    ["Prazo", `${simulation.termMonths} parcelas`],
    ["Taxa de juros", `${formatRate(simulation.monthlyRate)} ao mês`],
    ["Parcela mensal", formatCurrency(simulation.installment)],
    [
      "Seguro prestamista",
      contract.insurance === "com-prestamista"
        ? `Incluso — ${formatCurrency(simulation.insuranceMonthly)} por mês`
        : "Não contratado",
    ],
    ["Tarifa de cadastro", formatCurrency(simulation.originationFee)],
    ["Total a pagar", formatCurrency(simulation.totalPayable)],
    ["CET", `${formatRate(simulation.cetYearly)} ao ano`],
    ["1º vencimento", formatDate(simulation.firstDueDate)],
  ];

  const rows = summaryRows
    .map(
      ([label, value], index) => `
        <tr style="background:${index % 2 === 0 ? "#fafafa" : "#ffffff"}">
          <td style="padding:10px 14px;color:#525252;font-size:13px;border-bottom:1px solid #ededed">${label}</td>
          <td style="padding:10px 14px;color:#171717;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #ededed">${value}</td>
        </tr>`
    )
    .join("");

  const clauses = contract.clauses
    .map(
      (clause) => `
        <div style="margin-bottom:18px">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#171717">${clause.title}</p>
          <p style="margin:0;font-size:13px;line-height:1.65;color:#404040">${clause.body}</p>
        </div>`
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${contractSubject(contract)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:14px;overflow:hidden">

      <div style="padding:28px 32px;background:#171717;color:#ffffff">
        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7">${LENDER.name}</p>
        <h1 style="margin:8px 0 0;font-size:22px;font-weight:700">Contrato ${contract.number}</h1>
        <p style="margin:8px 0 0;font-size:13px;opacity:.8">Emitido em ${formatDate(contract.createdAt)} · Assinado eletronicamente</p>
      </div>

      <div style="padding:28px 32px">
        <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#404040">
          Olá, <strong>${client.fullName}</strong>. Sua contratação foi concluída.
          Esta é a via integral do contrato, enviada conforme a obrigação de entrega
          de cópia ao consumidor.
        </p>

        <h2 style="margin:0 0 12px;font-size:15px;color:#171717">Resumo da operação</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #ededed;border-radius:8px;margin-bottom:28px">
          ${rows}
        </table>

        <h2 style="margin:0 0 6px;font-size:15px;color:#171717">Partes</h2>
        <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#404040">
          <strong>CREDOR:</strong> ${LENDER.name}, CNPJ ${LENDER.cnpj}, ${LENDER.address}.<br />
          <strong>DEVEDOR:</strong> ${client.fullName}, CPF ${formatCpf(client.cpf)},
          ${client.address.street}, ${client.address.city}/${client.address.state}, CEP ${client.address.zipCode}.
        </p>

        <h2 style="margin:0 0 14px;font-size:15px;color:#171717">Cláusulas</h2>
        ${clauses}

        <div style="margin-top:28px;padding:16px;background:#fafafa;border:1px solid #ededed;border-radius:10px">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#171717">Assinatura eletrônica</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#525252">
            Aceite registrado em ${formatDate(contract.createdAt)} por ${client.fullName} (CPF ${formatCpf(client.cpf)}).<br />
            Hash de integridade SHA-256:<br />
            <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;word-break:break-all;color:#171717">${contract.signatureHash}</code>
          </p>
        </div>

        <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#737373">
          Você pode desistir desta contratação em até 7 dias corridos, sem custo.
          Dúvidas: ${LENDER.supportEmail}.
        </p>
      </div>

      <div style="padding:16px 32px;background:#fafafa;border-top:1px solid #ededed">
        <p style="margin:0;font-size:11px;color:#a3a3a3">
          Documento gerado por uma aplicação de demonstração. Instituição, valores e
          cláusulas são fictícios e não possuem efeito jurídico.
        </p>
      </div>

    </div>
  </body>
</html>`;
}

/** Versão em texto puro, usada como alternativa multipart no e-mail. */
export function contractText(contract: Contract) {
  const { simulation, client } = contract;

  const lines = [
    `${LENDER.name}`,
    `CONTRATO ${contract.number}`,
    `Emitido em ${formatDate(contract.createdAt)}`,
    "",
    `Cliente: ${client.fullName} — CPF ${formatCpf(client.cpf)}`,
    `Produto: ${PRODUCTS[contract.product].label}`,
    `Oferta: ${simulation.offerName}`,
    "",
    "RESUMO DA OPERAÇÃO",
    `Valor do bem: ${formatCurrency(simulation.assetValue)}`,
    `Entrada: ${formatCurrency(simulation.downPayment)}`,
    `Valor financiado: ${formatCurrency(simulation.financedAmount)}`,
    `Prazo: ${simulation.termMonths} parcelas`,
    `Taxa: ${formatRate(simulation.monthlyRate)} ao mês`,
    `Parcela: ${formatCurrency(simulation.installment)}`,
    `Total a pagar: ${formatCurrency(simulation.totalPayable)}`,
    `CET: ${formatRate(simulation.cetYearly)} ao ano`,
    `1º vencimento: ${formatDate(simulation.firstDueDate)}`,
    "",
    "CLÁUSULAS",
    ...contract.clauses.flatMap((clause) => [clause.title, clause.body, ""]),
    `Hash de assinatura: ${contract.signatureHash}`,
    "",
    "Documento de demonstração, sem efeito jurídico.",
  ];

  return lines.join("\n");
}
