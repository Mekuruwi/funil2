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

Antes de migrar dados, configure um banco de destino vazio. A migração não apaga
dados de destino existentes; se uma falha ocorrer depois do início da cópia, o
destino pode conter dados parciais e deve ser revisado antes de uma nova tentativa.
Faça uma cópia de segurança do banco de origem antes de iniciar.

> **Importação de regionais:** a operação substitui a base atual de regionais. O
> aplicativo pede confirmação antes de importar; mantenha uma cópia de segurança
> dos dados antes de confirmar.

O Electron mantém isolamento de contexto, desativa a integração Node no renderer,
usa sandbox e restringe navegação da janela. As chamadas IPC são aceitas apenas
da janela principal e as importações têm limites de quantidade e tamanho.

## ✅ Validação automatizada

O projeto usa Vitest para testes unitários e de integração SQLite, ESLint para
análise estática e Prettier para formatar novos arquivos. Execute `npm test`,
`npm run test:coverage`, `npm run lint`, `npm run typecheck` e
`npm run format:check` localmente. O TypeScript já usa modo `strict`; a regra de
`any` no ESLint começa como aviso para permitir a tipagem gradual.

O Husky valida mensagens de commit com Conventional Commits. O GitHub Actions
executa qualidade, testes e build para Windows, Linux e macOS. Em `main`,
commits Conventional Commits calculam a versão semanticamente, atualizam o
`CHANGELOG.md` e publicam os instaladores do mesmo build em um GitHub Release.
Para que o CI seja obrigatório antes do merge, habilite regras de proteção da
branch `main` no GitHub e exija os jobs `Typecheck and lint`, `Domain and
database tests` e os três jobs de build. Essa configuração exige permissão de
administrador no repositório.

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
