# Evolução estrutural: navegação, Hoje, Rotina e camada social

Estado do plano de 13 fases em **28/09/2026**. Este arquivo existe pra a próxima
sessão começar sabendo exatamente onde parou, sem reauditar nada.

Branch de trabalho: `feat/nova-navegacao-e-rotina`, já mergeada na `main`
(`d189d4a` e `1cba79a`) e publicada em produção.

---

## Onde parou, fase a fase

| Fase | Estado |
|---|---|
| 1. Auditoria | **Feito e conferido.** 66 migrations, 63 tabelas, 40 páginas |
| 2. Navegação | **Feito e conferido.** Em produção |
| 3. Hoje | **Feito e conferido**, menos o teste da §81 na composição exata |
| 4. Rotina | **Feito em 01/10.** Linha do tempo com "agora", grupo "Em algum momento", check animado, menu único por linha |
| 5. Integração | **Feito em 01/10**, menos o teste de integração ponta a ponta (item 6 das lacunas) |
| 6. Reagendamento | **Feito e em produção desde 29/09** |
| 7. Modelo social + RLS | **Escrito e provado, NÃO aplicado em produção.** Migrations 0067 e 0068 |
| 8. Perfis e follows | **Escrito.** Perfil público/fechado, pedido com aprovação, listas |
| 9. Feed e publicações | **Escrito.** Publicação com foto, carrossel, legenda, objetivo e privacidade |
| 10. Calendário visual | **Escrito.** Ligado a publicações, com sinal de vários no dia e aba de grade |
| 11. Stories | **Escrito.** Foto e vídeo curto, 24h pela política, visualizador em tela cheia |
| 12. Segurança e moderação | **Escrito.** Bloqueio, denúncia e painel de desbloqueio |
| 13. Refinamento | **Feito.** Virada de dia em produção desde 29/09 (`useToday`); uploads entraram com a camada social |

**As fases 7 a 12 estão prontas no código e provadas contra um Postgres de
verdade (`npm run db:test`, 55 asserções em `supabase/tests/pglite/social.mjs`),
mas NÃO foram aplicadas no banco de produção.** Enquanto a 0067 e a 0068 não
subirem, o Feed, o perfil público e o calendário respondem "esse recurso ainda
não chegou ao servidor", que é o texto que `fail()` dá pra função inexistente.

Dos testes das §78 a §87, só o **§80** (compromisso) e o **§87** (regressão em
17 rotas) foram executados de verdade.

---

## O próximo passo

**Aplicar a 0067 e a 0068 em produção.** É o que separa a camada social escrita
da camada social funcionando, e é o único passo que a sessão não pôde dar:
`npx supabase migration list` responde 401 (o CLI não está autenticado nesta
máquina). O procedimento está em "O que trava as fases 7 em diante", logo
abaixo, e continua valendo inteiro.

Depois disso, o teste com duas contas reais (§ "Critérios de conclusão").

**Fase 6: feita em 29/09** na branch `feat/reagendar-so-hoje`. O submenu agora separa "Só nesse dia" de "Na rotina", e `planOccurrenceMove` decide o que a data escolhida significa. Falta o merge. O texto abaixo fica como registro do que foi pedido.

~~Fase 6, fechar o reagendamento.~~

No `AgendaItemSheet`, o submenu Reagendar tem "Hoje, mais tarde" e "Amanhã",
que mexem só na ocorrência, e "Escolher dia e horário", que abre o editor da
REGRA e muda todos os dias. Os três estão na mesma lista sem separação, e é o
que a §26 pede pra distinguir.

O que falta: seletor de data que mova só a ocorrência de hoje
(`setRoutineStatus` com `movedToDay`, que o banco já suporta desde a 0064), e
separar em voz alta "só hoje" de "na rotina".

---

## Lacunas das fases 4 e 5 (auditoria de 30/09)

O texto da especificação não está no repositório: foi colado no chat da sessão
de 27/09. O essencial das seções usadas:

- **§10 / §57:** timeline vertical limpa, horários fáceis de escanear, check
  satisfatório, transições sutis, respiro, categorias discretas, objetivo sem
  poluir. §13: o que não tem horário vai pra "Em algum momento". §59: check
  animado.
- **§16:** OBJETIVO → PLANO → ROTINA → HOJE → ✓ → PROGRESSO, sem duplicar
  registro e sem perder o objetivo de origem.

O que falta, em ordem:

1. ~~**Plano → rotina não existe.**~~ **Feito em 01/10:** "Levar pra rotina"
   em cada etapa (`StagePanel`) e no objetivo abre o formulário da Rotina com
   título e objetivo preenchidos e "dias específicos" marcado
   (`routine-prefill.ts`).
2. ~~**Rotina fora do progresso do objetivo.**~~ **Feito em 01/10:** painel
   "Na rotina" no objetivo, "Rotina" nos últimos 7 dias do Progresso
   (`routineRateBetween`) e "Rotina concluída" também pros itens de rotina.
3. ~~**Timeline de verdade.**~~ **Feito em 01/10** (`routineTimeline`). Hoje é lista: sem trilho nem marcador de agora,
   check sem animação (o Hoje já anima), sem grupo "Em algum momento" (o
   `dayPart` é ignorado na Rotina).
