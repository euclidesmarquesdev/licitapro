export interface LicitacaoChecklistItem {
  id: string;
  name: string;
  status: "pendente" | "preparando" | "validado" | "documento_pronto" | "rejeitado";
  obs?: string;
  updatedAt: string;
}

export interface SupplierContact {
  id: string;
  name: string;
  product: string;
  value: number;
  contact: string; // Phone or Email
  status: "aguardando" | "cotado" | "sem_estoque" | "rejeitado_valor_alto";
  notes?: string;
  itemPrices?: Record<string, number>; // Mapping item number (e.g. "1") -> unit price quoted
}

export interface CompetitorBid {
  id: string;
  name: string;
  cnpj?: string;
  bidValue: number;
  ranking?: number;
  status: "vencedor_provisorio" | "ganhou_certame" | "desclassificado" | "recurso" | "perdeu";
}

export interface SmartNotification {
  id: string;
  type: "email" | "whatsapp";
  title: string;
  content: string;
  triggerDate: string; // Date of the alert
  sent: boolean;
  testSent?: boolean; // Manual simulation trigger
}

export interface StatusHistory {
  status: string;
  timestamp: string;
  notes?: string;
  userId: string;
}

export interface Licitacao {
  id: string;
  userId: string;
  url?: string;
  edital: string;
  orgao: string;
  modalidade: string;
  objeto: string;
  valorEstimado: number;
  dataSessao: string; // ISO or date format
  cidade: string;
  estado: string;
  categoria: string;
  status: "Triagem" | "Em Análise" | "Decidido Participar" | "Proposta Enviada" | "Ganhamos" | "Perdemos" | "Suspenso" | "Desclassificado" | "Desistimos" | "Arquivado";
  
  // Custom collections nested in single document for atomic updates & offline speed
  checklist: LicitacaoChecklistItem[];
  suppliers: SupplierContact[];
  competitors: CompetitorBid[];
  alerts: SmartNotification[];
  historicStatus: StatusHistory[];

  // PNCP specific fields for rich GovTech compliance
  idContratacaoPncp?: string;
  amparoLegal?: string;
  unidadeCompradora?: string;
  modoDisputa?: string;
  dataInicioPropostas?: string;
  dataFimPropostas?: string;
  pncpRawText?: string;
  itensPncp?: {
    numero: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }[];
  arquivosPncp?: {
    id: string;
    nome: string;
    descricao?: string;
    linkUrl?: string;
    tamanho?: string;
  }[];
  
  // Predict model cache
  predictiveCache?: {
    level: string;
    recommendedDiscount: string;
    targetPrice: string;
    winProbability: string;
    competitorInsights: string;
    risks: string[];
    strategy: string;
    generatedAt: string;
  };

  createdAt: string;
  updatedAt: string;
}

export interface CompanySetting {
  name: string;
  cnpj: string;
  address: string;
  partnerName: string;
  partnerCPF: string;
  partnerRole: string;
}
