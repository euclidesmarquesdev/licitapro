# TREE.md

Estrutura de pastas e arquivos do projeto (resumo)

## Raiz
- `allcode.bat` — script utilitário (executa/coordena ações no repo)
- `docker-compose.yml` — configuração de containers (quando aplicável)
- `Dockerfile` — imagem do app
- `firebase-applet-config.json` — credenciais/config do Firebase (base)
- `firebase-blueprint.json` — blueprint/config adicional do Firebase
- `firestore.rules` — regras de segurança do Firestore
- `index.html` — entry HTML (Vite)
- `metadata.json` — metadados do projeto
- `package.json` / `package-lock.json` — dependências e scripts
- `README.md` — documentação
- `server.ts` (na raiz) — servidor backend (Express/handlers; ponto de entrada)
- `tsconfig.json` — configuração TypeScript
- `vite.config.ts` — configuração do Vite
- `firebase-applet-config.json` / `firebase-blueprint.json` — configs externas
- `assets/` — assets estáticos do frontend

## `prisma/`
- `schema.prisma` — schema do Prisma (modelagem do banco)

## `src/`
- `App.tsx` — componente raiz do frontend (dashboard e roteamento interno)
- `data.ts` — constantes/mock e dicionários (UF/categorias/status)
- `firebase.ts` — inicialização Firebase Auth/Firestore + helpers de token
- `index.css` — Tailwind CSS import
- `main.tsx` — boot do React
- `types.ts` — tipos TypeScript (Licitacao, checklist, suppliers, etc.)

### `src/__tests__/`
- `server.test.ts` — testes do backend

### `src/components/` (UI do frontend)
- `AddLicitacaoModal.tsx` — modal para cadastrar/colar texto PNCP e criar nova licitação
- `AlertsManager.tsx` — criação e simulação de alertas/prazos por licitação
- `BackupModal.tsx` — export/import de backup via IndexedDB
- `ConfettiCelebration.tsx` — overlay de celebração (itens/docs/compliance)
- `DeleteLicitacaoModal.tsx` — modal de confirmação de exclusão
- `GeneralSuppliers.tsx` — base geral de fornecedores homologados + busca/filtragem
- `LicitacaoCard.tsx` — card de licitação na lista (status, datas, ações)
- `LicitacaoDetails.tsx` — tela principal do edital (tabs e orquestração de hooks)
- `RastreadorPncp.tsx` — rastreador/busca no PNCP + import de editais
- `TabAlerts.tsx` — aba de prazos e notificações
- `TabCompetitors.tsx` — aba de concorrentes
- `TabCompliance.tsx` — aba de compliance (leis 14.133)
- `TabDados.tsx` — aba de dados iniciais e scraper
- `TabDocs.tsx` — aba de documentos e anexos
- `TabPredict.tsx` — aba de predição IA
- `TabReport.tsx` — aba de geração de proposta/documentos
- `TabSuppliers.tsx` — aba de fornecedores/cotações

### `src/hooks/` (lógica de estado)
- `useAuth.ts` — autenticação (Google/Firebase) e modo guest
- `useFiltros.ts` — filtros e busca local em licitações
- `useFornecedores.ts` — gerenciamento de fornecedores/cotações e compatibilidade
- `useGeracaoDocumentos.ts` — geração de documentos/proposta
- `useLicitacao.ts` — estado e handlers do edital (scraper, status, checklist, etc.)
- `useLicitacoes.ts` — estado e ações do conjunto de licitações

### `src/server/` (backend: controllers/services/middleware)
- `config/`
  - `firebase.ts` — config Firebase no backend
  - `redis.ts` — config Redis (cache/controle)
- `controllers/`
  - `licitacaoController.ts` — endpoints/handlers relacionados a licitações
- `middleware/`
  - `auth.ts` — middleware de autenticação
  - `rateLimiter.ts` — rate limit
- `routes/`
  - `api.ts` — montagem das rotas de API
- `services/`
  - `audit.ts` — auditoria/logs
  - `gemini.ts` — integração com Gemini/IA
- `utils/`
  - `sanitization.ts` — sanitização/validação
  - `timeout.ts` — util de timeout
- `workers/`
  - `queue.ts` — fila/worker (processamento assíncrono)

### `src/utils/` (utils compartilhadas)
- `indexedDb.ts` — export/import de backup no IndexedDB
- `pncpParser.ts` — parser de texto PNCP (clipboard)
- `pncpParser.test.ts` — testes do parser PNCP
- `validation.ts` — validações auxiliares

