import { Licitacao } from "./types";

export const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export const CATEGORIAS_LICITACAO = [
  "Tecnologia da Informação",
  "Obras & Engenharia",
  "Serviços Gerais",
  "Materiais & Equipamentos",
  "Consultoria",
  "Saúde & Medicamentos",
  "Alimentação & Merenda",
  "Outros"
];

export const STATUS_LICITACAO: { value: Licitacao["status"]; label: string; bg: string; text: string }[] = [
  { value: "Triagem", label: "Triagem", bg: "bg-gray-100", text: "text-gray-800" },
  { value: "Em Análise", label: "Em Análise", bg: "bg-amber-100", text: "text-amber-800" },
  { value: "Decidido Participar", label: "Decidido Participar", bg: "bg-purple-100", text: "text-purple-800" },
  { value: "Proposta Enviada", label: "Proposta Enviada", bg: "bg-blue-100", text: "text-blue-800" },
  { value: "Ganhamos", label: "Ganhamos (Venceu)", bg: "bg-emerald-100", text: "text-emerald-800" },
  { value: "Perdemos", label: "Perdemos", bg: "bg-red-100", text: "text-red-800" },
  { value: "Suspenso", label: "Suspenso", bg: "bg-amber-200", text: "text-amber-900" },
  { value: "Desclassificado", label: "Desclassificado", bg: "bg-rose-100", text: "text-rose-800" },
  { value: "Desistimos", label: "Desistimos", bg: "bg-slate-100", text: "text-slate-800" },
  { value: "Arquivado", label: "Arquivado", bg: "bg-zinc-100", text: "text-zinc-800" }
];

export const MOCK_COMPANY_DETAILS = {
  name: "Brasil GovTech Soluções S/A",
  cnpj: "18.394.204/0001-44",
  address: "Alameda Santos, 1200 - Cerqueira César, São Paulo - SP",
  partnerName: "Eduardo Sant'Anna de Oliveira",
  partnerCPF: "349.882.110-09",
  partnerRole: "Diretor Comercial"
};

