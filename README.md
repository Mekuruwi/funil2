# Funil Comercial - Sistema de Gestão

Sistema de gestão de funil comercial desenvolvido com **Electron**, **React**, **TypeScript** e uma camada de dados compatível com múltiplos providers.

## 🚀 Funcionalidades

- **Gestão de Funil**: Cadastro, edição e acompanhamento de leads no funil de vendas
- **Dashboard**: Visão geral com métricas e indicadores do funil comercial
- **Importação de Dados**: Importação de dados via arquivos Excel (.xlsx)
- **Armazenamento configurável**: SQLite local, Turso/libSQL, PostgreSQL/Supabase e MySQL/MariaDB
- **Interface Moderna**: UI desenvolvida com Tailwind CSS e componentes Lucide React
- **Gerenciamento de Estado**: Zustand para gerenciamento de estado global

## 🛠️ Tecnologias Utilizadas

### Frontend
- React 18.2.0
- TypeScript 5.4.2
- Tailwind CSS 3.4.1
- Lucide React (ícones)
- Zustand (state management)
- Vite 5.1.6 (build tool)

### Desktop
- Electron 29.1.0
- better-sqlite3 (banco de dados SQLite)
- Knex (query builder agnóstico)
- pg e mysql2 (drivers PostgreSQL e MySQL)
- @libsql/client (driver Turso/libSQL)

### Utilitários
- XLSX (leitura de arquivos Excel)
- electron-builder (empacotamento da aplicação)

## 📦 Instalação

### Pré-requisitos
- Node.js (versão recomendada: 18 ou superior)
- npm ou yarn

### Passos

1. Clone o repositório:
```bash
git clone <repository-url>
cd funil-comercial-electron
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie a aplicação em modo de desenvolvimento:
```bash
npm run dev
```

## 🔧 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento Vite |
| `npm run build` | Compila o projeto para produção |
| `npm run electron:dev` | Inicia a aplicação Electron em modo de desenvolvimento |
| `npm run electron:build` | Compila e empacota a aplicação Electron |
| `npm start` | Executa a aplicação compilada |

## 📁 Estrutura do Projeto

```
funil-comercial-electron/
├── src/                    # Código fonte React
│   ├── components/         # Componentes reutilizáveis
│   ├── pages/              # Páginas da aplicação
│   ├── services/           # Serviços e integrações
│   ├── store/              # Gerenciamento de estado (Zustand)
│   ├── types/              # Tipos TypeScript
│   └── utils/              # Utilitários e helpers
├── electron/               # Código principal do Electron
│   └── database/           # Contrato, factory e adapters Knex
├── dist/                   # Build de produção
├── dist-electron/          # Build do Electron
├── package.json            # Dependências e scripts
├── tsconfig.json           # Configuração TypeScript
├── vite.config.ts          # Configuração Vite
└── tailwind.config.js      # Configuração Tailwind CSS
```

## 🗄️ Providers de banco

A abstração em `electron/database/` expõe o mesmo contrato para SQLite,
Turso/libSQL, PostgreSQL, Supabase (via PostgreSQL) e MySQL. A configuração persistida fica
em `config.json` dentro do diretório `userData` do Electron, independente do
banco ativo. O processo principal expõe os canais `database:testConnection`,
`database:switchProvider` e `database:migrateData` pelo preload, sem expor
credenciais ao renderer além do necessário para a operação solicitada.

O SQLite continua sendo o caminho padrão e compatível com os dados existentes.
Providers remotos exigem seus respectivos parâmetros de conexão; para Supabase,
use uma conexão PostgreSQL com SSL habilitado. Para Turso, informe a URL
`libsql://...turso.io` e um token criado no dashboard do Turso.

## 🏗️ Build para Produção

Para criar um executável da aplicação:

```bash
npm run electron:build
```

O arquivo gerado estará na pasta `dist-electron/`.

## 📝 Licença

MIT

## 👨‍💻 Autor

Desenvolvido como sistema de gestão de funil comercial.
