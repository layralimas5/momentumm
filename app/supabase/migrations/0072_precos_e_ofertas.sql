-- Momentumm — preço novo do PRO e as condições de entrada.
--
-- O preço mudou (R$ 24,90 por mês, R$ 99,90 por ano) e ganhou duas ofertas
-- que mexem só na PRIMEIRA cobrança: R$ 9,90 no primeiro mês pra quem nunca
-- assinou, e a campanha Fundadores (R$ 69,90 no primeiro ano), ligada pelo
-- painel. O preço mora no código (`billing-plans.ts`); o que o banco precisa
-- guardar é o que não dá pra deduzir depois:
--
--   offer                 com que condição a assinatura começou
--   renewal_amount_cents  quanto a PRÓXIMA cobrança vai custar
--
-- `amount_cents` continua sendo o valor da última cobrança paga. No primeiro
-- mês com oferta, os dois diferem, e é essa diferença que a tela de
-- assinatura mostra antes de a pessoa ser surpreendida pela renovação.
--
-- Nada é apagado e a migration é re-executável.

alter table public.subscriptions
  add column if not exists offer text,
  add column if not exists renewal_amount_cents integer;

do $$ begin
  alter table public.subscriptions
    add constraint subscriptions_offer_known check (offer is null or offer in ('primeiro_mes', 'fundadores'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.subscriptions
    add constraint subscriptions_renewal_positive check (renewal_amount_cents is null or renewal_amount_cents >= 0);
exception when duplicate_object then null; end $$;

comment on column public.subscriptions.offer is
  'Condição de entrada: primeiro_mes (mensal a R$ 9,90) ou fundadores (anual a R$ 69,90). Nulo = preço cheio.';
comment on column public.subscriptions.renewal_amount_cents is
  'Valor da próxima cobrança. Nulo em assinatura anterior à 0072: vale amount_cents.';

/*
  A campanha Fundadores nasce DESLIGADA. Ligar é trocar `foundersOffer` pra
  true na chave `features`, pelo painel. A landing lê pela `public_settings()`
  e a função de cobrança lê direto da tabela: é a mesma chave dos dois lados.
*/
update public.product_settings
   set value = value || jsonb_build_object('foundersOffer', false),
       updated_at = now()
 where key = 'features'
   and not (value ? 'foundersOffer');
