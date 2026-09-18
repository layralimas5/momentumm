# Testes de banco no PGlite

Roda as migrations inteiras num Postgres em WASM (`@electric-sql/pglite`),
sem Docker nem projeto remoto, e prova os fluxos do teste de 7 dias do PRO
(migration 0034) contra o SQL de verdade: triggers, RLS, funções.

```bash
npm run db:test
```

`harness.mjs` sobe o banco com stubs do que é do Supabase (schema `auth`,
`auth.uid()`/`auth.jwt()` lendo `request.jwt.claims`, `storage`, os papéis
`anon`/`authenticated`/`service_role` com os privilégios padrão) e aplica
`supabase/migrations/*.sql` em ordem. `pg_cron` não existe aqui: a 0034 trata
isso e segue, como em qualquer banco sem a extensão.

`trial.mjs` cobre: implantação sobre contas existentes (7 dias contados de
agora, owner com cortesia, assinante convertido), conta nova, permissões do
dono, fim do teste sem assinatura (dados preservados, fechamento pelo
agendador e pela abertura do app), assinatura durante o teste, pagamento
aprovado depois do teste expirar, e as regras de assinatura da 0026 intactas.

Os testes `supabase/tests/*.sql` continuam sendo os de RLS contra um banco
real (`psql`): eles usam metacomandos e colunas do `auth.users` do GoTrue que
o PGlite não tem.
