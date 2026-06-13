import { useState, useMemo } from "react";
import { Licitacao } from "../types";

export function useFiltros(licitacoes: Licitacao[]) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedState, setSelectedState] = useState("Todos");
  const [selectedStatus, setSelectedStatus] = useState("Todos");

  const filteredLicitacoes = useMemo(() => {
    return licitacoes.filter((lic) => {
      const matchesSearch = 
        lic.edital.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lic.orgao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lic.objeto.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategory === "Todas" || lic.categoria === selectedCategory;
      const matchesState = selectedState === "Todos" || lic.estado === selectedState;
      const matchesStatus = selectedStatus === "Todos" || lic.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesState && matchesStatus;
    });
  }, [licitacoes, searchTerm, selectedCategory, selectedState, selectedStatus]);

  return {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedState,
    setSelectedState,
    selectedStatus,
    setSelectedStatus,
    filteredLicitacoes
  };
}
