export interface ParsedPncp {
  edital: string;
  orgao: string;
  unidadeCompradora: string;
  modalidade: string;
  amparoLegal: string;
  idPncp: string;
  objeto: string;
  valorEstimado: number;
  cidade: string;
  estado: string;
  dataInicio: string;
  dataFim: string;
  modoDisputa?: string;
  itens: {
    numero: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }[];
  arquivos?: {
    id: string;
    nome: string;
    descricao?: string;
    linkUrl?: string;
    tamanho?: string;
  }[];
}

export function parsePncpClipboardText(text: string): ParsedPncp {
  const result: ParsedPncp = {
    edital: "",
    orgao: "",
    unidadeCompradora: "",
    modalidade: "Dispensa",
    amparoLegal: "",
    idPncp: "",
    objeto: "",
    valorEstimado: 0,
    cidade: "Juazeiro",
    estado: "BA",
    dataInicio: "",
    dataFim: "",
    modoDisputa: "",
    itens: [],
    arquivos: []
  };

  if (!text) return result;

  // Split lines
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Parse fields
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check various combinations
    if (line.startsWith("Aviso de Contratação Direta nº") || line.startsWith("Pregão Eletrônico nº") || line.startsWith("Edital nº") || line.startsWith("Aviso de Licitação nº")) {
      result.edital = line;
    } else if (line.startsWith("Órgão:")) {
      result.orgao = line.replace(/^Órgão:\s*/i, "").trim();
    } else if (line.startsWith("Unidade compradora:")) {
      result.unidadeCompradora = line.replace(/^Unidade compradora:\s*/i, "").trim();
    } else if (line.startsWith("Modalidade da contratação:") || line.startsWith("Modalidade:")) {
      result.modalidade = line.replace(/^(Modalidade da contratação:|Modalidade:)\s*/i, "").trim();
    } else if (line.startsWith("Amparo legal:")) {
      result.amparoLegal = line.replace(/^Amparo legal:\s*/i, "").trim();
    } else if (line.startsWith("Modo de disputa:")) {
      result.modoDisputa = line.replace(/^Modo de disputa:\s*/i, "").trim();
    } else if (line.startsWith("Id contratação PNCP:") || line.startsWith("ID PNCP:") || line.startsWith("Id contratação:")) {
      result.idPncp = line.replace(/^(Id contratação PNCP:|ID PNCP:|Id contratação:)\s*/i, "").trim();
    } else if (line.startsWith("Local:")) {
      const loc = line.replace(/^Local:\s*/i, "").trim();
      if (loc.includes("/")) {
        const parts = loc.split("/");
        result.cidade = parts[0].trim();
        result.estado = parts[1].trim().substring(0, 2).toUpperCase();
      } else {
        result.cidade = loc;
      }
    } else if (line.startsWith("Data de início de recebimento de propostas:") || line.startsWith("Início de recebimento de propostas:")) {
      let val = line.replace(/^(Data de início de recebimento de propostas:|Início de recebimento de propostas:)\s*/i, "").trim();
      val = val.replace(/\s*\(horário de Brasília\)/gi, "").trim();
      result.dataInicio = val;
    } else if (line.startsWith("Data fim de recebimento de propostas:") || line.startsWith("Fim de recebimento de propostas:")) {
      let val = line.replace(/^(Data fim de recebimento de propostas:|Fim de recebimento de propostas:)\s*/i, "").trim();
      val = val.replace(/\s*\(horário de Brasília\)/gi, "").trim();
      result.dataFim = val;
    } else if (line.startsWith("Objeto:")) {
      let objText = "";
      let jj = i + 1;
      while (jj < lines.length && 
             !lines[jj].startsWith("VALOR TOTAL") && 
             !lines[jj].startsWith("Itens") && 
             !lines[jj].includes("Órgão:") &&
             !lines[jj].includes("Local:") && 
             lines[jj].trim() !== "") {
        objText += (objText ? " " : "") + lines[jj];
        jj++;
      }
      result.objeto = objText;
    } else if (line.startsWith("VALOR TOTAL ESTIMADO DA COMPRA") || line.startsWith("VALOR TOTAL ESTIMADO")) {
      if (i + 1 < lines.length) {
        const valStr = lines[i + 1].replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
        const numVal = parseFloat(valStr);
        if (!isNaN(numVal)) {
          result.valorEstimado = numVal;
        }
      }
    }
  }

  // Backup regex elements to make it extremely resilient
  if (!result.edital) {
    const editalMatch = text.match(/(?:Aviso de Contratação Direta nº|Pregão Eletrônico nº|Processo nº|Edital nº|Aviso de Dispensa nº)\s*([^\n\r]+)/i);
    if (editalMatch) result.edital = editalMatch[0].trim();
  }
  if (!result.orgao) {
    const orgaoMatch = text.match(/Órgão:\s*([^\n\r]+)/i);
    if (orgaoMatch) result.orgao = orgaoMatch[1].trim();
  }
  if (!result.objeto) {
    const objetoMatch = text.match(/Objeto:\s*([\s\S]+?)(?=VALOR TOTAL ESTIMADO|$)/i);
    if (objetoMatch) result.objeto = objetoMatch[1].trim().replace(/\s+/g, " ");
  }
  if (!result.modoDisputa) {
    const modoMatch = text.match(/Modo de disputa:\s*([^\r\n]+)/i);
    if (modoMatch) result.modoDisputa = modoMatch[1].trim();
  }
  if (result.valorEstimado === 0) {
    const valorMatch = text.match(/VALOR TOTAL ESTIMADO DA COMPRA\s*[\r\n]+\s*R\$\s*([0-9.,]+)/i);
    if (valorMatch) {
      const valStr = valorMatch[1].replace(/\./g, "").replace(",", ".").trim();
      const numVal = parseFloat(valStr);
      if (!isNaN(numVal)) result.valorEstimado = numVal;
    }
  }

  // Now, parse table of Items
  // Look for any line containing "Itens"
  // Let's find "Detalhar" or lines starting with digit
  const detalharIndex = lines.findIndex(l => l.toLowerCase() === "detalhar");
  let startIndex = detalharIndex !== -1 ? detalharIndex + 1 : -1;
  if (startIndex === -1) {
    // Try to find the line where table column names are
    startIndex = lines.findIndex(l => l.toLowerCase().includes("valor total estimado"));
    if (startIndex !== -1) {
      if (lines[startIndex + 1]?.toLowerCase() === "detalhar") {
        startIndex += 2;
      } else {
        startIndex += 1;
      }
    }
  }

  if (startIndex !== -1 && startIndex < lines.length) {
    let curr = startIndex;
    while (curr < lines.length) {
      const lineVal = lines[curr].trim();
      // Match item index numbers like "317780" or sequential "1", "2"
      if (/^\d+$/.test(lineVal)) {
        const numStr = lineVal;
        const desc = lines[curr + 1] || "";
        const qtdStr = lines[curr + 2] || "";
        const valUnitStr = lines[curr + 3] || "";
        const valTotalStr = lines[curr + 4] || "";

        // Verify if Qtd and Prices look like expected
        // Qtd is a clear integer
        const qtd = parseInt(qtdStr);
        const hasUnitSign = valUnitStr.includes("R$");
        const valUnit = hasUnitSign ? parseFloat(valUnitStr.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) : parseFloat(valUnitStr.replace(/\./g, "").replace(",", ".").trim());
        const hasTotalSign = valTotalStr.includes("R$");
        const valTotal = hasTotalSign ? parseFloat(valTotalStr.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) : parseFloat(valTotalStr.replace(/\./g, "").replace(",", ".").trim());

        if (!isNaN(qtd) && !isNaN(valUnit)) {
          result.itens.push({
            numero: numStr,
            descricao: desc,
            quantidade: qtd,
            valorUnitario: valUnit,
            valorTotal: isNaN(valTotal) ? qtd * valUnit : valTotal
          });
          // Jump past the parsed lines
          curr += 5;
        } else {
          curr++;
        }
      } else {
        curr++;
      }
    }
  }

  // If items weren't parsed because headers were different, try alternative line-by-line item parser
  if (result.itens.length === 0) {
    for (let c = 0; c < lines.length; c++) {
      if (/^\d+$/.test(lines[c]) && lines[c].length >= 4 && c + 4 < lines.length) {
        // e.g. item code 317780
        const numStr = lines[c];
        const desc = lines[c+1];
        const qtdStr = lines[c+2];
        const valUnitStr = lines[c+3];
        const valTotalStr = lines[c+4];
        if (valUnitStr.includes("R$") && valTotalStr.includes("R$")) {
          const qtd = parseInt(qtdStr);
          const valUnit = parseFloat(valUnitStr.replace("R$", "").replace(/\./g, "").replace(",", ".").trim());
          const valTotal = parseFloat(valTotalStr.replace("R$", "").replace(/\./g, "").replace(",", ".").trim());
          if (!isNaN(qtd) && !isNaN(valUnit)) {
            result.itens.push({
              numero: numStr,
              descricao: desc,
              quantidade: qtd,
              valorUnitario: valUnit,
              valorTotal: valTotal
            });
            c += 4;
          }
        }
      }
    }
  }

  // Extract archives/files from PNCP text matching extensions or field patterns
  const arquivosList: { id: string; nome: string; descricao?: string; linkUrl?: string; tamanho?: string; }[] = [];
  
  // Method 1: regex-based extraction for lines starting with "Nome do arquivo:" or "Arquivo"
  const fileRegex = /(?:Nome do arquivo|Nome do Anexo|Arquivo|Documento|Título|Name|File)[:\s-]*([^\r\n:]+\.(?:pdf|zip|rar|docx|xlsx|doc|xls|png|jpg))/gi;
  let fileMatch;
  while ((fileMatch = fileRegex.exec(text)) !== null) {
    const nome = fileMatch[1].trim();
    if (nome && nome.length > 3 && !arquivosList.some(a => a.nome === nome)) {
      arquivosList.push({
        id: "pncp-doc-" + arquivosList.length + "-" + Math.random().toString(36).substring(2, 7),
        nome,
        descricao: "Documento oficial do edital",
        linkUrl: "https://pncp.gov.br/app/editais?pagina=1",
        tamanho: "Indisponível"
      });
    }
  }

  // Method 2: scanner for any line indicating standard documents or containing document extensions
  const rawLines = text.split("\n");
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;
    
    // Check if line contains a standard document extension
    const dotPdfIndex = line.toLowerCase().indexOf(".pdf");
    const dotZipIndex = line.toLowerCase().indexOf(".zip");
    const dotDocxIndex = line.toLowerCase().indexOf(".docx");
    const dotRarIndex = line.toLowerCase().indexOf(".rar");
    
    let foundExt = "";
    if (dotPdfIndex !== -1) foundExt = ".pdf";
    else if (dotZipIndex !== -1) foundExt = ".zip";
    else if (dotDocxIndex !== -1) foundExt = ".docx";
    else if (dotRarIndex !== -1) foundExt = ".rar";
    
    if (foundExt) {
      // Find the probable filename token or grab the line
      let nome = line;
      nome = nome.replace(/^(Nome do arquivo|Arquivo|Documento|Anexo|Título)[:\s-]*/i, "").trim();
      
      // If the line is too generic or long, try to find the specific token that has .pdf / .zip in it
      if (nome.length > 120) {
        const tokens = nome.split(/[\s\t,;]+/);
        const fileToken = tokens.find(t => t.toLowerCase().includes(foundExt));
        if (fileToken) {
          nome = fileToken;
        } else {
          nome = nome.substring(0, 90) + "...";
        }
      }
      
      // Remove restricted characters for web/UI safety
      nome = nome.replace(/[<>:"/\\|?*()]/g, "").trim();
      
      // Ensure it ends with our extension or we just add it back if it got cleaned
      if (!nome.toLowerCase().endsWith(foundExt)) {
        nome = nome + foundExt;
      }
      
      if (nome && nome.length > 4 && !arquivosList.some(a => a.nome.toLowerCase() === nome.toLowerCase())) {
        let descricao = "Termo / Arquivo do edital";
        let tamanho = "Aprox. 1.2 MB";
        let linkUrl = "";
        
        // Scan surrounding lines for metadata like descriptions or real links
        for (let offset = 1; offset <= 3; offset++) {
          if (i + offset < rawLines.length) {
            const nextL = rawLines[i + offset].trim();
            if (nextL.toLowerCase().startsWith("descrição:") || nextL.toLowerCase().startsWith("descricao:")) {
              descricao = nextL.replace(/^(descrição|descricao):\s*/i, "").trim();
            } else if (nextL.toLowerCase().startsWith("tamanho:") || nextL.toLowerCase().includes("kb") || nextL.toLowerCase().includes("mb")) {
              tamanho = nextL.replace(/^tamanho:\s*/i, "").trim();
            } else if (nextL.startsWith("http://") || nextL.startsWith("https://")) {
              linkUrl = nextL;
            }
          }
        }
        
        // Search if some URL exists in the filename line itself
        if (!linkUrl) {
          const inlineUrlMatch = line.match(/https?:\/\/[^\s]+/);
          if (inlineUrlMatch) {
            linkUrl = inlineUrlMatch[0];
          }
        }
        
        arquivosList.push({
          id: "pncp-doc-" + arquivosList.length + "-" + Math.random().toString(36).substring(2, 7),
          nome,
          descricao,
          tamanho,
          linkUrl: linkUrl || "https://pncp.gov.br/app/editais?pagina=1"
        });
      }
    }
  }

  result.arquivos = arquivosList;

  return result;
}
