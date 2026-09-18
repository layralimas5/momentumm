# Prompt pro Lovable: landing page do Momentumm

Cola o bloco abaixo inteiro no Lovable, numa mensagem só. Depois que ele gerar, os
pontos marcados como `[DADO REAL]` são substituídos aqui no repositório na hora de
vincular (preços, limites, capturas de tela, links de cadastro).

---

## PROMPT

Crie a landing page de um SaaS chamado **Momentumm**, um sistema de progresso pessoal que transforma um objetivo com prazo em um plano por etapas, ações diárias e um score de ritmo. Não é um app de hábitos nem uma agenda: é um sistema que percebe quando o plano parou de funcionar e ajusta. O público é brasileiro, adulto, que já tentou app de hábitos e abandonou. Todo o texto em português do Brasil, tom direto, frases curtas, sem clichê motivacional, sem exclamação. Nunca use travessão no texto: use vírgula, ponto, dois pontos ou parênteses.

### Stack e regras técnicas

- React 18 + Vite + TypeScript strict + Tailwind CSS. Framer Motion pra animações. Nada de shadcn ou biblioteca de UI: componentes próprios, pequenos, em `src/components/landing/`.
- Uma página só (`/`), com âncoras `#metodo`, `#telas`, `#score`, `#planos`, `#duvidas`.
- Mobile-first, testada em 360, 390, 430, 768, 1024 e 1440 px. Nenhuma rolagem horizontal em nenhuma largura. Grid que reduz colunas sozinho, componentes lado a lado que empilham, textos longos que quebram.
- Acessibilidade AA: HTML semântico, um `h1`, foco visível, `aria-label` em botões só com ícone, contraste mínimo 4.5:1 em texto, `prefers-reduced-motion` desliga toda animação de entrada e esteira.
- Performance: imagens com `loading="lazy"` e `width/height` declarados, sem fonte externa pesada, sem vídeo autoplay. LCP é o título do hero.
- Todo texto e número que aparece na página mora em um arquivo `src/content/landing.ts` exportando objetos tipados (hero, problema, método, telas, score, ia, planos, faq, cta). Os componentes só leem daí. É por esse arquivo que os dados reais entram depois.
- Links dos CTAs: primário `/entrar`, secundário `/app`. Não invente rotas.

### Identidade visual

Tema escuro único, sem modo claro. Referência de qualidade: Linear, Raycast, Vercel. Minimalista, muito espaço em branco (aqui, em preto), hierarquia forte, nada de gradiente saturado ocupando seção inteira.

Tokens (usar como CSS custom properties e no `tailwind.config`):

```
--canvas:      #0a0a0b   fundo da página
--surface:     #121214   cards
--surface-hi:  #1a1a1e   card elevado, hover
--line:        #232328   bordas
--line-hi:     #2e2e35   borda em hover/foco
--ink:         #f4f4f5   texto principal
--ink-muted:   #a1a1aa   texto de apoio
--ink-faint:   #8b8b96   legenda (passa AA sobre --surface)
--brand:       #6d5cff   roxo da marca
--brand-hi:    #8878ff   roxo claro (links, ícones ativos)
--brand-dim:   #2a2450   roxo bem escuro (fundo de destaque)
--brand-deep:  #4b3fd6   roxo profundo
--brand-ink:   #cfc7ff   texto sobre fundo roxo escuro
--flame:       #ff6b35   laranja, só pra sequência de dias
--positive:    #3ecf8e   verde de confirmação
--radius-card: 16px
```

Tipografia: fonte do sistema (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). Títulos com `tracking-tight`, peso 600. Escala: h1 `clamp(2.25rem, 5vw, 4rem)`, h2 `clamp(1.75rem, 3vw, 2.5rem)`, corpo 16px, apoio 14px, legenda 12px. Números sempre com `font-variant-numeric: tabular-nums`.

