# E-mail transacional do Momentumm

Quem manda os e-mails de confirmação de cadastro, recuperação de senha e troca
de endereço. Até 22/09/2026 quem mandava era o servidor compartilhado do
Supabase: remetente `noreply@mail.app.supabase.io`, assunto em inglês, corpo
falando "Supabase", e um teto de 2 e-mails por hora. Serve pra desenvolver,
não pra um produto pago.

## O que já está no repositório

- `app/supabase/config.toml`, bloco `[auth.email.smtp]`: aponta pro Gmail da
  conta `momentumm.suport@gmail.com`.
- `app/supabase/templates/`: os três modelos em português, com a identidade do
  app (fundo escuro, violeta da marca, assinatura momentumm.com.br).
  - `confirmacao.html` — confirmação de cadastro
  - `recuperacao.html` — senha nova
  - `troca-de-email.html` — troca de endereço

Falta só o que não pode morar no repositório: a senha.

## Passo a passo (uma vez só)

1. **Ligar a verificação em duas etapas** na conta `momentumm.suport@gmail.com`
   (myaccount.google.com/security). Sem isso o Google não deixa criar senha de
   app.
2. **Gerar a senha de app** em myaccount.google.com/apppasswords. Nome:
   `Momentumm Supabase`. O Google devolve 16 letras em quatro blocos. Copiar
   sem os espaços.
3. **Guardar a senha** no ambiente antes de aplicar a configuração:

   ```powershell
   $env:SUPABASE_AUTH_SMTP_PASS = "assenhade16letras"
   ```

4. **Aplicar no projeto** (de dentro de `app/`):

   ```powershell
   supabase config push
   ```

   Isso sobe o SMTP e os três modelos. Dá pra conferir em Authentication >
   Emails no painel: o remetente deve aparecer como `Momentumm
   <momentumm.suport@gmail.com>` e os assuntos em português.
5. **Testar de verdade:** criar uma conta com um endereço que você abra na
   hora. O e-mail tem que chegar como Momentumm, em português, e o botão tem
   que cair em `/app`. Testar também "Esqueci minha senha", que cai em
   `/nova-senha`.

## O que esperar do Gmail

- **Teto de 500 envios por dia.** Até uns 150 assinantes isso sobra. Passou
  disso, ou o e-mail começou a cair em spam, é hora de trocar pro plano B
  abaixo.
- **O remetente é o endereço do Gmail, sempre.** O Gmail reescreve o campo
  `From` pro endereço autenticado. O nome "Momentumm" aparece; o
  `@gmail.com` também.
- **Sem SPF e DKIM do momentumm.com.br**, porque o domínio não assina o envio.
  Alguns provedores marcam esses e-mails como promoção. É o custo de usar
  Gmail em vez do domínio próprio.
- Deixar o teto do Supabase onde está (`email_sent = 30` por hora em
  `[auth.rate_limit]`). Ele já cabe folgado dentro do limite do Google.

## Plano B, quando o Gmail apertar

Trocar o bloco `[auth.email.smtp]` por um provedor com o domínio próprio
(Resend ou Brevo, os dois com faixa gratuita de 3 mil e-mails por mês):
verificar `momentumm.com.br`, criar os registros SPF e DKIM no DNS e apontar o
host pro provedor. Remetente vira `Momentumm <conta@momentumm.com.br>`, a
entrega melhora e o teto diário deixa de existir na prática. Os modelos em
português continuam valendo sem mudar uma linha.
