## 📋 Visão Geral

**Nome do Projeto:** Funil Comercial - Sistema de Gestão
**Versão:** 1.0.0
**Tipo:** Aplicação Desktop (Electron)
**Descrição:** Sistema de gestão de funil comercial desenvolvido com Electron, React, TypeScript e SQLite para acompanhamento e gerenciamento de oportunidades de negócio desde o mapeamento inicial até o fechamento.

---

## 🎯 Objetivo do Projeto

Centralizar e gerenciar o funil comercial de vendas, eliminando planilhas descentralizadas e versões conflitantes. O sistema proporciona:

- **Controle de SLA**: Monitora automaticamente o tempo de permanência em cada fase do funil
- **Rastreabilidade**: Histórico completo de observações e movimentações de cada oportunidade
- **Integração de bases**: Cruza dados do funil com base de regionais (clientes, executivos, coordenadores)
- **Relatórios gerenciais**: Dashboard com métricas de potencial financeiro por fase e responsável

---

## 👥 Público-Alvo

- Executivos de conta e gerentes comerciais
- Coordenadores de regionais
- Equipes de implantação e acompanhamento
- Gestores que necessitam de visão consolidada do pipeline comercial

---

## 🛠️ Stack Tecnológico

### Frontend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| React | 18.2.0 | Biblioteca UI componentizada |
| TypeScript | 5.4.2 | Tipagem estática e segurança de código |
| Vite | 5.1.6 | Build tool com HMR |
| TailwindCSS | 3.4.1 | Estilização utilitária com temas light/dark |
| Zustand | 4.5.2 | Gerenciamento de estado global minimalista |
| Lucide React | 0.344.0 | Biblioteca de ícones SVG |

### Desktop & Backend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Electron | 29.1.0 | Runtime desktop multiplataforma |
| better-sqlite3 | 11.0.0 | Banco de dados SQLite síncrono |
| XLSX | 0.18.5 | Leitura/escrita de arquivos Excel |

### DevDependencies Principais
- `@electron/rebuild`: ^4.2.0
- `electron-builder`: ^24.13.3
- `vite-plugin-electron`: ^0.28.4
- `concurrently`: ^8.2.2
- `wait-on`: ^7.2.0

---

## 📁 Estrutura do Projeto

```
funil-comercial-electron/
├── src/                          # Código fonte React (Renderer Process)
│   ├── App.tsx                   # Componente raiz da aplicação
│   ├── main.tsx                  # Ponto de entrada do React
│   ├── index.css                 # Estilos globais + Tailwind
│   ├── components/               # Componentes reutilizáveis
│   │   ├── FadeIn.tsx            # Componente de animação fade-in
│   │   ├── FunilCard.tsx         # Card expansível de registro do funil
│   │   ├── FunilFormModal.tsx    # Modal de cadastro/edição de funil
│   │   ├── Modal.tsx             # Componente modal genérico com portal
│   │   ├── Sidebar.tsx           # Menu lateral de navegação
│   │   └── SystemHealthDashboard.tsx  # Dashboard de saúde do sistema
│   ├── pages/                    # Páginas da aplicação
│   │   ├── DashboardPage.tsx     # Dashboard com métricas e gráficos
│   │   ├── FunilPage.tsx         # Listagem e gestão de funis
│   │   ├── FiltersPage.tsx       # Página de filtros dinâmicos
│   │   └── ImportPage.tsx        # Importação/exportação de dados
│   ├── services/                 # Serviços e integrações
│   ├── store/                    # Gerenciamento de estado (Zustand)
│   │   ├── funilStore.ts         # Estado e ações do funil
│   │   ├── filterStore.ts        # Estado e ações de filtros
│   │   ├── themeStore.ts         # Controle de tema (light/dark)
│   │   └── systemHealthStore.ts  # Saúde do sistema
│   ├── types/                    # Tipos TypeScript
│   │   ├── index.ts              # Tipos principais do domínio
│   │   └── electron.d.ts         # Type definitions da API Electron
│   └── utils/                    # Utilitários e helpers
├── electron/                     # Código do Electron (Main Process)
│   ├── main.ts                   # Processo principal, IPC handlers, janela
│   ├── database.ts               # Operações CRUD no SQLite
│   ├── preload.ts                # Context bridge (renderer ↔ main)
│   └── preload.cjs               # Preload em CommonJS
├── dist/                         # Build de produção do frontend
├── dist-electron/                # Build de produção do Electron
├── funil_comercial.db            # Banco de dados SQLite (runtime)
├── package.json                  # Dependências e scripts
├── tsconfig.json                 # Configuração TypeScript
├── tsconfig.node.json            # Configuração TS para Node
├── vite.config.ts                # Configuração Vite + Electron
├── tailwind.config.js            # Configuração Tailwind CSS
└── postcss.config.js             # Configuração PostCSS
```

