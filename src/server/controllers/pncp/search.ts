import express from "express";
import { fetchWithRedirects } from "./utils.js";

const PAGE_SIZE = 50;
const MAX_PAGES = 2;

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

    const today = new Date();
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}${m}${d}`;
    };

    const baseUrl = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
    
    console.log(`[PNCP Search] 📅 Buscando editais dos últimos 30 dias`);
    console.log(`[PNCP Search] 📌 Modalidade: ${codigoModalidade || "TODAS"}`);
    console.log(`[PNCP Search] 📌 UF: ${uf || "TODOS"}`);

    let allItems: any[] = [];

    for (let p = 1; p <= MAX_PAGES; p++) {
      try {
        const params = new URLSearchParams();
        params.append("dataFinal", formatDate(today));
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - 30);
        params.append("dataInicial", formatDate(pastDate));
        params.append("pagina", String(p));
        params.append("tamanhoPagina", String(PAGE_SIZE));

        const isModalidadeValida = codigoModalidade && 
                                   codigoModalidade !== "Todos" && 
                                   codigoModalidade !== "" &&
                                   codigoModalidade !== "undefined";
        
        if (isModalidadeValida) {
          params.append("codigoModalidadeContratacao", String(codigoModalidade));
        }

        if (uf && uf !== "Todos" && uf !== "" && uf !== "undefined") {
          params.append("uf", uf);
        }

        const apiUrl = `${baseUrl}?${params.toString()}`;
        console.log(`[PNCP Search] 📄 Página ${p}...`);
        
        const response = await fetchWithRedirects(apiUrl, 5, 15000);
        const responseText = await response.text();

        if (responseText.trim().startsWith('<!doctype') || responseText.trim().startsWith('<html')) {
          console.warn(`[PNCP Search] Página ${p} retornou HTML, pulando.`);
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
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err: any) {
        console.warn(`[PNCP Search] Erro na página ${p}:`, err.message);
      }
    }

    // Remove duplicatas
    const uniqueItems = removeDuplicates(allItems);
    console.log(`[PNCP Search] ✅ Total único: ${uniqueItems.length} itens`);

    // Filtro por valor
    let filteredByValue = uniqueItems;
    if (valorMinimo !== undefined || valorMaximo !== undefined) {
      filteredByValue = filterByValue(uniqueItems, valorMinimo, valorMaximo);
      console.log(`[PNCP Search] 💰 Após filtro por valor: ${filteredByValue.length} itens`);
    }

    // Ordena por data
    const sortedItems = sortByDate(filteredByValue);

    // Log dos 10 mais recentes
    if (sortedItems.length > 0) {
      console.log(`[PNCP Search] 📅 10 mais recentes:`);
      sortedItems.slice(0, 10).forEach((item, i) => {
        const data = item.dataAtualizacao || item.dataPublicacaoPncp || "data desconhecida";
        const orgao = item.orgaoEntidade?.razaoSocial || "Órgão";
        const modalidade = item.modalidadeNome || "Modalidade";
        console.log(`  ${i+1}. ${data} - ${modalidade} - ${orgao}`);
      });
    }

    // Verifica editais de hoje
    const todayStr = formatDate(today);
    const todayItems = sortedItems.filter(item => {
      const data = item.dataAtualizacao || item.dataPublicacaoPncp || "";
      return data.replace(/-/g, "").startsWith(todayStr);
    });
    console.log(`[PNCP Search] 📌 Editais de hoje (${todayStr}): ${todayItems.length}`);

    // Filtro por termo
    let finalItems = sortedItems;
    if (searchTerm) {
      finalItems = filterByTerm(sortedItems, searchTerm);
      console.log(`[PNCP Search] Após filtro por termo: ${finalItems.length} itens`);
    }

    // Pagina resultados
    const totalRegistros = finalItems.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / PAGE_SIZE));
    const startIndex = (page - 1) * PAGE_SIZE;
    const paginatedItems = finalItems.slice(startIndex, startIndex + PAGE_SIZE);

    // Conta modalidades
    const modalidadesEncontradas = new Set<string>();
    finalItems.forEach(item => {
      if (item.modalidadeNome) {
        modalidadesEncontradas.add(item.modalidadeNome);
      }
    });
    console.log(`[PNCP Search] 📊 Modalidades: ${Array.from(modalidadesEncontradas).join(', ')}`);

    res.json({
      success: true,
      data: {
        data: paginatedItems,
        totalRegistros,
        totalPaginas,
        paginaAtual: page,
        itensPorPagina: PAGE_SIZE,
        editaisHoje: todayItems.length,
        modalidadesEncontradas: Array.from(modalidadesEncontradas),
        isMock: false
      }
    });

  } catch (error: any) {
    console.error("[PNCP Search] ❌ Erro:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao consultar API do PNCP: " + error.message
    });
  }
}

// FUNÇÕES AUXILIARES
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