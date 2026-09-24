import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'

/**
 * A aba de Objetivos antes do primeiro objetivo.
 *
 * O estado vazio era uma caixa tracejada com duas frases e um botão. Honesto e
 * inerte: ele diz que não há nada, e a pessoa já sabia disso — foi ela que
 * chegou numa tela vazia.
 *
 * O que falta a quem nunca criou um objetivo não é o botão, é saber COMO é um.
 * Por isso o exemplo aparece montado, com a mesma cara de um objetivo de
 * verdade: título, prazo, etapas. Ver a coisa pronta é o que transforma "criar
 * objetivo" de tarefa abstrata em preencher três campos.
 *
 * Os exemplos não são clicáveis de propósito: cada pessoa chega com o objetivo
 * dela na cabeça, e um botão que copia o exemplo faria a tela encher de metas
 * que ninguém quer cumprir.
 */
export function ObjectivesEmpty({ onCreate }: { readonly onCreate: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel tone="brand" className="p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-dim/60 text-brand-ink">
          <Icon name="objetivo" className="size-6" />
        </span>

        <h2 className="mt-4 text-xl font-semibold tracking-tight text-balance text-ink">
          O que você quer que seja diferente daqui a três meses?
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-pretty text-ink-muted">
          Um objetivo com prazo vira plano: o Momentumm quebra em etapas, sugere o hábito que
          sustenta e coloca a primeira ação no seu dia.
        </p>

        <Button size="lg" className="mt-5" onClick={onCreate}>
          <Icon name="mais" className="size-4" />
          Criar meu primeiro objetivo
        </Button>

        <p className="mt-3 text-xs text-ink-faint">Leva um minuto. Dá pra mudar depois.</p>
      </Panel>

      <section aria-label="Exemplos de objetivo">
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-faint uppercase">
          Como um objetivo se parece
        </p>
        <ul className="flex flex-col gap-2">
          {EXEMPLOS.map((exemplo) => (
            <li
              key={exemplo.titulo}
              className="rounded-xl border border-dashed border-line px-4 py-3"
            >
              <p className="text-sm font-medium text-ink-muted">{exemplo.titulo}</p>
              <p className="mt-0.5 text-xs text-ink-faint">{exemplo.detalhe}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/**
 * Três exemplos de áreas diferentes, com número e prazo.
 *
 * Todos seguem a mesma forma — verbo, quantidade, prazo — porque é essa forma
 * que o produto sabe transformar em plano. "Ler mais" não vira etapa nenhuma;
 * "ler 6 livros até dezembro" vira seis.
 */
const EXEMPLOS: readonly { readonly titulo: string; readonly detalhe: string }[] = [
  { titulo: 'Ler 6 livros até o fim do trimestre', detalhe: 'Leitura · 90 dias · 20 páginas por dia' },
  { titulo: 'Correr 10 km sem parar', detalhe: 'Treino · 60 dias · 3 sessões por semana' },
  { titulo: 'Terminar o curso de arquitetura', detalhe: 'Estudo · 70 dias · 30 minutos por dia' },
]