export const MOCK_LICITACOES: Licitacao[] = [
  {
    id: "exemplo-1",
    userId: "demo-user",
    url: "https://www.comprasnet.gov.br/licitacoes",
    edital: "Pregão Eletrônico SRP 12/2026",
    orgao: "Ministério da Educação (MEC)",
    modalidade: "Pregão Eletrônico",
    objeto: "Aquisição de computadores portáteis tipo Chromebook para rede federal de ensino profissional e tecnológico.",
    valorEstimado: 12000000.00,
    dataSessao: "2026-06-25T09:00",
    cidade: "Brasília",
    estado: "DF",
    categoria: "Tecnologia da Informação",
    status: "Decidido Participar",
    historicStatus: [
      { status: "Triagem", timestamp: "2026-06-01T10:00:00Z", notes: "Triagem de edital automática via linkComprasNet", userId: "demo-user" },
      { status: "Em Análise", timestamp: "2026-06-03T11:30:00Z", notes: "Análise prévia de edital por Eduardo", userId: "demo-user" },
      { status: "Decidido Participar", timestamp: "2026-06-08T14:45:00Z", notes: "Aprovado pela diretoria com margem de 15%", userId: "demo-user" }
    ],
    checklist: [
      { id: "c1", name: "Certidão Conjunta Débitos Federais", status: "validado", updatedAt: "2026-06-05T09:00:00Z", obs: "Válida até 08/2026" },
      { id: "c2", name: "FGTS CRF", status: "validado", updatedAt: "2026-06-05T09:12:00Z", obs: "Válida até 07/2026" },
      { id: "c3", name: "Balanço Patrimonial Reconhecido", status: "preparando", updatedAt: "2026-06-08T15:00:00Z", obs: "Falta assinatura do contador" },
      { id: "c4", name: "Atestado de Capacidade Técnica (Mínimo 500 máquinas)", status: "pendente", updatedAt: "2026-06-08T15:02:00Z" }
    ],
    suppliers: [
      { id: "s1", name: "Lenovo Distribuidor S/A", product: "Chromebook 300e", value: 1650.00, contact: "vendas@lenovocorporativo.com.br", status: "cotado", notes: "Prazo de entrega 30 dias" },
      { id: "s2", name: "Acer do Brasil", product: "Chromebook C733", value: 1720.00, contact: "(11) 4003-9111", status: "cotado" },
      { id: "s3", name: "Dell Distribuição", product: "Dell Chromebook 11", value: 0, contact: "suporte@dellgov.com.br", status: "aguardando" }
    ],
    competitors: [
      { id: "cp1", name: "Positivo Tecnologia", cnpj: "21.394.029/0001-99", bidValue: 11200000.00, status: "vencedor_provisorio" },
      { id: "cp2", name: "Lanlink Soluções", cnpj: "10.029.384/0002-12", bidValue: 11950000.00, status: "perdeu" }
    ],
    alerts: [
      { id: "a1", type: "email", title: "Sessão Pública Próxima", content: "Abertura da sessão para o Chromebook MEC amanhã às 09:00.", triggerDate: "2026-06-24T09:00", sent: false },
      { id: "a2", type: "whatsapp", title: "Aviso de Lances", content: "Lembrete: Enviar proposta comercial inicial até às 08:30.", triggerDate: "2026-06-25T08:00", sent: false }
    ],
    predictiveCache: {
      level: "ALTO",
      recommendedDiscount: "18% - 24%",
      targetPrice: "R$ 9.360.000,00",
      winProbability: "72%",
      competitorInsights: "Positivo Tecnologia costuma baixar as propostas ao extremo em lotes de Chromebooks devido ao benefício fiscal da Zona Franca de Manaus. Recomenda-se negociar desconto máximo de distribuidor e preparar recurso focado em atestado de compatibilidade com chip de segurança TPM 2.0.",
      risks: [
        "Variação cambial acentuada afetando importadores de semicondutores.",
        "Exigência de assistência técnica autorizada em todas as capitais do país.",
        "Exigência de certificação de conformidade ambiental do INMETRO."
      ],
      strategy: "Cadastrar proposta inicial em R$ 11.500.000,00. No certame, programar o robô para disputar lances até o preço teto de R$ 9.120.000,00 (margem bruta de 9%). Monitorar atestados das concorrentes.",
      generatedAt: "2026-06-08T15:10:00Z"
    },
    createdAt: "2026-06-01T10:00:00Z",
    updatedAt: "2026-06-08T15:10:00Z"
  }
];

