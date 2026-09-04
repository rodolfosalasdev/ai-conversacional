const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

/** Recebe a taxa em fração (0.0189) e devolve "1,89%". */
export function formatRate(rate: number) {
  return `${percentFormatter.format(rate * 100)}%`;
}

export function formatDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return dateFormatter.format(date);
}

export function formatCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "").padStart(11, "0").slice(0, 11);
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

/**
 * Lê valores escritos em linguagem natural: "80 mil", "R$ 1.200,50", "45k".
 * Retorna null quando não encontra um número plausível.
 */
export function parseCurrencyFromText(text: string): number | null {
  const normalized = text.toLowerCase().replace(/r\$/g, " ");

  const match = normalized.match(
    /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(mil|k|milhão|milhoes|milhões|mi)?/
  );
  if (!match) return null;

  const raw = match[1];
  const suffix = match[2];

  // "1.200,50" -> 1200.50 | "1200.50" -> 1200.50
  let numeric: number;
  if (raw.includes(",")) {
    numeric = Number(raw.replace(/\./g, "").replace(",", "."));
  } else if (/\.\d{3}\b/.test(raw)) {
    numeric = Number(raw.replace(/\./g, ""));
  } else {
    numeric = Number(raw);
  }

  if (!Number.isFinite(numeric)) return null;

  if (suffix === "mil" || suffix === "k") numeric *= 1_000;
  if (suffix && ["milhão", "milhoes", "milhões", "mi"].includes(suffix)) {
    numeric *= 1_000_000;
  }

  return numeric;
}

export function parseMonthsFromText(text: string): number | null {
  const match = text
    .toLowerCase()
    .match(/(\d{1,3})\s*(x|vezes|meses|mes|parcelas|prestações|prestacoes)/);
  if (match) return Number(match[1]);

  const years = text.toLowerCase().match(/(\d{1,2})\s*(anos?)/);
  if (years) return Number(years[1]) * 12;

  return null;
}
