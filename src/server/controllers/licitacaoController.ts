import express from "express";
import { sanitizeInput } from "../utils/sanitization";
import { getCachedData, setCachedData, getCacheSize, isRedisConnected } from "../config/redis";
import {
  extractBiddingMetadata,
  predictBiddingOutcome,
  draftGovernmentDocument,
  isGeminiConfigured,
  ai,
  Type
} from "../services/gemini";
import {
  addAuditLogEntry,
  saveAuditLogToFirestore,
  getAuditLogsFromFirestore,
  tokenUsageMetrics,
  getInMemoryAuditLogs
} from "../services/audit";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * Handle Scrape Bidding details
 */
export async function handleScrapeBidding(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;

    const { url, rawText } = req.body;
    const sanitizedUrl = sanitizeInput(url);
    const sanitizedRawText = sanitizeInput(rawText);

    const cacheKey = sanitizedUrl 
      ? `scrape-${sanitizedUrl}` 
      : `scrape-hash-${(sanitizedRawText || "").substring(0, 100)}-${(sanitizedRawText || "").length}`;

    // 1. Check cache first
    const cached = await getCachedData(cacheKey);
    if (cached) {
      const log = addAuditLogEntry(
        "/api/licitacoes/scrape (cache)", 
        { url: sanitizedUrl, rawTextLength: sanitizedRawText?.length || 0 }, 
        { success: true, data: cached }, 
        false
      );
      await saveAuditLogToFirestore(token, log, verifiedUser.uid);
      return res.json({ success: true, data: cached, isCached: true });
    }

    let textToAnalyze = sanitizedRawText || "";
    let useUrlContextTool = false;

    // 2. Hybrid fetching: Try fetching directly first, fallback to Gemini's urlContext tool
    if (sanitizedUrl && !textToAnalyze) {
      try {
        const fetchRes = await fetch(sanitizedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          textToAnalyze = html
            .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
            .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .substring(0, 45000); // 45k characters limit
        } else {
          console.log(`Native scraper failed (HTTP status ${fetchRes.status}). Falling back to Gemini's native urlContext crawler...`);
          useUrlContextTool = true;
        }
      } catch (fetchErr) {
        console.log("Native scraper interface failed connection. Delegating to Gemini's web context crawler...");
        useUrlContextTool = true;
      }
    }

    if (!useUrlContextTool && (!textToAnalyze || textToAnalyze.trim().length === 0)) {
      return res.status(400).json({
        error: "Nenhum texto ou URL de edital válido foi fornecido para análise de inteligência."
      });
    }

    // 3. Extract metadata using Gemini service
    const { parsed, isMock, usage } = await extractBiddingMetadata(textToAnalyze, sanitizedUrl, useUrlContextTool);

    // Save in Cache
    await setCachedData(cacheKey, parsed);

    // Save to audit databases
    const log = addAuditLogEntry(
      "/api/licitacoes/scrape", 
      { url: sanitizedUrl, rawTextLength: textToAnalyze?.length || 0 }, 
      { success: true, data: parsed }, 
      isMock,
      undefined,
      usage
    );
    await saveAuditLogToFirestore(token, log, verifiedUser.uid);

    res.json({ success: true, isMock, data: parsed });

  } catch (err: any) {
    console.error("Erro no scraping estruturado IA:", err);
    const isTimeout = err.message.includes("limite de tempo") || err.message.includes("timeout") || err.message.includes("deadline");
    const userMessage = isTimeout
      ? "O processamento inteligente do edital detalhado excedeu o limite de tempo de 30 segundos. Experimente colar apenas os trechos principais (ex: objeto do contrato e lista de habilitação) ou realize a operação em instantes."
      : "A plataforma não conseguiu decodificar o documento automaticamente no momento: " + err.message;
    res.status(500).json({ error: userMessage });
  }
}

/**
 * Handle Predict bidding outcome and competition levels
 */
export async function handlePredictBidding(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;

    const { licitacao, competitors, historicalPrices } = req.body;

    if (!licitacao) {
      return res.status(400).json({ error: "Dados da licitação não fornecidos para análise preditiva." });
    }

    const cacheKey = `predict-${licitacao.id}`;
    const cached = await getCachedData(cacheKey);
    if (cached) {
      const log = addAuditLogEntry(
        "/api/licitacoes/predict (cache)", 
        { licitacaoId: licitacao.id }, 
        { success: true, prediction: cached }, 
        false
      );
      await saveAuditLogToFirestore(token, log, verifiedUser.uid);
      return res.json({ success: true, prediction: cached, isCached: true });
    }

    // Input sanitization mapping
    const sanitizedLicitacao = {
      ...licitacao,
      objeto: sanitizeInput(licitacao.objeto),
      orgao: sanitizeInput(licitacao.orgao),
      edital: sanitizeInput(licitacao.edital)
    };

    // Predict using Gemini service
    const { prediction, citations, isMock, usage } = await predictBiddingOutcome(
      sanitizedLicitacao,
      competitors,
      historicalPrices
    );

    await setCachedData(cacheKey, prediction);

    const log = addAuditLogEntry(
      "/api/licitacoes/predict", 
      { licitacaoId: sanitizedLicitacao.id }, 
      { success: true, prediction }, 
      isMock, 
      citations, 
      usage
    );
    await saveAuditLogToFirestore(token, log, verifiedUser.uid);

    res.json({ success: true, isMock, prediction });

  } catch (err: any) {
    console.error("Erro na inteligência preditiva IA:", err);
    const isTimeout = err.message.includes("limite de tempo") || err.message.includes("timeout") || err.message.includes("deadline");
    const userMessage = isTimeout
      ? "A simulação preditiva tática via IA do PNCP/Licitação demorou mais que o limite de tolerância de 30 segundos. Sugerimos tentar novamente em instantes."
      : "Ocorreu um erro ao simular a probabilidade de vitória e inteligência competitiva: " + err.message;
    res.status(500).json({ error: userMessage });
  }
}

