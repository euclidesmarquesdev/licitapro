import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Ensure Gemini API key is configured
const geminiKey = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: geminiKey || "MOCK_KEY_SANS_SECRET",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // API 1: Extract bidding metadata from URL or raw text using Gemini
  app.post("/api/licitacoes/scrape", async (req, res) => {
    try {
      const { url, rawText } = req.body;
      let textToAnalyze = rawText || "";

      // If URL is provided and no rawText was pasted, try fetching it
      if (url && !textToAnalyze) {
        try {
          const fetchRes = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });
          if (fetchRes.ok) {
            const html = await fetchRes.text();
            // Simple clean-up of HTML tag noise to save token limit
            textToAnalyze = html
              .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
              .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .substring(0, 45000); // Take first 45k chars
          } else {
            return res.status(400).json({
              error: `Não foi possível acessar a página diretamente (Erro HTTP ${fetchRes.status}). Copie e cole o texto ou edital da página no campo fornecido!`
            });
          }
        } catch (fetchErr) {
          return res.status(400).json({
            error: "Falha na conexão ao tentar acessar a URL do edital. Isso pode ocorrer por bloqueio de bots ou CORS. Cole o texto da página do edital diretamente no campo abaixo para prosseguir com a IA!"
          });
        }
      }

      if (!textToAnalyze || textToAnalyze.trim().length === 0) {
        return res.status(400).json({
          error: "Nenhum texto ou conteúdo de edital foi fornecido para análise."
        });
      }

      // Check if API key is present
      if (!geminiKey) {
        // Fallback mockup in case API key is missing
        return res.json({
          success: true,
          isMock: true,
          data: {
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
            ]
          }
        });
      }

      const prompt = `Analise o texto fornecido extraído de uma página de licitação pública brasileira e obtenha os seguintes campos estruturados:
      1. 'edital': Identificação/Número do edital ou processo (ex: "Pregão Eletrônico nº 15/2026" ou "Concorrência 02/2026")
      2. 'orgao': Nome do Órgão Licitante (ex: "Prefeitura Municipal de Campinas")
      3. 'modalidade': Escolha uma das modalidades (ex: "Pregão Eletrônico", "Pregão Presencial", "Concorrência", "Tomada de Preços", "Inexigibilidade", "Dispensa", "Diálogo Competitivo", "Leilão")
      4. 'objeto': Descrição resumida e clara dos produtos ou serviços licitados.
      5. 'valorEstimado': Valor orçado estimado em formato numérico (ex: 1250000.50). Retorne 0 se não encontrar.
      6. 'dataSessao': Data e horário de abertura da sessão pública no formato YYYY-MM-DDTHH:MM (ex: "2026-06-25T09:00"). Se encontrar somente data, assumir horário comercial típico (ex: 09:00).
      7. 'cidade': Cidade da sessão ou órgão.
      8. 'estado': Estado em sigla de duas letras (ex: "SP", "RJ", "MG").
      9. 'categoria': Escolha uma categoria que melhor se encaixe: "Tecnologia da Informação", "Obras & Engenharia", "Serviços Gerais", "Materiais & Equipamentos", "Consultoria", "Saúde & Medicamentos", "Alimentação & Merenda", "Outros".
      10. 'checklistRecomendado': Lista contendo entre 4 a 8 nomes de documentos cruciais exigidos pela lei brasileira de licitações para esta modalidade/objeto (como Balanço Patrimonial, CRF FGTS, FGTS, Certidão Trabalhista, Atestado de Capacidade Técnica, etc.) de forma customizada.
      11. 'competitorsEstimated': Uma previsão realista ou estimativa de 2 a 4 empresas concorrentes frequentes ou potenciais nesse segmento.
      12. 'arquivosPncp': Lista contendo arquivos/documentos oficiais de editais ou anexos (tipicamente arquivos .pdf, .zip, .docx) mencionados ou presentes no texto. Cada arquivo deve ser um objeto com:
          - 'id': Um ID único curto de string (ex: "doc-1")
          - 'nome': Nome do arquivo encontrado (ex: "Edital_preg_ao_35.pdf" ou "Termo_de_Referencia.zip")
          - 'descricao': Descrição do arquivo (ex: "Edital Completo" ou "Projeto Básico")
          - 'tamanho': Tamanho em KB/MB se houver no texto, senão "Indisponível"
          - 'linkUrl': URL para realizar o download se estiver explícita no texto (começando com http ou https), caso contrário preencher com a URL padrão "https://pncp.gov.br/app/editais?pagina=1"

      Texto da página:
      """
      ${textToAnalyze.substring(0, 30000)}
      """`;

      // Structure schema for response
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
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
            required: ["edital", "orgao", "modalidade", "objeto", "valorEstimado", "dataSessao", "cidade", "estado", "categoria", "checklistRecomendado", "competitorsEstimated", "arquivosPncp"]
          },
          systemInstruction: "Você é um Analista de Licitações Sênior que extrai informações de editais governamentais com extrema precisão e gera checklists de habilitação em conformidade com as leis Leis 8.666/93 e 14.133/2021."
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("A IA gerou uma resposta vazia.");
      }

      const parsedJSON = JSON.parse(resultText.trim());
      res.json({ success: true, data: parsedJSON });

    } catch (err: any) {
      console.error("Erro no scraping IA:", err);
      res.status(500).json({ error: "Erro interno ao processar com a IA: " + err.message });
    }
  });

  // API 2: AI Predictive Analysis for a given Bidding
  app.post("/api/licitacoes/predict", async (req, res) => {
    try {
      const { licitacao, competitors, historicalPrices } = req.body;

      if (!licitacao) {
        return res.status(400).json({ error: "Dados da licitação não fornecidos para análise preditiva." });
      }

      if (!geminiKey) {
        // Fallback response for missing API key:
        return res.json({
          success: true,
          isMock: true,
          prediction: {
            level: "MÉDIO-ALTO",
            recommendedDiscount: "14.5% - 19.2%",
            targetPrice: licitacao.valorEstimado ? (licitacao.valorEstimado * 0.83).toFixed(2) : "0.00",
            winProbability: "68%",
            competitorInsights: "As empresas fornecidas possuem grande atuação na região administrativa selecionada. Espera-se concorrência acirrada em lances eletrônicos. Recomenda-se focar na otimização de custos logísticos ou buscar isenção ICMS se aplicável.",
            risks: [
              "Vencimento iminente da CND Trabalhista durante o prazo estipulado.",
              "Exigência de qualificação técnica com índice específico de liquidez corrente superior a 1.25.",
              "Histórico de impugnações decorrentes de especificações restritivas no edital do órgão."
            ],
            strategy: "Entrar com proposta de abertura conservadora (ex: desconto de 5%) e programar lances automáticos (robô) calibrados com limite de margem líquida de 12%. Preparar as declarações de ME/EPP se enquadrado para usufruir da preferência de desempate."
          }
        });
      }

      const prompt = `Aja como o maior especialista analista de inteligência de mercado pública do Brasil.
      Analise os dados da licitação descrita e dê recomendações estratégicas, análise preditiva de lances e probabilidade de sucesso.

      Dados da Licitação:
      - Órgão: ${licitacao.orgao}
      - Edital/ID: ${licitacao.edital}
      - Objeto: ${licitacao.objeto}
      - Modalidade: ${licitacao.modalidade}
      - Valor Estimado: R$ ${licitacao.valorEstimado}
      - Região: ${licitacao.cidade} - ${licitacao.estado}
      - Categoria: ${licitacao.categoria}

      Concorrentes Digitados/Conhecidos:
      ${JSON.stringify(competitors || [])}

      Histórico Geral de Preços Licitados na Categoria (se houver):
      ${JSON.stringify(historicalPrices || [])}

      Gere uma análise no formato JSON contendo exatamente as seguintes propriedades:
      1. 'level': Nível estimado de concorrência ("BAIXO", "MÉDIO", "ALTO", "CRÍTICO/MUITO ALTO")
      2. 'recommendedDiscount': Faixa de desconto recomendada em porcentagem (ex: "10.5% - 15.0%")
      3. 'targetPrice': Preço-alvo para propor ou máximo limite estratégico calculado (R$ formatado ou valor numérico string)
      4. 'winProbability': Probabilidade estimada de sucesso da nossa empresa (ex: "75%")
      5. 'competitorInsights': Resumo de comportamento preditivo dos concorrentes, analisando o padrão de lances que costumam adotar.
      6. 'risks': Lista de 3 riscos iminentes/técnicos ou jurídicos do edital ou da disputa de preços.
      7. 'strategy': Recomendações estratégicas e táticas de guerra para vencer o pregão.`;

      const response = await ai.models.generateContent({
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
          }
        }
      });

      const parsedJSON = JSON.parse(response.text?.trim() || "{}");
      res.json({ success: true, prediction: parsedJSON });

    } catch (err: any) {
      console.error("Erro na predição IA:", err);
      res.status(500).json({ error: "Erro interno na predição da IA: " + err.message });
    }
  });

  // API 3: Auto Document Generation Template Generator based on Bidding Details
  app.post("/api/licitacoes/generate-document", async (req, res) => {
    try {
      const { docType, licitacao, ourCompanyDetails } = req.body;

      if (!licitacao) {
        return res.status(400).json({ error: "Dados da licitação necessários para elaboração do documento." });
      }

      const companyDetails = ourCompanyDetails || {
        name: "Minha Empresa GovTech Brasil S/A",
        cnpj: "12.345.678/0001-99",
        address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
        partnerName: "Fulano de Souza Rezende",
        partnerCPF: "111.222.333-44",
        partnerRole: "Sócio Administrador"
      };

      if (!geminiKey) {
        return res.json({
          success: true,
          isMock: true,
          documentTitle: `Declaração para ${licitacao.edital}`,
          content: `DECLARAÇÃO DE COMPLASCÊNCIA E REGULARIDADE\n\nAo Órgão: ${licitacao.orgao}\nEdital: ${licitacao.edital}\n\nA empresa ${companyDetails.name}, inscrita no CNPJ sob o nº ${companyDetails.cnpj}, sediada no endereço ${companyDetails.address}, por intermédio de seu representante legal, Sr(a). ${companyDetails.partnerName}, portador(a) do CPF nº ${companyDetails.partnerCPF}, declara para os devidos fins de habilitação e conformidade legal:\n\n1. Que cumprimos plenamente todos os requisitos vigentes exigidos na modalidade de ${licitacao.modalidade} referente ao objeto: "${licitacao.objeto}".\n2. Que nos termos do artigo 7º, inciso XXXIII, da Constituição Federal, não empregamos menores de dezoito anos em trabalho noturno, perigoso ou insalubre e nem menores de dezesseis anos em qualquer trabalho.\n3. Que inexiste fato superveniente impeditivo de nossa habilitação técnica ou jurídica.\n\nPor ser expressão da verdade, firmamos o presente termo.\n\n${licitacao.cidade || "Local"}, ${new Date().toLocaleDateString("pt-BR")}.\n\n_____________________________________________\n${companyDetails.partnerName}\n${companyDetails.partnerRole}`
        });
      }

      const prompt = `Gere uma declaração ou proposta oficial formalizada em língua portuguesa para participação em licitações públicas com base nos seguintes dados:
      - Tipo de Documento: ${docType} (ex: "Declaração de Habilitação Geral", "Declaração de Superveniência e CF Art 7", "Carta de Proposta Comercial Inicial", "Declaração de Enquadramento ME/EPP")
      - Licitação: Edital ${licitacao.edital} do órgão ${licitacao.orgao}
      - Objeto: ${licitacao.objeto}
      - Modalidade: ${licitacao.modalidade}
      
      Dados da Nossa Empresa Licitante:
      - Razão Social: ${companyDetails.name}
      - CNPJ: ${companyDetails.cnpj}
      - Endereço completo: ${companyDetails.address}
      - Assinante: ${companyDetails.partnerName} (${companyDetails.partnerRole}), CPF: ${companyDetails.partnerCPF}

      O texto deve ser um modelo formal brasileiro, completo, bem espaçado, com cabeçalho, corpo completo citando os artigos da lei e rodapé para assinatura do sócio.
      Retorne um JSON contendo:
      1. 'documentTitle': O título sugerido do documento
      2. 'content': O texto estruturado e formatado em parágrafos de texto puro, prontinho para copiar/colar e imprimir na pasta do processo.`;

      const response = await ai.models.generateContent({
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
      });

      const parsedJSON = JSON.parse(response.text?.trim() || "{}");
      res.json({ success: true, data: parsedJSON });

    } catch (err: any) {
      console.error("Erro na geração de documento:", err);
      res.status(500).json({ error: "Erro interno ao gerar documento preliminar: " + err.message });
    }
  });

  // Serve static files and integrate Vite in development or serve production builds
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
