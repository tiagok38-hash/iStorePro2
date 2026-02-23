# Estratégia de Monetização e Planos de Assinatura (SaaS Tiers) – iStorePro

A estruturação modular e os "Feature Flags" implícitos no design do ecossistema iStorePro permitem o empacotamento do produto em tiers corporativos, maximizando a Extração de Valor do Cliente (LTV) através de *Upselling*.

Abaixo está o mapeamento dos módulos fragmentados para os três planos de comercialização do software corporativo:

---

## 🔹 STARTER TIER (Base/Lojas Pequenas)
*Focado no lojista em transição das planilhas para a automação básica de PDV, necessitando de controle primário financeiro e acompanhamento de catálogos simples.*

**Core Features (Inclusas):**
- **Dashboard Resumido:** Faturamento básico e métricas essenciais.
- **POS / Vendas (Standard):** PDV funcional para aprovação de Vender e Cobrar (Apenas Cartões, Dinheiro e Pix manual).
- **Gestão de Catálogo (Sem unitarização estrita):** Cadastro de produtos gerais sem restrição ou rastreabilidade imperativa de IMEI (Módulo flexível simplificado).
- **Controle de Caixa Local (CashSession):** Módulo para abertura e fluxos básicos.
- **Clientes (Cadastro Simples):** Banco de informações em ficha rotineira, mantendo histórico genérico.
- **1 Usuário Administrativo + 1 Operador.**

---

## ⚡ PRO TIER (Crescimento/Loja Especializada)
*O carro chefe do produto. Desenhado para a loja da Apple/Eletrônicos em franca expansão que exige rastreabilidade contra furtos, retém aparelhos de clientes para giro ou efetua manutenções rápidas.*

**Core Features (Tudo do Starter, mais):**
- **Gestão de Estoque Unitária (IMEI / Serial Strict):** Rastreio avançado (Stock Lock), grades de celular (ex: Bateria, A/B/C/Novo). Custo e histórico detalhado por PEÇA.
- **Motor de Trade-in (Aparelhos na Troca):** Liberação da injeção nativa de recebimento de aparelho de cliente na tela de POS com formação de Preço dinâmico na Base de Dados.
- **Módulo de Assistência Técnica (Service Orders):** Kanban fluído de Ordens de Serviço (Checklist Técnico Avançado).
- **Módulo de Orçamentos de Vendas:** Funil temporário de State Machine para Propostas que imobiliza valores mas não abate fisicamente estantes sem fechamento.
- **CRM Básico (Leads Workflow):** Kanban de acompanhamento de Clientes.
- **Notificações via Telegram:** Alertas em Realtime atrelado ao bot para o Owner/Gerente.
- **Matriz de Permissões Intermediária:** Restrição de perfis para Vendedor vs Gerente.
- **Até 5 Usuários e Múltiplas Sessões Simutâneas Locais.**

---

## 🚀 ENTERPRISE TIER (Redes/Atacado/Financiadoras Próprias)
*Solução definitiva para as lojas de larga escala, distribuidores de atacado que dependem de segurança forense ou para o lojista atuante como uma Fintech Própria.*

**Core Features (Tudo do Pro, mais):**
- **Internal Credit Engine (Crediário Próprio Avançado):** Liberação do Módulo de Concessão de Crédito interno do iStorePro. Gestão de balanço em risco, bloqueios automáticos (`credit_limit`), cálculo de amortizações dinâmicas e painel de devedores.
- **Advanced Audit Trail Analytics (Monitoria Forense):** Acesso em interface de alto nível do LOG global imutável com filtros preditivos e exports de auditoria, cruzando Caixas X Ações Severas (`SALE_CANCEL`, etc).
- **Custom Permission Set Engine (RBAC Granular Avançado):** Construção própria paramétrica de novos perfis com flag binária granular customizada (Micro-permissões modulares por checkbox).
- **Performance Multi-Store Insights:** Filtros e views de consolidação de relatórios multi-caixas com centro de custos aglomerados.
- **Prioridade 24/7 de SLA e Infraestrutura Isolada (BaaS Dedicado).**
- **Usuários Ilimitados.**