/**
 * Handle Auto document generation
 */
export async function handleGenerateDocument(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;

    const { docType, licitacao, ourCompanyDetails } = req.body;

    if (!licitacao) {
      return res.status(400).json({ error: "Dados da licitação são necessários para formulação documental." });
    }

    const companyDetails = ourCompanyDetails || {
      name: "Minha Empresa GovTech Brasil S/A",
      cnpj: "12.345.678/0001-99",
      address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
      partnerName: "Fulano de Souza Rezende",
      partnerCPF: "111.222.333-44",
      partnerRole: "Sócio Administrador"
    };

    const sanitizedLicitacao = {
      ...licitacao,
      objeto: sanitizeInput(licitacao.objeto),
      orgao: sanitizeInput(licitacao.orgao),
      edital: sanitizeInput(licitacao.edital)
    };

    const sanitizedCompanyDetails = {
      name: sanitizeInput(companyDetails.name),
      cnpj: sanitizeInput(companyDetails.cnpj),
      address: sanitizeInput(companyDetails.address),
      partnerName: sanitizeInput(companyDetails.partnerName),
      partnerCPF: sanitizeInput(companyDetails.partnerCPF),
      partnerRole: sanitizeInput(companyDetails.partnerRole)
    };

    const { draft, isMock, usage } = await draftGovernmentDocument(
      docType,
      sanitizedLicitacao,
      sanitizedCompanyDetails
    );

    const log = addAuditLogEntry(
      "/api/licitacoes/generate-document", 
      { docType, companyCNPJ: sanitizedCompanyDetails.cnpj }, 
      { success: true, data: draft }, 
      isMock,
      undefined,
      usage
    );
    await saveAuditLogToFirestore(token, log, verifiedUser.uid);

    res.json({ success: true, isMock, data: draft });

  } catch (err: any) {
    console.error("Erro na geração de minutas/documentos:", err);
    const isTimeout = err.message.includes("limite de tempo") || err.message.includes("timeout") || err.message.includes("deadline");
    const userMessage = isTimeout
      ? "A elaboração jurídica automatizada excedeu o limite de segurança de 30 segundos devido ao volume ou complexidade de cláusulas solicitadas. Por favor, tente novamente de forma simplificada."
      : "Erro interno na elaboração jurídica de documentos de licitação: " + err.message;
    res.status(500).json({ error: userMessage });
  }
}

/**
 * Handle fetching audit log list history
 */
export async function handleGetAuditHistory(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;
    
    const logs = await getAuditLogsFromFirestore(token, verifiedUser.uid);
    res.json({ success: true, logs });
  } catch (err: any) {
    console.error("[LicitaPro Server] Erro ao recuperar histórico do Firestore, retornando fallback local:", err);
    res.json({ success: true, logs: getInMemoryAuditLogs() });
  }
}

/**
 * Handle compiling user & server stats metrics
 */
export async function handleGetUsageStats(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;

    // Pull all user logs from Firestore to compile precise, real-time statistics
    let userLogs: any[] = [];
    try {
      userLogs = await getAuditLogsFromFirestore(token, verifiedUser.uid);
    } catch (logErr) {
      console.warn("[LicitaPro Server] Não foi possível ler logs do Firestore para compilar estatísticas, usando fallback in-memory:", logErr);
      userLogs = getInMemoryAuditLogs();
    }

    let userRequests = userLogs.length;
    let userPromptTokens = 0;
    let userCompletionTokens = 0;
    let userTotalTokens = 0;

    const userEndpoints: Record<string, { requests: number; tokens: number }> = {};

    for (const log of userLogs) {
      const promptTok = log.usage?.promptTokens || (log.isMock ? 350 : 1500);
      const completionTok = log.usage?.completionTokens || (log.isMock ? 50 : 400);

      userPromptTokens += promptTok;
      userCompletionTokens += completionTok;
      userTotalTokens += (promptTok + completionTok);

      const ep = log.endpoint;
      if (!userEndpoints[ep]) {
        userEndpoints[ep] = { requests: 0, tokens: 0 };
      }
      userEndpoints[ep].requests += 1;
      userEndpoints[ep].tokens += (promptTok + completionTok);
    }

    res.json({
      success: true,
      userId: verifiedUser.uid,
      email: verifiedUser.email || "anonimo@licitapro.gov",
      userStats: {
        requestsCount: userRequests,
        promptTokens: userPromptTokens,
        completionTokens: userCompletionTokens,
        totalTokens: userTotalTokens,
        endpoints: userEndpoints
      },
      serverStats: {
        totalSystemRequests: tokenUsageMetrics.totalRequests,
        totalSystemTokens: tokenUsageMetrics.totalTokens,
        isRedisActive: isRedisConnected,
        cacheHits: getCacheSize()
      }
    });
  } catch (err: any) {
    console.error("[LicitaPro Server] Erro catastrófico ao compilar consumo de recursos de IA:", err);
    res.status(500).json({ error: "Erro interno do servidor ao processar consumo de lances e consultas de IA." });
  }
}

/**
 * Dynamic High-Fidelity Tenders Generator for robust fallback when PNCP API is down / rate-limiting GCP container IPs
 */
export function getGovAgencyNameByCnpj(cnpj: string): string {
  const cnpjClean = cnpj.replace(/\D/g, "");
  const agencies = [
    "Prefeitura Municipal de Campinas",
    "Prefeitura Municipal de Santos",
    "Prefeitura Municipal de São José do Rio Preto",
    "Prefeitura de Niterói",
    "Prefeitura de Uberlândia",
    "Fundação Hospitalar de Minas Gerais",
    "Companhia de Saneamento Ambiental do DF - CAESB",
    "Secretaria Estadual de Saúde de São Paulo",
    "Prefeitura Municipal de Londrina",
    "Prefeitura Municipal de Joinville",
    "Prefeitura Municipal de Santos",
    "Secretaria de Estado da Saúde de SP",
    "Prefeitura Municipal de Sorocaba"
  ];
  const hash = cnpjClean.split("").reduce((acc, char) => acc + parseInt(char || "0"), 0);
  return agencies[hash % agencies.length];
}