---

## 🏗️ Arquitetura

### Padrão Arquitetural: Camadas com Separação de Responsabilidades

```
┌─────────────────────────────────────────────────────────────┐
│                 Camada de Apresentação (React)               │
│  Components: DashboardPage, FunilPage, ImportPage, etc.     │
│  UI: TailwindCSS + Lucide Icons                             │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│              Gerenciamento de Estado (Zustand)               │
│  Stores: funilStore, filterStore, themeStore, healthStore   │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                Context Bridge (preload.ts)                   │
│  electronAPI exposto via contextBridge                      │
│  IPC Renderer ↔ Main                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│               Camada Principal (Electron Main)               │
│  main.ts: IPC Handlers, BrowserWindow                       │
│  database.ts: Operações CRUD no SQLite                      │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                  Banco de Dados (SQLite)                     │
│  funil_comercial.db                                         │
│  Tabelas: regionais, funil, observacoes, import_operations  │
└─────────────────────────────────────────────────────────────┘
```

### Padrões de Comunicação

- **IPC (Inter-Process Communication)**: Comunicação assíncrona entre renderer e main process via `ipcRenderer.invoke` / `ipcMain.handle`
- **Context Isolation**: Habilitado no preload para segurança
- **Node Integration**: Desabilitado no renderer (princípio do menor privilégio)
- **Clean Architecture Adaptada**: Separação clara entre UI, lógica de negócio (store), e infraestrutura (database/Electron)

### Fluxo de Dados Típico

1. **Usuário interage com UI** → Dispara action no Zustand store
2. **Store chama API do Electron** → `window.electronAPI.methodName()`
3. **Preload envia via IPC** → `ipcRenderer.invoke('channel', data)`
4. **Main process executa no SQLite** → `db.prepare().run()/all()`
5. **Retorno sobe a cadeia** → Main → Preload → Store → UI (re-render)

---

## 💾 Modelo de Dados

### Tabelas Principais

#### 1. `funil` - Registros do Funil Comercial
Campos principais:
- `id`: PK
- `lumiax_genomica`, `responsavel`, `ticket_onboarding`
- `id_cliente`: FK para regionais
- `cnpj`, `razao_social`, `nome_fantasia`, `uf`, `regional`
- `ev`, `carteira`, `coordenador`, `gerente`
- `potencial`: Valor financeiro
- `fase`: Inteiro 1-8 (ver fases abaixo)
- Campos de SLA por fase: `entrada_mapeamento`, `saida_mapeamento`, `sla_mapeamento`, etc.
- `observacao`, `historico`, `selecionados`
- `data_criacao`, `data_atualizacao`

#### 2. `regionais` - Base de Clientes/Regionais
- `id`: PK
- `ent_id_sap`, `cnpj`, `raiz`
- `nome_cliente`, `desc_representante`, `desc_regional_matriz`
- `executivo`, `email`, `nome_coordenador`

#### 3. `observacoes` - Histórico de Observações
- `id`: PK
- `funil_id`: FK para funil
- `data`: datetime
- `observacao`: texto

#### 4. `import_operations` - Log de Importações
- `id`: PK
- `operation`, `file_name`, `records`
- `status`: success/warning/error
- `error_message`, `created_at`

#### 5. `system_access` - Controle de Acesso
- `id`: PK (sempre = 1)
- `last_access_at`: datetime

### Fases do Funil (1-8)

| Fase | Nome | Descrição |
|------|------|-----------|
| 1 | Mapeamento | Identificação inicial da oportunidade |
| 2 | Proposta | Elaboração e envio da proposta |
| 3 | Negociação | Discussão de termos e valores |
| 4 | Contrato | Formalização contratual |
| 5 | Implantação | Implementação da solução |
| 6 | Acompanhamento (60 Dias) | Follow-up pós-implantação |
| 7 | Declinado | Oportunidade perdida |
| 8 | Concluído | Negócio fechado com sucesso |

### Índices de Performance

