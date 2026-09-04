"use client";

import {
  BadgeCheck,
  CircleAlert,
  FileText,
  ListChecks,
  Mail,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MessageBlock } from "@/lib/types/chat";

export function MessageBlocks({ blocks }: { blocks: MessageBlock[] }) {
  return (
    <div className="mt-3 space-y-3">
      {blocks.map((block, index) => (
        <BlockRenderer key={index} block={block} />
      ))}
    </div>
  );
}

function BlockRenderer({ block }: { block: MessageBlock }) {
  switch (block.kind) {
    case "assessment": {
      const { assessment } = block;
      const tone =
        assessment.status === "approved"
          ? "border-border bg-card"
          : assessment.status === "conditional"
            ? "border-chart-3/40 bg-muted/40"
            : "border-destructive/40 bg-destructive/5";

      const Icon =
        assessment.status === "approved"
          ? BadgeCheck
          : assessment.status === "conditional"
            ? CircleAlert
            : CircleAlert;

      return (
        <Panel className={tone}>
          <PanelHeader
            icon={<Icon className="size-3.5" aria-hidden />}
            title="Resultado da análise de crédito"
            trailing={
              <Badge
                variant={
                  assessment.status === "denied" ? "destructive" : "secondary"
                }
                className="text-[10px] uppercase"
              >
                {assessment.status === "approved"
                  ? "Aprovado"
                  : assessment.status === "conditional"
                    ? "Condicional"
                    : "Negado"}
              </Badge>
            }
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Score" value={String(assessment.score)} />
            <Metric
              label="Renda livre"
              value={formatCurrency(assessment.disposableIncome)}
            />
            <Metric
              label="Parcela máxima"
              value={formatCurrency(assessment.maxInstallment)}
            />
            <Metric
              label="Comprometimento"
              value={`${(assessment.debtToIncome * 100).toFixed(1)}%`}
            />
          </div>

          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Score ${assessment.score} de 1000`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                assessment.status === "denied"
                  ? "bg-destructive"
                  : "bg-foreground"
              )}
              style={{
                width: `${Math.min((assessment.score / 1000) * 100, 100)}%`,
              }}
            />
          </div>

          <ul className="mt-3 space-y-1.5">
            {assessment.reasons.map((reason, index) => (
              <li
                key={index}
                className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                {reason}
              </li>
            ))}
          </ul>
        </Panel>
      );
    }

    case "simulation": {
      const { simulation } = block;
      return (
        <Panel>
          <PanelHeader
            icon={<TrendingUp className="size-3.5" aria-hidden />}
            title={`Simulação — ${simulation.offerName}`}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              label="Parcela"
              value={formatCurrency(simulation.installment)}
              emphasis
            />
            <Metric label="Prazo" value={`${simulation.termMonths}x`} />
            <Metric
              label="Financiado"
              value={formatCurrency(simulation.financedAmount)}
            />
            <Metric
              label="CET"
              value={`${formatRate(simulation.cetYearly)} a.a.`}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Total a pagar de {formatCurrency(simulation.totalPayable)}, sendo{" "}
            {formatCurrency(simulation.totalInterest)} de juros. Primeiro
            vencimento em {formatDate(simulation.firstDueDate)}.
          </p>
        </Panel>
      );
    }

    case "summary":
      return (
        <Panel>
          <PanelHeader
            icon={<ListChecks className="size-3.5" aria-hidden />}
            title="Conferência da proposta"
          />
          <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {block.rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 bg-background px-3 py-1.5"
              >
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="text-xs font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      );

    case "contract":
      return (
        <Panel>
          <PanelHeader
            icon={<FileText className="size-3.5" aria-hidden />}
            title={`Contrato ${block.contract.number}`}
            trailing={
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <ShieldCheck className="size-2.5" aria-hidden />
                Assinado
              </Badge>
            }
          />
          <p className="text-xs text-muted-foreground">
            {block.contract.clauses.length} cláusulas · emitido em{" "}
            {formatDate(block.contract.createdAt)}
          </p>
          <p className="mt-2 font-mono text-[10px] break-all text-muted-foreground">
            SHA-256 {block.contract.signatureHash}
          </p>
        </Panel>
      );

    case "delivery":
      return (
        <Panel>
          <PanelHeader
            icon={<Mail className="size-3.5" aria-hidden />}
            title="Cópia enviada"
            trailing={
              <Badge variant="secondary" className="text-[10px] uppercase">
                {block.delivery.transport}
              </Badge>
            }
          />
          <p className="text-xs text-muted-foreground">
            {block.delivery.subject}
            <br />
            Para {block.delivery.to} em {formatDate(block.delivery.sentAt)}.
          </p>
          {block.delivery.previewUrl ? (
            <a
              href={block.delivery.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4 hover:text-foreground"
            >
              <Mail className="size-3" aria-hidden />
              Abrir o e-mail recebido
            </a>
          ) : null}
        </Panel>
      );

    case "plan":
      return (
        <Panel>
          <PanelHeader
            icon={<ListChecks className="size-3.5" aria-hidden />}
            title="Plano de execução"
          />
          <ol className="space-y-1.5">
            {block.steps.map((step, index) => (
              <li key={index} className="flex gap-2.5 text-xs leading-relaxed">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px]">
                  {index + 1}
                </span>
                <span
                  className="text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: step.replace(
                      /\*\*(.+?)\*\*/g,
                      "<strong>$1</strong>"
                    ),
                  }}
                />
              </li>
            ))}
          </ol>
        </Panel>
      );

    default:
      return null;
  }
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/30 p-3",
        className
      )}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  icon,
  title,
  trailing,
}: {
  icon: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      {trailing}
    </div>
  );
}

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-medium tabular-nums",
          emphasis ? "text-sm" : "text-xs"
        )}
      >
        {value}
      </p>
    </div>
  );
}