Regras visuais duras:
- Fundo das seções alterna entre `--canvas` e `--surface`. Só UMA seção pode ter fundo roxo escuro (`--brand-dim`), e é a das telas (`#telas`). Nunca um gradiente roxo vivo de ponta a ponta.
- Botão primário: fundo `--brand`, texto branco, `rounded-full`, altura 48px, hover `--brand-hi`. Botão secundário: borda `--line-hi`, fundo transparente, texto `--ink`.
- Cards: fundo `--surface`, borda 1px `--line`, raio 16px, padding 24px. Sem sombra colorida, sem glow, exceto no card do plano PRO.
- Ícones: traço fino (Lucide), 20px, cor `--ink-muted`; em estado ativo, `--brand-hi`.
- Animações: entrada com fade + 12px de subida, 0.5s, `cubic-bezier(0.22, 1, 0.36, 1)`, disparada quando a seção entra na tela, uma vez só. Nada que se repita em loop, exceto a esteira de áreas no hero.
- Proibido: depoimentos inventados, fotos de pessoas de banco de imagem, contadores de "usuários ativos", estrelas de avaliação, selos falsos, popup, chat flutuante, vídeo de fundo, gradiente animado, partículas, cursor customizado.

### Estrutura, seção por seção

**0. Header fixo.** Altura 64px, fundo `--canvas` com 90% de opacidade e `backdrop-blur`. Esquerda: wordmark "MOMENTUMM" em caixa alta com `letter-spacing: 0.35em`, peso 500, 13px, com as duas últimas letras em `--brand-hi` (é assim que a marca é escrita). Centro (só desktop): links Método, Por dentro, Score, Planos, Dúvidas. Direita: "Entrar" (texto) e "Começar grátis" (botão primário, altura 40px). No mobile, menu hambúrguer abrindo um painel de tela cheia com os mesmos links e os dois botões empilhados.

**1. Hero.** Fundo `--canvas`. Centralizado, largura máxima 880px. Em cima, uma etiqueta pequena em pílula com borda: "7 dias de PRO grátis, sem cartão". Título em duas linhas, a segunda em `--brand-hi`:

> Objetivo vira plano.
> Plano vira o que você faz hoje.

Subtítulo (18px, `--ink-muted`, máximo 560px): "O Momentumm transforma um objetivo com prazo em ações diárias, mede se o seu ritmo está de pé e ajusta o plano quando ele deixa de funcionar."

Dois botões lado a lado (empilhados no mobile): "Começar grátis" (primário) e "Ver por dentro, sem criar conta" (secundário, com ícone de seta). Abaixo, uma linha de 14px em `--ink-faint`: "Grátis, sem cartão, com 7 dias de PRO. O primeiro plano fica pronto em dois minutos."

Abaixo dos botões, um mockup de celular (moldura escura, cantos 40px, largura 300px) mostrando a tela "Hoje" do app. Use a imagem `[DADO REAL] /telas/hoje.webp` (780×1688); enquanto não existir, um placeholder cinza com o texto "tela Hoje". Ao redor do celular, no desktop, dois cards flutuantes pequenos e levemente inclinados (-4° e 3°): um com "Momentumm 72" e a etiqueta "Constante", outro com "Sequência: 12 dias" e o ícone de chama em `--flame`. No mobile os cards somem.

No rodapé do hero, uma esteira horizontal infinita rolando pra esquerda (60s por volta, pausa em `prefers-reduced-motion`), com fade nas bordas, mostrando as áreas que o app atende, cada uma com ícone: Estudo, Leitura, Treino, Meditação, Concurso, Projeto pessoal, Idioma, Carreira, Finanças. Acima da esteira, em 14px: "Serve pra qualquer objetivo com prazo".

**2. Problema.** Fundo `--surface`. Eyebrow em caixa alta 12px `--brand-hi`: "O PADRÃO". Título: "Você não tem um problema de motivação. Tem um problema de sistema." Três cards em linha (empilham no mobile), cada um com uma etiqueta de dia em cima:

- **Dia 1. A motivação monta o plano.** Objetivo novo, lista cheia, hábito pra todo dia. O plano é do tamanho da empolgação, não do tamanho da semana.
- **Dia 12. O dia real não cabe no plano.** Uma noite ruim, uma reunião a mais. A lista de hoje vira dívida de amanhã, e amanhã já tinha a lista dele.
- **Dia 30. O app é fechado, o objetivo fica.** Não por preguiça: porque a ferramenta só sabia cobrar o plano ideal. Ela nunca percebeu que ele tinha parado de funcionar.

Fechamento em uma linha, centralizado: "O Momentumm foi feito pra perceber isso no dia 12, não no dia 30."

