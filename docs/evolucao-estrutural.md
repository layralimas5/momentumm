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
| 4. Rotina | **Feito, não validado** contra o design de timeline das §10 e §57 |
| 5. Integração | **Parcial.** Fonte única existe; o caminho da §16 nunca foi testado ponta a ponta |
| 6. Reagendamento | **Parcial.** Falta mover só a ocorrência pra uma data escolhida |
| 7. Modelo social + RLS | **Não feito.** Só `profiles` e `follows` existem |
| 8. Perfis e follows | **Parcial.** Falta perfil privado com solicitação |
| 9. Feed e publicações | **Parcial.** A tela existe com momentos automáticos; publicação não existe |
| 10. Calendário visual | **Parcial.** Falta ligar a publicações, indicador de vários no dia e a aba de grid |
| 11. Stories | **Não feito** |
| 12. Segurança e moderação | **Parcial.** Falta bloqueio e denúncia |
| 13. Refinamento | **Parcial.** Falta virada de dia e uploads |

Dos testes das §78 a §87, só o **§80** (compromisso) e o **§87** (regressão em
17 rotas) foram executados de verdade.

---

## O próximo passo, e é só um

**Fase 6, fechar o reagendamento.** É o único item que não depende do banco.

No `AgendaItemSheet`, o submenu Reagendar tem "Hoje, mais tarde" e "Amanhã",
que mexem só na ocorrência, e "Escolher dia e horário", que abre o editor da
REGRA e muda todos os dias. Os três estão na mesma lista sem separação, e é o
que a §26 pede pra distinguir.

O que falta: seletor de data que mova só a ocorrência de hoje
(`setRoutineStatus` com `movedToDay`, que o banco já suporta desde a 0064), e
separar em voz alta "só hoje" de "na rotina".

---

## O que trava as fases 7 em diante

O registro de migrations do CLI está parado na **0056**. O schema de produção
está em dia (conferido tabela por tabela e função por função pela API REST), mas
`supabase_migrations.schema_migrations` não tem as linhas da 0057 à 0066, porque
elas foram aplicadas pelo SQL Editor em vez de `supabase db push`.

**Antes de escrever a migration da camada social**, rodar em `app/`:

```
npx supabase migration list
```

Se a coluna Remote parar na 0056:

```
npx supabase migration repair --status applied 0057 0058 0059 0060 0061 0062 0063 0064 0065 0066
```

Esse comando **só insere dez linhas no registro**. Não executa SQL nas tabelas.
Sem ele, um `db push` tentaria reaplicar dez migrations antigas em produção.

---

## Decisões já tomadas, não reabrir

- **Alcance social do primeiro corte:** só entre amigos aceitos. Sem comunidade,
  sem público.
- **Foco de hoje:** só o que a pessoa marcou (prioridade principal e prioridade
  alta). Rotina não entra, porque item de rotina não tem prioridade pra marcar.
- **O anel do topo:** continua medindo ação e hábito, que é o que alimenta os
  momentos da jornada e o card de compartilhar. O dia inteiro virou a linha de
  baixo do mesmo tile.
- **Rotina fora do card "Seu dia":** com a aba própria na barra, a lente e o
  atalho "Organizar rotina" saíram. Os itens de rotina continuam na lista.
- **Compromisso não é entidade nova:** é item de rotina com recorrência `unica`.

---

## Ambiente

- `VITE_CIRCLE_OPEN=true` em produção (confirmado pelo Netlify CLI).
- O login automático de dev não funciona: a senha em `.env.local` tem 8
  caracteres e a conta exige 12.
- Pra ver a interface sem login: `VITE_AUTH_BYPASS=true npx vite --port 5180`.
