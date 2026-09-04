/** Produtos de crédito disponíveis na jornada mockada. */
export type ProductId = "veiculo" | "imovel" | "pessoal" | "consignado";

export type InsuranceChoice = "com-prestamista" | "sem-prestamista";

export interface ClientProfile {
  fullName: string;
  cpf: string;
  birthDate: string;
  email: string;
  phone: string;
  occupation: string;
  employer: string;
  monthlyIncome: number;
  /** Comprometimento mensal já existente (outras dívidas). */
  monthlyDebts: number;
  creditScore: number;
  relationshipYears: number;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface CreditAssessment {
  score: number;
  /** Renda livre depois de descontar dívidas existentes. */
  disposableIncome: number;
  /** Teto de parcela aceito pela política (30% da renda bruta). */
  maxInstallment: number;
  debtToIncome: number;
  status: "approved" | "conditional" | "denied";
  reasons: string[];
  /** Percentual mínimo de entrada exigido pela política. */
  requiredDownPaymentRate: number;
}

export interface Offer {
  id: string;
  name: string;
  description: string;
  /** Taxa mensal em fração: 0.0149 = 1,49% a.m. */
  monthlyRate: number;
  maxTermMonths: number;
  minDownPaymentRate: number;
  /** Tarifa de cadastro cobrada uma única vez. */
  originationFee: number;
  highlights: string[];
  recommended?: boolean;
}

export interface Simulation {
  offerId: string;
  offerName: string;
  assetValue: number;
  downPayment: number;
  financedAmount: number;
  termMonths: number;
  monthlyRate: number;
  installment: number;
  totalPayable: number;
  totalInterest: number;
  originationFee: number;
  insuranceMonthly: number;
  /** Custo Efetivo Total anual, em fração. */
  cetYearly: number;
  firstDueDate: string;
  dueDay: number;
}

export interface FinancingApplication {
  product?: ProductId;
  assetValue?: number;
  downPayment?: number;
  termMonths?: number;
  offerId?: string;
  insurance?: InsuranceChoice;
  dueDay?: number;
  assetDescription?: string;
  /** Remediações aplicadas quando a análise volta condicional. */
  remediations: string[];
  guarantorName?: string;
}

export interface Contract {
  id: string;
  number: string;
  createdAt: string;
  client: ClientProfile;
  product: ProductId;
  simulation: Simulation;
  insurance: InsuranceChoice;
  assessment: CreditAssessment;
  clauses: { title: string; body: string }[];
  /** Hash simbólico da "assinatura eletrônica" do aceite. */
  signatureHash: string;
}

export interface EmailDelivery {
  id: string;
  to: string;
  subject: string;
  sentAt: string;
  /** "resend" | "smtp" | "preview" — como a mensagem saiu. */
  transport: string;
  previewUrl?: string;
}
