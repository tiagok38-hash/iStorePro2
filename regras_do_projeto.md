# Regras Globais do Projeto iStorePro (Instruções para a IA)

As regras listadas neste arquivo devem ser estritamente seguidas pela inteligência artificial em todas as interações e desenvolvimentos no projeto.

## 1. Idioma
- Sempre fale comigo em **Português do Brasil**.

## 2. Formatação de Moeda
- Sempre que criarmos ou formatarmos campos de valores monetários, deixe-os prontos com o padrão de Real Brasileiro: **R$ 1.234,99**.
- Aplique máscaras de centavos e pontuação correta em campos de input (`toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })` ou bibliotecas de máscara correspondentes da base de código).

## 3. Banco de Dados e Multi-Tenant
Toda vez que precisarmos criar uma **NOVA TABELA no Supabase** para a aplicação iStorePro, ela DEVE OBRIGATORIAMENTE seguir o padrão Multi-Tenant da aplicação. Você deve sempre:
1. Adicionar preenchimento de coluna: `company_id UUID NOT NULL`.
2. Criar uma política RLS (Row Level Security) de isolamento usando a função: `public.get_my_company_id()`.
3. Aplicar a trigger de inserção automática: `set_company_id_[nome_da_tabela] BEFORE INSERT FOR EACH ROW EXECUTE FUNCTION public.set_company_id()`.
4. Criar um índice indexando a coluna para performance: `CREATE INDEX idx_[nome_da_tabela]_company_id ON public.[nome_da_tabela](company_id);`.

## 4. Preservação de UI e Design
- Quando eu pedir para mudar algo, principalmente no design ou interface, **tenha extremo cuidado para não mudar ou apagar coisas que eu não pedi**.
- Seja cirúrgico: altere apenas o escopo solicitado e mantenha a integridade visual, classes (especialmente Tailwind se houver) e componentes ao redor intactos.

## 5. Centralização da Lógica de Banco de Dados
- NUNCA escreva chamadas diretas ou lógica pesada do Supabase dentro dos componentes visuais `.tsx`.
- Sempre crie, atualize e chame funções encapsuladas dentro da pasta `services` (ex: `mockApi.ts`), mantendo uma separação clara de responsabilidades. Isso garante que a interface do usuário não fique poluída com código de banco de dados e bugs sejam fáceis de encontrar/corrigir.

## 6. Sincronização Estrita de Tipos (TypeScript)
- Sempre que adicionar uma nova tabela, coluna ou mudar as chamadas de banco de dados, você **deve OBRIGATORIAMENTE** atualizar imediatamente o arquivo central de tipagem `types.ts`.
- Evite ao máximo o uso do tipo genérico `any` para tapar buracos; faça uma tipagem correta, precisa e documentada das interfaces.

## 7. Gerenciamento de Cache
- No sistema atual da iStorePro, após toda e qualquer operação de modificação no banco de dados (INSERT, UPDATE ou DELETE), certifique-se OBRIGATORIAMENTE se é necessário chamar a função de revalidação de cache (`clearCache(['nome_da_chave'])`) implementada no arquivo `services` para garantir que as telas do painel logo atualizem a informação para o usuário e não mostrem dados desatualizados (stale data).

## 8. Tratamento Fino de Erros e Feedback (UX)
- Ao adicionar botões com ações assíncronas no painel, você deve SEMPRE utilizar blocos `try/catch`.
- Caso ocorra um erro, **jamais deixe a tela travar de forma silenciosa** ou apresentar uma tela branca de quebra (crash).
- Exiba feedback visual limpo e claro - use a biblioteca de notificações do sistema (Toasts/Alerts) para informar ao usuário o que ocorreu de errado de forma amigável em português. Faça o mesmo notificando proativamente o sucesso das operações.

## 9. Auditoria de Segurança e Logs
- Se uma nova funcionalidade modificar, deletar ou criar movimentações críticas (excluir ou reverter venda, ajustar estoque manualmente, estornar financeiro, dar desconto drástico), procure integrar o disparo automático de registros para as tabelas de auditoria do Supabase (`audit_logs` ou `stock_history`).
- Isso garante a rastreabilidade segura da aplicação a nível gerencial (quem fez, o que fez e quando).

## 10. Prevenção de Loops Infinitos (useEffect)
- Em componentes React que disparam chamadas ao banco ou funções em ciclo de vida (`useEffect`), preste EXTREMA atenção às arrays de dependência `[deps]`.
- Nunca passe objetos não estabilizados ou funções como dependência a menos que estejam encapsulados com `useCallback` ou `useMemo` para evitar que a tela entre em loops de renderização infinitos prejudicando o banco Supabase.

## 11. Otimização de Performance e Lazy Rendering
- Se tivermos modais pesados de funcionalidade e listagens (ex: Adicionar Venda, Peça Complexa, Relatórios), eles nunca devem vir totalmente renderizados escondidos pela tela. 
- Utilize renderização condicional pesada `{isOpen && <Componente />}` logo acima do retorno visual para prevenir gasto de memória desnecessário em dispositivos de poucos recursos (celular dos técnicos na bancada).

## 12. Modularização Obrigatória de Componentes
- Nenhum arquivo `.tsx` novo ou componente já existente deverá crescer descontroladamente após 400-500 linhas de código.
- Extrapolou o limite visual? Identifique sub-partes complexas e quebre-as OBRIGATORIAMENTE num componente separado dentro de uma pasta estruturada. Não aceite o desenvolvimento de "Monólitos Inquebráveis" prejudiciais.

## 13. Proibição de Modificação do mockApi.ts (Modularização Estrita)
- **Regra de Arquitetura Absoluta**: NUNCA adicione código, funções ou novas chamadas de banco de dados diretamente ao arquivo `/services/mockApi.ts`.
- Todos os novos serviços e integrações com banco de dados devem ser construídos em arquivos modulares separados dentro da pasta `/services/` (exemplo: `productService.ts`, `salesService.ts`, `customerService.ts`).
- A camada de dados desta aplicação é estritamente e 100% modularizada. O `mockApi.ts` atua apenas como um agregador/roteador legado para reexportação e não deve crescer.

## 14. Permissões Estritas (Deny by Default / Proibição Absoluta)
- Perfis sem permissão expressa (caminho `true` no objeto do usuário) NUNCA podem acessar áreas restritas do sistema.
- Essa regra é INVIOLÁVEL E IMUTÁVEL e prevalece sobre qualquer outra regra nova ou antiga. Se houver falha de componente, falha ao puxar do banco de dados, perfil nulo, erro inesperado no login, ou qualquer indefinição, o comportamento padrão OBRIGATÓRIO é negar o acesso (`Deny by Default`).
- Todas as rotas e componentes protegidos devem assumir a postura estrita de `emptyPermissions` (todos como `false`) até que se prove o contrário positivamente, sem chaves de destrancamento soltas no fallback.
