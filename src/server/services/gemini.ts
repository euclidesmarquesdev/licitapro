import { GoogleGenAI, Type } from "@google/genai";
import { withTimeout } from "../utils/timeout";

// Ensure Gemini API key is configured
const geminiKey = process.env.GEMINI_API_KEY;

export const ai = new GoogleGenAI({
  apiKey: geminiKey || "MOCK_KEY_SANS_SECRET",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export const isGeminiConfigured = !!geminiKey;

/**
 * Executes a structured scrape/extraction of bidding contents using gemini-3.5-flash
 */
export async function extractBiddingMetadata(
  textToAnalyze: string,
  sanitizedUrl: string,
  useUrlContextTool: boolean
): Promise<{ parsed: any; isMock: boolean; usage: any }> {
  if (!isGeminiConfigured) {
    const mockData = {
      edital: "Pregão Eletrônico SRP 35/2026",
      orgao: "Tribunal Regional Federal (TRF) - 3ª Região",
      modalidade: "Pregão Eletrônico",
      objeto: "Contratação de empresa especializada para modernização tecnológica, suporte de infraestrutura em nuvem, e fornecimento de hardware de alto desempenho.",
      valorEstimado: 2450000.00,
      dataSessao: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
      cidade: "São Paulo",
      estado: "SP",
      categoria: "Tecnologia da Informação",
      checklistRecomendado: [
        "Certidão Conjunta Negativa de Débitos Federais",
        "Balanço Patrimonial do último exercício social",
        "Atestado de Capacidade Técnica operacional compatível",
        "Certificado de Regularidade de Situação do FGTS (CRF)",
        "Atestado de Vistoria ou Declaração de Conhecimento do Local",
        "Declaração de cumprimento do Art. 7º, XXXIII da CF"
      ],
      competitorsEstimated: ["Softplan Planejamento", "Tech Solution Brasil Ltda", "GovTech Infra S.A."],
      arquivosPncp: [
        { id: "mock-doc-1", nome: "Edital_Concorrencia_35_2026.pdf", descricao: "Edital de Abertura Oficial", tamanho: "1.4 MB", linkUrl: "https://pncp.gov.br/app/editais?pagina=1" },
        { id: "mock-doc-2", nome: "Projeto_Basico_Anexo_I.pdf", descricao: "Anexo Técnico e Requisitos", tamanho: "3.2 MB", linkUrl: "https://pncp.gov.br/app/editais?pagina=1" }
      ],
      disclaimer: "Aviso Legal - Lei 14.133/2021: Os dados cadastrais e checklists foram recuperados/gerados por inteligência artificial em modo offline."
    };
    return { parsed: mockData, isMock: true, usage: { promptTokens: 350, completionTokens: 50, totalTokens: 400 } };
  }

  const promptTemplate = `Analise o edital ou dados da licitação pública brasileira fornecidos e obtenha os seguintes campos estruturados em JSON:
  1. 'edital': Identificação/Número do edital ou processo (ex: "Pregão Eletrônico nº 15/2026" ou "Concorrência 02/2026")
  2. 'orgao': Nome do Órgão Licitante (ex: "Prefeitura Municipal de Campinas")
  3. 'modalidade': Escolha uma das seguintes modalidades exatas: "Pregão Eletrônico", "Pregão Presencial", "Concorrência", "Tomada de Preços", "Inexigibilidade", "Dispensa", "Diálogo Competitivo", "Leilão"
  4. 'objeto': Descrição resumida, rica e clara dos produtos ou serviços licitados.
  5. 'valorEstimado': Valor orçado estimado em formato numérico (ex: 1250000.50). Retorne 0 se não encontrar.
  6. 'dataSessao': Data e horário de abertura da sessão pública no formato YYYY-MM-DDTHH:MM (ex: "2026-06-25T09:00"). Se encontrar somente data, assumir horário comercial típico (ex: 09:00).
  7. 'cidade': Cidade da sessão ou órgão.
  8. 'estado': Estado em sigla de duas letras (ex: "SP", "RJ", "MG").
  9. 'categoria': Escolha uma categoria correspondente: "Tecnologia da Informação", "Obras & Engenharia", "Serviços Gerais", "Materiais & Equipamentos", "Consultoria", "Saúde & Medicamentos", "Alimentação & Merenda", "Outros".
  10. 'checklistRecomendado': Lista contendo entre 4 a 8 nomes de documentos cruciais e específicos exigidos no edital para habilitação técnica e jurídica (como Balanço Patrimonial, CRF FGTS, FGTS, Certidão Trabalhista, Atestado de Capacidade Técnica, etc.).
  11. 'competitorsEstimated': Uma previsão de 2 a 4 empresas concorrentes realistas frequentes ou potenciais nesse segmento.
  12. 'arquivosPncp': Lista contendo arquivos/documentos oficiais de editais ou anexos mencionados no texto. Cada arquivo deve ser um objeto com:
      - 'id': Um ID único curto de string (ex: "doc-1")
      - 'nome': Nome do arquivo encontrado (ex: "Edital_preg_ao_35.pdf" ou "Termo_de_Referencia.zip")
      - 'descricao': Descrição do edital ou termo
      - 'tamanho': Tamanho em KB/MB se houver no texto, senão "Indisponível"
      - 'linkUrl': URL para download se explícita no texto, senão usar "https://pncp.gov.br/app/editais?pagina=1"`;

  const contents = useUrlContextTool && sanitizedUrl
    ? `${promptTemplate}\n\nAnalise o arquivo ou conteúdo principal da página pública contida na seguinte URL real: ${sanitizedUrl}`
    : `${promptTemplate}\n\nTexto extraído do edital:\n\"\"\"\n${textToAnalyze.substring(0, 32000)}\n\"\"\"`;

  const config: any = {
    systemInstruction: "Você é um Analista de Licitações Sênior especialista em compras públicas brasileiras (Leis 14.133/2021 e 8.666/93). Extraia dados com precisão total, e monte o checklist de habilitação baseado no edital analisado.",
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        edital: { type: Type.STRING },
        orgao: { type: Type.STRING },
        modalidade: { type: Type.STRING },
        objeto: { type: Type.STRING },
        valorEstimado: { type: Type.NUMBER },
        dataSessao: { type: Type.STRING },
        cidade: { type: Type.STRING },
        estado: { type: Type.STRING },
        categoria: { type: Type.STRING },
        checklistRecomendado: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        competitorsEstimated: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        arquivosPncp: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              nome: { type: Type.STRING },
              descricao: { type: Type.STRING },
              tamanho: { type: Type.STRING },
              linkUrl: { type: Type.STRING }
            },
            required: ["id", "nome", "descricao", "tamanho", "linkUrl"]
          }
        }
      },
      required: [
        "edital", "orgao", "modalidade", "objeto", "valorEstimado", 
        "dataSessao", "cidade", "estado", "categoria", "checklistRecomendado", 
        "competitorsEstimated", "arquivosPncp"
      ]
    }
  };

  if (useUrlContextTool && sanitizedUrl) {
    config.tools = [{ urlContext: {} }];
  }

  const response = await withTimeout(
    ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ parts: [{ text: contents }] }],
      config: config
    }),
    30000,
    "Extração de Edital"
  );

  const resultText = response.text;
  if (!resultText) {
    throw new Error("A IA gerou uma resposta vazia.");
  }

  const parsedJSON = JSON.parse(resultText.trim());
  parsedJSON.disclaimer = "Aviso Legal - Lei 14.133/2021: Os dados cadastrais e as listas de habilitação foram consolidados de forma robótica por análise semântica assistida de IA.";

  const usageStats = {
    promptTokens: response.usageMetadata?.promptTokenCount || 1500,
    completionTokens: response.usageMetadata?.candidatesTokenCount || 400,
    totalTokens: response.usageMetadata?.totalTokenCount || 1900
  };

  return { parsed: parsedJSON, isMock: false, usage: usageStats };
}

