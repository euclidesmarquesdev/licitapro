/**
 * Utilitários para integração com a API do PNCP
 */

/**
 * Segue redirecionamentos HTTP (301, 302, 307, 308)
 */
export async function fetchWithRedirects(
  url: string,
  maxRedirects: number = 5,
  timeoutMs: number = 15000
): Promise<Response> {
  let currentUrl = url;
  let redirects = 0;

  while (redirects < maxRedirects) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Cache-Control": "no-cache"
        },
        signal: controller.signal,
        redirect: "manual"
      });
      clearTimeout(timeoutId);

      // ✅ Se for redirecionamento sem Location, tenta novamente com redirect: follow
      if ([301, 302, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          console.log(`[PNCP] Redirecionamento sem Location em ${currentUrl}, tentando com follow...`);
          // Tenta novamente com redirect automático
          const followResponse = await fetch(currentUrl, {
            headers: {
              "Accept": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            redirect: "follow"
          });
          return followResponse;
        }
        currentUrl = new URL(location, currentUrl).toString();
        console.log(`[PNCP] Seguindo redirecionamento: ${currentUrl}`);
        redirects++;
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error(`Timeout após ${timeoutMs}ms na requisição ao PNCP`);
      }
      throw err;
    }
  }

  throw new Error(`Máximo de ${maxRedirects} redirecionamentos excedido`);
}

/**
 * Extrai CNPJ, Ano e Sequencial de uma URL ou código PNCP
 */
export function parsePncpIdentifier(input: string): {
  cnpj: string;
  ano: string;
  sequencial: string;
  isValid: boolean;
} {
  const cleanInput = input.trim();

  // Tenta extrair via regex: CNPJ/ANO/SEQUENCIAL
  const urlRegex = /(\d{14})\/(\d{4})\/(\d+)/;
  const match = cleanInput.match(urlRegex);

  if (match) {
    return {
      cnpj: match[1],
      ano: match[2],
      sequencial: match[3],
      isValid: true
    };
  }

  // Fallback: extrai números do texto
  const numbers = cleanInput.match(/\d+/g) || [];
  const foundCnpj = numbers.find((n: string) => n.length === 14);

  if (foundCnpj) {
    const foundYear = numbers.find((n: string) => n.length === 4 && parseInt(n) >= 2021 && parseInt(n) <= 2030);
    if (foundYear) {
      const otherNumbers = numbers.filter((n: string) => n !== foundCnpj && n !== foundYear);
      const sequencial = otherNumbers.length > 0 ? otherNumbers[otherNumbers.length - 1] : "";
      return {
        cnpj: foundCnpj,
        ano: foundYear,
        sequencial,
        isValid: !!sequencial
      };
    }
  }

  return {
    cnpj: "",
    ano: "",
    sequencial: "",
    isValid: false
  };
}

/**
 * Gera URLs para consulta ao PNCP (com fallback)
 */
export function buildPncpUrls(cnpj: string, ano: string, sequencial: string): {
  detail: string[];
  items: string[];
  files: string[];
} {
  // ✅ Duas versões da URL para fallback (pncp/v1 e consulta/v1)
  const baseUrls = [
    `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`,
    `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`
  ];

  return {
    detail: baseUrls,
    items: baseUrls.map(url => `${url}/itens?pagina=1&tamanhoPagina=500`),
    files: baseUrls.map(url => `${url}/arquivos`)
  };
}

/**
 * Mapeia dados do PNCP para o formato padronizado da aplicação
 */
