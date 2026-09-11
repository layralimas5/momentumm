-- Momentumm — excluir a conta voltou a funcionar.
--
-- O Supabase passou a recusar `delete from storage.objects` feito por SQL
-- ("Direct deletion from storage tables is not allowed. Use the Storage API
-- instead."). O trigger `profiles_purge_media` da 0014 fazia exatamente isso,
-- então `delete_my_account` explodia com 42501 pra TODA conta — testado em
-- 10/09/2026 contra o projeto real, com uma conta sem arquivo nenhum.
--
-- A divisão agora é:
--
--   - quem apaga os arquivos é o CLIENTE, pela Storage API, antes de chamar
--     `delete_my_account` (`deleteOwnAccount` em `supabase-repositories`). A
--     política "dono apaga" da 0014 já permite, e é o caminho que o Supabase
--     manda usar;
--   - o trigger continua existindo como rede de segurança, mas nunca mais
--     derruba a exclusão: se o storage recusar, ele registra um aviso e deixa a
--     conta ir embora. Arquivo órfão é um problema de limpeza; conta que não
--     consegue ser apagada é um problema de LGPD.

create or replace function public.purge_user_media()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  begin
    delete from storage.objects
     where bucket_id = 'user-media'
       and (storage.foldername(name))[1] = old.id::text;
  exception
    when others then
      raise warning 'purge_user_media: storage recusou apagar a pasta de % (%). O cliente já deve ter limpado pela API.',
        old.id, sqlerrm;
  end;
  return old;
end;
$$;