/**
 * Predicts bid strategy parameters using gemini-3.5-flash (Enhanced with Search Grounding / Citations)
 */
export async function predictBiddingOutcome(
  sanitizedLicitacao: any,
  competitors: any[],
  historicalPrices: any[]
): Promise<{ prediction: any; citations: any[]; isMock: boolean; usage: any }> {
  if (!isGeminiConfigured) {
    const mockPrediction = {
      level: "MÉDIO-ALTO",
      recommendedDiscount: "14.5% - 19.2%",
      targetPrice: sanitizedLicitacao.valorEstimado ? (sanitizedLicitacao.valorEstimado * 0.83).toFixed(2) : "0.00",
      winProbability: "68%",
      competitorInsights: "As empresas fornecidas possuem grande atuação na região administrativa selecionada. Espera-se concorrência acirrada em lances eletrônicos. Recomenda-se focar na otimização de custos logísticos ou buscar isenção ICMS se aplicável.",
      risks: [
        "Vencimento iminente da CND Trabalhista durante o prazo estipulado.",
        "Exigência de qualificação técnica com índice específico de liquidez corrente superior a 1.25.",
        "Histórico de impugnações decorrentes de especificações restritivas no edital do órgão."
      ],
      strategy: "Entrar com proposta de abertura conservadora (ex: desconto de 5%) e programar lances automáticos (robô) calibrados com limite de margem líquida de 12%. Preparar as declarações de ME/EPP se enquadrado para usufruir da preferência de desempate."
    };
    return { prediction: mockPrediction, citations: [], isMock: true, usage: { promptTokens: 450, completionTokens: 100, totalTokens: 550 } };
  }

  const prompt = `Aja como o maior analista e modelador estratégico de licitações governamentais no Brasil.
  Sua missão é realizar uma análise de inteligência preditiva profunda de mercado para o seguinte edital. Use a ferramenta do Google Search (buscando no PNCP, ComprasNet ou diários oficiais) para verificar os concorrentes conhecidos ou tendências de lances recentes do órgão ou segmento correspondente se preferir.

  Dados do Edital:
  - Órgão Licitante: ${sanitizedLicitacao.orgao}
  - Edital Ref: ${sanitizedLicitacao.edital}
  - Objeto: ${sanitizedLicitacao.objeto}
  - Modalidade: ${sanitizedLicitacao.modalidade}
  - Valor Orçado do Edital: R$ ${sanitizedLicitacao.valorEstimado}
  - Região Física: ${sanitizedLicitacao.cidade} - ${sanitizedLicitacao.estado}
  - Categoria: ${sanitizedLicitacao.categoria}

  Concorrentes Conhecidos no Sistema:
  ${JSON.stringify(competitors || [])}

  Histórico de Preços de Referência da Categoria do Produto:
  ${JSON.stringify(historicalPrices || [])}

  Forneça um laudo de inteligência preditivo completo em formato JSON contendo exatamente as seguintes propriedades:
  1. 'level': Nível estimado de competitividade ("BAIXO", "MÉDIO", "ALTO", "CRÍTICO/MUITO ALTO")
  2. 'recommendedDiscount': Desconto estimado ótimo para vencer (ex: "12.0% - 18.5%")
  3. 'targetPrice': Preço-alvo para formulação da proposta inicial otimizada (ex: R$ 2.050.000,00 ou valor equivalente calibrado)
  4. 'winProbability': Probabilidade estatística aproximada de vitória baseado nas restrições de habilitação (ex: "72%")
  5. 'competitorInsights': Análise resumida de comportamento e vulnerabilidade dos concorrentes digitados, detalhando qual tática é mais provável de funcionar no pregão eletrônico.
  6. 'risks': Lista contendo 3 riscos cruciais (técnicos, regulatórios ou jurídicos) identificados para essa categoria ou objeto.
  7. 'strategy': Estratégia de guerra tática passo a passo (preparo, lances automáticos, acompanhamento, fase recursal) calibrada para maximizar as chances.`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.STRING },
            recommendedDiscount: { type: Type.STRING },
            targetPrice: { type: Type.STRING },
            winProbability: { type: Type.STRING },
            competitorInsights: { type: Type.STRING },
            risks: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            strategy: { type: Type.STRING }
          },
          required: ["level", "recommendedDiscount", "targetPrice", "winProbability", "competitorInsights", "risks", "strategy"]
        },
        tools: [{ googleSearch: {} }] // Activate Search Grounding to verify actual bidder actions!
      }
    }),
    30000,
    "Análise Preditiva"
  );

  const parsedJSON = JSON.parse(response.text?.trim() || "{}");

  // Extract grounding chunks/citations
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  const citations = groundingChunks?.map((chunk: any) => ({
    title: chunk.web?.title || "Diário Oficial / Portal de Compras",
    url: chunk.web?.uri
  })).filter((c: any) => c.url) || [];

  if (citations.length > 0) {
    parsedJSON._sources = citations;
  }

  const usageStats = {
    promptTokens: response.usageMetadata?.promptTokenCount || 2000,
    completionTokens: response.usageMetadata?.candidatesTokenCount || 500,
    totalTokens: response.usageMetadata?.totalTokenCount || 2500
  };

  return { prediction: parsedJSON, citations, isMock: false, usage: usageStats };
}