**3. Método (`#metodo`).** Fundo `--canvas`. Eyebrow: "COMO FUNCIONA". Título: "Um ciclo, não uma coleção de recursos." Uma linha do tempo vertical no centro (desktop) ou à esquerda (mobile), com seis nós circulares de 48px, borda `--brand` 50%, ícone dentro. Ao passar o mouse, o nó preenche com `--brand`, o ícone fica branco e o nó dá um pulso curto (escala 1 → 1.14 → 1.06 em 0.55s). Os passos, alternando lado a lado no desktop:

1. **Objetivo.** O que você quer alcançar, com alvo e prazo.
2. **Plano.** Etapas com peso, que somam 100% do objetivo.
3. **Ações do Hoje.** Uma prioridade principal por dia, com versão mínima.
4. **Progresso.** Quanto do objetivo andou de verdade, e onde travou.
5. **Review.** A semana em números, onde evoluiu e onde o ritmo caiu.
6. **Ajuste.** Cada leitura vem com o botão que a resolve.

Cada passo tem "Passo 01" em 12px `--brand-hi` acima do título.

**4. Por dentro (`#telas`).** Única seção com fundo `--brand-dim`, texto `--ink` e `--brand-ink`. Eyebrow: "POR DENTRO". Título: "Sete telas. Um exemplo só atravessa todas." Descrição: "O mesmo objetivo visto do dia, do plano, do progresso e do review. Nenhum número aparece diferente em duas telas."

Abas em pílula (rolagem horizontal no mobile): Hoje, Objetivos, Hábitos, Plano, Progresso, Review semanal, Meu perfil. Aba ativa: fundo branco, texto `--brand-deep`. Navegação por teclado com setas. Abaixo, duas colunas (empilham no mobile, celular primeiro): à esquerda o texto da aba (título, descrição, três pontos com ícone de check), à direita o mockup de celular com a imagem `[DADO REAL] /telas/<aba>.webp`. Troca de aba com fade de 0.25s.

Textos das abas:
- **Hoje.** "O que fazer agora, e o que muda quando o dia não sai como planejado." Pontos: check-in de dez segundos que define a capacidade do dia; uma prioridade principal, sempre com versão mínima; Dia Adaptável: você diz quanto tempo tem e o plano encolhe.
- **Objetivos.** "Um objetivo com alvo, prazo e progresso real." Pontos: progresso vem do que você registrou, não do que marcou; pausar e retomar sem perder histórico; até dois ativos no gratuito, sem limite no PRO.
- **Hábitos.** "A repetição que segura o plano. Versão mínima conta." Pontos: hábito de verdade (treinar, ler, meditar), separado do objetivo; versão mínima pra dia ruim, que mantém a sequência viva; consistência em 14 dias.
- **Plano.** "Etapas com peso, e as ações de cada uma." Pontos: cada etapa tem quanto vale do objetivo; ações nascem dentro da etapa, com data; a IA monta o primeiro plano a partir do objetivo.
- **Progresso.** "Se o seu ritmo está de pé, o que caiu e qual é o próximo ajuste." Pontos: número, classificação e variação contra a semana anterior; onde você avançou e o que precisa de atenção; o próximo ajuste, com o botão que executa.
- **Review semanal.** "O que a semana mostrou e o que muda na próxima." Pontos: não cobra dias anteriores à criação do hábito; prioridades da semana seguinte saem do review; fica separado do dia.
- **Meu perfil.** "O quanto você mudou desde que começou." Pontos: capa e status do momento, do seu jeito ("🔥 Semana de foco"); nível e XP crescem com dias de movimento, não com volume; compartilhe o Momentumm em card de story.

No fim da seção, centralizado: "Quer ver essas telas com o seu objetivo?" e o botão "Começar grátis" em branco com texto `--brand-deep`.

**5. Momentumm Score (`#score`).** Fundo `--canvas`. Eyebrow: "MOMENTUMM SCORE". Título: "Um número que mede ritmo, não o seu valor." Descrição: "De 0 a 100, o Momentumm diz se você está avançando, constante, retomando ou desacelerando. Ele olha 28 dias, dá peso triplo à semana atual e nunca zera por um dia perdido."

