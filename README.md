# Funil Comercial

Aplicativo desktop para gestão de funis comerciais, desenvolvido com Electron, React e TypeScript. Os dados podem ficar em um banco SQLite local ou em um provedor remoto.

## Funcionalidades

- **Dashboard:** resumo e indicadores dos registros do funil.
- **Gestão do funil:** cadastro, edição, acompanhamento por fase, filtros, busca, seleção em lote e exportação para Excel.
- **Importação:** carga de regionais, dados de uma base anterior e observações a partir de arquivos Excel ou CSV.
- **Documentos comerciais:** geração de proposta, contrato e termo aditivo, com modelos configuráveis e saída editável ou PDF.
- **Consulta de CNPJ:** preenchimento de endereço por meio da BrasilAPI durante a geração de documentos.
- **Filtros configuráveis:** escolha dos campos disponíveis para filtrar o funil.
- **Tabelas e manutenção:** gestão de contatos de responsáveis, catálogo de preços e atualização em lote de registros por regras.
- **Saúde do sistema:** visualização de informações de diagnóstico da aplicação.
- **Aparência:** tema claro ou escuro, estilos prontos e cores personalizadas.
- **Bancos configuráveis:** SQLite, Turso/libSQL, PostgreSQL, Supabase via PostgreSQL e MySQL/MariaDB.

## Tecnologias

- **Aplicação:** Electron 29, React 18, TypeScript e Vite 5.
- **Interface:** Tailwind CSS, Lucide React e Zustand.
- **Dados:** Knex, better-sqlite3, `pg`, `mysql2` e `@libsql/client`.
- **Planilhas e distribuição:** XLSX e electron-builder.
- **Qualidade:** Vitest, Testing Library, ESLint, Prettier e semantic-release.

## Requisitos

- Node.js 20 ou superior.
- npm.

## Desenvolvimento

```bash
npm install
npm run dev
```

O comando de desenvolvimento inicia o Vite integrado ao Electron. A aplicação usa SQLite local por padrão. O primeiro `npm install` também configura as dependências nativas do Electron.

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia a aplicação em modo de desenvolvimento. |
| `npm run electron:dev` | Alias de `npm run dev`. |
| `npm run build` | Gera o build de produção do renderer e do processo Electron. |
| `npm start` | Gera o build e abre a aplicação Electron localmente. |
| `npm run electron:build` | Gera e empacota a aplicação para a plataforma atual, sem publicar. |
| `npm run typecheck` | Verifica os tipos TypeScript. |
| `npm run lint` | Executa o ESLint em `src`, `electron` e `tests`. |
| `npm test` | Executa os testes com Vitest. |
| `npm run test:coverage` | Executa os testes e gera cobertura. |
| `npm run format:check` | Verifica a formatação dos arquivos configurados. |

Os artefatos de build e instaladores são gravados em `dist/` e `dist-electron/`.

## Estrutura do projeto

```text
src/
  components/   Componentes reutilizáveis da interface
  pages/        Dashboard, funil, importação, filtros e configurações
  services/     Importação e exportação de planilhas
  store/        Estado global com Zustand
  types/        Tipos da aplicação
  utils/        Formatação e tratamento de erros
electron/
  database/     Adaptadores, configuração e fábrica de bancos
  domain/       Regras de domínio e métricas
  ipc/          Handlers e validação de chamadas IPC
  templates/    Modelos de documentos
  main.ts       Processo principal do Electron
  preload.ts    API segura entre Electron e a interface
tests/          Testes automatizados
```

## Configuração de banco de dados

A configuração do provedor é salva em `config.json` no diretório de dados do usuário do Electron, independentemente do banco ativo. SQLite é o padrão e mantém compatibilidade com os dados locais existentes. Para Supabase, configure uma conexão PostgreSQL com SSL habilitado. Para Turso, use a URL `libsql://...turso.io` e um token do Turso.

Senhas, tokens e strings de conexão são armazenados em `database-secrets.enc` usando o `safeStorage` do Electron. O arquivo de configuração guarda somente a referência às credenciais e os parâmetros não sensíveis. Se o sistema não oferecer criptografia, o aplicativo não salva credenciais. Configurações antigas são migradas na primeira inicialização.

Para trocar de provedor e migrar dados, configure primeiro um banco de destino vazio. A migração não apaga os dados que já existem no destino; uma falha durante a cópia pode deixar dados parciais. Faça uma cópia de segurança do banco de origem e revise o destino antes de tentar novamente.

## Importação de arquivos

A importação aceita arquivos `.xlsx`, `.xls` e `.csv`. A importação de regionais substitui os registros atuais de regionais e solicita confirmação no aplicativo. Faça uma cópia de segurança antes de confirmar. As demais importações validam e normalizam os dados de acordo com o tipo de arquivo.

## Segurança e CI

O Electron mantém isolamento de contexto, sandbox e integração Node desativada no renderer. A navegação da janela é restrita, os canais IPC validam as chamadas e as importações têm limites de tamanho e quantidade.

O GitHub Actions executa verificação de segredos com Gitleaks, análise estática, testes e builds para Windows, Linux e macOS. Na branch `main`, commits Conventional Commits são usados para calcular a versão, atualizar o `CHANGELOG.md` e publicar os instaladores em um GitHub Release. O CI não configura automaticamente a proteção de branch: para exigir os jobs antes do merge, habilite as regras de proteção no GitHub.

O hook local de `pre-commit` também usa Gitleaks se o executável estiver no `PATH`. As mensagens de commit são validadas pelo Husky e pelo Commitlint.

## Licença e uso

Este repositório é público para consulta no GitHub, mas o projeto não é distribuído sob uma licença de código aberto. Todos os direitos reservados. Sem autorização prévia e por escrito do titular dos direitos, não é permitido copiar, modificar, distribuir, sublicenciar, vender ou criar obras derivadas do código ou dos materiais deste projeto.

A publicação pública no GitHub permite que usuários visualizem e façam fork do repositório dentro do serviço, conforme os [Termos de Serviço do GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service). Este aviso não impede cópias já feitas nem revoga permissões concedidas sob licenças anteriores.
