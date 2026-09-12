-- Momentumm — privacidade, exportação e limites.
--
-- O que já existia (0013 a 0017): RLS em toda tabela com política por
-- comando, papel fora de `profiles`, admin só em aal2, auditoria sem
-- conteúdo, bucket privado com pasta por dono, exclusão da conta levando os
-- arquivos. Esta migration fecha o que a LGPD e o abuso cobram por cima:
--
--   1. aceite dos Termos e da Política, registrado por versão, data e pessoa
--   2. exportação dos dados da conta em um JSON só, respeitando a RLS
--   3. limite de uploads por hora e tipo de arquivo checado na política
--   4. limite por minuto das chamadas da IA (o mensal já é a franquia)
--
-- Tudo re-executável, pelo mesmo motivo da 0013: o caminho real é o SQL
-- Editor, e uma migration que estoura na metade deixa a proteção pela metade.

-- ---------------------------------------------------------------------------
-- 1. aceite legal
-- ---------------------------------------------------------------------------

/*
  Uma linha por (pessoa, documento, versão). Aceite é REGISTRO: não se edita
  nem se apaga pelo cliente. Mudar a versão do documento cria outra linha, e
  a ausência da linha da versão vigente é o que faz o app pedir o aceite de
  novo. Sem coluna de IP ou user agent: a data e a versão bastam pra provar o
  aceite, e o resto seria dado pessoal guardado sem função.
*/
create table if not exists public.legal_acceptances (
  user_id     uuid not null references auth.users (id) on delete cascade,
  document    text not null check (document in ('termos', 'privacidade')),
  version     text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, document, version)
);

alter table public.legal_acceptances enable row level security;

drop policy if exists legal_acceptances_owner_select on public.legal_acceptances;
create policy legal_acceptances_owner_select
  on public.legal_acceptances for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists legal_acceptances_owner_insert on public.legal_acceptances;
create policy legal_acceptances_owner_insert
  on public.legal_acceptances for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Sem update e sem delete: a ausência é a política.

-- ---------------------------------------------------------------------------
-- 2. exportação
-- ---------------------------------------------------------------------------

/*
  `security invoker`, de propósito: a função roda com a RLS de quem chama,
  então ela só consegue montar o JSON com o que a pessoa já podia ler. Não há
  como pedir a exportação de outra conta — o `where user_id = auth.uid()` é
  redundância, não a proteção.

  O que sai: tudo que ela escreveu ou registrou. O que NÃO sai: as linhas de
  outras pessoas que ela enxerga por amizade (momentos do círculo, perfil de
  amigo), porque exportação é dos dados DELA, e o dado do amigo é do amigo.
*/
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'format', 'momentumm.export.v1',
    'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = auth.uid()),
    'legal_acceptances', coalesce((select jsonb_agg(to_jsonb(l) - 'user_id') from public.legal_acceptances l where l.user_id = auth.uid()), '[]'::jsonb),
    'activity_types', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.activity_types t where t.user_id = auth.uid()), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(a) - 'user_id') from public.activities a where a.user_id = auth.uid()), '[]'::jsonb),
    'objectives', coalesce((select jsonb_agg(to_jsonb(o) - 'user_id') from public.objectives o where o.user_id = auth.uid()), '[]'::jsonb),
    'plan_stages', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id') from public.plan_stages s where s.user_id = auth.uid()), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(to_jsonb(g) - 'user_id') from public.goals g where g.user_id = auth.uid()), '[]'::jsonb),
    'habits', coalesce((select jsonb_agg(to_jsonb(h) - 'user_id') from public.habits h where h.user_id = auth.uid()), '[]'::jsonb),
    'habit_logs', coalesce((select jsonb_agg(to_jsonb(hl) - 'user_id') from public.habit_logs hl where hl.user_id = auth.uid()), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(k) - 'user_id') from public.tasks k where k.user_id = auth.uid()), '[]'::jsonb),
    'check_ins', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id') from public.check_ins c where c.user_id = auth.uid()), '[]'::jsonb),
    'wins', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id') from public.wins w where w.user_id = auth.uid()), '[]'::jsonb),
    'weekly_reviews', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id') from public.weekly_reviews r where r.user_id = auth.uid()), '[]'::jsonb),
    'journey_events', coalesce((select jsonb_agg(to_jsonb(e) - 'user_id') from public.journey_events e where e.user_id = auth.uid()), '[]'::jsonb),
    'challenges', coalesce((select jsonb_agg(to_jsonb(ch) - 'owner_id') from public.challenges ch where ch.owner_id = auth.uid()), '[]'::jsonb),
    'challenge_participations', coalesce((select jsonb_agg(to_jsonb(cp) - 'user_id') from public.challenge_participants cp where cp.user_id = auth.uid()), '[]'::jsonb),
    'friendships', coalesce((select jsonb_agg(jsonb_build_object('status', f.status, 'created_at', f.created_at, 'requested_by_me', f.requester_id = auth.uid())) from public.friendships f where f.requester_id = auth.uid() or f.addressee_id = auth.uid()), '[]'::jsonb),
    'ai_calls', coalesce((select jsonb_agg(to_jsonb(ai) - 'user_id') from public.ai_calls ai where ai.user_id = auth.uid()), '[]'::jsonb),
    'media', coalesce((select jsonb_agg(jsonb_build_object('path', so.name, 'size', (so.metadata ->> 'size')::bigint, 'mimetype', so.metadata ->> 'mimetype', 'created_at', so.created_at)) from storage.objects so where so.bucket_id = 'user-media' and (storage.foldername(so.name))[1] = auth.uid()::text), '[]'::jsonb)
  );