Layout em duas colunas. Esquerda: um card grande com o número "72" em 96px, a etiqueta "Constante" em pílula, "+4 esta semana" em `--positive`, e abaixo quatro barras horizontais com rótulo e porcentagem: Consistência recente 68%, Execução das prioridades 80%, Progresso nos objetivos 55%, Capacidade de retomada 90%. Abaixo das barras, um mini gráfico de linha de 14 dias (SVG inline, sem biblioteca) onde a linha cai num dia e volta em dois, com o ponto do dia perdido marcado. Legenda: "Dia 9: dia perdido. Dia 11: de volta."

Direita: quatro blocos curtos com título e texto:
- **Olha 28 dias, com a semana atual pesando o triplo.** Sete dias sozinhos viram termômetro de humor: uma gripe apaga um mês. Um mês sozinho não reage ao que você mudou hoje.
- **Falhar um dia custa pouco e nunca zera.** Um dia vazio é um dia sem crédito, não um zero na conta.
- **Conta impacto, não quantidade.** A prioridade do dia vale 3, a ação de objetivo vale 2, a tarefa comum vale 1. Hábito tem teto.
- **Voltar rápido devolve a nota.** Retomar em até dois dias devolve nota cheia no fator de retomada.

**6. Momentumm AI.** Fundo `--surface`. Eyebrow: "MOMENTUMM AI". Título: "A IA que conhece o seu plano, não uma que responde qualquer coisa." Descrição: "Ela lê o que você já colocou no app e devolve plano, leitura de progresso e review. Toda sugestão vira uma prévia que você edita antes de salvar."

Mostrar como demonstração, não como lista: um card no formato de conversa com três trocas. Cada troca tem, à esquerda, "Você" e o que a pessoa dá; à direita, "Momentumm AI" e o que volta, em card com borda `--brand` 30%.

1. Você: "Quero ler 6 livros até dezembro. Tenho 30 minutos por dia, de segunda a sexta." → AI: "Plano em 3 etapas. Etapa 1 (até 15/10): livros 1 e 2, 20 páginas por sessão. Primeira ação hoje: abrir o livro e ler a primeira sessão. Se o prazo apertar, a etapa 3 encolhe pra 1 livro."
2. Você: (nada, a IA lê o progresso) → AI: "Você apareceu em 5 dos últimos 7 dias, mas a prioridade do dia ficou aberta em 3 deles. O gargalo é o horário: as sessões de noite não saem. Próxima ação: mover a leitura pra manhã de terça."
3. Você: "Semana difícil, entreguei menos." → AI: "Execução de 60%, 4 dias ativos. Dois dias com versão mínima, que contam. Recomendação pra próxima semana: manter 20 páginas e cortar a ação extra de sábado."

Abaixo do card, uma linha em 14px `--ink-faint`: "A chave da IA fica no servidor. Nada roda no seu navegador, e nenhum texto seu treina modelo."

**7. Por que confiar.** Fundo `--canvas`. Eyebrow: "POR QUE CONFIAR". Título: "O que sustenta a promessa." Quatro cards em grade 2×2 (1 coluna no mobile), cada um com ícone, título e duas linhas:
- **Sem cartão pra testar.** 7 dias de PRO em toda conta nova. No fim, volta pro gratuito sozinho e nada é apagado.
- **Cancela quando quiser.** Um clique, sem ligação. O PRO continua até o fim do período pago.
- **Seus dados são seus.** Privado por padrão. Exporta tudo em JSON a qualquer hora, apaga a conta quando quiser.
- **Feito no Brasil, por uma pessoa.** Suporte direto com quem construiu. `[DADO REAL] e-mail de contato`.

Sem números de usuários, sem depoimentos.

**8. Planos (`#planos`).** Fundo `--surface`. Eyebrow: "PLANOS". Título: "O gratuito organiza e executa. O PRO registra, analisa e evolui." Um seletor Mensal / Anual em pílula (Anual com a etiqueta "metade do preço"). Dois cards lado a lado (empilham no mobile), o PRO com borda `--brand` e um glow discreto.

Card FREE: etiqueta "FREE", título "Organize e execute", preço "R$ 0" e "para sempre", selo verde "7 dias de PRO inclusos". Descrição: "Toda conta nova começa com 7 dias de PRO completo, sem cartão. Depois, o gratuito segue pra sempre." Lista com check: 7 dias com tudo do PRO ao criar a conta; até 2 objetivos ativos e 5 hábitos ativos; 1 plano ativo por etapas; até 5 ações por dia; histórico dos últimos 15 dias; Momentumm Score de hoje; check-in semanal manual; Dia Adaptável e Modo Retomada. Botão secundário "Começar grátis".

