-- Momentumm — áreas criadas pela pessoa.
--
-- A regra de arquitetura do produto sempre foi "eixo novo é uma linha em
-- activity_types, nunca um módulo novo". Esta migration só cobra essa promessa:
-- a tabela passa a aceitar linhas de dono, e tudo que já lê de activity_types
-- (atividade, hábito, meta, objetivo, streak, review) funciona na área nova sem
-- uma linha de código a mais.
--
-- `user_id` nulo continua sendo eixo de fábrica, visível pra todo mundo.

alter table public.activity_types
  add column user_id uuid references public.profiles (id) on delete cascade,
  add column color text;

-- O slug é a chave primária e precisa continuar único no geral: dois donos com
-- uma área "escrita" cada um teriam o mesmo slug e as FKs não saberiam separar.
-- Por isso o slug de área criada nasce prefixado com o dono no repositório.
create index activity_types_user_idx on public.activity_types (user_id);

alter table public.activity_types enable row level security;

-- Eixo de fábrica é público; o criado é só de quem criou.
create policy "todos leem os eixos de fábrica e os próprios"
  on public.activity_types for select
  using (user_id is null or auth.uid() = user_id);

create policy "usuário cria os próprios eixos"
  on public.activity_types for insert
  with check (auth.uid() = user_id);

create policy "usuário gerencia os próprios eixos"
  on public.activity_types for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "usuário apaga os próprios eixos"
  on public.activity_types for delete
  using (auth.uid() = user_id);
