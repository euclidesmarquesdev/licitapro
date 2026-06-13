import { useMemo } from "react";
import { Licitacao, SupplierContact } from "../types";
import { MOCK_CATALOG_SUPPLIERS } from "../data";

export function useFornecedores(
  licitacao: Licitacao,
  onUpdate: (updated: Licitacao) => void,
  onCheckCelebration: (newChecklist?: any[], newSuppliers?: SupplierContact[]) => void
) {
  const activeSuppliers = useMemo(() => {
    return (licitacao.suppliers || []).filter(s => s && s.name && !s.name.startsWith("[PNCP]"));
  }, [licitacao.suppliers]);

  const activeQuoteSum = useMemo(() => {
    return activeSuppliers
      .filter(s => s.status === "cotado")
      .reduce((acc, curr) => acc + curr.value, 0);
  }, [activeSuppliers]);

  const handleAddSupplier = (name: string, product: string, contact: string) => {
    if (!name.trim()) return;

    const itemPrices: { [itemNumero: string]: number } = {};
    let totalValue = 0;

    (licitacao.itensPncp || []).forEach(item => {
      const unitPrice = Math.round(item.valorUnitario * 100) / 100;
      itemPrices[item.numero] = unitPrice;
      totalValue += unitPrice * (item.quantidade || 1);
    });

    const newItem: SupplierContact = {
      id: "sup-" + Date.now(),
      name,
      product: product || "Produto Geral",
      value: totalValue || 0,
      contact: contact || "comercial@empresa.com.br",
      status: totalValue > 0 ? "cotado" : "aguardando",
      notes: "Fornecedor incluído manualmente com base no preço teto de referência (0% de desconto inicial).",
      itemPrices
    };

    const updatedSuppliers = [...licitacao.suppliers, newItem];
    onCheckCelebration(undefined, updatedSuppliers);

    onUpdate({
      ...licitacao,
      suppliers: updatedSuppliers,
      updatedAt: new Date().toISOString()
    });

    // Save newly added manual supplier to the global database as well!
    try {
      const saved = localStorage.getItem("LICI_TRACK_V1_general_suppliers");
      let currentList = saved ? JSON.parse(saved) : [...MOCK_CATALOG_SUPPLIERS];
      if (!currentList.some((s: any) => s.name.toLowerCase() === name.toLowerCase())) {
        const globalSup = {
          name,
          product: product || "Produto Geral",
          value: totalValue || 0,
          contact: contact || "comercial@empresa.com.br",
          phone: "(11) 99999-9999",
          categoryKeywords: [
            product ? product.toLowerCase() : "geral", 
            licitacao.categoria ? licitacao.categoria.toLowerCase() : "geral"
          ]
        };
        currentList = [globalSup, ...currentList];
        localStorage.setItem("LICI_TRACK_V1_general_suppliers", JSON.stringify(currentList));
      }
    } catch (e) {
      console.error("Local sync fail for global suppliers:", e);
    }
  };

  const handleUpdateSupplierStatus = (id: string, newStatus: SupplierContact["status"], priceValue?: number) => {
    const updatedSuppliers = licitacao.suppliers.map(s => 
      s.id === id ? { 
        ...s, 
        status: newStatus, 
        value: priceValue !== undefined ? priceValue : s.value 
      } : s
    );
    onCheckCelebration(undefined, updatedSuppliers);
    onUpdate({
      ...licitacao,
      suppliers: updatedSuppliers,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteSupplier = (id: string) => {
    onUpdate({
      ...licitacao,
      suppliers: licitacao.suppliers.filter(s => s.id !== id),
      updatedAt: new Date().toISOString()
    });
  };

  const getCompatibleSuppliers = () => {
    const textPool = [
      licitacao.objeto || "",
      licitacao.edital || "",
      licitacao.categoria || "",
      ...(licitacao.itensPncp || []).map(item => item.descricao || "")
    ].join(" ").toLowerCase();

    return MOCK_CATALOG_SUPPLIERS.filter(sup => {
      return sup.categoryKeywords.some(keyword => textPool.includes(keyword));
    });
  };

  const handleImportCatalogSupplier = (sup: typeof MOCK_CATALOG_SUPPLIERS[0]) => {
    const existingIndex = licitacao.suppliers.findIndex(s => s.name.toLowerCase() === sup.name.toLowerCase());
    
    if (existingIndex !== -1) {
      const updatedSuppliers = licitacao.suppliers.filter((_, idx) => idx !== existingIndex);
      onUpdate({
        ...licitacao,
        suppliers: updatedSuppliers,
        updatedAt: new Date().toISOString()
      });
      return;
    }

    const itemPrices: { [itemNumero: string]: number } = {};
    let totalValue = 0;

    (licitacao.itensPncp || []).forEach(item => {
      const unitPrice = Math.round(item.valorUnitario * 100) / 100;
      itemPrices[item.numero] = unitPrice;
      totalValue += unitPrice * (item.quantidade || 1);
    });

    const newItem: SupplierContact = {
      id: "catalog-sup-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: sup.name,
      product: sup.product,
      value: totalValue || sup.value,
      contact: sup.phone ? `${sup.phone} • ${sup.contact}` : sup.contact,
      status: "cotado",
      notes: "Sincronizado do catálogo comercial com preços teto de referência (0% de desconto inicial).",
      itemPrices
    };

    const updatedSuppliers = [...licitacao.suppliers, newItem];
    onCheckCelebration(undefined, updatedSuppliers);
    onUpdate({
      ...licitacao,
      suppliers: updatedSuppliers,
      updatedAt: new Date().toISOString()
    });
  };

  const handleImportAllCompatible = (matching: typeof MOCK_CATALOG_SUPPLIERS) => {
    let count = 0;
    const currentSuppliers = [...licitacao.suppliers];

    matching.forEach(sup => {
      if (!currentSuppliers.some(s => s.name.toLowerCase() === sup.name.toLowerCase())) {
        const itemPrices: { [itemNumero: string]: number } = {};
        let totalValue = 0;

        (licitacao.itensPncp || []).forEach(item => {
          const unitPrice = Math.round(item.valorUnitario * 100) / 100;
          itemPrices[item.numero] = unitPrice;
          totalValue += unitPrice * (item.quantidade || 1);
        });

        currentSuppliers.push({
          id: "catalog-sup-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6) + "-" + count,
          name: sup.name,
          product: sup.product,
          value: totalValue || sup.value,
          contact: sup.phone ? `${sup.phone} • ${sup.contact}` : sup.contact,
          status: "cotado",
          notes: "Sincronizado do catálogo comercial de referência com 0% de desconto inicial.",
          itemPrices
        });
        count++;
      }
    });

    if (count === 0) {
      alert("Todos os fornecedores compatíveis já estão presentes na lista.");
      return;
    }

    onCheckCelebration(undefined, currentSuppliers);
    onUpdate({
      ...licitacao,
      suppliers: currentSuppliers,
      updatedAt: new Date().toISOString()
    });
  };

  const handleUpdateSupplierItemPrice = (supplierId: string, itemNumero: string, price: number) => {
    const updatedSuppliers = licitacao.suppliers.map(s => {
      if (s.id === supplierId) {
        const itemPrices = { ...(s.itemPrices || {}), [itemNumero]: price };

        const rawItems = licitacao.itensPncp || [];
        let computedTotal = 0;
        rawItems.forEach(it => {
          const itemPrice = it.numero === itemNumero ? price : (itemPrices[it.numero] || 0);
          computedTotal += itemPrice * (it.quantidade || 1);
        });

        const nextStatus = computedTotal > 0 ? "cotado" as const : s.status;

        return {
          ...s,
          itemPrices,
          value: computedTotal,
          status: nextStatus
        };
      }
      return s;
    });

    onCheckCelebration(undefined, updatedSuppliers);
    onUpdate({
      ...licitacao,
      suppliers: updatedSuppliers,
      updatedAt: new Date().toISOString()
    });
  };

  return {
    activeSuppliers,
    activeQuoteSum,
    handleAddSupplier,
    handleUpdateSupplierStatus,
    handleDeleteSupplier,
    getCompatibleSuppliers,
    handleImportCatalogSupplier,
    handleImportAllCompatible,
    handleUpdateSupplierItemPrice
  };
}