$$;

revoke all on function public.export_my_data() from public;
revoke all on function public.export_my_data() from anon;
grant execute on function public.export_my_data() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. uploads: tipo, tamanho e ritmo
-- ---------------------------------------------------------------------------

/*
  O bucket ganha áudio (registros por voz do PRO) e o teto sobe pra 10MB. O
  tipo é conferido em DOIS lugares: `allowed_mime_types` do bucket (a API do
  Storage recusa antes de gravar) e a política de insert (sobrevive a alguém
  mexer no bucket pelo painel). Formato vem do `metadata->>'mimetype'` que o
  Storage grava a partir do upload.
*/
update storage.buckets
   set public = false,
       file_size_limit = 10485760,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp',
         'audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
         'application/pdf'
       ]
 where id = 'user-media';

/*
  Quantos arquivos a pessoa subiu na última hora. `security definer` porque a
  política roda como o usuário e a contagem precisa enxergar a pasta inteira
  dele — que é a dele mesmo, então nada vaza. Revogado do `anon` pela lição
  da 0010.
*/
create or replace function public.user_media_uploads_last_hour()
returns integer
language sql
stable
security definer
set search_path = public, storage
as $$
  select count(*)::integer
    from storage.objects o
   where o.bucket_id = 'user-media'
     and (storage.foldername(o.name))[1] = auth.uid()::text
     and o.created_at > now() - interval '1 hour';
$$;

revoke all on function public.user_media_uploads_last_hour() from public;
revoke all on function public.user_media_uploads_last_hour() from anon;
grant execute on function public.user_media_uploads_last_hour() to authenticated;

drop policy if exists "user-media: dono envia" on storage.objects;
create policy "user-media: dono envia"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name !~ '\.\.'
    -- Pasta por tipo: <uid>/fotos|audios|anexos/<arquivo>. Caminho fora disso
    -- é cliente inventando estrutura, e não entra.
    and (storage.foldername(name))[2] in ('fotos', 'audios', 'anexos')
    and coalesce(metadata ->> 'mimetype', '') in (
      'image/jpeg', 'image/png', 'image/webp',
      'audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
      'application/pdf'
    )
    and public.user_media_uploads_last_hour() < 60
  );

-- ---------------------------------------------------------------------------
-- 4. IA: ritmo por minuto
-- ---------------------------------------------------------------------------

/*
  A franquia mensal segura o custo; o limite por minuto segura o abuso de
  script (e o duplo toque que o freio do cliente não pegou). A função é
  chamada pela Edge Function com service role, então o `p_user` vem do JWT
  já validado lá, nunca do corpo do pedido.
*/
create or replace function public.ai_calls_last_minute(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.ai_calls c
   where c.user_id = p_user
     and c.created_at > now() - interval '1 minute';
$$;

revoke all on function public.ai_calls_last_minute(uuid) from public;
revoke all on function public.ai_calls_last_minute(uuid) from anon;
revoke all on function public.ai_calls_last_minute(uuid) from authenticated;
grant execute on function public.ai_calls_last_minute(uuid) to service_role;