```sql
-- Funil
CREATE INDEX idx_funil_id_cliente ON funil(id_cliente);
CREATE INDEX idx_funil_fase ON funil(fase);
CREATE INDEX idx_funil_cnpj ON funil(cnpj);
CREATE INDEX idx_funil_data_criacao ON funil(data_criacao DESC);
CREATE INDEX idx_funil_responsavel ON funil(responsavel);
CREATE INDEX idx_funil_ev ON funil(ev);

-- Regionais
CREATE INDEX idx_regionais_cnpj ON regionais(cnpj);
CREATE INDEX idx_regionais_cnpj_normalizado ON regionais(
  replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
);

-- Observações
CREATE INDEX idx_observacoes_funil_id ON observacoes(funil_id);
CREATE INDEX idx_observacoes_funil_data ON observacoes(funil_id, data DESC, id DESC);

-- Import Operations
CREATE INDEX idx_import_operations_created_at ON import_operations(created_at DESC);
```

---

## 🚀 Funcionalidades Implementadas (MVP v1.0)

### Módulo 1: Gestão de Funil
- [x] Listagem de registros em cards expansíveis
- [x] Cadastro manual de novo registro (modal)
- [x] Edição de registro existente
- [x] Exclusão individual e em lote (multi-seleção)
- [x] Movimentação de fase (1-8) com atualização de SLA
- [x] Histórico de observações por registro (timeline)
- [x] Adição de nova observação com data personalizada

### Módulo 2: Base de Regionais
- [x] Importação de base de regionais via Excel (substitui tudo)
- [x] Validação de colunas e normalização de CNPJ
- [x] Cruzamento automático funil ↔ regional via CNPJ/id_cliente
- [x] Exibição de dados cruzados (executivo, coordenador, carteira)

### Módulo 3: Dashboard e Métricas
- [x] Cards resumo: Potencial total, Quantidade de itens, Novos no mês
- [x] Gráfico de potencial por responsável (top 5)
- [x] Distribuição de itens por fase do funil
- [x] Cálculo de SLA médio por fase
- [x] Filtros globais no dashboard

### Módulo 4: Importação/Exportação
- [x] Importação de funil legado via Excel
- [x] Validação e normalização de dados legados
- [x] Prevenção de duplicidade por CNPJ ou ID cliente
- [x] Exportação de registros selecionados para Excel
- [x] Template para importação de observações em lote

### Módulo 5: Saúde do Sistema
- [x] Dashboard de saúde: tamanho do DB, contagem de registros
- [x] Validação de integridade (CNPJs faltantes, regionais não encontradas)
- [x] Histórico de operações de importação
- [x] Controle de último acesso ao sistema

### Módulo 6: Filtros e Busca
- [x] Filtros dinâmicos habilitáveis/desabilitáveis (FilterStore)
- [x] Busca textual global em múltiplos campos
- [x] Paginação por "carregar mais"
- [x] Ordenação por colunas

### Módulo 7: UX/UI
- [x] Tema claro/escuro (persistido em localStorage)
- [x] Animações de fade-in
- [x] Loading skeletons durante fetch de dados
- [x] Feedback visual de seleção em lote
- [x] Modal reutilizável com portal

---

## 📜 Regras de Negócio Principais

### RN001 - Unicidade de Registro
- Não permitir duplicidade de funil por **CNPJ** OU **ID cliente**
- Validação realizada antes do INSERT no banco

### RN002 - Fases do Funil (1-8)
- Fase é inteiro entre 1 e 8
- Movimentação atualiza campos de entrada/saida e SLA da fase correspondente

### RN003 - Cálculo de SLA
- SLA = diferença em dias entre `data_criacao` e data atual (ou data de saída da fase)
- Dashboard calcula média aritmética dos SLAs por fase

### RN004 - Cruzamento de Dados
- Prioridade: `id_cliente` (FK para regionais.id) > CNPJ normalizado
- Se regional não encontrada, mantém dados originais do funil

### RN005 - Importação de Regionais
- Operação "slot": apaga toda a tabela e reinsere (não faz merge)
- Rollback automático em caso de erro em qualquer linha

### RN006 - Observações
- Pode ser adicionada com data retroativa
- Histórico legado (`historico` field) é parseado e exibido junto com observações persistidas

---

## 🔒 Segurança e Restrições Técnicas

### RT001 - Segurança
- `nodeIntegration: false` no BrowserWindow
- `contextIsolation: true` obrigatório
- Preload script expõe apenas APIs necessárias via `contextBridge`
- Sem execução de código arbitrário no renderer

### RT002 - Performance
- Limite de 40 cards renderizados inicialmente (pagination "load more")
- Índices em todas as colunas de filtro e join
- Query única para observações (evita N+1) via `attachObservations()`
- Memoização de filtros e stats com `useMemo` no React

