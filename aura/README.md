# Aura

> A jornada entre a mulher que você é hoje e a mulher que decidiu se tornar.

SaaS de transformação pessoal — metas, leituras e reflexões num só lugar.

## Stack

- **React 19 + TypeScript** (strict) + **Vite**
- **Tailwind CSS v4** + **Framer Motion**
- **Supabase** (Auth + Postgres + RLS)
- **Clean Architecture** — domínio, aplicação e infraestrutura desacoplados

## Estrutura

```
src/
├── domain/          # entidades e regras de negócio puras (Goal, Book) + ports
├── application/     # casos de uso (orquestram domínio + repositórios)
├── infrastructure/  # Supabase, adapters, container (composition root), config
├── presentation/    # React: páginas, componentes, hooks, layout
└── shared/          # utilitários (cn)
```

A regra de dependência aponta sempre para dentro: a UI depende dos casos de uso,
que dependem das interfaces do domínio — nunca do Supabase diretamente.

## Rodando localmente

```bash
npm install
npm run dev
```

Sem Supabase configurado, a app sobe em **modo demonstração** (dados de exemplo,
em memória). Para persistir de verdade:

1. Crie um projeto no [Supabase](https://supabase.com).
2. Rode o SQL de `supabase/migrations/0001_init.sql` (SQL Editor) — cria as tabelas
   `goals` e `books` com **RLS** por usuária.
3. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` (Project Settings > API).
4. Reinicie o dev server.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | Typecheck + build de produção |
| `npm run lint` | Lint (oxlint) |
| `npm run preview` | Servir o build |

## MVP

- [x] Landing de conversão (dark, humanizada, planos)
- [x] Autenticação real (Supabase Auth) — cadastro, login, logout, sessão
- [x] Rotas protegidas + dados por usuária (RLS)
- [x] Dashboard "Jornada" (visão única)
- [x] Metas — criar, progresso, concluir, remover
- [x] Leituras — estante com status (quero ler / lendo / lido)
- [ ] Configurar o projeto Supabase (ver "Rodando localmente")
- [ ] Identidade visual definitiva (logo/cores/fonte)
- [ ] Pagamento/planos (WhatsApp já wired atrás de flag)

## Autenticação

- Sem Supabase → **modo demo**: entra direto como usuária de exemplo (dados em memória).
- Com Supabase → **contas reais**: `/criar-conta` e `/entrar`, cada usuária vê só os
  próprios dados (RLS). Rotas `/app*` exigem sessão.
- Arquitetura: port `AuthService` (application) + adapters `SupabaseAuthService` /
  `DemoAuthService` (infra), escolhidos pelo container conforme o ambiente.

Feito por Layra Lima.
