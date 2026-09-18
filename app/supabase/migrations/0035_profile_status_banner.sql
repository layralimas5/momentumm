-- Momentumm — status e capa no perfil.
--
-- Duas coisas que a pessoa escolhe sobre si, no estilo dos apps de
-- comunidade: um status curto com emoji ("🔥 Semana de foco") e uma capa
-- atrás do avatar. A capa é um preset de gradiente (chave curta) ou uma foto
-- reduzida no aparelho e guardada como data URL, a mesma decisão do
-- `avatar_url`: um arquivo por conta não justifica um bucket.
--
-- Nada muda na RLS: são colunas de `profiles`, cobertas pela política de
-- update do dono. O que o Círculo e o cartão de visita (0012) mostram dos
-- outros continua o mesmo; expor status e capa pra amigos é uma decisão à
-- parte.

alter table public.profiles
  add column if not exists status_emoji text,
  add column if not exists status_text  text,
  add column if not exists banner       text;

do $$ begin
  alter table public.profiles
    add constraint profiles_status_emoji_length check (status_emoji is null or char_length(status_emoji) <= 8);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_status_text_length check (status_text is null or char_length(status_text) <= 60);
exception when duplicate_object then null; end $$;

-- Preset é uma chave curta; foto é data URL JPEG. 1024x360 em JPEG fica bem
-- abaixo de 200 mil caracteres, e o teto impede que a coluna vire um álbum.
do $$ begin
  alter table public.profiles
    add constraint profiles_banner_format check (
      banner is null
      or banner ~ '^[a-z][a-z0-9-]{1,30}$'
      or (banner like 'data:image/jpeg;base64,%' and char_length(banner) <= 200000)
    );
exception when duplicate_object then null; end $$;

comment on column public.profiles.status_emoji is 'Emoji do status atual. Opcional, até 8 caracteres.';
comment on column public.profiles.status_text  is 'Frase do status atual. Opcional, até 60 caracteres.';
comment on column public.profiles.banner       is 'Capa do perfil: chave de preset ou data URL JPEG reduzida no aparelho.';
