-- Momentumm — os dois papéis administrativos que faltavam.
--
-- `app_role` nasceu com `admin` e `support` (0013). O painel administrativo
-- separa quatro níveis:
--
--   owner    configurações gerais e gestão de administradores
--   admin    operação: usuários, assinaturas, produto
--   support  solicitações e os dados básicos que elas exigem
--   analyst  só métricas agregadas, sem dado pessoal
--
-- `add value` não pode ser USADO na mesma transação em que foi criado, e o
-- CLI roda cada arquivo numa transação. Por isso o enum cresce aqui e o
-- resto do painel (0023 em diante) só começa a usar os valores novos no
-- arquivo seguinte. É a mesma regra que a 0011 seguiu.

alter type public.app_role add value if not exists 'owner';
alter type public.app_role add value if not exists 'analyst';
