import React, { useState, useRef } from "react";
import { 
  Download, Upload, FileJson, Check, AlertTriangle, 
  X, ShieldCheck, Database, RefreshCw
} from "lucide-react";
import { exportLocalDbBackup, importLocalDbBackup } from "../utils/indexedDb";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreComplete: () => void;
}

export default function BackupModal({
  isOpen,
  onClose,
  onRestoreComplete
}: BackupModalProps) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      const jsonString = await exportLocalDbBackup();
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      const dateStr = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `licitapro_backup_local_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSuccessMsg("Backup gerado e baixado com sucesso! Salve este arquivo em um local seguro.");
    } catch (err: any) {
      setErrorMsg("Falha ao exportar seus lances: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");
    
    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importLocalDbBackup(text);
        
        if (res.success) {
          setSuccessMsg(`${res.message} (${res.importedCount} editais restaurados).`);
          onRestoreComplete();
        } else {
          setErrorMsg(res.message);
        }
      } catch (err: any) {
        setErrorMsg("Falha na leitura do arquivo JSON: " + err.message);
      } finally {
        setLoading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    
    reader.onerror = () => {
      setErrorMsg("Erro ao carregar o arquivo físico do disco.");
      setLoading(false);
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Database className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Backup de Segurança (Modo Local)</h3>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">IndexedDB de Alta Performance</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="space-y-4 py-2">
          <p className="text-xs text-slate-600 leading-relaxed">
            Como você está utilizando o **Modo Demonstração com Banco Local**, todos os seus dados ficam salvos de forma privada no navegador. Para garantir que nunca perderá seu progresso de editais, utilize este assistente.
          </p>

          {/* Alert messages */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2 animate-bounce-short">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Export block */}
            <div className="border border-slate-100 bg-slate-50 p-4 rounded-xl flex flex-col justify-between h-40">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Download className="w-4.5 h-4.5 text-indigo-600" />
                  <h4 className="text-xs font-extrabold text-slate-800">Exportar Base</h4>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-normal">
                  Gere um arquivo JSON com todas as licitações, cronogramas, propostas, margens e dados da sua empresa.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-bold rounded-lg shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <FileJson className="w-3.5 h-3.5" />
                    Baixar Backup JSON
                  </>
                )}
              </button>
            </div>

            {/* Import block */}
            <div className="border border-slate-150 p-4 rounded-xl flex flex-col justify-between h-40">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Upload className="w-4.5 h-4.5 text-emerald-600" />
                  <h4 className="text-xs font-extrabold text-slate-800">Importar Base</h4>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-normal">
                  Restaure uma base anterior de backup. <span className="text-amber-600 font-bold">Atenção:</span> Esta ação irá substituir o histórico local atual.
                </p>
              </div>
              <div>
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImport}
                  accept=".json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow transition flex items-center justify-center gap-1.5 cursor-pointerOne"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Subir Arquivo Backup
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <p className="text-[9.5px] text-slate-400 font-semibold leading-none mr-auto">
            🛡️ Seus backups são salvos 100% de forma estática offline.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
}
