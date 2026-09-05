-- Momentumm — fecha o vazamento das áreas criadas pela pessoa.
--
-- A 0001 criou em `activity_types` a policy "catálogo de eixos é público", com
-- `using (true)`: na época a tabela só tinha os quatro eixos de fábrica e isso
-- era correto.
--
-- A 0004 abriu a tabela pras áreas que a conta cria e adicionou uma policy
-- restrita ("todos leem os eixos de fábrica e os próprios") — mas NÃO removeu a
-- antiga. Policies permissivas no Postgres se somam com OR, então a de
-- `using (true)` continua ganhando e a restrita não tem efeito nenhum.
--
-- Resultado: qualquer conta autenticada lê o nome das áreas de qualquer outra.
-- E o nome da área é texto que a pessoa escreveu sobre a própria vida
-- ("terapia", "reabilitação", "violão") — é justamente o dado que ela não
-- esperava compartilhar.
--
-- `if exists` porque um banco criado só depois da 0004 pode não ter a policy.

drop policy if exists "catálogo de eixos é público" on public.activity_types;
