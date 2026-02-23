# Software Requirements Specification (SRS) – iStorePro

**Versão:** 1.0
**Data:** 22 de Fevereiro de 2026
**Autor:** Founder: Tiago

---

## Sumário
1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [Architecture](#3-architecture)
4. [Functional Modules](#4-functional-modules)
5. [Business Rules](#5-business-rules)
6. [Permissions and Security Model](#6-permissions-and-security-model)
7. [Integrations](#7-integrations)
8. [Data Flow](#8-data-flow)
9. [Limitations and Technical Debt](#9-limitations-and-technical-debt)
10. [Future Expansion Points](#10-future-expansion-points)

---

## 1. Introduction

Este documento de Especificação de Requisitos de Software (Software Requirements Specification - SRS) fornece uma descrição técnica oficial, completa e detalhada do sistema **iStorePro**. O objetivo deste documento é estabelecer a arquitetura, os módulos funcionais, as regras de negócio e os fluxos sistêmicos com precisão para servir como fonte de verdade (Source of Truth) para processos de auditoria técnica, due diligence por parte de investidores e onboarding de engenheiros de software seniores.

O iStorePro é uma plataforma de gestão empresarial e financeira avançada operada em nuvem, modelo Software as a Service (SaaS), desenvolvida para atender às rigorosas demandas operacionais de revendas de alta tecnologia, com foco em dispositivos e ecossistema Apple.

---

## 2. System Overview

O iStorePro unifica a interface de ponto de venda (POS), planejamento de recursos empresariais (ERP), gestão de relacionamento com o cliente (CRM) e controle de assistência técnica (Service Orders) em uma única Suíte Integrada. 

Ao invés de tratar o estoque como meros números quantitativos, o sistema adota um paradigma de rastreabilidade unitária baseado em Identificadores Únicos (IMEI e Número de Série). Esta granularidade permite um fluxo preciso desde a aquisição no fornecedor até a liquidação no POS, cobrindo intrincados fluxos financeiros como recebimentos multi-meios, "Trade-in" (recebimento de aparelhos usados como parte do pagamento) e motor de crédito próprio (Credit Engine). Tudo encapsulado sob camadas severas de observabilidade transacional via sistema holístico de auditoria (AuditLog).

---

## 3. Architecture

A arquitetura do iStorePro foi projetada adotando o modelo Client-Server em arquitetura de microsserviços e Serverless Backend, visando escalabilidade horizontal, alta disponibilidade e segurança na persistência de dados.

### 3.1. Frontend
- **Tecnologias:** React.js (v19), TypeScript (Strict Mode), Vite (Bundler).
- **Gerenciamento de Estado:** Context API e Custom Hooks otimizados para redução de re-renders desnecessários.
- **Visualização de Dados:** Recharts para processamento assíncrono e exibição de componentes gráficos interativos de relatórios de inteligência de negócio.
- **Paradigma de UI/UX:** Design System customizado focado em operações rápidas de balcão de loja (alta densidade de informações e navegação sem bloqueios).

### 3.2. Backend (BaaS)
- **Provedor:** Supabase (Backend-as-a-Service).
- **Core Processing:** Lógica de negócio descentralizada operada na borda via chamadas asíncronas RPC e subscrição de mutações em tempo real (WebSockets / Supabase Realtime).
- **Storage:** Supabase Storage bucket policies aplicadas para armazenamento massivo de Assets estáticos, Documentos de Laudos e Upload fotográfico para Ordens de Serviço.

### 3.3. Banco de Dados (Database)
- **Engine:** PostgreSQL (Relacional).
- **Segurança Nativa:** Row Level Security (RLS) habilitada por padrão para barrar tentativas arbitrárias de modificação cruzada e manter o isolamento arquitetural multi-tenant/multi-usuário.
- **Modelagem Relacional de Alta Complexidade:** Relacionamento estrito via Foreign Keys e Enums para ProductVariations, PermissionSets, CashSessions e AuditLogs, reforçando a integridade referencial.

---

## 4. Functional Modules

O ecossistema iStorePro está segregado em agrupamentos lógicos de funcionalidades, garantindo alta coesão sistêmica.

### 4.1. Dashboard Principal
Painel central agregador de métricas. Utiliza views materializadas (conceitualmente) para consolidar faturamento, margem de lucratividade efetiva descontando despesas operacionais fixas e ranking transacional. Proporciona atalhos de navegação otimizados.

### 4.2. Point of Sale (POS / PDV)
Módulo frontend de missão crítica, desenhado para checkout ultra-rápido.
- **Carrinho Abstrato Multi-Dimensional:** Suporta inserção de produtos, peças avulsas, taxas de conversão (Markup de cartão).
- **Operações de Trade-in Genético:** Permite usar "Aparelho do Cliente" na compensação do pagamento. Imediatamente efetua Dedução de Dívida (Cash In) e Injeção de Estoque Físico com origem "Comprado de Cliente".
- **Composição Híbrida de Liquidação:** Uma venda suporta fração X no Pix, Y no Cartão de Crédito e Z em Cash.

### 4.3. Inventory Management (Estoque)
Motor de controle não-quantitativo.
- **Grau de Produto (Product Grading):** Cada unidade carrega seu estado intrínseco: Saúde da Bateria, Grau (Novo/CPO/A/B) e Custo Aquisitivo Unitário (Unit Cost).
- **Prevenção de Venda Fictícia (Stock Lock):** Trava sub-zero. Impede liquidações base sem presença do Unit-Asset referencial.
- **Mutações Rastreáveis:** Qualquer modificação arbitrária ("Ajuste Manual", "Quebra/Perda") exige injeção no AuditLog.

### 4.4. Orçamentos (Quotation & Presales)
Ambiente state-machine para propostas.
- **Lifecycle:** O pipeline orbita através de transições `Draft` -> `Finalizado` -> `Expirado` -> `Convertido`.
- **Pre-allocation:** Protege negociações via snapshot de preços (imunidade contra flutuação cambial até o momento de faturamento). Ao converter, despacha o JSON transformado em Payload legível para o POS.

### 4.5. Service Orders (Assistência Técnica / Ordens de Serviço)
Módulo estruturado com base em **Kanban Workflow**. 
- **Checklist Técnico:** Formulário matriz associando ao device danos físicos visíveis (Riscos, Câmeras Danificadas) reduzindo liability moral.
- **Gestão de Transição de Status:** Movimentações entre colunas Kanban (Ex: `Aguardando Aprovação` -> `Aprovado`) engatilham notificações e acionem estorno dinâmico de peças do Catalog se atrelado a serviço real.

### 4.6. CRM (Customer Relationship Management) e Negócios
Motor de prospecção acoplado e nativamente integrado ao ERP.
- **Pipeline Kanban Sales:** Separação progressiva de leads (`Negotiating`, `Awaiting Payment`).
- **Classification Engine:** Escalonamento termodinâmico (`hot`, `warm`, `cold`) orientando a capacidade de dedicação do braço comercial.
- **Log Book Activity:** Agrupamento atômico de calls, notas operacionais e agendamentos.

### 4.7. Financeiro, Contábil e Fluxo de Caixa (Cash Flow)
Arquitetura financeira determinística dividida em CashSession diária vs Receitas Macro:
- **CashSession (Sessão de Caixa):** Instância virtual de um usuário com Gaveta Física. Suprime, Sangra e Fecha de forma independente, provendo micro-auditoria terminal.
- **Despesas / Categorias:** Motor transacional de contas a pagar (fornecedores) com sub-grupos, despesas fixas da filial e variação recorrente mensal.
- **Conciliação Híbrida:** A inteligência contábil não mistura um Cartão parcelado em 18 vezes com Fluxo de Caixa Imediato (Caixa Local).

---

## 5. Business Rules

As regras de negócio atuam correndo silenciosamente contra operações forjadas, criando um sistema à prova de desfalques sistêmicos e processuais.

### 5.1. Rastreabilidade Absoluta Unificada (RAU)
Produtos seriais (iPhones, Apple Watches) são imutáveis no ID macro e tratados de modo serializado. Não é possível uma transação de "Output" quantitativa (ex: Diminuir -2 iPhones) sem prover ao backend exatamente quais strings Hash de IMEI saíram.

### 5.2. Credit Engine (Motor Restritivo de Crediário)
No processamento de parcelamentos proprietários (Crediário Interno), a engine interpola limites individuais definidos.
- **Cálculo Algebrico Punitivo:** Avalia `credit_limit - credit_used`. Se `New Transactions > Available Credit`, o sistema emite Trigger bloqueante na UI ("Transaction Denied: Soft Limit Breach"), alavancável excepcionalmente por um SuperAdmin User Override.

### 5.3. Rate Passing Algorithm (Dynamic Payment Margins)
Configurações contábeis recalibram dinamicamente a fração exata subtraída ou somada no total das vendas. Dependendo se a loja absorve a taxa do arranjo de pagamento (Acquirer Spread) ou transfere como Markup rotativo para o comprador.

### 5.4. CashSession Isolation Strict Protocol (Protocolo Estrito de Isolamento de Caixa)
Não é permitida a execução de Vendas, Recebimentos Fracionados (Amortizações do Credit Engine) se a CashSession vinculada ao Token UID estiver fechada. A sessão isola as transferências; Caixa B não interage com Sangrias do Caixa A operando no terminal ao lado.

---

## 6. Permissions and Security Model

A camada de segurança repousa sob concessão vertical granular atrelada não a "Cargos Fictícios" mas a modelagens JSON flexíveis englobadas no formato de **PermissionSet**.

### 6.1. Diagrama Hierárquico Textual de Permissões
```text
[Usuário Final / Authentication Node]
      |
      +---> [Profile ID Mapping]
                   |
                   +---> [PermissionProfile Entity] ---> (Owner, Manager, Sales, Tech)
                               |
                               +---> [PermissionSet JSON Object]
                                         |
                                         +--> View Nodes
                                         |      ├── canAccessDashboard: bool
                                         |      ├── canAccessPOS: bool
                                         |      └── canAccessFinanceiro: bool
                                         |
                                         +--> Mutate Nodes
                                         |      ├── canCreateSale: bool
                                         |      ├── canCancelSale: bool (Estritamente Restrito)
                                         |      └── canEditStock: bool
                                         |
                                         +--> Advanced Nodes
                                                ├── canManageUsers: bool
                                                ├── canDeleteSupplier: bool
                                                └── canViewFinancialKPIs: bool
```

### 6.2. Proteção Cross-Layer
- **Supabase Row Level Security (RLS):** Policies são elaboradas garantindo que, mesmo se existisse Reverse Engineering no token local de sessão para emitir scripts curl diretos ao banco de dados, a engine PostgreSQL rejeitará modificações pois as `where conditions` batem de volta à tabela de `PermissionSet` relacional mapeada ao `auth.uid()`.
- **Systematic Audit (AuditLog):** Ações destrutivas (`DELETE`, `SALE_CANCEL`) disparam payloads imutáveis para tabelas isoladas de log global, rotulados por carimbo de tempo, autor e metadados contextuais, evitando o famoso "Non-repudiation" processual por funcionários.

---

## 7. Integrations

A arquitetura prevê pontos orgânicos de saída de eventos conectando ao ecossistema exterior.

- **Supabase Cloud Native Engine:** Ponto focal central, usando Websockets real-time nativos para update automático caso Estoque zere em um PDV B enquanto o PDV A atende o cliente.
- **Telegram Webhook Connector:** Subsistema de mensageria assíncrona atuando em threads isoladas (vide script), realizando Push Notifications agressivos orientados para donos/operadores para:
  - Notificação de abertura de Session de terminal (Caixa Físico).
  - Vendas finalizadas de elevado ticket médio.
  - Logs nocivos como transições forçadas e quebra/avarias inseridas no log de inventário.
- **Processamento Gráfico Recharts:** Dependência primária de construção analítica que renderiza vetores de SVG sob arrays assíncronos montados dinamicamente em runtime pela camada React.

---

## 8. Data Flow

Abaixo é descrito em caráter vetorial conceitual o fluxo da principal funcionalidade sistêmica: a conversão de um bem patrimonial em receita financeira complexa pelo Módulo PDV.

### 8.1. Flowchart Tracional Principal (POS to Revenue)
```text
[BEGIN: POS Checkout Invocation]
       |
       |--- 1. [Select Product & Client / UID Check]
       |           |-> Verifica RLS (Row Level Security) e Conexão Realtime de Estoque.
       |
       |--- 2. [Determine Payment Vectors]
       |           |-> Array Híbrido: [Pix, Cartão Múltiplo, Trade-in Device]
       |
       |--- 3. [Credit Engine Interception] (Conditional)
       |           |-> Se "Crediário": Request -> Check(CreditLimit - UsedCredit) 
       |           |-> Resposta: [Pass / Hard Block]
       |
       |--- 4. [Trade-In Mutation Routine] (Conditional)
       |           |-> Insere Hardware (Apple, Imei X) na fila "Entry: Bought from Client".
       |           |-> Gera amortização no subtotal da invoice local.
       |
       |--- 5. [Finalize Transaction Boundary]
       |           |-> Abate Estoque Global Principal (Mutation A).
       |           |-> Injeta Receitas na "CashSession" Ativa local do user (Mutation B).
       |           |-> Cria Invoice unificada no DB e atualiza Status POS (Mutation C).
       |
       |--- 6. [Asynchronous Observers & Epilogue]
                   |-> Push AuditLog Global Table (Ação: SALE_CREATE).
                   |-> Trigger Telegram Service Msg Notification API.
[END: Sale Concluded with Success]
```

---

## 9. Limitations and Technical Debt

Embora disponha de arquitetura avançada de nível SaaS "State-of-the-Art" (estado da arte) para uso interno, existem barreiras e pendências técnicas rigorosamente mapeadas no roadmap.

- **Deficit de Transmissão SEFAZ (Limitação Fiscal Brasileira):** Total ausência atual de motor gerador de schemas XML formatados para emissões diretas de NFe e NFCe nativa. Relatórios emissores geram boletos ou comprovantes de balcão temporários sem valoração jurídica federal acoplada diretamente em webservice da União via endpoint.
- **Gargalo Utilitário de Mocks System:** O código fonte sustenta um peso estrutural significativo baseado em abstrações utilitárias massíveis hospedadas (historicamente) no escopo de serviços simulados e legados consolidados em arquivos base. Necessita de contínuo "Refactoring" baseado em princípios SOLID para segregar a arquitetura em serviços moleculares dedicados (Ex: Injeção de dependência estrita através de `CustomerService`, `ProductService`, `SaleService`).
- **Race Condition Potencial (Concurrency Collision):** Na ausência de emprego robusto de transações pessimistas e bloqueantes severas do Postgres (`SELECT FOR UPDATE`), submissões simultâneas de fração de milissegundos efetuadas por terminais PDV separados requisitando o mesmo UUID de produto final da grade podem suscitar em exceções na abstração da UI até a reconciliação assíncrona forçada.

---

## 10. Future Expansion Points

- **Integração Plural OminiChannel:** Efetuar a conexão end-to-end com múltiplas interfaces de marketplace (MercadoLivre API, Amazon Seller Central e API Oficial HTTP de WhatsApp Cloud) para captação bruta contínua de leads injetando direto as conversões no Kanban Workflow do módulo de CRM.
- **Analytics Predictive Modeling:** Estabelecer o acoplamento de modelagem de predição em Machine Learning (Linear Regression / Motores Preditivos) operando sobre a vasta base persistida do AuditLog, para predizer o ciclo sazonais macroeconômicos baseando-se em health status contínuo das baterias de Trade-ins e ciclo renovatório dos hardwares.
- **Fintech Bank-as-a-service Embedded:** Integrar API nativa e robusta de OpenBanking atrelada às variações diretas de Pix da empresa, acionando baixas paramétricas de contas a receber e emitindo ordens síncronas através do motor de PDV ("Point of Sale") de maneira "Fire-and-forget", liquidando de imediato a intervenção humana para autorização fiscal (Conciliação Pix Zero-Click Integrada ao Banking).
