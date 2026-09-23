# Links do quiz

O quiz vive em `/criar-meu-plano`, mas **ninguém precisa digitar isso**. O link
que circula é o curto:

```
momentumm.com.br/plano
```

Esse é o link genérico: bio, story, conversa solta, qualquer lugar em que a
origem não importa.

## O link por assunto

Quando o link vai numa resposta de comentário ou num direct, ele leva um código
no fim. O código faz duas coisas ao mesmo tempo:

1. **Troca o título do quiz** pra continuar a conversa do post. Quem comentou
   num post sobre procrastinação abre o quiz em "Pare de adiar. Comece com um
   passo que cabe hoje.", não na copy genérica.
2. **Marca a origem** (rede, assunto e canal) no funil, sem você montar `utm_`
   nenhum na mão. O resultado aparece em `/admin/funil`, por origem e por tema.

### Instagram

| Assunto do post | Link |
| --- | --- |
| Adiar, procrastinação | `momentumm.com.br/plano/ig-proc` |
| Recomeçar toda segunda | `momentumm.com.br/plano/ig-const` |
| Falta de tempo | `momentumm.com.br/plano/ig-tempo` |
| Não saber por onde começar | `momentumm.com.br/plano/ig-comeco` |
| Fazer coisa demais ao mesmo tempo | `momentumm.com.br/plano/ig-foco` |
| Link da bio (copy padrão) | `momentumm.com.br/plano/ig-bio` |

### TikTok

| Assunto do vídeo | Link |
| --- | --- |
| Adiar, procrastinação | `momentumm.com.br/plano/tt-proc` |
| Recomeçar toda segunda | `momentumm.com.br/plano/tt-const` |
| Falta de tempo | `momentumm.com.br/plano/tt-tempo` |
| Não saber por onde começar | `momentumm.com.br/plano/tt-comeco` |
| Fazer coisa demais ao mesmo tempo | `momentumm.com.br/plano/tt-foco` |
| Link do perfil (copy padrão) | `momentumm.com.br/plano/tt-bio` |

## Comentário ou direct

O link acima já é o do **comentário** — é o caso em que a URL fica visível pra
todo mundo, então ele não leva parâmetro nenhum.

Quando você manda o mesmo link no **direct**, acrescenta `?c=dm`:

```
momentumm.com.br/plano/ig-proc?c=dm
```

É a mesma página; o que muda é que o funil passa a separar quem veio do
comentário de quem veio da conversa no direct. Sem isso, os dois caem no mesmo
balde e não dá pra saber qual dos dois caminhos converte.

Canais válidos: `?c=dm` (direct), `?c=bio` (link da bio) e nada (comentário,
que é o padrão).

## O que fazer quando errar o link

Nada quebra. Código que não existe abre o quiz normal, com a copy padrão e sem
origem — um link errado numa campanha nunca vira página de erro. O que você
perde é só a marcação daquele envio.

## Criar um código novo

Os códigos vivem em `app/src/domain/analytics/quiz-links.ts`. Uma linha nova na
tabela `QUIZ_LINK_CODES` já cria o link, e o teste garante que o tema apontado
existe e que o código é curto o bastante pra caber num comentário.

O tema (`theme`) precisa ser um dos cinco que o quiz conhece: `procrastinacao`,
`constancia`, `tempo`, `comeco`, `foco`. Com `theme: null` o quiz abre com a
copy padrão, o que é o certo pra link de bio — ali a pessoa não vem de um
assunto específico.

## Onde ver o resultado

`/admin/funil`: visitas, quiz concluído, contato deixado, cadastro, plano
ativado, primeira ação, trial e assinatura. O painel quebra por **origem**
(`utm_source`) e por **tema**, que é exatamente o que os códigos preenchem.
`/admin/contatos` lista quem deixou nome e e-mail, mesmo sem ter criado conta.