export function mapPncpData(
  purchaseDetails: any,
  itemsList: any[],
  filesList: any[]
): {
  edital: string;
  orgao: string;
  modalidade: string;
  objeto: string;
  valorEstimado: number;
  dataSessao: string;
  cidade: string;
  estado: string;
  categoria: string;
  unidadeCompradora: string;
  amparoLegal: string;
  idContratacaoPncp: string;
  modoDisputa: string;
  dataInicioPropostas: string;
  dataFimPropostas: string;
  itensPncp: any[];
  arquivosPncp: any[];
} {
  // Extrai dados básicos
  const org = purchaseDetails.orgaoEntidade?.razaoSocial || purchaseDetails.orgaoEntidade?.nomeOrgao || "Órgão do PNCP";
  const modeName = purchaseDetails.modalidadeNome || "Pregão Eletrônico";
  const rawObjeto = purchaseDetails.objetoCompra || purchaseDetails.objeto || "Objeto não informado.";
  const rawValue = purchaseDetails.valorTotalEstimado || purchaseDetails.valorEstimado || 0;
  const num = purchaseDetails.numeroCompra || purchaseDetails.sequencialCompra || "";
  const anoCompra = purchaseDetails.anoCompra || "";
  const isSrp = purchaseDetails.srp === true;

  // Cria título humanizado
  let humanizedTitle = modeName.replace(/\s*-\s*/, " ").trim();
  if (humanizedTitle.toLowerCase().startsWith("pregão")) {
    humanizedTitle = "Pregão Eletrônico";
  } else if (humanizedTitle.toLowerCase().startsWith("dispensa")) {
    humanizedTitle = "Dispensa de Licitação";
  }

  if (isSrp) humanizedTitle += " SRP";
  if (num) {
    humanizedTitle += ` ${num}`;
    if (anoCompra) humanizedTitle += `/${anoCompra}`;
  } else if (anoCompra) {
    humanizedTitle += ` ${anoCompra}`;
  }

  // Auto-mapeamento de categoria
  let category = "Materiais & Equipamentos";
  const objLower = rawObjeto.toLowerCase();
  const categoryMap: Record<string, string[]> = {
    "Tecnologia da Informação": ["tecnologia", "software", "hardware", "computador", "sistema", "internet", "fibra", "servidor", "ti ", "nuvem", "cloud"],
    "Obras & Engenharia": ["obra", "reforma", "constru", "engenharia", "asfalto", "pavimentação", "saneamento", "edificação", "infraestrutura"],
    "Saúde & Medicamentos": ["saude", "medicamento", "hospitalar", "clinica", "odontológico", "vacina", "remedio"],
    "Consultoria": ["consultoria", "treinamento", "assessoria", "auditoria", "parecer", "estudo"],
    "Serviços Gerais": ["limpeza", "vigilancia", "seguranca", "conservação", "coleta", "jardinagem", "manutenção"],
    "Alimentação & Merenda": ["merenda", "alimento", "refeicao", "cozinha", "nutrição"]
  };

  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(kw => objLower.includes(kw))) {
      category = cat;
      break;
    }
  }

  // Mapeia arquivos
  const mappedArquivos = filesList.map((file: any, index: number) => ({
    id: `pncp-doc-${index + 1}-${Date.now()}`,
    nome: file.nomeOriginal || file.nome || file.titulo || `Documento_${index + 1}.pdf`,
    descricao: file.tipoDocumentoNome || file.descricao || "Documentação Oficial",
    tamanho: file.tamanho ? `${(file.tamanho / 1024 / 1024).toFixed(2)} MB` : "Indisponível",
    linkUrl: file.link || file.uri || ""
  }));

  // Mapeia itens
  const mappedItens = itemsList.map((it: any) => {
    const vUnit = it.valorUnitarioEstimado || it.valorEstimado || it.valorMaximoUnitario || 0;
    const q = it.quantidade || 1;
    return {
      numero: it.numeroItem || it.numero || 0,
      descricao: it.descricao || "Item cadastrado no edital",
      quantidade: q,
      valorUnitario: vUnit,
      valorTotal: it.valorTotal || (q * vUnit)
    };
  });

  return {
    edital: humanizedTitle,
    orgao: org,
    modalidade: modeName.includes("Pregão") ? "Pregão Eletrônico" : modeName,
    objeto: rawObjeto,
    valorEstimado: Number(rawValue),
    dataSessao: purchaseDetails.dataAberturaSessaoPublica?.substring(0, 16) ||
                purchaseDetails.dataEnvio?.substring(0, 16) ||
                new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
    cidade: purchaseDetails.unidadeOrgao?.municipioNome ||
            purchaseDetails.municipioNome ||
            purchaseDetails.orgaoEntidade?.municipioNome ||
            "Brasília",
    estado: purchaseDetails.unidadeOrgao?.ufSigla ||
            purchaseDetails.ufSigla ||
            purchaseDetails.orgaoEntidade?.ufSigla ||
            "DF",
    categoria: category,
    unidadeCompradora: purchaseDetails.unidadeOrgao?.nomeUnidade ||
                       purchaseDetails.unidadeSubrogada?.nomeUnidade ||
                       "Unidade Gestora",
    amparoLegal: purchaseDetails.amparoLegal?.descricao ||
                 "Artigo 75, Inciso II da Lei Nº 14.133/2021",
    idContratacaoPncp: purchaseDetails.numeroControlePNCP || "",
    modoDisputa: purchaseDetails.modoDisputaNome || "Não informado",
    dataInicioPropostas: purchaseDetails.dataInicioRecebimentoPropostas ?
                         new Date(purchaseDetails.dataInicioRecebimentoPropostas).toLocaleString("pt-BR") :
                         "",
    dataFimPropostas: purchaseDetails.dataFimRecebimentoPropostas ?
                      new Date(purchaseDetails.dataFimRecebimentoPropostas).toLocaleString("pt-BR") :
                      "",
    itensPncp: mappedItens,
    arquivosPncp: mappedArquivos
  };
}