4. ~~**Peso por linha.**~~ **Feito em 01/10.** Editar e apagar em toda linha; objetivo na única cor
   forte.
5. ~~**Acertos pequenos.**~~ **Feito em 01/10.** "Pulado hoje" aparece em dia que não é hoje; em dia
   passado o check trava mas editar/apagar não.
6. **Teste de integração do caminho da §16**, no demo ou no PGlite.

---

## O que trava as fases 7 em diante

O registro de migrations do CLI está parado na **0056**. O schema de produção
está em dia (conferido tabela por tabela e função por função pela API REST), mas
`supabase_migrations.schema_migrations` não tem as linhas da 0057 à 0066, porque
elas foram aplicadas pelo SQL Editor em vez de `supabase db push`.

**Antes de aplicar a 0067 e a 0068**, autenticar e conferir o registro, em `app/`:

```
npx supabase login
```

e então:

```
npx supabase migration list
```

Se a coluna Remote parar na 0056:

```
npx supabase migration repair --status applied 0057 0058 0059 0060 0061 0062 0063 0064 0065 0066
```

Esse comando **só insere dez linhas no registro**. Não executa SQL nas tabelas.
Sem ele, um `db push` tentaria reaplicar dez migrations antigas em produção.

Só depois disso:

```
npx supabase db push
```

### O que a 0067 muda no que já existe

Ela é aditiva em quase tudo (dez tabelas novas, um bucket novo), com três
exceções que valem ser lidas antes de rodar:

1. **`follows` ganha `status`.** As linhas que existem viram `aceito` quando o
   perfil de destino é `publico`, e `pendente` nas outras — a leitura
   conservadora, porque elas foram criadas quando seguir não dava acesso a
   nada. Quem seguia um perfil fechado vira um pedido esperando resposta.
2. **A política de SELECT de `profiles` é substituída.** Ela ganha duas
   cláusulas (quem tem pedido aceito, e quem pediu pra me seguir) e mantém as
   quatro da 0012. Nada é afrouxado.
3. **`follow_counts` passa a contar só o aceito.** Perfil fechado que tinha
   seguidores pendentes vê o número cair, e é o número certo.

Nada é apagado, nada é destrutivo, e a migration é re-executável.

---

## Decisões já tomadas, não reabrir

- **Alcance social:** ~~só entre amigos aceitos~~. **Mudou em 28/09/2026**, com a
  camada social: o alcance agora é decidido pelo PERFIL (`profile_visibility`).
  Perfil `publico` é visível a qualquer conta autenticada; `privado` e `amigos`
  exigem pedido aceito. Perfil nasce `privado`, então nada ficou aberto por
  padrão. O Círculo (amizade) continua existindo ao lado, com a regra dele.
- **Seguir passou a abrir conteúdo.** A 0060 dizia com todas as letras que
  seguir não abria nada. Sem feed isso estava certo; com feed, seguir É a porta,
  e o que entrou junto foi o pedido de aprovação pro perfil fechado.
- **Uma pergunta de autorização, uma função.** `can_view_content_of(dono)` é
  lida pela RLS de publicação, mídia, story, comentário, curtida e salvo, e
  também pelo Storage. Espalhar a regra por sete políticas seria garantir que
  uma afrouxasse sozinha.
- **Bucket separado (`social-media`).** O `user-media` (0014) é "só o dono lê", e
  está certo pro que mora lá. A leitura do bucket social é liberada pela LINHA
  que aponta pro arquivo, nunca pela pasta: listar pasta de perfil público
  entregaria a foto de publicação privada e a de story vencido.
- **Nada de ranking.** O card do feed não mostra seguidores do autor, score nem
  posição. O que aparece é o avanço da pessoa contra ela mesma.
- **Foco de hoje:** só o que a pessoa marcou (prioridade principal e prioridade
  alta). Rotina não entra, porque item de rotina não tem prioridade pra marcar.
- **O anel do topo:** continua medindo ação e hábito, que é o que alimenta os
  momentos da jornada e o card de compartilhar. O dia inteiro virou a linha de
  baixo do mesmo tile.
- **Rotina fora do card "Seu dia":** com a aba própria na barra, a lente e o
  atalho "Organizar rotina" saíram. Os itens de rotina continuam na lista.
- **Compromisso não é entidade nova:** é item de rotina com recorrência `unica`.

---

## Critérios de conclusão que ainda faltam

Só dá pra marcar com duas contas reais, depois do `db push`:

1. Conta A segue Conta B; B aparece no feed de A.
2. B publica uma foto; ela aparece no feed de A.
3. A curte e comenta; B vê as duas coisas.
4. A foto cai no dia certo do calendário de B, e o dia abre a publicação.
5. A não consegue editar nem apagar nada de B (a suíte já prova isso no PGlite;
   falta provar pela API REST com dois JWT de verdade).

O que JÁ foi provado sem duas contas: as 55 asserções de
`supabase/tests/pglite/social.mjs` cobrem os cinco itens acima contra a RLS de
verdade, com três sessões autenticadas simuladas.

---

## Ambiente

- `VITE_CIRCLE_OPEN=true` em produção (confirmado pelo Netlify CLI).
- O login automático de dev não funciona: a senha em `.env.local` tem 8
  caracteres e a conta exige 12.
- Pra ver a interface sem login: `VITE_AUTH_BYPASS=true npx vite --port 5180`.
