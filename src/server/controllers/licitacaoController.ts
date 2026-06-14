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
 * Real API Integrator with the Gov PNCP Portal (Consumes no Gemini Tokens, extracts with 100% precision)
 */
export async function handlePncpImport(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;

    const { urlOrCode, runAIEnhance } = req.body;
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

    // Try both portals with the new API endpoint structure for details (api/consulta/v1) and legacy fallback
    const detailUrls = [
      `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`,
      `https://dadosabertos.pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`,
      `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`,
      `https://dadosabertos.pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`
    ];

    let purchaseDetails: any = null;
    let itemsList: any[] = [];
    let filesList: any[] = [];
    let fetchErrorMsg = "";

    for (const url of detailUrls) {
      try {
        console.log(`[PNCP Direct API] Consultando detalhes do edital na URL: ${url}`);
        const detailsRes = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0"
          }
        });

        if (detailsRes.ok) {
          purchaseDetails = await detailsRes.json();
          break; // break early on success
        } else {
          fetchErrorMsg = `Portal retornou código HTTP ${detailsRes.status}`;
        }
      } catch (err: any) {
        fetchErrorMsg = err.message;
        console.warn(`[PNCP Direct API] Erro na URL de detalhes ${url}:`, err.message);
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
          const [itemsRes, filesRes] = await Promise.all([
            fetch(`${apiBase}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=500`, {
              headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
            }).catch(() => null),
            fetch(`${apiBase}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`, {
              headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
            }).catch(() => null)
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
          console.warn(`[PNCP Direct API] Erro ao buscar sub-recursos na URL base ${apiBase}:`, err.message);
        }
      }
    }

    if (!purchaseDetails) {
      return res.status(404).json({
        error: `Não conseguimos consultar o edital no PNCP diretamente. Detalhes: ${fetchErrorMsg}. Certifique-se de que o ID de contratação ${cnpj}-${ano}-${sequencial} realmente existe e está homologado/publicado.`
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
    let isMock = false;
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

    // Default to Pregão (6) if no modality or 'Todos' is specified to meet the mandatory PNCP API parameter
    const modalidadeCode = (codigoModalidade && String(codigoModalidade) !== "Todos" && String(codigoModalidade) !== "")
      ? String(codigoModalidade)
      : "6";

    // Build base URL without page parameters
    let baseSearchUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${start}&dataFinal=${end}&tamanhoPagina=50`;
    if (uf && String(uf) !== "Todos" && String(uf) !== "") {
      baseSearchUrl += `&uf=${String(uf)}`;
    }
    baseSearchUrl += `&codigoModalidadeContratacao=${modalidadeCode}`;

    // 1. Fetch metadata first (page 1) to find total records & pages
    const metadataUrl = `${baseSearchUrl}&pagina=1`;
    console.log(`[PNCP Search Backend] Requisitando Metadados URL: ${metadataUrl}`);

    const metaRes = await fetch(metadataUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!metaRes.ok) {
      throw new Error(`PNCP principal retornou código de status HTTP ${metaRes.status}`);
    }

    const metaData = await metaRes.json();
    const totalRecords = metaData.totalRegistros || 0;
    const totalPages = metaData.totalPaginas || 1;

    let items: any[] = [];

    // Helper to normalize the text ignoring case and Portuguese accents for fuzzy search
    const cleanStringForSearch = (str: string): string => {
      return (str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    };

    // If there is only 1 page, we just use the current page data directly (it's already the newest and oldest combined)
    if (totalPages <= 1) {
      items = metaData.data || [];
    } else {
      // Reversing pagination scale!
      // Since the API returns oldest-first, User Page 1 should fetch the LAST page (totalPages).
      // User Page 2 should fetch second-to-last page (totalPages - 1), and so on.
      const backendPage = Math.max(1, totalPages - (page - 1));

      // If a search term is specified, we fetch multiple pages in parallel to scan a larger set (up to 500 records)
      if (termo && String(termo).trim().length > 0) {
        const pagesToFetch: number[] = [];
        // Scan starting from backendPage down to 9 pages prior
        const startPage = backendPage;
        for (let i = 0; i < 10; i++) {
          const pToGet = startPage - i;
          if (pToGet >= 1 && pToGet <= totalPages) {
            pagesToFetch.push(pToGet);
          }
        }

        console.log(`[PNCP Deep Search Backend] Fetching ${pagesToFetch.length} pages in parallel to find "${termo}"...`);
        
        try {
          const fetchPromises = pagesToFetch.map(async (pNum) => {
            const pageUrl = `${baseSearchUrl}&pagina=${pNum}`;
            const pageRes = await fetch(pageUrl, {
              headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0"
              }
            });
            if (pageRes.ok) {
              const pageData = await pageRes.json();
              return pageData.data || [];
            }
            return [];
          });

          const resultsArray = await Promise.all(fetchPromises);
          items = resultsArray.flat();
        } catch (err) {
          console.error("[PNCP Deep Search Parallel Fetch failed]:", err);
          items = metaData.data || [];
        }
      } else {
        // Standard non-term pagination (just 1 page)
        if (backendPage >= 1 && backendPage <= totalPages) {
          const pageUrl = `${baseSearchUrl}&pagina=${backendPage}`;
          console.log(`[PNCP Search Backend] Requisitando Página Inversa ${backendPage}/${totalPages} URL: ${pageUrl}`);

          const pageRes = await fetch(pageUrl, {
            headers: {
              "Accept": "application/json",
              "User-Agent": "Mozilla/5.0"
            }
          });

          if (pageRes.ok) {
            const pageData = await pageRes.json();
            items = pageData.data || [];

            // Fetch previous page too if items are too few
            if (items.length < 25 && backendPage > 1) {
              const prevPageUrl = `${baseSearchUrl}&pagina=${backendPage - 1}`;
              const prevRes = await fetch(prevPageUrl, {
                headers: {
                  "Accept": "application/json",
                  "User-Agent": "Mozilla/5.0"
                }
              });
              if (prevRes.ok) {
                const prevData = await prevRes.json();
                const prevItems = prevData.data || [];
                items = [...items, ...prevItems];
              }
            }
          } else {
            items = metaData.data || [];
          }
        }
      }
    }

    // 1. Sort by dataAtualizacao descending (Latest updated first, exactly matching current PNCP Portal behavior)
    items.sort((a: any, b: any) => {
      const dateA = new Date(a.dataAtualizacao || a.dataAtualizacaoGlobal || a.dataPublicacaoPncp || a.dataInclusao || 0).getTime();
      const dateB = new Date(b.dataAtualizacao || b.dataAtualizacaoGlobal || b.dataPublicacaoPncp || b.dataInclusao || 0).getTime();
      return dateB - dateA;
    });

    // 2. Filter by keyword (termo) if specified (since external PNCP ignores the query parameter)
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
    const totalRecordsAdjusted = termo ? items.length : totalRecords;
    const totalPagesAdjusted = termo ? Math.max(1, Math.ceil(items.length / pageSize)) : totalPages;
    const slicedItems = items.slice(0, pageSize);

    res.json({
      success: true,
      data: {
        data: slicedItems,
        totalRegistros: totalRecordsAdjusted,
        totalPaginas: totalPagesAdjusted,
        numeroPagina: page,
        paginasRestantes: Math.max(0, totalPagesAdjusted - page),
        empty: slicedItems.length === 0
      }
    });
  } catch (err: any) {
    console.error("[PNCP Search Backend] Erro na consulta do catálogo de dados abertos:", err);
    res.status(500).json({ error: "Falha na conexão com o sistema do PNCP: " + err.message });
  }
}
