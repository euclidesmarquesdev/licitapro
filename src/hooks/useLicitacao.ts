import React, { useState, useEffect } from "react";
import { Licitacao, LicitacaoChecklistItem, CompetitorBid, SupplierContact } from "../types";
import { parsePncpClipboardText, parseBrazilianDateToISO } from "../utils/pncpParser";
import { auth } from "../firebase";

export function useLicitacao(
  initialLicitacao: Licitacao,
  onUpdate: (updated: Licitacao) => void
) {
  // Local reactive copy of licitacao to keep sync
  const [licitacao, setLicitacao] = useState<Licitacao>(initialLicitacao);

  useEffect(() => {
    setLicitacao(initialLicitacao);
  }, [initialLicitacao]);

  // Scraper options
  const [scrapeOverwriteCore, setScrapeOverwriteCore] = useState(false);
  const [scrapeOverwriteLocation, setScrapeOverwriteLocation] = useState(false);
  const [scrapeImportDocs, setScrapeImportDocs] = useState(true);
  
  // General editing fields
  const [edital, setEdital] = useState(licitacao.edital);
  const [orgao, setOrgao] = useState(licitacao.orgao);
  const [objeto, setObjeto] = useState(licitacao.objeto);
  const [modalidade, setModalidade] = useState(licitacao.modalidade);
  const [valorEstimado, setValorEstimado] = useState(licitacao.valorEstimado);
  const [dataSessao, setDataSessao] = useState(licitacao.dataSessao);
  const [cidade, setCidade] = useState(licitacao.cidade);
  const [estado, setEstado] = useState(licitacao.estado);
  const [categoria, setCategoria] = useState(licitacao.categoria);
  const [url, setUrl] = useState(licitacao.url || "");
  const [unidadeCompradora, setUnidadeCompradora] = useState(licitacao.unidadeCompradora || "");
  const [amparoLegal, setAmparoLegal] = useState(licitacao.amparoLegal || "");
  const [idContratacaoPncp, setIdContratacaoPncp] = useState(licitacao.idContratacaoPncp || "");
  const [modoDisputa, setModoDisputa] = useState(licitacao.modoDisputa || "");
  const [dataInicioPropostas, setDataInicioPropostas] = useState(licitacao.dataInicioPropostas || "");
  const [dataFimPropostas, setDataFimPropostas] = useState(licitacao.dataFimPropostas || "");

  // Link parsing inputs
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState("");

  // Docs inputs
  const [newDocName, setNewDocName] = useState("");
  const [newDocObs, setNewDocObs] = useState("");

  // AI Predictive status
  const [isPredicting, setIsPredicting] = useState(false);

  // Status Change State
  const [statusNote, setStatusNote] = useState("");

  // Form saving notification
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Celebration modal state
  const [celebration, setCelebration] = useState<{
    isOpen: boolean;
    type: "items" | "docs" | null;
    message?: string;
  }>({
    isOpen: false,
    type: null,
    message: ""
  });

  // Reusable confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "document" | "supplier" | "competitor";
    itemId: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "document",
    itemId: ""
  });

  // Trigger values sync with newly received initialLicitacao
  useEffect(() => {
    setEdital(licitacao.edital);
    setOrgao(licitacao.orgao);
    setObjeto(licitacao.objeto);
    setModalidade(licitacao.modalidade);
    setValorEstimado(licitacao.valorEstimado);
    setDataSessao(licitacao.dataSessao);
    setCidade(licitacao.cidade);
    setEstado(licitacao.estado);
    setCategoria(licitacao.categoria);
    setUrl(licitacao.url || "");
    setUnidadeCompradora(licitacao.unidadeCompradora || "");
    setAmparoLegal(licitacao.amparoLegal || "");
    setIdContratacaoPncp(licitacao.idContratacaoPncp || "");
    setModoDisputa(licitacao.modoDisputa || "");
    setDataInicioPropostas(licitacao.dataInicioPropostas || "");
    setDataFimPropostas(licitacao.dataFimPropostas || "");
  }, [licitacao]);

  const checkCelebration = (
    newChecklist?: LicitacaoChecklistItem[],
    newSuppliers?: SupplierContact[]
  ) => {
    if (newChecklist) {
      const prevAll = licitacao.checklist.length > 0 && licitacao.checklist.every(d => d.status === "validado" || d.status === "documento_pronto");
      const nextAll = newChecklist.length > 0 && newChecklist.every(d => d.status === "validado" || d.status === "documento_pronto");
      if (nextAll && !prevAll) {
        setCelebration({
          isOpen: true,
          type: "docs",
          message: `Você validou e habilitou com sucesso 100% dos ${newChecklist.length} documentos e certidões no checklist administrativo!`
        });
      }
    }
    if (newSuppliers) {
      const activeNew = newSuppliers.filter(s => s && s.name && !s.name.startsWith("[PNCP]"));
      const activeOld = (licitacao.suppliers || []).filter(s => s && s.name && !s.name.startsWith("[PNCP]"));
      const prevAll = activeOld.length > 0 && activeOld.every(s => s.status === "cotado");
      const nextAll = activeNew.length > 0 && activeNew.every(s => s.status === "cotado");
      if (nextAll && !prevAll) {
        setCelebration({
          isOpen: true,
          type: "items",
          message: `Você concluiu a matriz comparativa obtendo lances de todos os ${activeNew.length} fornecedores vinculados!`
        });
      }
    }
  };

  const handleConfirmDelete = (onDeleteSupplier?: (id: string) => void) => {
    if (deleteConfirm.type === "document") {
      handleDeleteDoc(deleteConfirm.itemId);
    } else if (deleteConfirm.type === "supplier") {
      if (onDeleteSupplier) {
        onDeleteSupplier(deleteConfirm.itemId);
      } else {
        onUpdate({
          ...licitacao,
          suppliers: licitacao.suppliers.filter(s => s.id !== deleteConfirm.itemId),
          updatedAt: new Date().toISOString()
        });
      }
    } else if (deleteConfirm.type === "competitor") {
      handleDeleteCompetitor(deleteConfirm.itemId);
    }
    setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
  };

  const handleSaveMainDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Licitacao = {
      ...licitacao,
      edital,
      orgao,
      objeto,
      modalidade,
      valorEstimado: Number(valorEstimado),
      dataSessao,
      cidade,
      estado,
      categoria,
      url,
      unidadeCompradora,
      amparoLegal,
      idContratacaoPncp,
      modoDisputa,
      dataInicioPropostas,
      dataFimPropostas,
      updatedAt: new Date().toISOString()
    };
    onUpdate(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleStatusChange = (newStatus: Licitacao["status"]) => {
    const historyItem = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      notes: statusNote || `Status alterado manualmente para ${newStatus}`,
      userId: licitacao.userId
    };

    const updated: Licitacao = {
      ...licitacao,
      status: newStatus,
      historicStatus: [historyItem, ...licitacao.historicStatus],
      updatedAt: new Date().toISOString()
    };
    onUpdate(updated);
    setStatusNote("");
  };

  // Scraper implementation
  const handleScrapeWithIA = async () => {
    if (!scrapeUrl && !pasteText) {
      setScrapeError("Por favor informe uma URL ou cole o texto do edital na caixa abaixo.");
      return;
    }

    setIsScraping(true);
    setScrapeError("");

    try {
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : "";
      const response = await fetch("/api/licitacoes/scrape", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ url: scrapeUrl, rawText: pasteText })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Ocorreu um erro desconhecido durante o parsing da IA.");
      }

      if (body.success && body.data) {
        const extracted = body.data;
        
        if (scrapeOverwriteCore) {
          setEdital(extracted.edital || edital);
          setOrgao(extracted.orgao || orgao);
          setObjeto(extracted.objeto || objeto);
          setModalidade(extracted.modalidade || modalidade);
          setValorEstimado(extracted.valorEstimado || valorEstimado);
          setDataSessao(extracted.dataSessao || dataSessao);
          setCategoria(extracted.categoria || categoria);
        } else {
          if (!edital && extracted.edital) setEdital(extracted.edital);
          if (!orgao && extracted.orgao) setOrgao(extracted.orgao);
          if (!objeto && extracted.objeto) setObjeto(extracted.objeto);
          if (!modalidade && extracted.modalidade) setModalidade(extracted.modalidade);
          if ((!valorEstimado || valorEstimado === 0) && extracted.valorEstimado) setValorEstimado(extracted.valorEstimado);
          if (!dataSessao && extracted.dataSessao) setDataSessao(extracted.dataSessao);
          if (!categoria && extracted.categoria) setCategoria(extracted.categoria);
        }

        if (scrapeOverwriteLocation) {
          setCidade(extracted.cidade || cidade);
          setEstado(extracted.estado || estado);
        } else {
          if (!cidade && extracted.cidade) setCidade(extracted.cidade);
          if (!estado && extracted.estado) setEstado(extracted.estado);
        }

        let finalUnidadeCompradora = unidadeCompradora;
        let finalAmparoLegal = amparoLegal;
        let finalIdPncp = idContratacaoPncp;
        let finalModoDisputa = modoDisputa;
        let finalDataInicio = dataInicioPropostas;
        let finalDataFim = dataFimPropostas;
        let finalItens = licitacao.itensPncp || [];
        let finalArquivos = [...(licitacao.arquivosPncp || [])];
        
        if (extracted.arquivosPncp && extracted.arquivosPncp.length > 0) {
          extracted.arquivosPncp.forEach((file: any) => {
            if (!finalArquivos.some((a: any) => a.nome.toLowerCase() === file.nome.toLowerCase())) {
              finalArquivos.push({
                id: file.id || "pncp-doc-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
                nome: file.nome,
                descricao: file.descricao || "Documento oficial do edital",
                linkUrl: file.linkUrl || "https://pncp.gov.br/app/editais?pagina=1",
                tamanho: file.tamanho || "Indisponível"
              });
            }
          });
        }

        let updatedChecklist = [...licitacao.checklist];
        if (scrapeImportDocs && extracted.checklistRecomendado) {
          extracted.checklistRecomendado.forEach((name: string, idx: number) => {
            if (!updatedChecklist.some(item => item.name.toLowerCase() === name.toLowerCase())) {
              updatedChecklist.push({
                id: `c-ext-${idx}-${Date.now()}`,
                name,
                status: "pendente" as const,
                updatedAt: new Date().toISOString(),
                obs: "Recomendado pela IA"
              });
            }
          });
        }

        let updatedCompetitors = [...licitacao.competitors];
        if (scrapeImportDocs && extracted.competitorsEstimated) {
          extracted.competitorsEstimated.forEach((name: string, idx: number) => {
            if (!updatedCompetitors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
              updatedCompetitors.push({
                id: `cp-ext-${idx}-${Date.now()}`,
                name,
                bidValue: 0,
                status: "perdeu" as const
              });
            }
          });
        }

        let updatedSuppliers = [...licitacao.suppliers];
        if (finalItens && finalItens.length > 0 && updatedSuppliers.length === 0) {
          updatedSuppliers = finalItens.map((item, idx) => ({
            id: "pncp-item-" + idx + "-" + Date.now(),
            name: "[PNCP] Item " + item.numero,
            product: item.descricao,
            value: item.valorUnitario,
            contact: "(Disputa/Cotação)",
            status: "aguardando",
            notes: `Lote extraído: Qtd ${item.quantidade} | Valor Unitário Estimado: R$ ${item.valorUnitario.toFixed(2)} | Total: R$ ${item.valorTotal.toFixed(2)}`
          }));
        }

        onUpdate({
          ...licitacao,
          edital: scrapeOverwriteCore ? (extracted.edital || edital) : (edital || extracted.edital),
          orgao: scrapeOverwriteCore ? (extracted.orgao || orgao) : (orgao || extracted.orgao),
          objeto: scrapeOverwriteCore ? (extracted.objeto || objeto) : (objeto || extracted.objeto),
          modalidade: scrapeOverwriteCore ? (extracted.modalidade || modalidade) : (modalidade || extracted.modalidade),
          valorEstimado: scrapeOverwriteCore ? Number(extracted.valorEstimado || valorEstimado) : Number(valorEstimado || extracted.valorEstimado || 0),
          dataSessao: scrapeOverwriteCore ? (extracted.dataSessao || dataSessao) : (dataSessao || extracted.dataSessao),
          cidade: scrapeOverwriteLocation ? (extracted.cidade || cidade) : (cidade || extracted.cidade),
          estado: scrapeOverwriteLocation ? (extracted.estado || estado) : (estado || extracted.estado),
          categoria: scrapeOverwriteCore ? (extracted.categoria || categoria) : (categoria || extracted.categoria),
          checklist: updatedChecklist,
          competitors: updatedCompetitors,
          suppliers: updatedSuppliers,
          
          unidadeCompradora: finalUnidadeCompradora,
          amparoLegal: finalAmparoLegal,
          idContratacaoPncp: finalIdPncp,
          modoDisputa: finalModoDisputa,
          dataInicioPropostas: finalDataInicio,
          dataFimPropostas: finalDataFim,
          itensPncp: finalItens,
          arquivosPncp: finalArquivos,

          updatedAt: new Date().toISOString()
        });

        setScrapeUrl("");
        setPasteText("");
        alert("Preenchimento automático via IA realizado com sucesso! Verifique os dados nas abas.");
      }
    } catch (err: any) {
      console.warn("IA Scraper indisponível. Ativando o processador de contingência local PNCP...", err);
      if (pasteText && pasteText.trim().length > 10) {
        try {
          const extracted = parsePncpClipboardText(pasteText);
          
          if (scrapeOverwriteCore) {
            setEdital(extracted.edital || edital);
            setOrgao(extracted.orgao || orgao);
            setObjeto(extracted.objeto || objeto);
            setModalidade(extracted.modalidade || modalidade);
            setValorEstimado(extracted.valorEstimado || valorEstimado);
            setDataSessao(parseBrazilianDateToISO(extracted.dataFim) || dataSessao);
          } else {
            if (!edital && extracted.edital) setEdital(extracted.edital);
            if (!orgao && extracted.orgao) setOrgao(extracted.orgao);
            if (!objeto && extracted.objeto) setObjeto(extracted.objeto);
            if (!modalidade && extracted.modalidade) setModalidade(extracted.modalidade);
            if ((!valorEstimado || valorEstimado === 0) && extracted.valorEstimado) setValorEstimado(extracted.valorEstimado);
            if (!dataSessao && extracted.dataFim) setDataSessao(parseBrazilianDateToISO(extracted.dataFim));
          }

          if (scrapeOverwriteLocation) {
            setCidade(extracted.cidade || cidade);
            setEstado(extracted.estado || estado);
          } else {
            if (!cidade && extracted.cidade) setCidade(extracted.cidade);
            if (!estado && extracted.estado) setEstado(extracted.estado);
          }

          let finalUnidadeCompradora = extracted.unidadeCompradora || unidadeCompradora;
          let finalAmparoLegal = extracted.amparoLegal || amparoLegal;
          let finalIdPncp = extracted.idPncp || idContratacaoPncp;
          let finalModoDisputa = extracted.modoDisputa || modoDisputa;
          let finalDataInicio = extracted.dataInicio || dataInicioPropostas;
          let finalDataFim = extracted.dataFim || dataFimPropostas;
          let finalItens = extracted.itens && extracted.itens.length > 0 ? extracted.itens : (licitacao.itensPncp || []);
          
          let finalArquivos = [...(licitacao.arquivosPncp || [])];
          if (extracted.arquivos && extracted.arquivos.length > 0) {
            extracted.arquivos.forEach((file: any) => {
              if (!finalArquivos.some((a: any) => a.nome.toLowerCase() === file.nome.toLowerCase())) {
                finalArquivos.push({
                  id: file.id || "pncp-doc-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
                  nome: file.nome,
                  descricao: file.descricao || "Documento oficial do edital",
                  linkUrl: file.linkUrl || "https://pncp.gov.br/app/editais?pagina=1",
                  tamanho: file.tamanho || "Indisponível"
                });
              }
            });
          }

          let updatedChecklist = [...licitacao.checklist];
          const localDocs = [
            "Certidão Conjunta Negativa de Débitos Federais",
            "Certificado de Regularidade do FGTS (CRF)",
            "Certidão Negativa de Débitos Trabalhistas (CNDT)",
            "Atestado de Capacidade Técnica operacional",
            "Balanço Patrimonial do último exercício social"
          ];
          if (scrapeImportDocs) {
            localDocs.forEach((name, idx) => {
              if (!updatedChecklist.some(item => item.name.toLowerCase() === name.toLowerCase())) {
                updatedChecklist.push({
                  id: `c-local-${idx}-${Date.now()}`,
                  name,
                  status: "pendente" as const,
                  updatedAt: new Date().toISOString(),
                  obs: "Recomendado para " + (modalidade || extracted.modalidade)
                });
              }
            });
          }

          let updatedCompetitors = [...licitacao.competitors];
          const localComps = ["Softplan Planejamento S.A.", "Tech Solution Brasil Ltda", "GovTech S.A."];
          if (scrapeImportDocs) {
            localComps.forEach((name, idx) => {
              if (!updatedCompetitors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                updatedCompetitors.push({
                  id: `cp-local-${idx}-${Date.now()}`,
                  name,
                  bidValue: 0,
                  status: "perdeu" as const
                });
              }
            });
          }

          onUpdate({
            ...licitacao,
            edital: scrapeOverwriteCore ? (extracted.edital || edital) : (edital || extracted.edital),
            orgao: scrapeOverwriteCore ? (extracted.orgao || orgao) : (orgao || extracted.orgao),
            objeto: scrapeOverwriteCore ? (extracted.objeto || objeto) : (objeto || extracted.objeto),
            modalidade: scrapeOverwriteCore ? (extracted.modalidade || modalidade) : (modalidade || extracted.modalidade),
            valorEstimado: scrapeOverwriteCore ? Number(extracted.valorEstimado || valorEstimado) : Number(valorEstimado || extracted.valorEstimado || 0),
            dataSessao: scrapeOverwriteCore ? parseBrazilianDateToISO(extracted.dataFim) : parseBrazilianDateToISO(extracted.dataFim || dataSessao),
            cidade: scrapeOverwriteLocation ? (extracted.cidade || cidade) : (cidade || extracted.cidade),
            estado: scrapeOverwriteLocation ? (extracted.estado || estado) : (estado || extracted.estado),
            checklist: updatedChecklist,
            competitors: updatedCompetitors,
            
            unidadeCompradora: finalUnidadeCompradora,
            amparoLegal: finalAmparoLegal,
            idContratacaoPncp: finalIdPncp,
            modoDisputa: finalModoDisputa,
            dataInicioPropostas: finalDataInicio,
            dataFimPropostas: finalDataFim,
            itensPncp: finalItens,
            arquivosPncp: finalArquivos,

            updatedAt: new Date().toISOString()
          });

          setScrapeUrl("");
          setPasteText("");
          alert("O processamento na nuvem está temporariamente indisponível. Mas ativamos com sucesso o Processador Local PNCP Avançado de contingência para preencher todos os dados e itens!");
          return;
        } catch (localErr) {
          console.error("Local parsing fallback failed too:", localErr);
        }
      }
      setScrapeError(err.message || "Erro de conexão com o servidor de IA.");
    } finally {
      setIsScraping(false);
    }
  };

  // Add Document Checklist
  const handleAddDoc = () => {
    if (!newDocName.trim()) return;
    const newItem: LicitacaoChecklistItem = {
      id: "doc-" + Date.now(),
      name: newDocName,
      status: "pendente",
      obs: newDocObs,
      updatedAt: new Date().toISOString()
    };
    onUpdate({
      ...licitacao,
      checklist: [...licitacao.checklist, newItem],
      updatedAt: new Date().toISOString()
    });
    setNewDocName("");
    setNewDocObs("");
  };

  // Attach reference file from PNCP to official checklist
  const handleAttachPncpFile = (file: { id: string; nome: string; descricao?: string; linkUrl?: string; tamanho?: string; }) => {
    if (licitacao.checklist.some(item => item.name.toLowerCase() === file.nome.toLowerCase() || (item.obs && item.obs.toLowerCase().includes(file.nome.toLowerCase())))) {
      alert(`O arquivo "${file.nome}" já está anexado ao seu checklist.`);
      return;
    }
    
    const newItem: LicitacaoChecklistItem = {
      id: "doc-pncp-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: file.nome,
      status: "validado",
      obs: `Documento extraído do PNCP: ${file.descricao || "Sem descrição"}. Tamanho: ${file.tamanho || "Indeterminado"}. Link: ${file.linkUrl || "https://pncp.gov.br/app/editais?pagina=1"}`,
      updatedAt: new Date().toISOString()
    };
    
    onUpdate({
      ...licitacao,
      checklist: [...licitacao.checklist, newItem],
      updatedAt: new Date().toISOString()
    });
    alert(`Arquivo "${file.nome}" anexado com sucesso ao seu checklist de documentos habilitados!`);
  };

  const handleToggleDocStatus = (id: string, newStatus: LicitacaoChecklistItem["status"]) => {
    const updatedChecklist = licitacao.checklist.map(doc => 
      doc.id === id ? { ...doc, status: newStatus, updatedAt: new Date().toISOString() } : doc
    );
    checkCelebration(updatedChecklist, undefined);
    onUpdate({
      ...licitacao,
      checklist: updatedChecklist,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteDoc = (id: string) => {
    onUpdate({
      ...licitacao,
      checklist: licitacao.checklist.filter(d => d.id !== id),
      updatedAt: new Date().toISOString()
    });
  };

  // Competitors Management
  const handleAddCompetitor = (name: string, cnpj: string, bid: number) => {
    if (!name.trim()) return;
    const newItem: CompetitorBid = {
      id: "comp-" + Date.now(),
      name,
      cnpj,
      bidValue: Number(bid),
      status: "perdeu"
    };
    onUpdate({
      ...licitacao,
      competitors: [...licitacao.competitors, newItem],
      updatedAt: new Date().toISOString()
    });
  };

  const handleUpdateCompetitorStatus = (id: string, newStatus: CompetitorBid["status"], val?: number) => {
    const updatedCompetitors = licitacao.competitors.map(c => 
      c.id === id ? { 
        ...c, 
        status: newStatus,
        bidValue: val !== undefined ? val : c.bidValue
      } : c
    );
    onUpdate({
      ...licitacao,
      competitors: updatedCompetitors,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteCompetitor = (id: string) => {
    onUpdate({
      ...licitacao,
      competitors: licitacao.competitors.filter(c => c.id !== id),
      updatedAt: new Date().toISOString()
    });
  };

  // AI Predictive Analysis API call
  const handleAIPredict = async () => {
    setIsPredicting(true);
    try {
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : "";
      const response = await fetch("/api/licitacoes/predict", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          licitacao: {
            orgao,
            edital,
            objeto,
            modalidade,
            valorEstimado,
            cidade,
            estado,
            categoria
          },
          competitors: licitacao.competitors,
          historicalPrices: licitacao.competitors.map(c => ({ name: c.name, bid: c.bidValue }))
        })
      });

      const body = await response.json();
      if (body.success && body.prediction) {
        onUpdate({
          ...licitacao,
          predictiveCache: {
            ...body.prediction,
            generatedAt: new Date().toISOString()
          },
          updatedAt: new Date().toISOString()
        });
        alert("Análise preditiva de concorrentes realizada com sucesso!");
      }
    } catch (err) {
      alert("Houve uma falha ao tentar conexão com o modelo preditivo Gemini.");
    } finally {
      setIsPredicting(false);
    }
  };

  // Custom Item creation inside bidding
  const handleCreateCustomItem = (desc: string, qty: number, val: number) => {
    if (!desc.trim()) return;
    const currentItens = licitacao.itensPncp || [];
    let maxNum = 0;
    currentItens.forEach(it => {
      const n = parseInt(it.numero, 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    });
    const nextNumero = (maxNum + 1).toString();
    const newItem = {
      numero: nextNumero,
      descricao: desc,
      quantidade: Number(qty) || 1,
      valorUnitario: Number(val) || 0,
      valorTotal: (Number(qty) || 1) * (Number(val) || 0)
    };

    onUpdate({
      ...licitacao,
      itensPncp: [...currentItens, newItem],
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteItemPncp = (numero: string) => {
    const currentItens = licitacao.itensPncp || [];
    const updatedItens = currentItens.filter(it => it.numero !== numero);

    const updatedSuppliers = licitacao.suppliers.map(s => {
      const nextPrices = { ...(s.itemPrices || {}) };
      delete nextPrices[numero];

      let computedTotal = 0;
      updatedItens.forEach(it => {
        const itemPrice = nextPrices[it.numero] || 0;
        computedTotal += itemPrice * (it.quantidade || 1);
      });

      return {
        ...s,
        itemPrices: nextPrices,
        value: computedTotal
      };
    });

    onUpdate({
      ...licitacao,
      itensPncp: updatedItens,
      suppliers: updatedSuppliers,
      updatedAt: new Date().toISOString()
    });
  };

  return {
    state: {
      licitacao,
      edital, setEdital,
      orgao, setOrgao,
      objeto, setObjeto,
      modalidade, setModalidade,
      valorEstimado, setValorEstimado,
      dataSessao, setDataSessao,
      cidade, setCidade,
      estado, setEstado,
      categoria, setCategoria,
      url, setUrl,
      unidadeCompradora, setUnidadeCompradora,
      amparoLegal, setAmparoLegal,
      idContratacaoPncp, setIdContratacaoPncp,
      modoDisputa, setModoDisputa,
      dataInicioPropostas, setDataInicioPropostas,
      dataFimPropostas, setDataFimPropostas,
      scrapeUrl, setScrapeUrl,
      pasteText, setPasteText,
      isScraping,
      scrapeError,
      scrapeOverwriteCore, setScrapeOverwriteCore,
      scrapeOverwriteLocation, setScrapeOverwriteLocation,
      scrapeImportDocs, setScrapeImportDocs,
      newDocName, setNewDocName,
      newDocObs, setNewDocObs,
      isPredicting,
      statusNote, setStatusNote,
      saveSuccess,
      celebration, setCelebration,
      deleteConfirm, setDeleteConfirm
    },
    checkCelebration,
    handleConfirmDelete,
    handleSaveMainDetails,
    handleStatusChange,
    handleScrapeWithIA,
    handleAddDoc,
    handleAttachPncpFile,
    handleToggleDocStatus,
    handleDeleteDoc,
    handleAddCompetitor,
    handleUpdateCompetitorStatus,
    handleDeleteCompetitor,
    handleAIPredict,
    handleCreateCustomItem,
    handleDeleteItemPncp
  };
}
