# Technical Architecture Breakdown – iStorePro

Este documento detalha as fundações tecnológicas, padrões de design e componentes estruturais que compõem o ecossistema do iStorePro.

## 1. Stack Tecnológico Frontend (Client-Side)

A interface com o usuário é construída visando altíssima performance de renderização no browser (Single Page Application - SPA), densidade de dados e responsividade.

- **Core Engine:** React.js (Versão 19) operando em TypeScript (Strict Mode) para tipagem estática e prevenção de erros em tempo de compilação.
- **Build Tool / Bundler:** Vite, garantindo Hot Module Replacement (HMR) ultrarrápido e assets otimizados para produção.
- **Gerenciamento de Estado:** Combinação de React Context API para estados globais (Sessão, Temas) e Custom Hooks para lógicas de negócio encapsuladas e data fetching local.
- **Estilização:** CSS Customizado / Design System proprietário, eliminando dependências pesadas de bibliotecas visuais genéricas.
- **Visualização Analítica:** Recharts, provendo renderização em SVG/Canvas de altíssima fidelidade para os dashboards financeiros e KPIs em tempo real.

## 2. Plataforma Backend (BaaS) e Database

A aplicação adota uma arquitetura Serverless/BaaS, terceirizando a infraestrutura de servidores clássica para focar em lógica de domínio na borda e Realtime subscriptions.

- **Provedor Core:** Supabase (PostgreSQL nativo).
- **Authentication & Identity:** Supabase Auth (JWT Baseado), utilizando ANON KEYs criptografadas para interações client-side seguras, com bloqueio de registros arbitrários.
- **Engine Relacional (Database):** PostgreSQL. Estrutura de dados altamente normalizada.
- **Proteção de Dados (RLS):** Emprego massivo de Row Level Security (RLS) policies diretamente no database layer. O backend rejeita operações nativamente caso o Token JWT (auth.uid) não possua autorização mapeada nas tabelas de permissões do sistema, tornando o banco impermeável a injeções do frontend.
- **File Storage:** Supabase Storage para persistência de binários (Avatares, Fotos de avarias em Ordens de Serviço).

## 3. Padrões de Design e Fluxos Sistêmicos (System Flows)

- **Event-Driven UI (Realtime):** O sistema reage ativamente a mutações do banco de dados (ex: um produto sendo vendido em outro terminal some instantaneamente do painel local sem necessidade de re-fetch manual através de WebSockets do Supabase Realtime).
- **Strict Role-Based Access Control (RBAC):** Mapeamento via matriz JSON (`PermissionSet`), definindo acessos binários microscópicos e granulares (ex: `canCancelSale`, `canViewCostPrice`), injetado globalmente no Frontend e Backend.
- **Atomic Operations ("All or Nothing"):** As finalizações de requisições no POS ou compras em fornecedores requerem blocos transacionais. A falha em abater uma peça de hardware reverte a inserção financeira, mantendo integridade ACID.
- **Micro-Audit Trail System:** Arquitetura passiva de "Append-Only" em tabelas de log (`AuditLog`). Nenhuma linha de deleção ('DELETE') ou atualização ('UPDATE') ocorre sem o disparo de um artefato de histórico imutável correspondente contendo a tupla de informações (User x Action x Payload x Timestamp).

## 4. Integrações de Rede e Assíncronas

- **Push Notifications Control (Telegram API):** Webhooks disparam funções para bots no Telegram através da classe de serviço `telegramService.ts`, roteando alertas de criticidade alta (Aberturas de Caixa, O.S Aprovadas, Vendas Suspeitas) direto para instâncias mobile da gerência.

## 5. Deployment e Infraestrutura

- O repositório reflete uma arquitetura Cloud-Native "Edge Ready".
- A esteira de Continuous Deployment (CD) foi homologada e projetada para rodar nativamente em Serverless Edge Networks como **Vercel** ou **Netlify**, compilando os estáticos minificados na pasta `/dist/` e realizando roteamento unificado, reduzindo custos de sustentação computacional (Compute Cost) à zero base, escalando elasticamente sob demanda.
