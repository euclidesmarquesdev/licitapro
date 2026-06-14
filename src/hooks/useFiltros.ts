import { useState, useMemo } from "react";
import { Licitacao } from "../types";

// Helper to check if an object description matches keywords for a specific category
export function getCategoryKeywords(category: string): string[] {
  switch (category) {
    case "Tecnologia da Informação":
      return ["tecnologia", "software", "hardware", "computador", "nuvem", "cloud", "sistema", "ti ", "telecom", "internet", "fibra", "servidor", "informatica", "informática", "banco de dados", "link"];
    case "Obras & Engenharia":
      return ["obra", "reforma", "constru", "engenharia", "asfalto", "calçamento", "pavimentação", "saneamento", "edificação", "infraestrutura"];
    case "Saúde & Medicamentos":
      return ["saude", "saúde", "medica", "médica", "hospitalar", "remedio", "remédio", "insumo", "medicamento", "clínica", "odontológico", "farmácia", "vacina"];
    case "Consultoria":
      return ["consultoria", "treinamento", "assessoria", "pesquisa", "auditoria", "parecer", "estudo", "planejamento"];
    case "Serviços Gerais":
      return ["limpeza", "vigilancia", "vigilância", "seguranca", "segurança", "servico", "serviço", "conservação", "portaria", "coleta", "desentupimento", "jardinagem", "manutenção"];
    case "Alimentação & Merenda":
      return ["merenda", "alimento", "refeicao", "refeição", "padaria", "gênero alimentício", "fome", "cozinha", "nutrição"];
    case "Materiais & Equipamentos":
      return ["material", "equipamento", "compra", "aquisição", "móveis", "mobiliário", "veículo", "carro", "ônibus"];
    default:
      return [];
  }
}

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

      const keywords = getCategoryKeywords(selectedCategory);
      const isMatchByKeyword = keywords.some(kw => lic.objeto?.toLowerCase().includes(kw));
      const matchesCategory = selectedCategory === "Todas" || lic.categoria === selectedCategory || isMatchByKeyword;
      
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
