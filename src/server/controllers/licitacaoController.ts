/**
 * 📁 LICITACAO CONTROLLER - PONTO DE ENTRADA
 * 
 * Este arquivo agora apenas re-exporta os handlers dos módulos refatorados.
 * Mantido para compatibilidade com as rotas existentes.
 * 
 * @deprecated Use imports diretos de:
 *   - import { handleScrapeBidding } from "./licitacao/scrape.js"
 *   - import { handlePredictBidding } from "./licitacao/predict.js"
 *   - import { handleGenerateDocument } from "./licitacao/document.js"
 *   - import { handlePncpImport } from "./pncp/import.js"
 *   - import { handlePncpSearch } from "./pncp/search.js"
 *   - import { handleGetAuditHistory } from "./audit/history.js"
 *   - import { handleGetUsageStats } from "./audit/stats.js"
 */

// ============================================================
// LICITAÇÃO
// ============================================================
export { 
  handleScrapeBidding,
  handlePredictBidding,
  handleGenerateDocument
} from "./licitacao/index.js";

// ============================================================
// PNCP
// ============================================================
export {
  handlePncpImport,
  handlePncpSearch
} from "./pncp/index.js";

// ============================================================
// AUDITORIA
// ============================================================
export {
  handleGetAuditHistory,
  handleGetUsageStats
} from "./audit/index.js";