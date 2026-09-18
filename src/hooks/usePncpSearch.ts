import { useState } from "react";
import { getClientAuthToken } from "../firebase";

interface SearchParams {
  searchTerm: string;
  uf: string;
  modality: string;
  dateRange: string;
  valorMinimo: string;
  valorMaximo: string;
  page?: number;
}

export function usePncpSearch() {
  const [results, setResults] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCalculatedDates = (daysAgo: string) => {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - parseInt(daysAgo));

    const fmt = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    return {
      start: fmt(past),
      end: fmt(today)
    };
  };

  const search = async (params: SearchParams) => {
    // ✅ Evita múltiplas chamadas simultâneas
    if (isLoading) {
  // Log de desenvolvimento removido em produção pelo AutoPatch
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
  // Log de desenvolvimento removido em produção pelo AutoPatch

      const token = await getClientAuthToken();
  // Log de desenvolvimento removido em produção pelo AutoPatch

      const dates = getCalculatedDates(params.dateRange);

      let modalidadeParaEnviar = params.modality;
      if (modalidadeParaEnviar === "Todos" || modalidadeParaEnviar === "") {
        modalidadeParaEnviar = "6";
      }

      const queryParams = new URLSearchParams({
        pagina: String(params.page || 1),
        dataInicial: dates.start,
        dataFinal: dates.end,
        uf: params.uf,
        codigoModalidade: modalidadeParaEnviar,
        termo: params.searchTerm
      });

      if (params.valorMinimo && parseFloat(params.valorMinimo) > 0) {
        queryParams.append("valorMinimo", params.valorMinimo);
      }
      if (params.valorMaximo && parseFloat(params.valorMaximo) > 0) {
        queryParams.append("valorMaximo", params.valorMaximo);
      }

      const url = `/api/pncp/search?${queryParams.toString()}`;
  // Log de desenvolvimento removido em produção pelo AutoPatch

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

  // Log de desenvolvimento removido em produção pelo AutoPatch

      const textResponse = await response.text();
  // Log de desenvolvimento removido em produção pelo AutoPatch
      
      if (textResponse.trim().startsWith('<!doctype') || textResponse.trim().startsWith('<html')) {
        throw new Error("O servidor retornou uma página de erro.");
      }

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${textResponse.substring(0, 100)}`);
      }

      const data = JSON.parse(textResponse);
  // Log de desenvolvimento removido em produção pelo AutoPatch

      if (data.success && data.data) {
        setResults(data.data.data || []);
        setTotalRecords(data.data.totalRegistros || 0);
        setTotalPages(data.data.totalPaginas || 1);
        setCurrentPage(data.data.paginaAtual || 1);
        setHasSearched(true);
      } else {
        setResults([]);
        setTotalRecords(0);
        setTotalPages(1);
        setError(data.error || "Nenhum resultado encontrado");
      }
    } catch (err: unknown) {
      console.error("[PNCP Search] ❌ Erro:", err);
      setError(err.message || "Erro ao buscar editais");
      setResults([]);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    results,
    setResults,
    totalRecords,
    setTotalRecords,
    totalPages,
    setTotalPages,
    currentPage,
    setCurrentPage,
    isLoading,
    setIsLoading,
    hasSearched,
    setHasSearched,
    error,
    search
  };
}