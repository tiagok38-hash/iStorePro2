# Auditoria de Segurança - Supabase RLS e Aplicação

Após analisar o código-fonte da aplicação, identifiquei falhas graves de segurança relacionadas à forma como o Supabase está sendo utilizado e à ausência de políticas de RLS (Row Level Security) eficazes.

## Principais Riscos Identificados

1. **Uso Indevido da Anon Key**: Toda a comunicação com o Supabase é feita através da `SUPABASE_ANON_KEY`. Se você consegue realizar operações de escrita (INSERT, UPDATE, DELETE) sem estar autenticado via `supabase.auth`, significa que suas tabelas estão ou com o RLS desativado ou com políticas permitindo acesso total ao papel `anon`.
2. **Exposição de Senhas**: A função `login` no arquivo `services/mockApi.ts` busca todos os dados do usuário (incluindo a senha em texto claro) e realiza a comparação no lado do cliente.
   - **Risco**: Qualquer pessoa com a URL do seu projeto e a Anon Key pode baixar a tabela inteira de usuários com todas as senhas.
3. **Autenticação Customizada vs Supabase Auth**: A aplicação usa uma tabela `users` customizada em vez do sistema de autenticação nativo do Supabase (`auth.users`). Isso impede o uso correto do RLS, que depende do `auth.uid()` para identificar o usuário de forma segura no banco de dados.
4. **Permissões de Admin Ignoradas no Banco**: O controle de permissões é feito apenas no frontend. Um usuário mal-intencionado pode enviar requisições diretas à API para alterar seu próprio `permissionProfileId` para 'profile-admin'.

---

## Recomendações de Segurança

### 1. Migrar para Supabase Auth (Urgente)
Em vez de buscar o usuário por e-mail e conferir a senha manualmente, utilize:
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@email.com',
  password: 'senha'
})
```

### 2. Ativar RLS em Todas as Tabelas
Execute o seguinte comando SQL no seu editor do Supabase para garantir que ninguém acesse os dados sem permissão:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
-- Repetir para todas as tabelas...
```

### 3. Implementar Políticas de RLS Seguras
Aqui está um exemplo de como as políticas deveriam ser configuradas para a tabela de produtos (permitindo leitura para todos autenticados, mas escrita apenas para admins):

```sql
-- Permitir leitura para usuários autenticados
CREATE POLICY "Produtos visíveis por membros" ON products
  FOR SELECT TO authenticated
  USING (true);

-- Permitir inserção apenas para administradores (exemplo baseado em JWT)
CREATE POLICY "Admins podem inserir produtos" ON products
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');
```

---

## Próximas Ações Sugeridas

Eu preparei um script SQL completo para você rodar no seu painel do Supabase que corrige essas vulnerabilidades e configura as tabelas corretamente. Você deseja que eu apresente esse script agora?
