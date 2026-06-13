import Dexie, { type Table } from "dexie";
import { Licitacao, CompanySetting } from "../types";

export interface CompanySettingsRecord extends CompanySetting {
  id: string;
}

export class LicitaProDatabase extends Dexie {
  licitacoes!: Table<Licitacao, string>;
  companySettings!: Table<CompanySettingsRecord, string>;

  constructor() {
    super("LicitaProDb");
    this.version(1).stores({
      licitacoes: "id, userId, status, categoria, updatedAt",
      companySettings: "id"
    });
  }
}

export const localDb = new LicitaProDatabase();

// Helper to fetch all biddings for a specific virtual/guest user 
export async function getLocalLicitacoes(userId: string = "guest-user"): Promise<Licitacao[]> {
  try {
    return await localDb.licitacoes.where("userId").equals(userId).toArray();
  } catch (err) {
    console.error("Erro ao obter licitações do IndexedDB:", err);
    return [];
  }
}

// Save or update a single bidding
export async function saveLocalLicitacao(licitacao: Licitacao): Promise<void> {
  try {
    await localDb.licitacoes.put(licitacao);
  } catch (err) {
    console.error("Erro ao gravar licitação no IndexedDB:", err);
  }
}

// Bulk save multiple biddings (often used inside bulk imports)
export async function bulkSaveLocalLicitacoes(items: Licitacao[]): Promise<void> {
  try {
    await localDb.licitacoes.bulkPut(items);
  } catch (err) {
    console.error("Erro ao salvar lote de licitações no IndexedDB:", err);
  }
}

// Delete a bidding
export async function deleteLocalLicitacao(id: string): Promise<void> {
  try {
    await localDb.licitacoes.delete(id);
  } catch (err) {
    console.error("Erro ao excluir licitação do IndexedDB:", err);
  }
}

// Fetch local company settings
export async function getLocalCompanySettings(): Promise<CompanySetting | null> {
  try {
    const record = await localDb.companySettings.get("current_settings");
    if (record) {
      const { id, ...settings } = record;
      return settings;
    }
    return null;
  } catch (err) {
    console.error("Erro ao obter configurações cadastradas do IndexedDB:", err);
    return null;
  }
}

// Save local company settings
export async function saveLocalCompanySettings(settings: CompanySetting): Promise<void> {
  try {
    await localDb.companySettings.put({
      id: "current_settings",
      ...settings
    });
  } catch (err) {
    console.error("Erro ao gravar configurações no IndexedDB:", err);
  }
}

// Export database backup to formatted JSON structure
export async function exportLocalDbBackup(): Promise<string> {
  try {
    const allLicitacoes = await localDb.licitacoes.toArray();
    const settingsRecord = await localDb.companySettings.get("current_settings");
    
    const backupObj = {
      app: "LicitaPro",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      data: {
        licitacoes: allLicitacoes,
        companySettings: settingsRecord ? {
          name: settingsRecord.name,
          cnpj: settingsRecord.cnpj,
          address: settingsRecord.address,
          partnerName: settingsRecord.partnerName,
          partnerCPF: settingsRecord.partnerCPF,
          partnerRole: settingsRecord.partnerRole
        } : null
      }
    };
    
    return JSON.stringify(backupObj, null, 2);
  } catch (err) {
    console.error("Falha ao exportar backup do IndexedDB:", err);
    throw new Error("Não foi possível gerar a string de backup dos seus dados.");
  }
}

// Import database from JSON structure with integrity check
export async function importLocalDbBackup(jsonString: string): Promise<{ success: boolean; importedCount: number; message: string }> {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Integrity validations
    if (!parsed || parsed.app !== "LicitaPro" || !parsed.data) {
      return { success: false, importedCount: 0, message: "O arquivo de backup fornecido não é compatível ou está corrompido." };
    }
    
    const { licitacoes, companySettings } = parsed.data;
    
    if (Array.isArray(licitacoes)) {
      // Clean and put items
      await localDb.licitacoes.clear();
      if (licitacoes.length > 0) {
        await localDb.licitacoes.bulkPut(licitacoes);
      }
    }
    
    if (companySettings) {
      await localDb.companySettings.put({
        id: "current_settings",
        ...companySettings
      });
    }
    
    return { 
      success: true, 
      importedCount: Array.isArray(licitacoes) ? licitacoes.length : 0, 
      message: "Backup integrado com sucesso! Todo o banco local foi reestabelecido." 
    };
  } catch (err: any) {
    console.error("Erro na restauração de backup:", err);
    return { success: false, importedCount: 0, message: "Erro ao decodificar a carga de backup: " + err.message };
  }
}