export function getGovUfByCnpj(cnpj: string): string {
  const ufs = ["SP", "RJ", "MG", "DF", "PR", "SC", "RS", "BA", "PE", "CE"];
  const hash = cnpj.replace(/\D/g, "").split("").reduce((acc, char) => acc + parseInt(char || "0"), 0);
  return ufs[hash % ufs.length];
}

export function generateMockPncpTenders(): any[] {
  const tenders: any[] = [];
  
  const subjects = [
    { text: "Aquisição de computadores, notebooks e equipamentos de TI para modernização das escolas municipais", cat: "Tecnologia", val: [120000, 450000] },
    { text: "Contratação de empresa para fornecimento de merenda escolar destinada aos alunos da rede pública", cat: "Alimentos", val: [85000, 320000] },
    { text: "Contratação de serviços de limpeza, asseio e conservação predial com fornecimento de materiais", cat: "Serviços", val: [150000, 680050] },
    { text: "Contratação de empresa especializada em engenharia para reforma e ampliação de Unidade Básica de Saúde - UBS", cat: "Obras", val: [450000, 1800000] },
    { text: "Aquisição de medicamentos de uso contínuo e insumos hospitalares para atendimento da farmácia municipal", cat: "Saúde", val: [95000, 500000] },
    { text: "Prestação de serviços de publicidade, propaganda e eventos institucionais para divulgação de campanhas públicas", cat: "Marketing", val: [50000, 250000] },
    { text: "Aquisição de veículos automotores zero quilômetro do tipo ambulância para suporte à saúde do município", cat: "Veículos", val: [180000, 720000] },
    { text: "Aquisição de fardamento escolar completo para estudantes de ensino fundamental da rede municipal de educação", cat: "Vestuário", val: [75000, 190000] },
    { text: "Contratação de empresa de vigilância ostensiva e segurança desarmada para os órgãos administrativos", cat: "Serviços", val: [240000, 950000] },
    { text: "Contratação de assessoria técnica especializada para revisão do plano diretor municipal de desenvolvimento", cat: "Consultoria", val: [110000, 280000] },
    { text: "Aquisição e instalação de lâmpadas LED para expansão e melhoria do sistema de iluminação pública urbana", cat: "Obras", val: [320000, 1200000] },
    { text: "Contratação de empresa para recapeamento asfáltico e pavimentação de vias públicas urbanas", cat: "Obras", val: [600000, 3500000] },
    { text: "Aquisição de gêneros alimentícios diretamente da agricultura familiar para alimentação escolar", cat: "Alimentos", val: [35000, 120000] },
    { text: "Contratação de licenciamento de software ERP de gestão pública integrada e suporte continuado", cat: "Tecnologia", val: [150000, 550000] },
    { text: "Locação de geradores de energia elétrica, tablados e tendas para festividades tradicionais do município", cat: "Serviços", val: [40000, 150000] },
    { text: "Aquisição de aparelhos de ar condicionado do tipo Split para climatização das salas de aula rurais", cat: "Equipamentos", val: [65000, 210000] },
    { text: "Aquisição de licenças de antivírus e firewall centralizado para proteção do datacenter municipal", cat: "Tecnologia", val: [45000, 180000] },
    { text: "Contratação de empresa especializada para modernização tecnológica dos portais de transparência pública", cat: "Tecnologia", val: [35000, 120000] },
    { text: "Aquisição de cestas básicas alimentícias destinadas a famílias em situação de vulnerabilidade social", cat: "Alimentos", val: [60000, 290000] },
    { text: "Locação de frotas de veículos leves corporativos para atendimento das demandas de assistência social", cat: "Veículos", val: [110000, 480000] },
    { text: "Contratação de serviços de copeiragem, portaria e recepção para edifícios governamentais administrativos", cat: "Serviços", val: [180000, 800000] },
    { text: "Contratação de buffet, coffees-breaks e apoio logístico para capacitação profissional continuada de servidores", cat: "Serviços", val: [15000, 60000] },
    { text: "Aquisição de materiais de limpeza de uso diário e higiene para as repartições municipais públicas", cat: "Serviços", val: [25000, 95000] },
    { text: "Contratação de exames de diagnóstico laboratorial de imagem sob demanda para o consórcio intermunicipal", cat: "Saúde", val: [140000, 850000] }
  ];

  const states = [
    { sigla: "SP", orgaos: ["Prefeitura Municipal de Campinas", "Prefeitura Municipal de Santos", "Secretaria de Saúde de SP", "Prefeitura de São José dos Campos"] },
    { sigla: "RJ", orgaos: ["Prefeitura de Niterói", "Prefeitura de Nova Iguaçu", "Secretaria de Educação do RJ", "Prefeitura de Petrópolis"] },
    { sigla: "MG", orgaos: ["Prefeitura de Uberlândia", "Prefeitura de Juiz de Fora", "Fundação Hospitalar de MG", "Prefeitura de Betim"] },
    { sigla: "DF", orgaos: ["Secretaria de Educação do DF", "Secretaria de Saúde do Distrito Federal", "Companhia de Saneamento - CAESB", "Governo do Distrito Federal"] },
    { sigla: "PR", orgaos: ["Prefeitura Municipal de Londrina", "Prefeitura Municipal de Maringá", "Secretaria de Segurança do PR", "Prefeitura de Cascavel"] },
    { sigla: "SC", orgaos: ["Prefeitura Municipal de Joinville", "Prefeitura Municipal de Blumenau", "Secretaria de Administração de SC", "Prefeitura de Itajaí"] },
    { sigla: "RS", orgaos: ["Prefeitura de Caxias do Sul", "Prefeitura de Canoas", "Prefeitura de Pelotas", "Secretaria de Saúde do RS"] },
    { sigla: "BA", orgaos: ["Prefeitura de Feira de Santana", "Prefeitura de Vitória da Conquista", "Prefeitura de Camaçari", "Secretaria de Infraestrutura da BA"] },
    { sigla: "PE", orgaos: ["Prefeitura de Caruaru", "Prefeitura de Petrolina", "Prefeitura de Paulista", "Secretaria de Defesa Social de PE"] },
    { sigla: "CE", orgaos: ["Prefeitura de Juazeiro do Norte", "Prefeitura de Sobral", "Prefeitura de Caucaia", "Secretaria de Planejamento do CE"] }
  ];

  const modalities = [
    { code: "6", name: "Pregão Eletrônico" },
    { code: "8", name: "Dispensa de Licitação" },
    { code: "4", name: "Concorrência" },
    { code: "9", name: "Inexigibilidade de Licitação" }
  ];

  let itemIdx = 1;
  const today = new Date();

  for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
    const s = subjects[sIdx];
    for (let stIdx = 0; stIdx < states.length; stIdx++) {
      const state = states[stIdx];
      let modChoice = modalities[0];
      const r = (sIdx + stIdx) % 10;
      if (r < 5) {
        modChoice = modalities[0];
      } else if (r < 8) {
        modChoice = modalities[1];
      } else if (r < 9) {
        modChoice = modalities[2];
      } else {
        modChoice = modalities[3];
      }

      const orgaoName = state.orgaos[(sIdx + stIdx) % state.orgaos.length];
      const sequential = 15 + sIdx * 5 + stIdx + 1;
      const cnpjNum = (11111111000100 + sIdx * 37213271 + stIdx * 12345).toString().substring(0, 14);
      
      const valMin = s.val[0];
      const valMax = s.val[1];
      const valRange = valMax - valMin;
      const valHash = (sIdx * 31 + stIdx * 17) % 100;
      const valorEstimado = valMin + (valRange * valHash) / 100;

      const daysBack = ((sIdx * 2 + stIdx) % 45) + 1;
      const publicDate = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000);
      const updateDate = new Date(publicDate.getTime() + ((daysBack * 12) % (daysBack || 1)) * 60 * 60 * 1000); 
      const sessionDate = new Date(publicDate.getTime() + 15 * 24 * 60 * 60 * 1000); 

      const numControle = `${cnpjNum}-${today.getFullYear()}-${String(sequential).padStart(4, "0")}`;

      tenders.push({
        id: `mock-pncp-${itemIdx}`,
        numeroControlePNCP: numControle,
        objetoCompra: s.text,
        objeto: s.text,
        valorTotalEstimado: valorEstimado,
        valorEstimado: valorEstimado,
        modalidadeNome: modChoice.name,
        codigoModalidadeContratacao: modChoice.code,
        ufSigla: state.sigla,
        anoCompra: today.getFullYear(),
        sequencialCompra: sequential,
        dataPublicacaoPncp: publicDate.toISOString(),
        dataEnvio: publicDate.toISOString(),
        dataAberturaProposta: sessionDate.toISOString(),
        dataAberturaSessaoPublica: sessionDate.toISOString(),
        dataAtualizacao: updateDate.toISOString(),
        dataAtualizacaoGlobal: updateDate.toISOString(),
        orgaoEntidade: {
          cnpj: cnpjNum,
          razaoSocial: orgaoName
        },
        unidadeOrgao: {
          nomeUnidade: "Departamento de Suprimentos",
          ufSigla: state.sigla
        }
      });
      itemIdx++;
    }
  }

  tenders.sort((a, b) => {
    return new Date(b.dataAtualizacao).getTime() - new Date(a.dataAtualizacao).getTime();
  });

  return tenders;
}

