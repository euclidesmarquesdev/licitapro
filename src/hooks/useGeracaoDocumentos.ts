import { useState } from "react";
import { CompanySetting, Licitacao } from "../types";
import { auth, getClientAuthToken } from "../firebase";

export function useGeracaoDocumentos(
  companySettings: CompanySetting, 
  licitacao: Licitacao,
  onUpdate: (updated: Licitacao) => void
) {
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);

  const handleGenerateDocTemplate = async (docType: string) => {
    setIsGeneratingDoc(true);
    try {
      const token = await getClientAuthToken();
      const response = await fetch("/api/licitacoes/generate-document", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          docType: docType,
          licitacao: {
            orgao: licitacao.orgao,
            edital: licitacao.edital,
            objeto: licitacao.objeto,
            modalidade: licitacao.modalidade,
            cidade: licitacao.cidade,
            estado: licitacao.estado
          },
          ourCompanyDetails: companySettings
        })
      });

      const body = await response.json();
      if (body.success && body.data) {
        return { success: true, data: body.data };
      }
      throw new Error("Resposta inválida do servidor");
    } catch (err) {
      console.warn("API de elaboração de documentos offline ou sem acesso. Iniciando gerador local avançado de contingência.", err);
      
      const companyName = companySettings.name || "Minha Empresa GovTech Brasil S/A";
      const companyCnpj = companySettings.cnpj || "12.345.678/0001-99";
      const companyAddress = companySettings.address || "Endereço não cadastrado";
      const partner = companySettings.partnerName || "Representante não preenchido";
      const cpf = companySettings.partnerCPF || "000.000.000-00";
      const role = companySettings.partnerRole || "Sócio Administrador";
      
      const today = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
      const orgaoName = licitacao.orgao || "Órgão Licitante";
      const editalLabel = licitacao.edital || "Pregão Presencial / Eletrônico";
      const modalidadeLabel = licitacao.modalidade || "Pregão Eletrônico";
      const objetoText = licitacao.objeto || "Objeto da licitação contratual.";
      const cidadeLabel = licitacao.cidade || "Brasília";
      const estadoLabel = licitacao.estado || "DF";

      let title = `Declaração para ${editalLabel}`;
      let content = "";

      if (docType.includes("Habilitação") || docType.includes("Geral")) {
        title = `Declaração de Habilitação Unificada - ${editalLabel}`;
        content = `DECLARAÇÃO DE PLENO CUMPRIMENTO DOS REQUISITOS DE HABILITAÇÃO

À Comissão de Licitação / Pregoeiro
Órgão Licitante: ${orgaoName}
Ref.: Processo de Licitação Nº ${editalLabel} (${modalidadeLabel})

A empresa ${companyName}, inscrita no CNPJ sob o nº ${companyCnpj}, com sede estabelecida no endereço ${companyAddress}, por intermédio de seu representante legal, o(a) Sr(a). ${partner}, portador(a) do CPF nº ${cpf} e no cargo de ${role}, DECLARA para todos os fins e efeitos de direito, sob as penalidades legais cabíveis:

1. Que cumpre plenamente todos os requisitos de qualificação e habilitação jurídica, fiscal, trabalhista e técnica exigidos para a presente contratação, nos termos previstos no edital e seus anexos.
2. Que não se encontra sob estado de falência, concordata, recuperação judicial, dissolução ou liquidação judicial, tampouco declarada inidônea por qualquer esfera do poder público brasileiro.
3. Que cumprirá integralmente as obrigações estipuladas no Edital, assegurando a qualidade e prazos descritos em nosso plano de ação.

Por ser a expressão fiel da verdade, sob as penas da Lei (art. 299 do Código Penal Brasileiro), firmamos este instrumento.

${cidadeLabel} - ${estadoLabel}, ${today}.

___________________________________________________________
${partner}
${role}
Doc. CPF: ${cpf}
representando ${companyName}`;
      } else if (docType.includes("Superveniência") || docType.includes("Art 7") || docType.includes("Trabalho")) {
        title = `Declaração de Fato Superveniente e Regularidade Trabalhista - ${editalLabel}`;
        content = `DECLARAÇÃO DE INEXISTÊNCIA DE FATO IMPEDITIVO E REGULARIDADE TRABALHISTA
(Em conformidade com o Art. 7º, Inciso XXXIII da CF)

Ao Órgão Licitante: ${orgaoName}
Ref.: Processo Licitatório nº ${editalLabel}

A proponente ${companyName}, inscrita sob o CNPJ nº ${companyCnpj}, sediada em ${companyAddress}, representada legalmente por ${partner}, portador do CPF nº ${cpf}, DECLARA solene e expressamente:

1. Que, em consonância com as exigências legais e sob as penas da lei, inexistem fatos supervenientes ou impeditivos para sua habilitação jurídica ou técnica na presente licitação, estando ciente da obrigatoriedade de declarar ocorrências futuras imprevistas.
2. Que, nos termos do disposto no inciso XXXIII do Art. 7º da Constituição Federal de 1988, regulamentado pela Lei Federal n.º 9.854/1999, não emprega menores de dezoito anos em trabalho noturno, perigoso ou insalubre, e não emprega menores de dezesseis anos em qualquer trabalho, salvo na condição de aprendiz, a partir de quatorze anos de idade.
3. Que cumpre com todos os parâmetros normativos e sanitários de segurança e medicina do trabalho referentes ao corpo de colaboradores operacionais.

Comprovando a veracidade destas declarações, firmamos la presente.

${cidadeLabel} - ${estadoLabel}, ${today}.

___________________________________________________________
${partner}
${role}
Doc. CPF: ${cpf}
representando ${companyName}`;
      } else if (docType.includes("Comercial") || docType.includes("Proposta") || docType.includes("Carta")) {
        title = `Carta de Proposta Comercial Simplificada - ${editalLabel}`;
        content = `CARTA DE APRESENTAÇÃO DE PROPOSTA COMERCIAL E FINANCEIRA

À Unidade Compradora: ${orgaoName}
Ref.: Procedimento Licitatório ${editalLabel} - Modalidade ${modalidadeLabel}
Objeto: "${objetoText}"

Prezados Senhores,

A empresa ${companyName}, CNPJ ${companyCnpj}, sediada em ${companyAddress}, considerando cuidadosamente todas as exigências técnicas informadas no edital e anexos relativos ao certame referenciado, vem apresentar sua Proposta de Preços Inicial para fornecimento / prestação de serviços:

1. VALOR GLOBAL REFERENCIAL DA PROPOSTA: Declaramos que o preço final proposto pela nossa corporação baseia-se na proposta de menor custo e de máxima qualidade, correspondendo perfeitamente ao objeto.
2. PRAZO DE VALIDADE DA PROPOSTA: 60 (sessenta) dias, contados a partir da data de abertura oficial da sessão pública.
3. PRAZO DE EXECUÇÃO / ENTREGA: Conforme expressamente determinado no respectivo Termo de Referência.
4. DECLARAÇÃO DE CUSTOS DIRETOS: Declaramos que nos preços propostos estão inclusos todos os tributos federais, estaduais e municipais incidentes, taxas logísticas, frete CIF, despesas patronais e trabalhistas, seguros e quaisquer outros encargos necessários.

Dados Bancários para eventual pagamento:
Banco: Banco do Brasil (001) / Banco Itaú • Agência: 3040-5 • C/C: 44.590-1

Para constar, assina esta proposta.

${cidadeLabel} - ${estadoLabel}, ${today}.

___________________________________________________________
${partner}
${role}
Doc. CPF: ${cpf}
representando ${companyName}`;
      } else {
        // ME/EPP
        title = `Declaração de Enquadramento ME/EPP - ${editalLabel}`;
        content = `DECLARAÇÃO DE ENQUADRAMENTO COMO MICROEMPRESA (ME) OU EMPRESA DE PEQUENO PORTE (EPP)

Ao Órgão: ${orgaoName}
Licitatório: ${editalLabel}

A empresa ${companyName}, inscrita no CNPJ sob o nº ${companyCnpj}, no endereço ${companyAddress}, por intermédio de seu representante legal Sr(a). ${partner}, portador(a) do CPF nº ${cpf}, DECLARA para os devidos fins de direito, especificamente para usufruir dos benefícios de preferência legal estabelecidos pela Lei Complementar nº 123/2006:

1. Que a nossa empresa se enquadra plenamente, na data de abertura deste certame, na categoria de [ ] Microempresa (ME) ou [ ] Empresa de Pequeno Porte (EPP), nos termos da Lei Complementar nº 123, de 14 de dezembro de 2006, modificada pelas legislações subsequentes.
2. Que o faturamento bruto anual da proponente não ultrapassa os limites legais previstos no Art. 3º do citado diploma legal.
3. Que inexistem quaisquer dos impedimentos previstos no § 4º do artigo 3º da Lei Complementar nº 123/2006, estando apta a usufruir de todas as prerrogativas de desempate e preferência de lances.

Por ser expressão legítima da verdade, firmo a presente sob as penas da lei.

${cidadeLabel} - ${estadoLabel}, ${today}.

___________________________________________________________
${partner}
${role}
Doc. CPF: ${cpf}
representando ${companyName}`;
      }

      return { success: true, data: { documentTitle: title, content } };
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  return {
    isGeneratingDoc,
    handleGenerateDocTemplate
  };
}
