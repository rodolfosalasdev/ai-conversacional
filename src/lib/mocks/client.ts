import type { ClientProfile } from "@/lib/types/financing";

/**
 * Cliente pré-carregado: a jornada começa direto no chat, sem tela de cadastro.
 * Estes números alimentam a análise de crédito do grafo.
 */
export const DEFAULT_CLIENT: ClientProfile = {
  fullName: "Rodolfo Salas de Almeida",
  cpf: "31245678909",
  birthDate: "1990-04-18",
  email: "rodolfo.salas@exemplo.com.br",
  phone: "11987654321",
  occupation: "Engenheiro de Software Sênior",
  employer: "Salas Tecnologia Ltda.",
  monthlyIncome: 18500,
  monthlyDebts: 2400,
  creditScore: 812,
  relationshipYears: 6,
  address: {
    street: "Rua das Palmeiras, 245 — Apto 82",
    city: "São Paulo",
    state: "SP",
    zipCode: "01415-002",
  },
};

/** Perfis alternativos para testar os ramos condicional e negado do grafo. */
export const CLIENT_PRESETS: { id: string; label: string; hint: string; profile: ClientProfile }[] =
  [
    {
      id: "premium",
      label: "Perfil aprovado",
      hint: "Score 812 · renda alta · aprovação direta",
      profile: DEFAULT_CLIENT,
    },
    {
      id: "conditional",
      label: "Perfil condicional",
      hint: "Score 612 · endividamento alto · exige remediação",
      profile: {
        ...DEFAULT_CLIENT,
        fullName: "Marina Torres Vasconcelos",
        cpf: "84512309911",
        email: "marina.torres@exemplo.com.br",
        occupation: "Analista de Marketing Pleno",
        employer: "Agência Norte Comunicação",
        monthlyIncome: 6200,
        monthlyDebts: 2650,
        creditScore: 612,
        relationshipYears: 2,
      },
    },
    {
      id: "denied",
      label: "Perfil negado",
      hint: "Score 452 · comprometimento acima da política",
      profile: {
        ...DEFAULT_CLIENT,
        fullName: "Caio Bezerra Lima",
        cpf: "70233451188",
        email: "caio.lima@exemplo.com.br",
        occupation: "Autônomo",
        employer: "Sem vínculo formal",
        monthlyIncome: 3100,
        monthlyDebts: 2200,
        creditScore: 452,
        relationshipYears: 1,
      },
    },
  ];
