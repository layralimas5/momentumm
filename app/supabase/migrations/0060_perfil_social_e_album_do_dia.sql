-- Momentumm — o perfil vira endereço: seguir, redes e a foto do dia.
--
-- Três mudanças que servem à mesma tela, a nova aba Perfil:
--
--   1. `follows`      — seguir, de uma via só.
--   2. `profiles.*`   — Instagram, TikTok e LinkedIn.
--   3. `day_photos`   — uma foto por dia, pro calendário virar álbum.
--
-- ## Seguir e ser amigo convivem
--
-- `friendships` (0001) é simétrica: pedido, aceite, e só então as duas pessoas
-- se enxergam. Isso continua valendo e continua sendo o que abre um perfil
-- `amigos`.
--
-- `follows` é outra pergunta: "quero acompanhar essa pessoa". Não pede
-- licença, e — a regra inteira de privacidade daqui — NÃO ABRE NADA. Não
-- existe nenhuma política nesta migration que use `follows` pra dar acesso a
-- perfil, atividade, objetivo ou foto. Quem é privado continua privado pra
-- quem segue; o número de seguidores é uma contagem, não uma porta.
--
-- Empilhar as duas na mesma tabela faria "somos amigos" e "eu te sigo" terem a
-- mesma resposta, e o dia em que uma delas mudar de regra a outra muda junto
-- sem ninguém pedir.

-- ---------------------------------------------------------------------------
-- seguir
-- ---------------------------------------------------------------------------

/*
  Uma linha por DIREÇÃO, e a chave primária é o par.

  "A e B se seguem" são duas linhas. Com uma linha só e um booleano de
  reciprocidade, desfazer de um lado teria que reescrever a linha do outro, e
  qualquer falha no meio deixaria o par em desacordo consigo mesmo.
*/
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),

  primary key (follower_id, following_id),
  -- Seguir a si mesmo infla o próprio número e não significa nada. A tela
  -- também barra; aqui é garantia, lá é conveniência.
  constraint follows_not_self check (follower_id <> following_id)
);

comment on table public.follows is
  'Seguir, de uma via. Não concede acesso a nada: é contagem, não permissão.';

-- "Quem eu sigo" sai da chave primária. "Quem me segue" precisa do índice.
create index if not exists follows_following_idx on public.follows (following_id, created_at desc);

alter table public.follows enable row level security;

drop policy if exists "vê os próprios laços" on public.follows;
create policy "vê os próprios laços"
  on public.follows for select
  to authenticated
  using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "só você segue por você" on public.follows;
create policy "só você segue por você"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

/*
  Os dois lados desfazem: quem segue deixa de seguir, e quem é seguido pode
  remover um seguidor. Sem a segunda metade, a única saída de alguém
  indesejado seria bloquear — que é um recurso que este produto ainda não tem.
*/
drop policy if exists "os dois lados desfazem" on public.follows;
create policy "os dois lados desfazem"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id or auth.uid() = following_id);

/*
  As contagens de um perfil.

  Contar pelo SELECT normal só devolveria as linhas que a política acima deixa
  ver — ou seja, cada pessoa veria "1 seguidor" em qualquer perfil que ela
  mesma segue. A contagem é pública por natureza (é o que todo perfil mostra),
  então ela sai de uma função de retorno estreito: dois números, nenhum id,
  nenhum nome.

  `security definer` com `search_path` fixo e revoke explícito ao `anon`, pela
  lição da 0010: o Supabase concede execute a `anon` e `authenticated` em toda
  função nova do schema `public`, direto ao papel, e o `revoke ... from public`
  não alcança isso.
*/
create or replace function public.follow_counts(target uuid)
returns table (followers bigint, following bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.follows f where f.following_id = target),
    (select count(*) from public.follows f where f.follower_id = target);
$$;

revoke all on function public.follow_counts(uuid) from public;
revoke all on function public.follow_counts(uuid) from anon;
grant execute on function public.follow_counts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- as redes da pessoa
-- ---------------------------------------------------------------------------

/*
  Três colunas, não uma tabela de links.

  Uma tabela aceitaria a quarta, a décima, e o perfil viraria árvore de links —
  outro produto. Três é o que cabe na linha de chips embaixo da bio.

  O que é guardado é o @ LIMPO, sem URL e sem rastreador: quem cola
  `instagram.com/lay/?igsh=...` está colando o endereço com a origem do clique
  dentro dele. A constraint recusa `@`, `/` e `:` justamente pra impedir que
  uma URL inteira entre disfarçada de nome.
*/
alter table public.profiles
  add column if not exists instagram text,
  add column if not exists tiktok    text,
  add column if not exists linkedin  text;

comment on column public.profiles.instagram is '@ limpo, sem URL. Null quando não tem.';

do $$
begin
  alter table public.profiles drop constraint if exists profiles_socials_format;
  alter table public.profiles
    add constraint profiles_socials_format check (
      (instagram is null or instagram ~ '^[A-Za-z0-9._-]{1,40}$')
      and (tiktok  is null or tiktok  ~ '^[A-Za-z0-9._-]{1,40}$')
      and (linkedin is null or linkedin ~ '^[A-Za-z0-9._-]{1,40}$')
    );
end $$;

