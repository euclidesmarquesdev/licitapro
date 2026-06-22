import express from "express";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import {
  fetchWithRedirects,
  parsePncpIdentifier,
  buildPncpUrls,
  mapPncpData
} from "./utils.js";
import { isGeminiConfigured, ai, Type } from "../../services/gemini.js";
import { addAuditLogEntry, saveAuditLogToFirestore } from "../../services/audit.js";

/**
 * Importa um edital do PNCP pelo ID ou URL
 */
export async function handlePncpImport(req: express.Request, res: express.Response) {
  try {
    // 1. Extrai token
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token de autenticação não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user;

    if (!verifiedUser) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // 2. Extrai dados do body
    const { urlOrCode, runAIEnhance, clientProvidedData } = req.body;

    if (!urlOrCode || urlOrCode.trim().length < 5) {
      return res.status(400).json({ 
        error: "Forneça um link válido do PNCP ou o ID de contratação." 
      });
    }

    // 3. Parseia o identificador
    const parsed = parsePncpIdentifier(urlOrCode.trim());
    if (!parsed.isValid) {
      return res.status(400).json({
        error: "Não foi possível extrair o CNPJ, ano e sequencial. Formato esperado: CNPJ/ANO/SEQUENCIAL"
      });
    }

    console.log(`[PNCP Import] CNPJ: ${parsed.cnpj}, Ano: ${parsed.ano}, Seq: ${parsed.sequencial}`);

    // 4. Busca os dados
    let purchaseDetails: any = null;
    let itemsList: any[] = [];
    let filesList: any[] = [];
    let fetchErrorMsg = "";

    if (clientProvidedData) {
      console.log("[PNCP Import] Usando dados enviados pelo navegador");
      purchaseDetails = clientProvidedData.purchaseDetails;
      itemsList = clientProvidedData.itemsList || [];
      filesList = clientProvidedData.filesList || [];
    } else {
      // ✅ Gera URLs com fallback
      const urls = buildPncpUrls(parsed.cnpj, parsed.ano, parsed.sequencial);

      // ✅ BUSCA DETALHES - Tenta todas as URLs de detalhes
      console.log("[PNCP Import] Buscando detalhes do edital...");
      for (const url of urls.detail) {
        try {
          console.log(`[PNCP Import] Tentando: ${url}`);
          const response = await fetchWithRedirects(url, 5, 15000);
          
          if (response.ok) {
            purchaseDetails = await response.json();
            console.log(`[PNCP Import] ✅ Detalhes obtidos de: ${url}`);
            break;
          } else {
            fetchErrorMsg = `HTTP ${response.status}`;
            console.log(`[PNCP Import] ❌ Falha em ${url}: ${fetchErrorMsg}`);
          }
        } catch (err: any) {
          fetchErrorMsg = err.message;
          console.log(`[PNCP Import] ❌ Erro em ${url}: ${fetchErrorMsg}`);
        }
      }

      // ✅ SE CONSEGUIU DETALHES, BUSCA ITENS E ARQUIVOS
      if (purchaseDetails) {
        // Busca itens
        console.log("[PNCP Import] Buscando itens...");
        for (const url of urls.items) {
          try {
            console.log(`[PNCP Import] Tentando itens: ${url}`);
            const response = await fetchWithRedirects(url, 5, 15000);
            if (response.ok) {
              const data = await response.json();
              itemsList = Array.isArray(data) ? data : (data.resultado || data.data || []);
              console.log(`[PNCP Import] ✅ ${itemsList.length} itens encontrados`);
              break;
            }
          } catch (err: any) {
            console.log(`[PNCP Import] ❌ Erro ao buscar itens: ${err.message}`);
          }
        }

        // Busca arquivos
        console.log("[PNCP Import] Buscando arquivos...");
        for (const url of urls.files) {
          try {
            console.log(`[PNCP Import] Tentando arquivos: ${url}`);
            const response = await fetchWithRedirects(url, 5, 15000);
            if (response.ok) {
              const data = await response.json();
              filesList = Array.isArray(data) ? data : (data.resultado || data.data || []);
              console.log(`[PNCP Import] ✅ ${filesList.length} arquivos encontrados`);
              break;
            }
          } catch (err: any) {
            console.log(`[PNCP Import] ❌ Erro ao buscar arquivos: ${err.message}`);
          }
        }
      }
    }

    // 5. Verifica se conseguiu os dados
    if (!purchaseDetails) {
      return res.status(404).json({
        error: `Não foi possível obter detalhes deste edital. Erro: ${fetchErrorMsg || "API indisponível"}`
      });
    }

    // 6. Mapeia os dados
    console.log("[PNCP Import] Mapeando dados...");
    const mappedData = mapPncpData(purchaseDetails, itemsList, filesList);

    // 7. Enriquecimento com IA (opcional)
    let aiEnhancement = null;
    if (runAIEnhance && isGeminiConfigured) {
      console.log("[PNCP Import] Enriquecendo com IA...");
      aiEnhancement = await enhanceWithAI(purchaseDetails, mappedData);
    }

    // 8. Monta resultado final
    const result = {
      ...mappedData,
      checklistRecomendado: aiEnhancement?.checklist || [
        "Certidão Conjunta Negativa de Débitos Federais",
        "Certificado de Regularidade do FGTS (CRF)",
        "Certidão Negativa de Débitos Trabalhistas (CNDT)",
        "Balanço Patrimonial do último exercício social",
        "Atestado de Capacidade Técnica operacional compatível"
      ],
      competitorsEstimated: aiEnhancement?.competitors || [],
      disclaimer: "Dados recuperados diretamente da API oficial do PNCP/MGI"
    };

    // 9. Registra auditoria
    const auditLog = addAuditLogEntry(
      "/api/pncp/import",
      { urlOrCode, runAIEnhance, parsedCnpj: parsed.cnpj },
      { success: true, data: result },
      false,
      undefined,
      aiEnhancement?.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
    await saveAuditLogToFirestore(token, auditLog, verifiedUser.uid);

    console.log("[PNCP Import] ✅ Importação concluída com sucesso!");
    res.json({ success: true, isMock: false, data: result });

  } catch (err: any) {
    console.error("[PNCP Import] ❌ Erro:", err);
    res.status(500).json({ 
      error: "Falha na conexão com o sistema do PNCP: " + err.message 
    });
  }
}

/**
 * Enriquecimento com IA
 */
async function enhanceWithAI(purchaseDetails: any, mappedData: any): Promise<{
  checklist: string[];
  competitors: string[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const org = purchaseDetails.orgaoEntidade?.razaoSocial || "Órgão";
  const modeName = purchaseDetails.modalidadeNome || "Pregão";
  const rawObjeto = purchaseDetails.objetoCompra || purchaseDetails.objeto || "";
  const rawValue = purchaseDetails.valorTotalEstimado || 0;

  const aiPrompt = `
    Com base nos dados do edital, retorne em JSON:
    - 'checklistRecomendado': 4 a 8 documentos de habilitação específicos
    - 'competitorsEstimated': 2 a 4 empresas concorrentes realistas

    Órgão: ${org}
    Objeto: ${rawObjeto}
    Modalidade: ${modeName}
    Valor: R$ ${rawValue}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: aiPrompt }] }],
      config: {
        systemInstruction: "Aja como Analista de Licitações Sênior.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            checklistRecomendado: { type: Type.ARRAY, items: { type: Type.STRING } },
            competitorsEstimated: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["checklistRecomendado", "competitorsEstimated"]
        }
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");

    return {
      checklist: parsed.checklistRecomendado || [],
      competitors: parsed.competitorsEstimated || [],
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 500,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 200,
        totalTokens: response.usageMetadata?.totalTokenCount || 700
      }
    };
  } catch (err) {
    console.warn("[PNCP Import] IA falhou:", err);
    return {
      checklist: [],
      competitors: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }
}