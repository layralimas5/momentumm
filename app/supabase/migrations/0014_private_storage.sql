-- Momentumm — armazenamento privado de arquivos.
--
-- ## Por que este bucket existe antes de haver upload
--
-- Hoje o produto não escreve nenhum arquivo: o avatar é um data URI de 256px
-- guardado na própria coluna (protegido pela RLS de `profiles`) e a imagem do
-- Share Studio é desenhada em canvas e nunca sai do navegador. Não há foto,
-- anexo nem registro em disco.
--
-- O bucket entra agora mesmo assim porque a ordem inversa é o que produz
-- vazamento: quando a primeira tela de upload aparecer, o caminho mais curto
-- vai ser `createBucket('fotos', { public: true })` numa tarde de sexta. Com
-- o bucket privado e as políticas já no lugar, o caminho mais curto passa a
-- ser o correto.
--
-- ## O contrato do caminho
--
--   <user_id>/<nome-imprevisível>.<ext>
--
-- A primeira pasta é o dono, e é ela que TODA política compara com
-- `auth.uid()`. Não é convenção de código: é a chave da autorização. Nome
-- previsível (`avatar.jpg`, `foto-1.jpg`) é o que permite adivinhar o caminho
-- de outra pessoa — mesmo com o bucket privado, um caminho adivinhado vira um
-- pedido de signed URL que o servidor precisa recusar. Recusar é o trabalho
-- das políticas abaixo; não dar o que adivinhar é a segunda camada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-media',
  'user-media',
  false,
  -- 5MB. Avatar cabe em 20KB; o teto existe pro dia em que entrar anexo, e
  -- ele é a única defesa contra upload usado como armazenamento gratuito.
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- políticas por proprietário
-- ---------------------------------------------------------------------------

/*
  Quatro políticas separadas, uma por comando.

  `for all` daria o mesmo resultado hoje e esconderia a assimetria de amanhã:
  quando existir compartilhamento, a leitura vai precisar de uma condição que
  a escrita não tem. Separadas, isso vira uma política nova; juntas, viraria
  uma condição maior que alguém precisa reler inteira pra ter certeza de que
  não afrouxou a escrita sem querer.

  A comparação é sempre `(storage.foldername(name))[1] = auth.uid()::text`.
  Isso também bloqueia LISTAGEM cruzada: o list do Storage roda um select
  sobre `storage.objects`, e uma pasta que a política não enxerga simplesmente
  não aparece.
*/

drop policy if exists "user-media: dono lê" on storage.objects;
create policy "user-media: dono lê"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user-media: dono envia" on storage.objects;
create policy "user-media: dono envia"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    -- Sem isso, `<uid>/../outro/arquivo` passaria pela checagem da primeira
    -- pasta e escreveria fora dela.
    and name !~ '\.\.'
  );

drop policy if exists "user-media: dono substitui" on storage.objects;
create policy "user-media: dono substitui"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user-media: dono apaga" on storage.objects;
create policy "user-media: dono apaga"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- o arquivo morre com a conta
-- ---------------------------------------------------------------------------

/*
  Apagar a conta cascateia por todas as tabelas (`references auth.users on
  delete cascade`), mas `storage.objects` não participa dessa cascata: o
  arquivo continuaria no disco, com o dono já inexistente, pra sempre.

  O trigger fecha isso. Ele roda no delete de `profiles`, que é o que o
  cascade de `auth.users` dispara primeiro.
*/
create or replace function public.purge_user_media()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
   where bucket_id = 'user-media'
     and (storage.foldername(name))[1] = old.id::text;
  return old;
end;
$$;

drop trigger if exists profiles_purge_media on public.profiles;
create trigger profiles_purge_media
  before delete on public.profiles
  for each row execute function public.purge_user_media();
