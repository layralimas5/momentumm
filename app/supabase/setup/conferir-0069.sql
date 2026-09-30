-- Momentumm — a 0069 subiu?
--
-- A 0069 troca UMA função (`profile_calendar`) e nada mais: não cria tabela,
-- não mexe em política, não apaga nada. Um `create or replace` que roda sem
-- erro está aplicado, então esta conferência existe pro caso que não aparece
-- como erro: o SQL Editor rodar uma versão antiga do arquivo, ou a janela ter
-- ficado com o texto da 0068 colado por engano.
--
-- Ela olha o CORPO da função em vez do comportamento porque comportamento
-- exigiria sessão: `profile_calendar` é `security invoker` e lê `auth.uid()`,
-- e no SQL Editor não existe usuário logado. Quem prova o comportamento é a
-- suíte (`npm run db:test`, 62 asserções em social.mjs).
--
-- Rodar no SQL Editor. Uma consulta, só leitura, uma linha de resposta.

select
  case
    when f.existe = 0        then 'FALTANDO: a função profile_calendar não existe'
    when not f.tem_com_foto  then 'ANTIGA: a capa ainda é a publicação mais recente, tenha ela foto ou não'
    when not f.tem_album     then 'INCOMPLETA: o álbum não entra como capa de dia com publicação só de texto'
    when not f.invoker       then 'PERIGO: a função virou security definer, e ela lê dados de perfil'
    else 'OK — a 0069 está aplicada'
  end as veredito,
  f.existe        as funcoes_com_esse_nome,
  f.tem_com_foto  as escolhe_a_mais_recente_com_foto,
  f.tem_album     as album_entra_como_capa,
  f.invoker       as roda_como_quem_chama
from (
  select
    count(*) as existe,
    bool_or(pg_get_functiondef(p.oid) like '%com_foto%')        as tem_com_foto,
    bool_or(pg_get_functiondef(p.oid) like '%coalesce(f.path, a.path)%') as tem_album,
    bool_or(not p.prosecdef)                                    as invoker
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'profile_calendar'
) f;