/**
 * Automatically crafts legal declarations and proposals using Lei 14.133 guidelines
 */
export async function draftGovernmentDocument(
  docType: string,
  sanitizedLicitacao: any,
  sanitizedCompanyDetails: any
): Promise<{ draft: any; isMock: boolean; usage: any }> {
  if (!isGeminiConfigured) {
    const mockDoc = {
      documentTitle: `Declaração para ${sanitizedLicitacao.edital}`,
      content: `DECLARAÇÃO DE COMPLASCÊNCIA E REGULARIDADE\n\nAo Órgão: ${sanitizedLicitacao.orgao}\nEdital: ${sanitizedLicitacao.edital}\n\nA empresa ${sanitizedCompanyDetails.name}, inscrita no CNPJ sob o nº ${sanitizedCompanyDetails.cnpj}, sediada no endereço ${sanitizedCompanyDetails.address}, por intermédio de seu representante legal, Sr(a). ${sanitizedCompanyDetails.partnerName}, portador(a) do CPF nº ${sanitizedCompanyDetails.partnerCPF}, declara para os devidos fins de habilitação e conformidade legal:\n\n1. Que cumprimos plenamente todos os requisitos vigentes exigidos na modalidade de ${sanitizedLicitacao.modalidade} referente ao objeto: "${sanitizedLicitacao.objeto}".\n2. Que nos termos do artigo 7º, inciso XXXIII, da Constituição Federal, não empregamos menores de dezoito anos em trabalho noturno, perigoso ou insalubre e nem menores de dezesseis anos em qualquer trabalho.\n3. Que inexiste fato superveniente impeditivo de nossa habilitação técnica ou jurídica.\n\nPor ser expressão da verdade, firmamos o presente termo.\n\n${sanitizedLicitacao.cidade || "Local"}, ${new Date().toLocaleDateString("pt-BR")}.\n\n_____________________________________________\n${sanitizedCompanyDetails.partnerName}\n${sanitizedCompanyDetails.partnerRole}`
    };
    return { draft: mockDoc, isMock: true, usage: { promptTokens: 250, completionTokens: 150, totalTokens: 400 } };
  }

  const prompt = `Gere uma minuta ou termo de declaração jurídica de habilitação oficial em língua portuguesa para participação em licitações públicas brasileiras com os seguintes dados:
  - Tipo de Documento: ${docType} (ex: "Declaração de Habilitação Geral", "Declaração de Superveniência e CF Art 7", "Carta de Proposta Comercial Inicial", "Declaração de Enquadramento ME/EPP")
  - Licitação: Edital ${sanitizedLicitacao.edital} do órgão ${sanitizedLicitacao.orgao}
  - Objeto do Edital: ${sanitizedLicitacao.objeto}
  - Modalidade: ${sanitizedLicitacao.modalidade}
  
  Dados Cadastrais da Empresa Requerente:
  - Razão Social: ${sanitizedCompanyDetails.name}
  - CNPJ: ${sanitizedCompanyDetails.cnpj}
  - Endereço completo: ${sanitizedCompanyDetails.address}
  - Representante Assinante: ${sanitizedCompanyDetails.partnerName} (${sanitizedCompanyDetails.partnerRole}), portador do CPF: ${sanitizedCompanyDetails.partnerCPF}

  Instruções de Estilo:
  Gere a minuta oficial com formatação impecável para diário e processos, com cabeçalho de intimação jurídica, citações adequadas da Lei de Licitações (Lei 14.133/2021 ou Lei 8.666/93 quando cabível) e espaçamento elegante para assinatura no fim.
  
  Retorne um JSON de resposta que contenha obrigatoriamente:
  1. 'documentTitle': O título formal do documento (ex: "DECLARAÇÃO VITAL DE CUMPRIMENTO DOS REQUISITOS DE HABILITAÇÃO")
  2. 'content': O corpo do texto estruturado e completo (texto cru puro formatado com quebras lineares elegantes, pronto para impressão e assinatura).`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentTitle: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["documentTitle", "content"]
        }
      }
    }),
    30000,
    "Elaboração de Documento"
  );

  const parsedJSON = JSON.parse(response.text?.trim() || "{}");

  const usageStats = {
    promptTokens: response.usageMetadata?.promptTokenCount || 1000,
    completionTokens: response.usageMetadata?.candidatesTokenCount || 600,
    totalTokens: response.usageMetadata?.totalTokenCount || 1600
  };

  return { draft: parsedJSON, isMock: false, usage: usageStats };
}