### RT003 - Banco de Dados
- SQLite versão 3.x compatível com better-sqlite3
- Foreign keys habilitadas (`PRAGMA foreign_keys = ON`)
- Path do DB: `app.getPath('userData')` (isolado por usuário OS)

### RT004 - Compatibilidade
- Windows 10+, macOS 10.13+, Linux (distros com glibc 2.17+)
- Node.js 18+ (compatível com Electron 29)
- Resolução mínima: 1024x768

---

## 🧪 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento Vite |
| `npm run build` | Compila o projeto React para produção |
| `npm run electron:dev` | Inicia a aplicação Electron em modo de desenvolvimento |
| `npm run electron:build` | Compila e empacota a aplicação Electron |
| `npm start` | Executa a aplicação compilada |
| `npm run postinstall` | Install-app-deps do Electron (pós-instalação) |

---

## 📦 Instalação e Desenvolvimento

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Passos para Desenvolvimento

```bash
# 1. Clone o repositório
git clone <repository-url>
cd funil-comercial-electron

# 2. Instale as dependências
npm install

# 3. Inicie em modo de desenvolvimento (Vite + Electron)
npm run electron:dev
```

### Build para Produção

```bash
# Compilar e empacotar
npm run electron:build

# O executável estará em dist-electron/
```

---

## 🔮 Backlog (Futuras Melhorias - v2.0)

### Funcionalidades
- [ ] Autenticação e Multi-usuário com níveis de permissão
- [ ] Sincronização em Nuvem (backup automático)
- [ ] Notificações Push de SLA prestes a vencer
- [ ] Relatórios PDF gerenciais
- [ ] Webhooks para integração com CRM externo
- [ ] Histórico de mudanças (audit log)
- [ ] Comentários em tempo real (WebSocket)
- [ ] Campos personalizados administráveis

### Técnicas
- [ ] Migração para TypeScript Estrito (remover `any`)
- [ ] Testes automatizados (Jest + RTL + Playwright)
- [ ] CI/CD Pipeline com GitHub Actions
- [ ] Auto-update para distribuição
- [ ] Logs estruturados (Winston)
- [ ] Monitoramento (Sentry)
- [ ] Virtualização de lista (react-window)

### Analytics Avançado
- [ ] Previsão de fechamento com ML
- [ ] Funil de conversão com comparação temporal
- [ ] Heatmap de SLA para identificação de gargalos
- [ ] Exportação para BI (Power BI/Tableau)

---

## 📝 Convenções de Código

### TypeScript
- Usar tipos explícitos sempre que possível
- Evitar `any`; usar `unknown` quando necessário
- Interfaces para tipos de objetos complexos
- Types para uniões e tipos primitivos

### React
- Componentes funcionais com hooks
- `useMemo` e `useCallback` para otimização
- Custom hooks para lógica reutilizável
- Props tipadas com interfaces

### Zustand
- Stores modulares por domínio (funil, filtros, tema, saúde)
- Actions nomeadas de forma descritiva
- Selectors derivados com `useMemo` nas views

### Nomenclatura
- Arquivos: PascalCase para componentes, camelCase para utils
- Variáveis/Funções: camelCase
- Constantes: UPPER_SNAKE_CASE
- Tipos/Interfaces: PascalCase

---

## 🆘 Tratamento de Erros Comuns

| Cenário | Comportamento | Mensagem |
|---------|--------------|----------|
| Importação Excel vazia | Rejeita arquivo | "Arquivo vazio ou sem dados válidos" |
| CNPJ duplicado | Rollback da linha | "Já existe um registro do funil com este CNPJ ou cliente." |
| Regional não encontrada | Mantém dados originais | (sem erro, só não cruza) |
| Falha no DB | Log no import_operations | "Erro ao buscar funis" (toast) |
| Fase inválida (<1 ou >8) | Throw exception | "Fase inválida." |

---

## 📚 Recursos e Documentação

- **README.md**: Visão geral e guia rápido
- **SPEC.md**: Especificação técnica detalhada
- **Tipos**: `src/types/index.ts` e `src/types/electron.d.ts`
- **Schema DB**: Definido em `electron/database.ts`

---

## ✨ Destaques da Implementação

1. **Arquitetura Electron Segura**: Context isolation + preload bridge
2. **Performance Otimizada**: Pagination, índices SQL, memoização
3. **UX Moderna**: Temas, animações, loading states, feedback visual
4. **Dados Cruzados**: Integração automática funil ↔ regionais
5. **SLA Tracking**: Cálculo automático de tempo por fase
6. **Importação Robusta**: Validação, normalização, rollback em erro

---

*Documento gerado para contexto do projeto - Última atualização: 2024*