-- ---------------------------------------------------------------------------
-- a foto do dia
-- ---------------------------------------------------------------------------

/*
  Uma foto por dia, e o arquivo NÃO mora aqui.

  O avatar é um data URL dentro da coluna, e está certo pra um arquivo de ~20KB
  por conta. Aqui são até 365 por ano, por pessoa: guardar a imagem na tabela
  faria cada leitura do mês arrastar megabytes e transformaria o banco em
  servidor de arquivo. A linha guarda o CAMINHO no bucket privado `user-media`
  (0014), e a imagem sai por link assinado, na hora de mostrar.

  A chave é (pessoa, dia): escolher outra foto no mesmo dia TROCA a primeira.
  Álbum por dia é outro produto — pede ordem, capa e navegação, e a pergunta
  que o calendário responde é "como foi esse dia", que tem uma resposta só.
*/
create table if not exists public.day_photos (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  path       text not null,
  created_at timestamptz not null default now(),

  primary key (user_id, day),
  -- O caminho tem que começar pela pasta da própria pessoa. É a mesma chave de
  -- autorização que o Storage usa na 0014, repetida aqui pra uma linha nunca
  -- apontar pro arquivo de outra conta.
  constraint day_photos_path_is_own check (path like user_id::text || '/%'),
  -- Foto de um dia que ainda não chegou é registro do que não aconteceu.
  constraint day_photos_not_ahead check (day <= (now() at time zone 'utc')::date + 1)
);

comment on table public.day_photos is
  'Uma foto por dia, por pessoa. Guarda o caminho no bucket privado, nunca a imagem.';

alter table public.day_photos enable row level security;

/*
  Só o dono, nos quatro verbos.

  O calendário de outra pessoa não mostra foto nenhuma — e não é só uma escolha
  de tela: as imagens vivem no bucket privado, onde a política da 0014 só deixa
  o dono assinar o próprio caminho. Abrir o álbum pra visitante é uma migration
  que mexe no Storage junto, e ela não é esta.
*/
drop policy if exists "só o dono vê o próprio álbum" on public.day_photos;
create policy "só o dono vê o próprio álbum"
  on public.day_photos for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "só o dono guarda foto" on public.day_photos;
create policy "só o dono guarda foto"
  on public.day_photos for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "só o dono troca a foto" on public.day_photos;
create policy "só o dono troca a foto"
  on public.day_photos for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "só o dono apaga a foto" on public.day_photos;
create policy "só o dono apaga a foto"
  on public.day_photos for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- recomeçar do zero também limpa o álbum
-- ---------------------------------------------------------------------------

/*
  A função da 0032, com uma linha a mais.

  `reset_my_data` apaga o conteúdo e mantém a conta, o plano e as amizades — e
  agora mantém também quem segue quem, pela mesma razão: recomeçar é sobre o
  que você registrou, não sobre quem te acompanha. O que sai é o álbum, porque
  os arquivos dele são apagados logo abaixo e caminho sem arquivo é foto
  quebrada no calendário.
*/
create or replace function public.reset_my_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := auth.uid();
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  perform public.record_audit('conta.recomecar', 'account', quem::text, 'ok', '{}'::jsonb);

  -- Sociais primeiro: o que a pessoa criou some; o que ela recebeu de amigos
  -- (participação em desafio de outra pessoa, apoio de outra pessoa) some
  -- junto porque aponta pra um momento ou desafio que deixa de existir.
  delete from public.challenge_participants where user_id = quem;
  delete from public.challenges where owner_id = quem;
  delete from public.journey_event_supports where user_id = quem;
  delete from public.journey_events where user_id = quem;

  -- O ciclo do produto. As etapas caem com o objetivo e os logs com o hábito.
  delete from public.tasks where user_id = quem;
  delete from public.objectives where user_id = quem;
  delete from public.goals where user_id = quem;
  delete from public.habits where user_id = quem;
  delete from public.activities where user_id = quem;
  delete from public.check_ins where user_id = quem;
  delete from public.wins where user_id = quem;
  delete from public.weekly_reviews where user_id = quem;

  -- Os eixos que ela criou. Os de fábrica não têm dono e ficam.
  delete from public.activity_types where user_id = quem;

  -- A evolução volta ao nível 1: recomeçar é recomeçar.
  delete from public.xp_transactions where user_id = quem;
  delete from public.user_achievements where user_id = quem;
  delete from public.user_evolution where user_id = quem;

  -- O álbum do dia (0060) cai junto com os arquivos: a linha guarda o caminho
  -- do que está prestes a ser apagado, e caminho sem arquivo é foto quebrada.
  delete from public.day_photos where user_id = quem;

  -- Os arquivos. Mesmo contrato da exclusão: o cliente já limpa pela API
  -- antes, e aqui é a garantia caso o storage aceite.
  begin
    delete from storage.objects
     where bucket_id = 'user-media'
       and (storage.foldername(name))[1] = quem::text;
  exception
    when others then
      raise warning 'reset_my_data: storage recusou apagar a pasta de % (%).', quem, sqlerrm;
  end;
end;
$$;

revoke all on function public.reset_my_data() from public;
revoke all on function public.reset_my_data() from anon;
grant execute on function public.reset_my_data() to authenticated;
