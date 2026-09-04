"use client";

import { ExternalLink, FileText, Mail, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PRODUCTS } from "@/lib/graph/credit-policy";
import { formatCpf, formatCurrency, formatDate, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversationState } from "@/lib/types/chat";

export function ContractPanel({ state }: { state: ConversationState | null }) {
  const contract = state?.contract;
  const delivery = state?.delivery;

  if (!contract) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <FileText className="size-6 text-muted-foreground/50" aria-hidden />
        <p className="text-xs font-medium">Nenhum contrato emitido</p>
        <p className="max-w-52 text-[11px] leading-relaxed text-muted-foreground">
          Conclua a jornada no chat até a etapa de autorização. O contrato e o
          e-mail aparecem aqui.
        </p>
      </div>
    );
  }

  const { simulation, client } = contract;

  return (
    <div className="thin-scrollbar h-full space-y-4 overflow-y-auto p-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{contract.number}</p>
            <p className="text-[11px] text-muted-foreground">
              {PRODUCTS[contract.product].label} ·{" "}
              {formatDate(contract.createdAt)}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
            <ShieldCheck className="size-2.5" aria-hidden />
            Assinado
          </Badge>
        </div>
      </div>

      <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        <Row label="Titular" value={client.fullName} />
        <Row label="CPF" value={formatCpf(client.cpf)} />
        <Row label="Oferta" value={simulation.offerName} />
        <Row label="Financiado" value={formatCurrency(simulation.financedAmount)} />
        <Row label="Entrada" value={formatCurrency(simulation.downPayment)} />
        <Row label="Prazo" value={`${simulation.termMonths} parcelas`} />
        <Row label="Parcela" value={formatCurrency(simulation.installment)} />
        <Row label="Taxa" value={`${formatRate(simulation.monthlyRate)} a.m.`} />
        <Row label="CET" value={`${formatRate(simulation.cetYearly)} a.a.`} />
        <Row label="Total" value={formatCurrency(simulation.totalPayable)} />
      </dl>

      {delivery ? (
        <div className="rounded-lg border border-border bg-muted/30 p-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold">
            <Mail className="size-3 text-muted-foreground" aria-hidden />
            Cópia enviada por e-mail
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {delivery.to}
            <br />
            Transporte: {delivery.transport} ·{" "}
            {formatDate(delivery.sentAt)}
          </p>
          {delivery.previewUrl ? (
            <a
              href={delivery.previewUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-2 w-full gap-1.5"
              )}
            >
              <ExternalLink className="size-3" aria-hidden />
              Ver o e-mail recebido
            </a>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Cláusulas ({contract.clauses.length})
        </p>
        <div className="space-y-2">
          {contract.clauses.map((clause) => (
            <div
              key={clause.title}
              className="rounded-lg border border-border bg-card p-2.5"
            >
              <p className="text-[11px] font-semibold">{clause.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {clause.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-2.5">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Hash de integridade
        </p>
        <p className="mt-1 font-mono text-[10px] break-all">
          {contract.signatureHash}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-background px-2.5 py-1.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-[11px] font-medium">{value}</dd>
    </div>
  );
}
