# iStore - Gerenciador de Vendas e Estoque

Sistema completo de gerenciamento de vendas e estoque para lojas de celulares e eletrônicos.

## 🚀 Tecnologias

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Auth)
- **Charts:** Recharts
- **Styling:** CSS customizado

## 📋 Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta no Supabase (para banco de dados)

## 🔧 Instalação Local

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/istore.git
   cd istore
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Execute o app em modo desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse: `http://localhost:3000`

## 🏗️ Build para Produção

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`.

## 🌐 Deploy

### Vercel (Recomendado)

1. Conecte seu repositório GitHub na Vercel
2. Configure:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Deploy automático a cada push

### Netlify

1. Conecte seu repositório no Netlify
2. Configure:
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
3. Deploy automático

### GitHub Pages

1. Adicione no `vite.config.ts`:
   ```ts
   base: '/nome-do-repo/',
   ```
2. Use GitHub Actions para deploy automático

## 📁 Estrutura do Projeto

```
├── components/       # Componentes React reutilizáveis
├── contexts/         # Context API (UserContext, ToastContext)
├── hooks/            # Custom hooks
├── pages/            # Páginas da aplicação
├── services/         # API e serviços (mockApi)
├── utils/            # Utilitários
├── public/           # Assets estáticos (logo, imagens)
├── App.tsx           # Componente principal
├── index.tsx         # Entry point
├── types.ts          # TypeScript types
├── supabaseClient.ts # Configuração do Supabase
└── vite.config.ts    # Configuração do Vite
```

## 🔐 Segurança

- Credenciais do Supabase usam ANON KEY (pública, segura para frontend)
- Row Level Security (RLS) habilitado no Supabase
- Autenticação via Supabase Auth
- Registro de novos usuários bloqueado (apenas admin pode criar)

## 📝 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Build para produção |
| `npm run preview` | Preview do build local |

## 🤝 Contribuição

Este é um projeto privado. Contribuições não são aceitas no momento.

## 📄 Licença

Propriedade privada. Todos os direitos reservados.
