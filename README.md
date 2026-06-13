# 🏛️ Sistema de Acompanhamento de Licitações (SAL - IA)

[![React 19](https://img.shields.io/badge/React-19.0.1-blue?logo=react&logoColor=white&style=for-the-badge)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.1.14-06B6D4?logo=tailwind-css&logoColor=white&style=for-the-badge)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-3.5_Flash-BF60A4?logo=google-gemini&logoColor=white&style=for-the-badge)](https://ai.google.dev/)
[![Express.js](https://img.shields.io/badge/Express-4.21.2-404D59?logo=express&logoColor=white&style=for-the-badge)](https://expressjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase_Firestore-12.14.0-FFCA28?logo=firebase&logoColor=white&style=for-the-badge)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript&logoColor=white&style=for-the-badge)](https://www.typescriptlang.org/)

O **Sistema de Acompanhamento de Licitações (SAL - IA)** é um ecossistema full-stack avançado de inteligência governamental e inteligência de mercado planejado para o gerenciamento de certames públicos no Brasil. Desenvolvido para atuar em total harmonia com a nova **Lei de Licitações e Contratos Administrativos (Lei nº 14.133/2021)**, o sistema utiliza Inteligência Artificial generativa (**Google Gemini**) para automatizar a leitura de editais, predizer comportamentos concorrenciais, validar conformidades regulatórias complexas e acelerar a redação documental necessária para as sessões de lances.

---

## 🚀 Principais Recursos & Características

O sistema é dividido em módulos analíticos táticos, consolidados sob uma interface SPA (Single Page Application) fluida e de alta performance:

### 1. 🤖 IA Scraper Inteligente de Editais (Integração PNCP)
*   **Extração Instantânea com IA**: Permite colar o texto bruto de editais ou fornecer o link direto do certame. A IA decifra o conteúdo e preenche automaticamente o formulário do portal nacional.
*   **Auto-Preenchimento Estruturado**: Reconhece dados complexos, como Órgão, Edital, Objeto, Modalidade, Valor Estimado, Data/Horário da Sessão Pública, Cidade, Estado e Categoria.
*   **Captura de Arquivos e Dossiês do PNCP**: Associa e importa arquivos oficiais (PDFs/ZIPs) anexando-os diretamente ao seu painel interno.

### 2. 🔮 Inteligência Preditiva de Mercado (Cérebro Gemini AI)
*   **Mapeamento de Competidores**: Lê automaticamente o banco de concorrentes conhecidos ou lances digitados e traça perfis realistas dos adversários.
*   **Estratégias de Lances & Margens**: Gera sugestões automatizadas de lances ideais de entrada, taxa de desconto ideal consolidada e teto de lances robôs.
*   **Identificação de Riscos de Desclassificação**: Antecipa riscos técnicos e gargalos jurídicos ocultos ou exigências complexas no edital para evitar perdas de sessão.

### 3. ⚖️ Compliance Legal, Auditoria de IA & Termos Gerais (Lei 14.133/21)
*   **Controle de Termos de Uso e Isenção de IA**: Tela de entrada equipada com consentimento legal explícito (Lei 14.133/2021 e Decreto nº 11.243/2022), obrigando o analista a declarar ciência de que as estimativas, checklists, prazos e minutas possuem caráter consultivo e de apoio estratégico, exigindo sempre a validação pelo jurídico competente.
*   **Livro de Auditoria de Algoritmos & Rastreabilidade de IA**: Plataforma de registro integrada para governança ativa de dados. Cada análise executada pelos motores de IA gera um registro imutável contendo:
    *   *Assinatura Criptográfica* única (`sha256`);
    *   *Payload* estruturado de envio e resposta detalhada;
    *   *Timestamp* preciso e origem da transação.
*   **Exportação do Livro de Auditoria**: Interface integrada para auditoria que permite baixar o histórico criptografado consolidade em formato `.JSON` para fins de compliance e defesas administrativas.
*   **Simulador de Empate Ficto (LC 123/2006)**: Aplica cálculos automatizados sobre lances concorrentes para identificar se a empresa (caso seja ME ou EPP) está apta a invocar o direito de desempate de 5% (Pregão) ou 10% (Concorrência), instruindo quais lances de desempate lançar no portal.
*   **Auditoria de Coerência de Preços (IN 65/2021)**: Realiza análises de dispersão estatística de propostas comerciais e cotações ativas. Calcula a **Média Aritmética**, **Mediana de Mercado**, **Desvio Padrão (σ)** e o crucial **Coeficiente de Variação (CV)** para alertar sobre disparates de preços superiores a 25% (*outliers*).
*   **Validador de Enquadramento Direto (IN 67/21)**: Avalia o valor de referência do edital sob os limiares atuais de Dispensa por Valor (limites federais vigentes para Compras/Serviços e Obras de Engenharia), determinando a viabilidade de contratação direta.

### 4. 📃 Gerador de Documentos de Sessão
*   **Minutas Prontas em Segundos**: Integra os dados cadastrais da instituição e as regras do edital para redigir instantaneamente:
    *   *Declaração de Habilitação Geral*
    *   *Declaração de Superveniência e Cumprimento da CF (Art 7º)*
    *   *Carta de Proposta Comercial Inicial*
    *   *Declaração de Enquadramento de Microempresa (ME/EPP)*
    *   *Estudo Técnico Preliminar (ETP - IN 58/2022)*
    *   *Termo de Referência (TR - IN 81/2022)*
*   **Exportação Rápida**: Área de pré-visualização configurada com suporte de cópia rápida em um clique para a Área de Transferência e utilitário nativo de impressão direta em papel ou PDF.

### 5. 📦 Catálogo de Fornecedores, Margens Completas & Tri-setorial
*   **Margem de Desconto Completa vs. Gov (Visão de Análise de Preços)**: Diferente de sistemas comuns que mostram apenas a margem do líder, o LicitaPro exibe a margem de desconto exata de **todos** os fornecedores cadastrados e com preços ativos na grade comparativa. O analista visualiza instantaneamente quem está abaixo (`% abaixo do preço teto`), acima (`% acima`) ou igual ao teto oficial do certame governamental para rápidas decisões de negociação.
*   **Limitador e Filtro Inteligente de Visualização**: Opção integrada de selecionar os "Top 3 Fornecedores com Melhor Desconto" ou alternar para o "Catálogo Completo de Fornecedores", viabilizando legibilidade total mesmo em editais complexos com dezenas de cotações concorrentes.
*   **Integração Persistente com localStorage**: Banco geral global integrado para salvar fornecedores parceiros de suprimentos recorrentes.
*   **Casamento Inteligente de Portfólio**: Algoritmo de mapeamento por palavras-chave relevantes conecta automaticamente itens do edital extraídos do PNCP com os produtos e descontos oferecidos pelos parceiros compatíveis no catálogo.

### 6. 🔔 Central de Alertas Inteligente (Gestão de Prazos)
*   **Disparadores Integrados**: Programação de lembretes importantes específicos para impugnação, esclarecimentos, abertura da sessão ativa ou recursos administrativos.
*   **Simulação de Mensageria Real**: Envio experimental com validação de status de despache para e-mail profissional e WhatsApp.

---

## 🛠️ Arquitetura Tecnológica (Tech Stack)

A engenharia do SAL foi modelada em uma infraestrutura full-stack moderna e de alto desempenho:

| Camada | Tecnologia | Utilidade / Função |
| :--- | :--- | :--- |
| **Frontend Core** | `React 19.x` & `Vite 6.x` | Renderização ultraveloz, SPA fluida e bundling moderno. |
| **Estilização** | `Tailwind CSS v4.0` | Arquitetura de design system moderna e declarativa rápida. |
| **Backend API** | `Express 4.x` | Servidor corporativo RESTful acoplado para proxy de APIs ocultas. |
| **Linguagem** | `TypeScript ~5.8` | Tipagem estática em ambas as pontas para máxima tolerância a bugs. |
| **Engine de Inteligência**| `@google/genai` (SDK Oficial) | Chamadas nativas ao modelo multimodal `gemini-3.5-flash`. |
| **Banco de Dados** | `Firebase Cloud Firestore` | Persistência de dados das licitações, listas de verificação e notas. |
| **Autenticação** | `Firebase Auth` / Configuração | Segurança federada robusta para as credenciais corporativas. |
| **Animações** | `motion/react` | Transições corporativas fluidas e dinâmicas nos painéis. |
| **Empacotamento Prod** | `esbuild` | Compila o Express TypeScript em CommonJS autônomo para produção. |

---

## 🗺️ Fluxo de Arquitetura do Sistema

```text
                                +-----------------------------+
                                |      Navegador Web / UI     |
                                |  (SPA React 19 + Tailwind4) |
                                +--------------+--------------+
                                               |
                                    Requisições HTTPS / API
                                               v
+----------------------------------------------+----------------------------------------------+
|                                  Express Server (Node.js)                                    |
|                                                                                             |
|   +--------------------------+  +--------------------------+  +--------------------------+  |
|   | /api/licitacoes/scrape   |  | /api/licitacoes/predict  |  | /api/licitacoes/doc-gen  |  |
|   +------------+-------------+  +------------+-------------+  +------------+-------------+  |
|                |                             |                             |                |
+----------------+-----------------------------+-----------------------------+----------------+
                 |                             |                             |
                 |               Modelagem de Prompts Estruturados            |
                 +-----------------------------+-----------------------------+
                                               |
                                               v
                                +--------------+--------------+
                                |  Google Gemini SDK (v2.4)   |
                                |     (gemini-3.5-flash)      |
                                +--------------+--------------+
                                               |
                                       Validação Orgânica
                                               v
                                +--------------+--------------+
                                | Firebase Cloud Firestore DB |
                                | (Persistência / Auditoria)  |
                                +-----------------------------+
```

---

## 🔌 Documentação da API de Integração Backend

O backend disponibiliza endpoints rápidos com esquemas protegidos e tipados em JSON:

### `POST /api/licitacoes/scrape`
Analisa dados brutos fornecidos via texto ou faz requisição à URL pública do certame, decodificando todas as informações estruturais.
*   **Payload do Request:**
    ```json
    {
      "url": "https://pncp.gov.br/app/editais/detalhe/12345/abc",
      "rawText": "Opcional. Conteúdo de texto bruto copiado do edital..."
    }
    ```
*   **Estrutura de Retorno (JSON Schema estruturado):**
    ```json
    {
      "success": true,
      "data": {
        "edital": "Pregão Eletrônico SRP 35/2026",
        "orgao": "Tribunal Regional Federal (TRF) - 3ª Região",
        "modalidade": "Pregão Eletrônico",
        "objeto": "Descrição do objeto...",
        "valorEstimado": 1450000.00,
        "dataSessao": "2026-06-30T09:00",
        "cidade": "São Paulo",
        "estado": "SP",
        "categoria": "Tecnologia da Informação",
        "checklistRecomendado": ["CND Trabalhistas", "Balanço Anual"],
        "competitorsEstimated": ["Concorrente A", "Concorrente B"],
        "arquivosPncp": []
      }
    }
    ```

### `POST /api/licitacoes/predict`
Executa o motor preditivo do Gemini cruzando os dados da disputa do mercado administrativo e os lances históricos dos concorrentes para dar táticas de disputa comercial.
*   **Payload do Request:**
    ```json
    {
      "licitacao": { "orgao": "...", "valorEstimado": 450000.00 },
      "competitors": [],
      "historicalPrices": []
    }
    ```
*   **Estrutura de Retorno:**
    ```json
    {
      "success": true,
      "prediction": {
        "level": "Baixo",
        "recommendedDiscount": "12% - 15%",
        "targetPrice": "395000.00",
        "winProbability": "80%",
        "competitorInsights": "Insights detalhados...",
        "risks": ["Risco 1", "Risco 2"],
        "strategy": "Estratégia de guerra..."
      }
    }
    ```

### `POST /api/licitacoes/generate-document`
Gera modelos oficiais de documentos e certidões jurídicas para o certame nos moldes legais do Brasil.
*   **Payload do Request:**
    ```json
    {
      "docType": "Declaração de Enquadramento ME/EPP",
      "licitacao": { "edital": "02/2026", "orgao": "..." },
      "ourCompanyDetails": { "name": "Razão Social", "cnpj": "..." }
    }
    ```

### `GET /api/ia/audit/history`
Retorna as transações executadas pelos algoritmos de IA sob análise securitária para compliance técnico e auditorias.
*   **Formato de Resposta (JSON):**
    ```json
    {
      "success": true,
      "logs": [
        {
          "id": "ia-log-1718223650-6a9b",
          "timestamp": "2026-06-13T02:15:00.000Z",
          "endpoint": "/api/licitacoes/predict",
          "payload": {},
          "response": {},
          "isMock": false,
          "signature": "sha256-sig-A9D4E2F7C..."
        }
      ]
    }
    ```

---

## 🔒 Proteção da Infraestrutura & Segurança (Security Shield)

Para assegurar estabilidade corporativa e em conformidade com as melhores práticas de governança:
*   **Rate Limiting Ativo**: Camada de proteção de API integrada no Express que restringe o abuso de scraping e sobrecarga por requisições simultâneas. Limite calibrado para no máximo **40 requisições por minuto por IP**, respondendo com `Status 429` e mensagem personalizada em caso de excesso.
*   **Blindagem de Cabeçalhos HTTP**: Configuração preventiva de segurança de rede:
    *   `X-Content-Type-Options: nosniff` (Prevenção de MIME-sniffing);
    *   `X-Frame-Options: SAMEORIGIN` (Mitigação de clickjacking);
    *   `X-XSS-Protection: 1; mode=block` (Proteção contra injeções XSS refletidas).

---

## ⌨️ Instalação & Uso para Desenvolvedores

### Requisitos Prévios
*   **Node.js** v18 ou superior instalado
*   Uma chave de ativação da API do **Google Gemini** (`GEMINI_API_KEY`)

### Passo a Passo

1.  **Clone o projeto no repositório de desenvolvimento:**
    ```bash
    git clone https://github.com/seu-usuario/sistema-acompanhamento-licitacoes.git
    cd sistema-acompanhamento-licitacoes
    ```

2.  **Instale todas as dependências pré-configuradas:**
    ```bash
    npm install
    ```

3.  **Configure as variáveis de ambiente:**
    Copie o arquivo `.env.example` para `.env` e preencha suas variáveis secretas (esse arquivo nunca é enviado para o repositório por segurança):
    ```env
    # .env
    GEMINI_API_KEY=sua_chave_secreta_aqui
    ```

4.  **Inicie o Servidor de Desenvolvimento:**
    Executa a SPA React acoplada juntamente ao servidor Express utilizando hot module TypeScript:
    ```bash
    npm run dev
    ```
    O sistema estará disponível no portal: `http://localhost:3000`

5.  **Gere a build de Produção (Bundling):**
    Prepara a montagem estática no frontend e compila o código do servidor Express em uma compilação CJS simplificada e otimizada via *esbuild* dentro da pasta `dist/`:
    ```bash
    npm run build
    ```

6.  **Inicie o aplicativo em Produção:**
    Inicia o servidor consolidado pronto para receber requisições de servidores de nuvem (como Cloud Run ou AWS):
    ```bash
    npm run start
    ```

---

## 🛡️ Termos Gerais & Licenciamento

*   **Padrões de Legislação Aplicados**: Lei nº 14.133/21 (Lei Geral de Licitações Públicas), Decreto nº 11.461/23 (Leilões), IN 58/2022 (ETP), IN 81/2022 (TR) e a Instrução Normativa da SEGES/ME nº 65/2021 (Mapeamento estatístico de Preços).
*   **Licença**: Sob os termos da licença pública de código aberto **MIT License**. Uso livre de fins acadêmicos e corporativos.

---
*SAL -IA: O futuro do mapeamento de mercado público através da inteligência artificial generativa.*
