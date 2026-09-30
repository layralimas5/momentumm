-- Momentumm — a 0071 subiu?
--
-- Rodar no SQL Editor depois de colar a 0071. Só leitura, uma linha.
-- As três colunas precisam vir `true`.

select
  to_regclass('public.quiz_lead_hits') is not null                        as tabela_do_freio,
  to_regprocedure('public.quiz_client_ip()') is not null                  as funcao_do_ip,
  position('quiz_lead_hits' in pg_get_functiondef(
    'public.quiz_save_lead(uuid, text, text, text, integer)'::regprocedure
  )) > 0                                                                   as contato_com_freio;