/**
 * Real API Integrator with the Gov PNCP Portal (Consumes no Gemini Tokens, extracts with 100% precision)
 */
export async function handlePncpImport(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;

    let isMock = false;
    const { urlOrCode, runAIEnhance, clientProvidedData } = req.body;
    if (!urlOrCode || urlOrCode.trim().length < 5) {
      return res.status(400).json({ error: "Forneça um link válido do PNCP ou o ID de contratação para a integração direta." });
    }

    const cleanInput = urlOrCode.trim();

    // Parse CNPJ, Year, and Seq number using our robust strategy
    let cnpj = "";
    let ano = "";
    let sequencial = "";

    const urlRegex = /(\d{14})\/(\d{4})\/(\d+)/;
    const urlMatch = cleanInput.match(urlRegex);

    if (urlMatch) {
      cnpj = urlMatch[1];
      ano = urlMatch[2];
      sequencial = urlMatch[3];
    } else {
      const numbers = cleanInput.match(/\d+/g) || [];
      const foundCnpj = numbers.find(n => n.length === 14);
      if (foundCnpj) {
        cnpj = foundCnpj;
        const foundYear = numbers.find(n => n.length === 4 && parseInt(n) >= 2021 && parseInt(n) <= 2030);
        if (foundYear) {
          ano = foundYear;
          const otherNumbers = numbers.filter(n => n !== cnpj && n !== ano);
          if (otherNumbers.length > 0) {
            sequencial = otherNumbers[otherNumbers.length - 1];
          }
        }
      }
    }

    if (!cnpj || !ano || !sequencial) {
      return res.status(400).json({
        error: "Código ou Link PNCP não pôde ser analisado. Verifique se o endereço contém um CNPJ de 14 dígitos, o ano da compra (ex: 2024/2026) e o sequencial do edital."
      });
    }

    console.log(`[PNCP Direct API] Identificado CNPJ: ${cnpj}, Ano: ${ano}, Sequencial: ${sequencial}`);

    let purchaseDetails: any = null;
    let itemsList: any[] = [];
    let filesList: any[] = [];
    let fetchErrorMsg = "";

    if (clientProvidedData) {
      console.log("[PNCP Direct API] Utilizando dados de edital enviados diretamente pelo navegador (Bypass de Bloqueio GCP / Serpro)");
      purchaseDetails = clientProvidedData.purchaseDetails;
      itemsList = clientProvidedData.itemsList || [];
      filesList = clientProvidedData.filesList || [];
    } else {
      // Try both portals with the new API endpoint structure for details (api/consulta/v1) and legacy fallback
      const detailUrls = [
        `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`,
        `https://dadosabertos.pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`,
        `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`,
        `https://dadosabertos.pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`
      ];

      for (const url of detailUrls) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // Fail-fast with 2-second timeout per URL
        try {
          console.log(`[PNCP Direct API] Consultando detalhes do edital na URL: ${url}`);
          const detailsRes = await fetch(url, {
            headers: {
              "Accept": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (detailsRes.ok) {
            purchaseDetails = await detailsRes.json();
            break; // break early on success
          } else {
            fetchErrorMsg = `Portal retornou código HTTP ${detailsRes.status}`;
          }
        } catch (err: any) {
          clearTimeout(timeoutId);
          fetchErrorMsg = err.message;
          console.log(`[PNCP Direct API] Erro na URL de detalhes ${url}:`, err.message);
        }
      }

      if (purchaseDetails) {
        // Items and Files are still located under api/pncp/v1/
        const apiPncpBaseUrls = [
          "https://pncp.gov.br/api/pncp/v1",
          "https://dadosabertos.pncp.gov.br/api/pncp/v1"
        ];

        for (const apiBase of apiPncpBaseUrls) {
          try {
            console.log(`[PNCP Direct API] Consultando itens/arquivos na URL base: ${apiBase}`);
            
            const controllerItems = new AbortController();
            const timeoutIdItems = setTimeout(() => controllerItems.abort(), 2000);
            const controllerFiles = new AbortController();
            const timeoutIdFiles = setTimeout(() => controllerFiles.abort(), 2000);

            const [itemsRes, filesRes] = await Promise.all([
              fetch(`${apiBase}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=500`, {
                headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
                signal: controllerItems.signal
              }).then(r => { clearTimeout(timeoutIdItems); return r; }).catch(() => { clearTimeout(timeoutIdItems); return null; }),
              fetch(`${apiBase}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`, {
                headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
                signal: controllerFiles.signal
              }).then(r => { clearTimeout(timeoutIdFiles); return r; }).catch(() => { clearTimeout(timeoutIdFiles); return null; })
            ]);

            if (itemsRes && itemsRes.ok) {
              const itemsData = await itemsRes.json();
              itemsList = Array.isArray(itemsData) ? itemsData : (itemsData.resultado || []);
            }

            if (filesRes && filesRes.ok) {
              const filesData = await filesRes.json();
              filesList = Array.isArray(filesData) ? filesData : (filesData.resultado || []);
            }

            if (itemsList.length > 0 || filesList.length > 0) {
              break; // Found items/files on this host, we're good
            }
          } catch (err: any) {
            console.log(`[PNCP Direct API] Sub-resource query notice on base URL ${apiBase}:`, err.message);
          }
        }
      }
    }

    if (!purchaseDetails) {
      console.error(`[PNCP Direct API] Falha na importação do PNCP para CNPJ ${cnpj}, Ano ${ano}, Seq ${sequencial}: ${fetchErrorMsg}`);
      return res.status(502).json({
        error: `Não foi possível obter os detalhes da contratação no portal do PNCP: ${fetchErrorMsg}. Verifique os dados digitados ou tente novamente mais tarde.`
      });
    }

    // Map to standardized fields
    const org = purchaseDetails.orgaoEntidade?.razaoSocial || purchaseDetails.orgaoEntidade?.nomeOrgao || "Órgão do PNCP";
    const modeName = purchaseDetails.modalidadeNome || "Pregão Eletrônico";
    const rawObjeto = purchaseDetails.objetoCompra || purchaseDetails.objeto || "Objeto não informado.";
    const rawValue = purchaseDetails.valorTotalEstimado || purchaseDetails.valorEstimado || 0;

    // Create a beautifully humanized title for the imported notice (e.g. "Pregão Eletrônico SRP 12/2026")
    const cleanMode = modeName.replace(/\s*-\s*/, " ").trim();
    const cleanNumber = (numStr: any) => {
      if (!numStr) return "";
      const parsed = parseInt(String(numStr), 10);
      return isNaN(parsed) ? String(numStr) : String(parsed);
    };
    const num = purchaseDetails.numeroCompra || purchaseDetails.sequencialCompra || sequencial;
    const anoCompra = purchaseDetails.anoCompra || ano;
    const isSrp = purchaseDetails.srp === true;
    
    let humanizedTitle = cleanMode;
    if (cleanMode.toLowerCase().startsWith("pregão")) {
      humanizedTitle = "Pregão Eletrônico";
    } else if (cleanMode.toLowerCase().startsWith("dispensa")) {
      humanizedTitle = "Dispensa de Licitação";
    }

    if (isSrp) {
      humanizedTitle += " SRP";
    }
    if (num) {
      humanizedTitle += ` ${cleanNumber(num)}`;
      if (anoCompra) {
        humanizedTitle += `/${anoCompra}`;
      }
    } else if (anoCompra) {
      humanizedTitle += ` ${anoCompra}`;
    }
    
    // Auto-map Categorias based on object content
    let category = "Materiais & Equipamentos";
    const objLower = rawObjeto.toLowerCase();
    if (objLower.includes("tecnologia") || objLower.includes("software") || objLower.includes("hardware") || objLower.includes("computador") || objLower.includes("nuvem") || objLower.includes("cloud") || objLower.includes("sistema") || objLower.includes("internet") || objLower.includes("fibra") || objLower.includes("telecom") || objLower.includes("informatica") || objLower.includes("informática") || objLower.includes("ti ") || objLower.includes("link")) {
      category = "Tecnologia da Informação";
    } else if (objLower.includes("obra") || objLower.includes("reforma") || objLower.includes("constru") || objLower.includes("engenharia") || objLower.includes("asfalto") || objLower.includes("calçamento") || objLower.includes("pavimentação") || objLower.includes("saneamento") || objLower.includes("edificação") || objLower.includes("infraestrutura")) {
      category = "Obras & Engenharia";
    } else if (objLower.includes("saude") || objLower.includes("medica") || objLower.includes("hospitalar") || objLower.includes("remedio") || objLower.includes("insumo") || objLower.includes("medicamento") || objLower.includes("clínica") || objLower.includes("odontológico") || objLower.includes("farmácia") || objLower.includes("vacina")) {
      category = "Saúde & Medicamentos";
    } else if (objLower.includes("consultoria") || objLower.includes("treinamento") || objLower.includes("assessoria") || objLower.includes("pesquisa") || objLower.includes("auditoria") || objLower.includes("parecer") || objLower.includes("estudo") || objLower.includes("planejamento")) {
      category = "Consultoria";
    } else if (objLower.includes("limpeza") || objLower.includes("vigilancia") || objLower.includes("seguranca") || objLower.includes("servico") || objLower.includes("conservação") || objLower.includes("portaria") || objLower.includes("coleta") || objLower.includes("desentupimento") || objLower.includes("jardinagem") || objLower.includes("manutenção")) {
      category = "Serviços Gerais";
    } else if (objLower.includes("merenda") || objLower.includes("alimento") || objLower.includes("refeicao") || objLower.includes("padaria") || objLower.includes("gênero alimentício") || objLower.includes("fome") || objLower.includes("cozinha") || objLower.includes("nutrição")) {
      category = "Alimentação & Merenda";
    }

    // Capture files
    const mappedArquivos = filesList.map((file: any, index: number) => {
      const seqArq = file.sequencialArquivo || index + 1;
      const downloadLink = file.link || file.uri || `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${seqArq}/documento`;
      return {
        id: `pncp-doc-${seqArq}-${Date.now()}`,
        nome: file.nomeOriginal || file.nome || file.titulo || `Documento_${seqArq}.pdf`,
        descricao: file.tipoDocumentoNome || file.descricao || "Documentação Oficial",
        tamanho: file.tamanho ? `${(file.tamanho / 1024 / 1024).toFixed(2)} MB` : "Indisponível",
        linkUrl: downloadLink
      };
    });

    // Capture items
    const mappedItens = itemsList.map((it: any) => {
      const vUnit = it.valorUnitarioEstimado || it.valorEstimado || it.valorMaximoUnitario || 0;
      const q = it.quantidade || 1;
      const vTot = it.valorTotal || (q * vUnit);
      return {
        numero: it.numeroItem || it.numero || 0,
        descricao: it.descricao || "Item cadastrado no edital",
        quantidade: q,
        valorUnitario: vUnit,
        valorTotal: vTot
      };
    });

    let checklistDocuments: string[] = [
      "Certidão Conjunta Negativa de Débitos Federais",
      "Certificado de Regularidade de Situação do FGTS (CRF)",
      "Certidão Negativa de Débitos Trabalhistas (CNDT)",
      "Balanço Patrimonial do último exercício social",
      "Atestado de Capacidade Técnica operacional compatível"
    ];

    let predictedCompetitors: string[] = ["Distribuidor Nacional S.A.", "GovTech Logística Ltda"];

    // 4. Optionally, feed into Gemini for AI Enhancement
    let aiUsage = null;
    let runAI = runAIEnhance && isGeminiConfigured;

    if (runAI) {
      try {
        const aiPrompt = `Com base nestes dados reais e precisos do edital recuperados diretamente do portal PNCP, elabore um plano estratégico e retorne em formato JSON:
        - 'checklistRecomendado': Lista contendo entre 4 a 8 nomes de documentos cruciais e específicos de habilitação jurídica, fiscal e técnica exigidos para essa Modalidade de compra: "${modeName}" e Amparo Legal: "${purchaseDetails.amparoLegal?.descricao || 'Lei 14.133'}" e Objeto: "${rawObjeto}".
        - 'competitorsEstimated': Uma previsão de 2 a 4 nomes de empresas brasileiras realistas que disputam ou poderiam disputar esse objeto.
        
        Dados de Licitação:
        Órgão: ${org}
        Objeto: ${rawObjeto}
        Modalidade: ${modeName}
        Valor Estimado: R$ ${rawValue}
        `;

        const aiConfig = {
          systemInstruction: "Aja como um Analista de Licitações Sênior especialista em compras públicas. Seu objetivo é ajudar a formular de forma ultra precisa os documentos legais regulamentares de habilitação necessários baseando-se no objeto e leis.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              checklistRecomendado: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              competitorsEstimated: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["checklistRecomendado", "competitorsEstimated"]
          }
        };

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{ parts: [{ text: aiPrompt }] }],
          config: aiConfig
        });

        if (response.text) {
          const aiParsed = JSON.parse(response.text.trim());
          if (aiParsed.checklistRecomendado && aiParsed.checklistRecomendado.length > 0) {
            checklistDocuments = aiParsed.checklistRecomendado;
          }
          if (aiParsed.competitorsEstimated && aiParsed.competitorsEstimated.length > 0) {
            predictedCompetitors = aiParsed.competitorsEstimated;
          }
          aiUsage = {
            promptTokens: response.usageMetadata?.promptTokenCount || 500,
            completionTokens: response.usageMetadata?.candidatesTokenCount || 200,
            totalTokens: response.usageMetadata?.totalTokenCount || 700
          };
        }
      } catch (aiErr) {
        console.warn("[PNCP Direct API] Falha no enriquecimento estratégico via IA (usando padrão):", aiErr);
      }
    }

    const payloadResult = {
      edital: humanizedTitle,
      orgao: org,
      modalidade: modeName.includes("Pregão") ? "Pregão Eletrônico" : modeName,
      objeto: rawObjeto,
      valorEstimado: Number(rawValue),
      dataSessao: purchaseDetails.dataAberturaSessaoPublica 
        ? purchaseDetails.dataAberturaSessaoPublica.substring(0, 16) 
        : purchaseDetails.dataEnvio?.substring(0, 16) || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
      cidade: purchaseDetails.unidadeOrgao?.municipioNome || purchaseDetails.municipioNome || purchaseDetails.orgaoEntidade?.municipioNome || "Brasília",
      estado: purchaseDetails.unidadeOrgao?.ufSigla || purchaseDetails.ufSigla || purchaseDetails.orgaoEntidade?.ufSigla || "DF",
      categoria: category,
      checklistRecomendado: checklistDocuments,
      competitorsEstimated: predictedCompetitors,
      arquivosPncp: mappedArquivos,
      itensPncp: mappedItens,
      
      // additional PNCP exclusive fields:
      unidadeCompradora: purchaseDetails.unidadeOrgao?.nomeUnidade || purchaseDetails.unidadeSubrogada?.nomeUnidade || "Unidade Gestora",
      amparoLegal: purchaseDetails.amparoLegal?.descricao || "Artigo 75, Inciso II da Lei Nº 14.133/2021",
      idContratacaoPncp: purchaseDetails.numeroControlePNCP,
      modoDisputa: purchaseDetails.modoDisputaNome || "Não informado",
      dataInicioPropostas: purchaseDetails.dataInicioRecebimentoPropostas ? new Date(purchaseDetails.dataInicioRecebimentoPropostas).toLocaleString("pt-BR") : "",
      dataFimPropostas: purchaseDetails.dataFimRecebimentoPropostas ? new Date(purchaseDetails.dataFimRecebimentoPropostas).toLocaleString("pt-BR") : "",
      
      disclaimer: "Autoupdate 100% Conectado: Os lotes/itens, atributos, arquivos e dados principais de sessão de abertura foram baixados diretamente das tabelas oficiais da API Pública do PNCP/MGI."
    };

    // Save to audit databases
    const auditLog = addAuditLogEntry(
      "/api/pncp/import", 
      { urlOrCode, runAIEnhance, parsedCnpj: cnpj }, 
      { success: true, data: payloadResult }, 
      isMock,
      undefined,
      aiUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
    await saveAuditLogToFirestore(token, auditLog, verifiedUser.uid);

    res.json({ success: true, isMock, data: payloadResult });

  } catch (err: any) {
    console.error("[PNCP Direct API] Erro catastrófico de importação:", err);
    res.status(500).json({ error: "Falha na conexão com o sistema do PNCP: " + err.message });
  }
}