export const MOCK_CATALOG_SUPPLIERS = [
  // Pneus (Tires)
  {
    name: "Pirelli Comercial Ltda",
    product: "Pneus Radiais, Rodas e Alinhamento Automotivo",
    value: 1250,
    contact: "vendas.corp@pirelli.com.br",
    phone: "(11) 4004-1234",
    categoryKeywords: ["pneu", "pneus", "roda", "rodas", "borracha", "pneus novos", "michelin", "bridgestone", "veículo"]
  },
  {
    name: "Michelin Distribuição Brasil",
    product: "Pneus de Alta Performance (Câmaras, Protetores e Pneus)",
    value: 1450,
    contact: "licitacoes@michelin.com",
    phone: "(11) 3254-9988",
    categoryKeywords: ["pneu", "pneus", "roda", "rodas", "borracha", "michelin", "veic", "veiculo", "veículo"]
  },
  {
    name: "Dpaschoal Auto Service",
    product: "Fornecimento de Pneus e Manutenção de Frota",
    value: 1100,
    contact: "corporate@dpaschoal.com.br",
    phone: "(19) 3728-2200",
    categoryKeywords: ["pneu", "pneus", "roda", "rodas", "frota", "borracha"]
  },

  // Xícara (Cups/Mugs)
  {
    name: "Cerâmica Porto Brasil",
    product: "Xícaras de Porcelana, Pratos e Utensílios de Cozinha",
    value: 18.5,
    contact: "comercial@portobrasil.com.br",
    phone: "(19) 3589-9200",
    categoryKeywords: ["xícara", "xicara", "xícaras", "caneca", "porcelana", "copo", "louça", "cozinha", "utensílios", "utensilio", "copos"]
  },
  {
    name: "Tramontina S/A Cutelaria",
    product: "Xícaras de Vidro Duplo, Talheres e Utilidades Domésticas",
    value: 24.9,
    contact: "licitacoes@tramontina.com.br",
    phone: "(54) 3461-8000",
    categoryKeywords: ["xícara", "xicara", "xícaras", "caneca", "vidro", "garfo", "cozinha", "utilidades", "louça", "pires"]
  },
  {
    name: "Oxford Porcelanas S/A",
    product: "Conjunto de Xícaras para Café e Chá",
    value: 15.2,
    contact: "vendas@oxfordporcelanas.com.br",
    phone: "(47) 3608-1000",
    categoryKeywords: ["xícara", "xicara", "xícaras", "caneca", "porcelana", "café", "chá", "copo"]
  },

  // Fonte de Alimentação (Power Supply)
  {
    name: "Corsair Brasil Distribuidora",
    product: "Fontes de Alimentação ATX, Componentes e Nobreaks",
    value: 450,
    contact: "parceiros@corsair.com.br",
    phone: "(11) 3042-9011",
    categoryKeywords: ["fonte", "power supply", "alimentação", "alimentacao", "fonte de alimentação", "carregador", "energia", "eletrônicos", "hardware", "desktop", "atx"]
  },
  {
    name: "Intelbras S/A Eletrônica",
    product: "Fontes Chaveadas 12V, Carregadores e No-Breaks",
    value: 89,
    contact: "licitacoes@intelbras.com.br",
    phone: "(48) 2106-0006",
    categoryKeywords: ["fonte", "alimentação", "alimentacao", "fonte chaveada", "carregador", "12v", "segurança", "energia", "comutadora"]
  },
  {
    name: "EVGA Tech América Latina",
    product: "Fonte de Alimentação Real Certificação 80 Plus",
    value: 380,
    contact: "latam@evga.com",
    phone: "(11) 4200-2489",
    categoryKeywords: ["fonte", "power supply", "alimentação", "alimentacao", "80 plus", "atx", "computador"]
  },

  // Pavimentação (Paving)
  {
    name: "Construvale Pavimentações Ltda",
    product: "Serviço de Pavimentação Asfáltica e Recapeamento",
    value: 185000,
    contact: "contato@construvalepav.com.br",
    phone: "(12) 3939-5555",
    categoryKeywords: ["pavimentação", "pavimentacao", "asfáltica", "asfaltica", "asfalto", "recapeamento", "vias", "pavimento", "calcamento", "calçamento", "obras", "infraestrutura"]
  },
  {
    name: "Sinalize Infraestrutura e Obras",
    product: "Execução de Pavimentação Intertravada e Ladrilhos",
    value: 142000,
    contact: "engenharia@sinalizeobras.com.br",
    phone: "(11) 2291-7788",
    categoryKeywords: ["pavimentação", "pavimentacao", "intertravado", "ladrilho", "bloco", "asfalto", "calçamento", "calcamento", "obras", "infraestrutura"]
  },
  {
    name: "Eurovia Construtora e Sinalização",
    product: "Pavimentação com CBUQ e Terraplenagem",
    value: 320000,
    contact: "licita@euroviabrasil.com.br",
    phone: "(21) 2503-4500",
    categoryKeywords: ["pavimentação", "pavimentacao", "cbuq", "asfalto", "terraplenagem", "rodovia", "obras", "infraestrutura", "ruas"]
  }
];

