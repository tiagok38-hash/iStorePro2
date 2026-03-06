# Regras Globais do Projeto iStorePro (Instruções para a IA)

As regras listadas neste arquivo devem ser estritamente seguidas pela inteligência artificial em todas as interações e desenvolvimentos no projeto.

## 1. Idioma
- Sempre fale comigo em **Português do Brasil**.

## 2. Formatação de Moeda
- Sempre que criarmos ou formatarmos campos de valores monetários, deixe-os prontos com o padrão de Real Brasileiro: **R$ 1.234,99**.
- Aplique máscaras de centavos e pontuação correta em campos de input (`toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })` ou bibliotecas de máscara).

## 3. Banco de Dados e Multi-Tenant
Toda vez que precisarmos criar uma **NOVA TABELA no Supabase** para a aplicação iStorePro, ela DEVE OBRIGATORIAMENTE seguir o padrão Multi-Tenant da aplicação. Você deve sempre:
1. Adicionar preenchimento de coluna: `company_id UUID NOT NULL`.
2. Criar uma política RLS (Row Level Security) de isolamento usando a função: `public.get_my_company_id()`.
3. Aplicar a trigger de inserção automática: `set_company_id_[nome_da_tabela] BEFORE INSERT FOR EACH ROW EXECUTE FUNCTION public.set_company_id()`.
4. Criar um índice indexando a coluna para performance: `CREATE INDEX idx_[nome_da_tabela]_company_id ON public.[nome_da_tabela](company_id);`.

## 4. Preservação de UI e Design
- Quando eu pedir para mudar algo, principalmente no design ou interface, **tenha extremo cuidado para não mudar ou apagar coisas que eu não pedi**.
- Seja cirúrgico: altere apenas o escopo solicitado e mantenha a integridade visual, classes e componentes ao redor intactos.