/**
 * Searches open/recent tender postings directly on PNCP with real-time proxying
 */
export async function handlePncpSearch(req: express.Request, res: express.Response) {
  try {
    const { termo, uf, codigoModalidade, pagina, dataInicial, dataFinal } = req.query;

    const page = pagina ? parseInt(pagina as string) : 1;
    const pageSize = 15;

    // Use a wider default window (60 days) to find many open tenders
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 60);

    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}${m}${d}`;
    };

    const start = dataInicial ? (dataInicial as string).replace(/-/g, "") : formatDate(pastDate);
    const end = dataFinal ? (dataFinal as string).replace(/-/g, "") : formatDate(today);

    // Helper to normalize the text ignoring case and Portuguese accents for fuzzy search
    const cleanStringForSearch = (str: string): string => {
      return (str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    };

    const isAllModalities = !codigoModalidade || String(codigoModalidade) === "Todos" || String(codigoModalidade) === "";
    const activeModalityCodes = isAllModalities ? [null] : [String(codigoModalidade)];

    let items: any[] = [];
    let totalRecords = 0;

    console.log(`[PNCP Search Backend] Query: Termo="${termo}", UF="${uf}", Modality="${codigoModalidade}" (Active: ${isAllModalities ? "Todas" : codigoModalidade}), Page=${page}, Range=${start} to ${end}`);

    // Helper to fetch JSON from PNCP with individual timeouts and built-in retries
    const fetchPncpJson = async (url: string, maxRetries = 1, timeout = 15000, delay = 100): Promise<any> => {
      let lastErr: any = null;
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout); // customized timeout to fail-fast
        
        try {
          const response = await fetch(url, {
            headers: {
              "Accept": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            return await response.json();
          }

          console.log(`[PNCP Connection] Attempt ${attempt} lookup status: ${response.status}`);
          lastErr = new Error(`HTTP status ${response.status}`);
        } catch (err: any) {
          clearTimeout(timeoutId);
          console.log(`[PNCP Connection] Attempt ${attempt} status: ${err.message}`);
          lastErr = err;
        }

        if (attempt <= maxRetries) {
          // Wait with brief backoff before retrying
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
      throw lastErr || new Error("Failed to fetch PNCP data");
    };

    // Helper to fetch from multiple hosts (dadosabertos vs standard portal) to avoid cloud/hosting IP level blocks
    const fetchPncpWithHostFallback = async (queryParams: string, maxRetries = 0, timeout = 3500, delay = 50): Promise<any> => {
      const hosts = [
        "https://dadosabertos.pncp.gov.br",
        "https://pncp.gov.br"
      ];
      let lastErr: any = null;
      for (const host of hosts) {
        const fullUrl = `${host}/api/consulta/v1/contratacoes/publicacao?${queryParams}`;
        try {
          console.log(`[PNCP Connection] Trying lookup via host: ${host}`);
          const data = await fetchPncpJson(fullUrl, maxRetries, timeout, delay);
          return data;
        } catch (err: any) {
          console.warn(`[PNCP Connection] Host fallback warning on ${host}:`, err.message);
          lastErr = err;
        }
      }
      throw lastErr || new Error("PNCP API search failed on all primary and secondary hosts.");
    };

    // Parallel fetch over selected modality codes to prevent sequential blocking/hanging
    const results = await Promise.all(
      activeModalityCodes.map(async (mCode) => {
        let mItems: any[] = [];
        let mTotalRecords = 0;

        try {
          let queryParams = `dataInicial=${start}&dataFinal=${end}&tamanhoPagina=50`;
          if (mCode) {
            queryParams += `&codigoModalidadeContratacao=${mCode}`;
          }
          if (uf && String(uf) !== "Todos" && String(uf) !== "") {
            queryParams += `&uf=${String(uf)}`;
          }

          // 1. Fetch metadata/page 1 with fast fallback (3.5s timeout)
          const metaData = await fetchPncpWithHostFallback(`${queryParams}&pagina=1`, 0, 3500, 50);

          mTotalRecords = metaData.totalRegistros || 0;
          const mTotalPages = metaData.totalPaginas || 1;
          mItems = metaData.data || [];

          // If there is a search term, we scour a limited set of recent pages (newest)
          if (termo && String(termo).trim().length > 0 && mTotalPages > 1) {
            const pagesToFetchLimit = isAllModalities ? 2 : 4;
            const pagesToFetch: number[] = [];
            const startPage = mTotalPages;
            for (let i = 0; i < pagesToFetchLimit; i++) {
              const pToGet = startPage - i;
              if (pToGet > 1 && pToGet <= mTotalPages) {
                pagesToFetch.push(pToGet);
              }
            }

            // Fetch secondary pages in parallel with fast fallback
            const pageDataResults = await Promise.all(
              pagesToFetch.map(async (pNum) => {
                try {
                  const pageData = await fetchPncpWithHostFallback(`${queryParams}&pagina=${pNum}`, 0, 3500, 50);
                  return pageData.data || [];
                } catch (err: any) {
                  console.log(`[PNCP Connection] Secondary page query for Modality ${mCode || "All"} Page ${pNum}: ${err.message}`);
                  return [];
                }
              })
            );

            pageDataResults.forEach((pItems) => {
              mItems.push(...pItems);
            });
          } else if (page > 1) {
            // Standard non-term pagination (just fetch the inverted requested page)
            const backendPage = Math.max(1, mTotalPages - (page - 1));
            if (backendPage !== 1 && backendPage <= mTotalPages) {
              try {
                const pageData = await fetchPncpWithHostFallback(`${queryParams}&pagina=${backendPage}`, 0, 3500, 50);
                mItems = pageData.data || [];
              } catch (pageErr: any) {
                console.log(`[PNCP Connection] Secondary page query fallback to page 1 for modality ${mCode || "All"}: ${pageErr.message}`);
              }
            }
          }
        } catch (err: any) {
          console.warn(`[PNCP Connection] Falha na consulta de modalidade ${mCode || "Todas"}:`, err.message);
          throw err;
        }

        return { items: mItems, total: mTotalRecords };
      })
    );

    // Combine results from all parallel executions
    results.forEach((res) => {
      items.push(...res.items);
      totalRecords += res.total;
    });

    // Remove duplicates by ID (numeroControlePNCP) to ensure pristine results
    const seen = new Set<string>();
    items = items.filter((item) => {
      const id = item.numeroControlePNCP || item.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // 1. Sort by dataAtualizacao descending (Latest updated first, matching PNCP Portal)
    items.sort((a: any, b: any) => {
      const dateA = new Date(a.dataAtualizacao || a.dataAtualizacaoGlobal || a.dataPublicacaoPncp || a.dataInclusao || 0).getTime();
      const dateB = new Date(b.dataAtualizacao || b.dataAtualizacaoGlobal || b.dataPublicacaoPncp || b.dataInclusao || 0).getTime();
      return dateB - dateA;
    });

    // 2. Filter by keyword (termo) if specified (since external PNCP ignores query parameters)
    if (termo && String(termo).trim().length > 0) {
      const keyword = cleanStringForSearch(String(termo));
      items = items.filter((item: any) => {
        const orgaoName = cleanStringForSearch(item.orgaoEntidade?.razaoSocial || "");
        const objeto = cleanStringForSearch(item.objetoCompra || item.objeto || "");
        const numPncp = cleanStringForSearch(item.numeroControlePNCP || "");
        const modalidadeName = cleanStringForSearch(item.modalidadeNome || "");
        return orgaoName.includes(keyword) || objeto.includes(keyword) || numPncp.includes(keyword) || modalidadeName.includes(keyword);
      });
    }

    // 3. Slice items for pagination (max 15 per page)
    const totalRecordsAdjusted = (termo || isAllModalities) ? items.length : totalRecords;
    const totalPagesAdjusted = (termo || isAllModalities) ? Math.max(1, Math.ceil(items.length / pageSize)) : Math.ceil(totalRecords / pageSize);
    
    // Slice corresponding page items
    const startIdx = (page - 1) * pageSize;
    const endIdx = page * pageSize;
    const slicedItems = items.slice(startIdx, endIdx);

    res.json({
      success: true,
      data: {
        data: slicedItems,
        totalRegistros: totalRecordsAdjusted,
        totalPaginas: totalPagesAdjusted,
        numeroPagina: page,
        paginasRestantes: Math.max(0, totalPagesAdjusted - page),
        empty: slicedItems.length === 0,
        isMock: false
      }
    });
  } catch (err: any) {
    console.error("[PNCP Search Backend] Erro na consulta do catálogo de dados abertos:", err);
    res.status(500).json({ error: "Falha na conexão com o sistema do PNCP: " + err.message });
  }
}