Card PRO: etiqueta "PRO" com raio, título "Registre, analise e evolua". Preço `[DADO REAL]`: mensal R$ 39,90/mês (de R$ 79,90); anual R$ 179,90/ano (de R$ 358,80, "equivale a R$ 14,99/mês", selo "Economize R$ 178,90"). Descrição: "Entender os próprios padrões, registrar a jornada, ver as métricas e ajustar o plano com a leitura da IA." Lista: tudo do gratuito, sem limite de quantidade; histórico completo; Momentumm Score com evolução e detalhamento; review semanal cruzando os seus dados reais; Momentumm AI com franquia mensal; métricas e relatórios semanais e mensais; registros em texto, foto e voz; compartilhamento com todos os modelos e exportação. Botão primário "Testar o PRO por 7 dias". Linha abaixo: "Sem cartão no teste. Cancela quando quiser."

Abaixo dos cards, um link "Ver a comparação completa dos planos" que abre uma tabela simples (feature × Free × PRO) com rolagem horizontal própria no mobile.

**9. Dúvidas (`#duvidas`).** Fundo `--canvas`. Título: "O que perguntam antes de começar". Acordeão acessível (`button` + `aria-expanded`, um aberto por vez), oito itens:
1. Como o Momentumm funciona no dia a dia?
2. Quanto tempo por dia isso toma?
3. Qual a diferença pra um app de hábitos, uma agenda ou o Notion?
4. E se eu perder um dia? Perco tudo?
5. O que tem no plano gratuito e o que muda no PRO?
6. Preciso de cartão pra experimentar o PRO? (Resposta: "Não. Toda conta nova começa com 7 dias de PRO completo, sem cartão e sem cobrança automática. No fim, a conta volta pro gratuito sozinha: nada é apagado. Se assinar durante o teste, o PRO segue sem interrupção.")
7. Como a IA usa os meus dados?
8. Posso cancelar quando quiser?

Escreva as outras respostas em 2 a 3 frases, coerentes com tudo acima, sem prometer nada que não esteja nesta spec.

**10. CTA final.** Fundo `--surface`, centralizado. Título: "Você não precisa resolver o objetivo inteiro hoje." Subtítulo: "Precisa da próxima ação. O Momentumm cuida do resto." Botões "Começar grátis" e "Ver por dentro, sem criar conta", e a linha "Grátis, sem cartão, com 7 dias de PRO."

**11. Rodapé.** Três colunas (empilham): Produto (Método, Por dentro, Score, Planos, Dúvidas), Recursos (Ferramentas grátis, Entrar), Legal (Termos de uso, Política de privacidade). Abaixo, wordmark pequena, "© Momentumm" e `[DADO REAL] e-mail de contato`. Sem redes sociais inventadas.

### Entrega

- `src/content/landing.ts` com todo o texto.
- Um componente por seção em `src/components/landing/`, mais `Container`, `Section`, `SectionHeading`, `Button`, `PhoneMockup`, `Marquee`, `Accordion`, `Tabs`.
- `README` curto dizendo onde trocar cada `[DADO REAL]`.
- Nenhum `any`, nenhum warning de lint, nenhuma rolagem horizontal em 360 px.

---

## Como vincular depois (aqui no repositório)

1. Copiar `src/components/landing/*` do Lovable pra `app/src/presentation/components/landing/` (substituindo os atuais) e `src/content/landing.ts` pra `app/src/presentation/components/landing/content.ts`.
2. Trocar cada `[DADO REAL]`:
   - preços: `PRO_PRICES` de `domain/billing/billing-plans.ts`
   - limites do gratuito: `PLAN_LIMITS.free` de `domain/entities/plan.ts`
   - dias de teste: `TRIAL_DAYS` de `domain/billing/trial.ts`
   - telas: já existem em `app/public/telas/*.webp`
   - e-mail: `SITE.contactEmail` em `site.ts`
3. Manter `SiteHeader`, `SiteFooter`, `StickyCta` atuais se o Lovable não superar (têm rotas, menu mobile e acessibilidade testados).
4. Rodar `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit` e a varredura de overflow em 320 a 1440 px antes de publicar.
