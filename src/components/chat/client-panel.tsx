"use client";

import { BadgeCheck, Briefcase, Mail, MapPin, Phone, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CLIENT_PRESETS } from "@/lib/mocks/client";
import { formatCpf, formatCurrency, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClientProfile } from "@/lib/types/financing";

/**
 * Cadastro pré-carregado: a jornada começa direto no chat, sem tela anterior.
 * Trocar o perfil reinicia a conversa e exercita outro ramo do grafo.
 */
export function ClientPanel({
  client,
  onSelectPreset,
  disabled,
}: {
  client: ClientProfile | null;
  onSelectPreset: (presetId: string) => void;
  disabled?: boolean;
}) {
  if (!client) {
    return (
      <div className="space-y-2 p-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const activePreset = CLIENT_PRESETS.find(
    (preset) => preset.profile.cpf === client.cpf
  );

  const scoreTone =
    client.creditScore >= 700
      ? "text-foreground"
      : client.creditScore >= 550
        ? "text-chart-3"
        : "text-destructive";

  return (
    <div className="space-y-4 p-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{client.fullName}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              CPF {formatCpf(client.cpf)}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
            <BadgeCheck className="size-2.5" aria-hidden />
            Verificado
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Score"
          value={String(client.creditScore)}
          className={scoreTone}
        />
        <Stat label="Relacionamento" value={`${client.relationshipYears} anos`} />
        <Stat label="Renda mensal" value={formatCurrency(client.monthlyIncome)} />
        <Stat label="Dívidas" value={formatCurrency(client.monthlyDebts)} />
      </div>

      <dl className="space-y-1.5">
        <Row icon={Mail} value={client.email} />
        <Row icon={Phone} value={formatPhone(client.phone)} />
        <Row icon={Briefcase} value={`${client.occupation} · ${client.employer}`} />
        <Row
          icon={MapPin}
          value={`${client.address.street}, ${client.address.city}/${client.address.state}`}
        />
        <Row
          icon={Wallet}
          value={`Capacidade de parcela: ${formatCurrency(client.monthlyIncome * 0.35)}`}
        />
      </dl>

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
          Trocar perfil e reiniciar a jornada
        </p>
        <div className="space-y-1.5">
          {CLIENT_PRESETS.map((preset) => {
            const isActive = preset.id === activePreset?.id;

            return (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onSelectPreset(preset.id)}
                className={cn(
                  "h-auto w-full flex-col items-start gap-0.5 px-2.5 py-2 text-left",
                  isActive && "border-foreground/40 bg-accent"
                )}
              >
                <span className="text-xs font-medium">{preset.label}</span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  {preset.hint}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-1.5">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={cn("mt-0.5 text-xs font-semibold tabular-nums", className)}>
        {value}
      </p>
    </div>
  );
}

function Row({
  icon: Icon,
  value,
}: {
  icon: typeof Mail;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-[11px] leading-relaxed text-muted-foreground">
        {value}
      </span>
    </div>
  );
}
