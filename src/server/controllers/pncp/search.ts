import express from "express";

const PAGE_SIZE = 50;
const MAX_PAGES = 2; // 🔥 REDUZIDO para 2 páginas (evita rate limit)
const CACHE_TTL = 60000; // 🔥 1 minuto de cache

// 🔥 Cache em memória
const cache = new Map<string, { data: any; timestamp: number }>();

export async function handlePncpSearch(req: express.Request, res: express.Response) {
  try {
    console.log("[PNCP Search] ✅ Buscando editais...");
    
    const termo = req.query.termo ? String(req.query.termo) : undefined;
    const uf = req.query.uf ? String(req.query.uf) : undefined;
    const codigoModalidade = req.query.codigoModalidade ? String(req.query.codigoModalidade) : undefined;
    const pagina = req.query.pagina ? parseInt(String(req.query.pagina)) : 1;
    const dataInicial = req.query.dataInicial ? String(req.query.dataInicial) : undefined;
    const dataFinal = req.query.dataFinal ? String(req.query.dataFinal) : undefined;
    const valorMinimo = req.query.valorMinimo ? parseFloat(String(req.query.valorMinimo)) : undefined;
    const valorMaximo = req.query.valorMaximo ? parseFloat(String(req.query.valorMaximo)) : undefined;

    const page = pagina || 1;
    const searchTerm = termo ? termo.trim() : "";

    // 🔥 Criar chave de cache baseada nos parâmetros
    const cacheKey = JSON.stringify({ termo, uf, codigoModalidade, dataInicial, dataFinal, valorMinimo, valorMaximo });
    
    // 🔥 Verificar cache
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log("[PNCP Search] ✅ Usando cache");
      return res.json(cached.data);
    }

    const today = new Date();
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}${m}${d}`;
    };

    const baseUrl = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
    
    const dataFinalStr = dataFinal ? dataFinal.replace(/-/g, '') : formatDate(today);
    
    let dataInicialStr = dataInicial ? dataInicial.replace(/-/g, '') : undefined;
    if (!dataInicialStr) {
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - 15); // 🔥 REDUZIDO para 15 dias
      dataInicialStr = formatDate(pastDate);
    }

    let modalidadeParaEnviar = codigoModalidade;
    if (!modalidadeParaEnviar || modalidadeParaEnviar === "Todos" || modalidadeParaEnviar === "" || modalidadeParaEnviar === "undefined") {
      modalidadeParaEnviar = "6";
    }

    console.log(`[PNCP Search] 📅 Data Inicial: ${dataInicialStr}`);
    console.log(`[PNCP Search] 📅 Data Final: ${dataFinalStr}`);
    console.log(`[PNCP Search] 📌 Modalidade: ${modalidadeParaEnviar}`);
    console.log(`[PNCP Search] 📌 UF: ${uf || "TODOS"}`);

    let allItems: any[] = [];

    for (let p = 1; p <= MAX_PAGES; p++) {
      try {
        const params = new URLSearchParams();
        params.append("dataFinal", dataFinalStr);
        params.append("dataInicial", dataInicialStr);
        params.append("pagina", String(p));
        params.append("tamanhoPagina", String(PAGE_SIZE));
        params.append("codigoModalidadeContratacao", String(modalidadeParaEnviar));

        if (uf && uf !== "Todos" && uf !== "" && uf !== "undefined") {
          params.append("uf", uf);
        }

        const apiUrl = `${baseUrl}?${params.toString()}`;
        console.log(`[PNCP Search] 📄 Página ${p}...`);
        
        // 🔥 HEADERS IDÊNTICOS AO NAVEGADOR
        const response = await fetch(apiUrl, {
          headers: {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "Cache-Control": "no-cache",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            "Referer": "https://pncp.gov.br/app/editais",
            "Origin": "https://pncp.gov.br"
          }
        });

        const responseText = await response.text();

        if (responseText.trim().startsWith('<!doctype') || responseText.trim().startsWith('<html')) {
          console.warn(`[PNCP Search] Página ${p} retornou HTML. Pulando...`);
          continue;
        }

        if (!response.ok) {
          console.warn(`[PNCP Search] Página ${p} falhou: HTTP ${response.status}`);
          continue;
        }

        const apiData = JSON.parse(responseText);
        const items = apiData.data || apiData.resultado || [];
        
        console.log(`[PNCP Search] Página ${p}: ${items.length} itens`);
        allItems.push(...items);
        
        if (items.length < PAGE_SIZE) {
          console.log(`[PNCP Search] Última página (${items.length} itens).`);
          break;
        }
        
        // 🔥 DELAY MAIOR entre requisições
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (err: any) {
        console.warn(`[PNCP Search] Erro na página ${p}:`, err.message);
        // 🔥 Se errar, espera mais e tenta de novo
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const uniqueItems = removeDuplicates(allItems);
    console.log(`[PNCP Search] ✅ Total único: ${uniqueItems.length} itens`);

    // 🔥 FILTRO: Remover expirados
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const itemsValidos = uniqueItems.filter((item: any) => {
      const dataEncerramento = item.dataEncerramentoProposta;
      
      if (!dataEncerramento) return true;
      
      const dataObj = parseDateString(dataEncerramento);
      if (!dataObj) return true;
      
      dataObj.setHours(0, 0, 0, 0);
      const isValid = dataObj >= hoje;
      
      return isValid;
    });

    const removidos = uniqueItems.length - itemsValidos.length;
    console.log(`[PNCP Search] 📌 ${removidos} editais removidos. Restam ${itemsValidos.length} editais válidos.`);

    let filteredByValue = itemsValidos;
    if (valorMinimo !== undefined || valorMaximo !== undefined) {
      filteredByValue = filterByValue(itemsValidos, valorMinimo, valorMaximo);
      console.log(`[PNCP Search] 💰 Após filtro por valor: ${filteredByValue.length} itens`);
    }

    const sortedItems = sortByDate(filteredByValue);
    console.log(`[PNCP Search] 📅 ${sortedItems.length} itens ordenados por dataAtualizacao`);

    if (sortedItems.length > 0) {
      console.log(`[PNCP Search] 📅 10 mais recentes:`);
      sortedItems.slice(0, 10).forEach((item, i) => {
        const dataAtualizacao = item.dataAtualizacao || item.dataPublicacaoPncp || "data desconhecida";
        const dataEncerramento = item.dataEncerramentoProposta || "sem data";
        const orgao = item.orgaoEntidade?.razaoSocial || "Órgão";
        console.log(`  ${i+1}. Atualização: ${dataAtualizacao} | Encerramento: ${dataEncerramento} | ${orgao}`);
      });
    }

    let finalItems = sortedItems;
    if (searchTerm) {
      finalItems = filterByTerm(sortedItems, searchTerm);
      console.log(`[PNCP Search] Após filtro por termo: ${finalItems.length} itens`);
    }

    const totalRegistros = finalItems.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / PAGE_SIZE));
    const startIndex = (page - 1) * PAGE_SIZE;
    const paginatedItems = finalItems.slice(startIndex, startIndex + PAGE_SIZE);

    const modalidadesEncontradas = new Set<string>();
    finalItems.forEach(item => {
      if (item.modalidadeNome) {
        modalidadesEncontradas.add(item.modalidadeNome);
      }
    });

    const responseData = {
      success: true,
      data: {
        data: paginatedItems,
        totalRegistros,
        totalPaginas,
        paginaAtual: page,
        itensPorPagina: PAGE_SIZE,
        editaisHoje: 0,
        modalidadesEncontradas: Array.from(modalidadesEncontradas),
        isMock: false
      }
    };

    // 🔥 Salvar no cache
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    res.json(responseData);

  } catch (error: any) {
    console.error("[PNCP Search] ❌ Erro:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao consultar API do PNCP: " + error.message
    });
  }
}

// ============================================================
// FUNÇÕES AUXILIARES (MANTIDAS)
// ============================================================
function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  try {
    let cleanDate = dateStr.replace(/h$/i, '').trim();
    if (cleanDate.includes(',')) {
      cleanDate = cleanDate.split(',')[0].trim();
    }
    if (cleanDate.includes(' ')) {
      cleanDate = cleanDate.split(' ')[0].trim();
    }
    
    const parts = cleanDate.split('/');
    if (parts.length === 3) {
      const dia = parseInt(parts[0]);
      const mes = parseInt(parts[1]) - 1;
      const ano = parseInt(parts[2]);
      const data = new Date(ano, mes, dia);
      if (!isNaN(data.getTime())) {
        return data;
      }
    }
    
    const isoData = new Date(cleanDate);
    if (!isNaN(isoData.getTime())) {
      return isoData;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function removeDuplicates(items: any[]): any[] {
  const seen = new Set();
  return items.filter(item => {
    const id = item.numeroControlePNCP || item.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function filterByValue(items: any[], valorMinimo?: number, valorMaximo?: number): any[] {
  return items.filter(item => {
    const valor = item.valorTotalEstimado || item.valorEstimado || 0;
    if (valor === 0) {
      if (valorMinimo !== undefined && valorMinimo > 0) return false;
      return true;
    }
    if (valorMinimo !== undefined && valor < valorMinimo) return false;
    if (valorMaximo !== undefined && valor > valorMaximo) return false;
    return true;
  });
}

function sortByDate(items: any[]): any[] {
  return [...items].sort((a, b) => {
    const dateA = a.dataAtualizacao || a.dataAtualizacaoGlobal || a.dataPublicacaoPncp || "";
    const dateB = b.dataAtualizacao || b.dataAtualizacaoGlobal || b.dataPublicacaoPncp || "";
    const timeA = new Date(dateA).getTime();
    const timeB = new Date(dateB).getTime();
    if (isNaN(timeA) && isNaN(timeB)) return 0;
    if (isNaN(timeA)) return 1;
    if (isNaN(timeB)) return -1;
    return timeB - timeA;
  });
}

function filterByTerm(items: any[], term: string): any[] {
  const normalize = (text: string) => {
    return (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  const keyword = normalize(term);

  return items.filter((item: any) => {
    const orgao = normalize(item.orgaoEntidade?.razaoSocial || "");
    const objeto = normalize(item.objetoCompra || item.objeto || "");
    const pncpId = normalize(item.numeroControlePNCP || "");
    const modalidade = normalize(item.modalidadeNome || "");

    return orgao.includes(keyword) ||
           objeto.includes(keyword) ||
           pncpId.includes(keyword) ||
           modalidade.includes(keyword);
  });
}