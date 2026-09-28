import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AGENDA_KIND_LABELS,
  agendaLenses,
  agendaOfKind,
  isPastPlannedTime,
  openAgendaMinutes,
  type AgendaGroup,
  type AgendaItem,
  type AgendaItemKind,
  type AgendaLens,
  type DayAgenda,
} from '@/domain/entities/day-agenda'
import type { Task } from '@/domain/entities/task'
import { AgendaItemSheet } from './AgendaItemSheet'
import { ObjectiveLink } from '@/presentation/components/shared/Meta'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, ProgressBar } from '@/presentation/components/ui/Surface'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'

/**
 * Seu dia: tudo que pertence a hoje, na ordem do relógio.
 *
 * É a resposta à pergunta que a pessoa faz ao destravar o celular, e ela não
 * pode depender de navegação. Antes deste bloco, "ver tudo do dia" levava pra
 * `/app/plano` e os hábitos moravam em `/app/habitos`: o app sabia o que era
 * de hoje e mandava a pessoa somar de cabeça, em duas telas, o que falta.
 *
 * ## Nada fica escondido
 *
 * A lista mostra TODOS os itens do dia. Não há "ver mais" que esconda pendência:
 * o que existe é recolhimento por trecho do dia, e mesmo assim só quando o dia é
 * grande, e o trecho recolhido diz quantos itens tem e quantos saíram. Agrupar
 * pra caber é diferente de esconder pra parecer menor.
 *
 * ## O concluído não sai da lista
 *
 * Ele fica no lugar, riscado. Mandar o que saiu pro fim faria a lista se
 * reorganizar embaixo do dedo a cada toque, e apagaria a leitura que a linha do
 * tempo dá de graça: o que passou acima, o que vem abaixo.
 *
 * ## O horário é intenção, não cobrança
 *
 * Passou das 18:00 e o treino continua aberto, a linha diz "planejado para
 * 18:00" e segue oferecendo a mesma coisa. Não existe "atrasado" em vermelho:
 * o produto defende continuidade sem culpa, e isso é regra de tela, não de copy.
 */
export function DayAgendaCard({
  agenda,
  onStartFocus,
  onAdd,
  onOpenRoutine,
  onAddRoutine,
  onEditTask,
  onEditRoutine,
  onEditHabit,
}: {
  readonly agenda: DayAgenda
  readonly onStartFocus: (task: Task) => void
  readonly onAdd: () => void
  /** Null esconde o atalho: a Rotina pode não estar disponível na tela. */
  readonly onOpenRoutine: (() => void) | null
  /** Abre a Rotina já com o formulário de item novo. Null esconde o atalho. */
  readonly onAddRoutine: (() => void) | null
  readonly onEditTask: (task: Task) => void
  readonly onEditRoutine: (itemId: string) => void
  readonly onEditHabit: (habitId: string) => void
}) {
  const [picked, setPicked] = useState<AgendaItem | null>(null)
  const [lens, setLens] = useState<AgendaItemKind | null>(null)

  const lenses = useMemo(() => agendaLenses(agenda), [agenda])

  /*
    A lente só vale enquanto a espécie existir no dia. Marcar o último item da
    rotina não muda nada, ele continua na lista riscado, mas apagar o último
    deixaria a tela presa numa lente vazia sem nenhuma pista de como sair.
  */
  const active = lens && lenses.some((entry) => entry.kind === lens) ? lens : null
  const shown = active ? agendaOfKind(agenda, active) : agenda
  const fora = agenda.total - shown.total
  const minutes = openAgendaMinutes(shown)

  return (
    <Panel tone="raised" aria-labelledby="dia-titulo" className="edge-light">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="dia-titulo" className="text-xl font-semibold tracking-tight text-ink">
            Seu dia
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {agenda.empty
              ? 'Nada programado ainda.'
              : `${active ? `${LENS_NOTE[active]} · ` : ''}${shown.total} ${
                  shown.total === 1 ? 'item' : 'itens'
                }${minutes ? ` · cerca de ${formatMinutes(minutes)} em aberto` : ''}`}
          </p>
        </div>

        {agenda.empty ? null : (
          <div className="w-full sm:w-44">
            <div className="flex items-baseline justify-between gap-2 text-xs text-ink-faint">
              <span>Concluído</span>
              <span className="tabular text-ink-muted">
                {shown.done} de {shown.total}
              </span>
            </div>
            <ProgressBar
              className="mt-1.5"
              value={shown.ratio}
              label={`${active ? AGENDA_KIND_LABELS[active] : 'Progresso do dia'}: ${shown.done} de ${shown.total}`}
            />
          </div>
        )}
      </div>

      {agenda.empty ? (
        <EmptyDay onAdd={onAdd} onOpenRoutine={onOpenRoutine} />
      ) : (
        <>
          <LensBar lenses={lenses} active={active} agenda={agenda} onPick={setLens} />

          <div className="mt-5 flex flex-col gap-5">
            {shown.groups.map((group) => (
              <AgendaSection
                key={group.part}
                group={group}
                onOpenMenu={setPicked}
                collapsible={shown.total > 8}
              />
            ))}
          </div>

          {/*
            A lente diz em voz alta o que ficou de fora, e a volta fica ao lado.
            Um filtro que esconde pendência em silêncio é o mesmo "ver mais" que
            esta tela recusa, com outro nome.
          */}
          {active && fora > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
              <span>
                {fora} {fora === 1 ? 'item' : 'itens'} do dia fora desta lente.
              </span>
              <button
                type="button"
                onClick={() => setLens(null)}
                className="min-h-11 font-medium text-brand-ink underline-offset-4 hover:underline"
              >
                Ver o dia inteiro
              </button>
            </div>
          ) : null}

          <AgendaItemSheet
            item={picked}
            today={agenda.day}
            onClose={() => setPicked(null)}
            onStartFocus={onStartFocus}
            onEditTask={onEditTask}
            onEditRoutine={onEditRoutine}
            onEditHabit={onEditHabit}
          />

          {/*
            O rodapé segue a lente: com a rotina na frente, "adicionar" quer
            dizer adicionar À ROTINA, e não uma ação avulsa de hoje. Um botão
            que troca de destino sem trocar de nome é o jeito mais rápido de a
            pessoa criar a coisa errada duas vezes.
          */}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {active === 'rotina' && onAddRoutine ? (
              <Button size="sm" variant="secondary" onClick={onAddRoutine}>
                <Icon name="mais" className="size-4" />
                Adicionar à rotina
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={onAdd}>
                <Icon name="mais" className="size-4" />
                Adicionar ao dia
              </Button>
            )}
            {onOpenRoutine ? (
              <Button size="sm" variant="ghost" onClick={onOpenRoutine}>
                Organizar rotina
                <Icon name="seta" className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </>
      )}
    </Panel>
  )
}

/**
 * O rótulo de cada lente na frase do cabeçalho.
 *
 * "Só a rotina", e não "Rotina": a etiqueta nomeia o filtro, a frase diz que a
 * lista encolheu. É a diferença entre achar que o dia tem quatro itens e saber
 * que você está olhando quatro de doze.
 */
const LENS_NOTE: Readonly<Record<AgendaItemKind, string>> = {
  acao: 'Só as ações',
  rotina: 'Só a rotina',
  habito: 'Só os hábitos',
}

/**
 * As lentes do dia.
 *
 * A lista continua sendo UMA: a lente recorta a mesma agenda, não cria uma
 * segunda. Ela existe porque o dia mistura três espécies em ordem de relógio,
 * e "quero dar check na minha rotina agora" obrigava a caçar quatro linhas no
 * meio de doze, com a tela da Rotina a dois toques de distância.
 *
 * Ela só aparece quando o dia mistura espécie. Com uma só, os botões seriam
 * "Tudo" e "Tudo" com outro nome.
 *
 * A contagem vive na própria etiqueta porque é ela que faz decidir se vale
 * tocar: "Rotina 4/7" já responde onde está o que falta, sem abrir nada.
 */
function LensBar({
  lenses,
  active,
  agenda,
  onPick,
}: {
  readonly lenses: readonly AgendaLens[]
  readonly active: AgendaItemKind | null
  readonly agenda: DayAgenda
  readonly onPick: (kind: AgendaItemKind | null) => void
}) {
  if (lenses.length < 2) return null

  return (
    <div role="group" aria-label="Lente do dia" className="mt-4 flex flex-wrap gap-1.5">
      <LensChip
        label="Tudo"
        done={agenda.done}
        total={agenda.total}
        active={active === null}
        onClick={() => onPick(null)}
      />
      {lenses.map((lens) => (
        <LensChip
          key={lens.kind}
          label={lens.label}
          done={lens.done}
          total={lens.total}
          active={active === lens.kind}
          onClick={() => onPick(active === lens.kind ? null : lens.kind)}
        />
      ))}
    </div>
  )
}

function LensChip({
  label,
  done,
  total,
  active,
  onClick,
}: {
  readonly label: string
  readonly done: number
  readonly total: number
  readonly active: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'relative flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors',
        // Mesma conta do check: 36px desenhados, 44px de toque. A etiqueta alta
        // empurrava a lista pra baixo numa tela de 390px, e a fileira quebrava
        // em duas linhas antes da primeira pendência aparecer.
        "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        active
          ? 'border-brand bg-brand-dim/70 text-brand-ink'
          : 'border-line text-ink-muted hover:text-ink active:bg-surface-hi',
      )}
    >
      {label}
      <span className={cn('tabular', active ? 'text-brand-ink/70' : 'text-ink-faint')}>
        {done}/{total}
      </span>
    </button>
  )
}

/**
 * O dia vazio não é uma tela fria: é um convite com uma saída.
 *
 * Quem abre o app sem nada programado não precisa de um aviso de que está
 * vazio, precisa do caminho mais curto pra deixar de estar.
 */
function EmptyDay({
  onAdd,
  onOpenRoutine,
}: {
  readonly onAdd: () => void
  readonly onOpenRoutine: (() => void) | null
}) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-line-hi px-4 py-6 text-center">
      <p className="text-sm font-medium text-ink">Vamos organizar seu dia?</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-ink-muted">
        Coloca aqui as coisas que fazem parte do teu dia, e o Momentumm mostra o que importa a
        cada manhã.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {onOpenRoutine ? (
          <Button size="sm" onClick={onOpenRoutine}>
            <Icon name="calendario" className="size-4" />
            Criar minha rotina
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" onClick={onAdd}>
          <Icon name="mais" className="size-4" />
          Adicionar ao dia
        </Button>
      </div>
    </div>
  )
}

/**
 * Um trecho do dia.
 *
 * Recolher só entra quando o dia passa de oito itens, e o cabeçalho continua
 * dizendo o tamanho do trecho fechado. Um dia de cinco itens recolhido seria
 * esconder trabalho pra a tela parecer arrumada.
 */
function AgendaSection({
  group,
  onOpenMenu,
  collapsible,
}: {
  readonly group: AgendaGroup
  readonly onOpenMenu: (item: AgendaItem) => void
  readonly collapsible: boolean
}) {
  // Trecho já cumprido nasce fechado num dia grande: ele é histórico do dia, e
  // o que interessa às nove da manhã é o que vem depois.
  const [open, setOpen] = useState(!collapsible || group.done < group.total)
  const titleId = `dia-trecho-${group.part}`

  const header = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <h3
        id={titleId}
        className="text-[0.6875rem] font-medium tracking-[0.12em] text-ink-faint uppercase"
      >
        {group.label}
      </h3>
      <span className="tabular text-[0.6875rem] text-ink-faint">
        {group.done} de {group.total}
      </span>
    </div>
  )

  return (
    <section aria-labelledby={titleId}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={`${titleId}-lista`}
          className="flex min-h-11 w-full items-center gap-2 text-left"
        >
          {header}
          <Icon
            name="seta"
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0 text-ink-faint transition-transform duration-200',
              open ? '-rotate-90' : 'rotate-90',
            )}
          />
        </button>
      ) : (
        <div className="flex min-h-6 items-center">{header}</div>
      )}

      {open ? (
        <ul id={`${titleId}-lista`} className="mt-1.5 flex flex-col">
          {group.items.map((item) => (
            <AgendaRow key={item.key} item={item} onOpenMenu={onOpenMenu} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/**
 * Uma linha do dia.
 *
 * A coluna da esquerda é o relógio, e é ela que dá a leitura de linha do tempo
 * sem desenhar uma. Item sem horário mostra um traço no lugar da hora: a coluna
 * continua alinhada, e a ausência fica visível em vez de deslocar a lista.
 */
function AgendaRow({
  item,
  onOpenMenu,
}: {
  readonly item: AgendaItem
  readonly onOpenMenu: (item: AgendaItem) => void
}) {
  const planner = usePlanner()
  const reduceMotion = useReducedMotion()
  const [busy, setBusy] = useState(false)

  const objective = planner.objectives.find((entry) => entry.id === item.objectiveId)
  const late = isPastPlannedTime(item, new Date())
  const resolved = item.done || item.skipped

  const toggle = async () => {
    setBusy(true)
    try {
      if (item.task) {
        await planner.setTaskDone(item.task.id, !item.done)
      } else if (item.habitState) {
        await planner.setHabitStatus(item.habitState.habit.id, item.done ? 'pendente' : 'feito')
      } else if (item.routineState) {
        /*
          A MESMA ocorrência que a tela de Rotina escreve.

          Não existe estado paralelo: marcar aqui e marcar lá são a mesma linha
          (item, dia), e é por isso que as duas telas nunca discordam. Se isto
          aqui gravasse um registro próprio do dashboard, a sincronia viraria
          trabalho de alguém lembrar de fazer nos dois lados.
        */
        await planner.setRoutineStatus(item.routineState.item.id, {
          status: item.done ? 'pendente' : 'feito',
          plannedTime: item.time,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-start gap-3 border-t border-line py-2.5 first:border-t-0">
      {/*
        A coluna do relógio dá a leitura de linha do tempo sem desenhar uma.
        Item sem horário mostra um traço: a coluna continua alinhada, e a
        ausência fica visível em vez de deslocar a lista.

        Ela é estreita de propósito. Numa tela de 390px, cada pixel gasto aqui
        sai do título, e título que quebra em duas linhas transforma uma lista
        de oito itens numa rolagem de dezesseis.
      */}
      <span
        className={cn(
          'tabular mt-0.5 w-10 shrink-0 text-right text-[0.6875rem] leading-5',
          item.done ? 'text-ink-faint' : 'text-ink-muted',
        )}
      >
        {item.time ?? <span aria-hidden="true">·</span>}
        {item.time ? null : <span className="sr-only">Sem horário definido</span>}
      </span>

      {/*
        Alvo de 44px no polegar: é a única ação da tela que a pessoa repete
        várias vezes por dia. O quadrado desenhado tem 24px; os 44px são de
        toque, e por isso moram num pseudo-elemento, que cresce sem empurrar o
        título nem mexer na altura da linha.
      */}
      <motion.button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        {...(reduceMotion ? {} : { whileTap: { scale: 0.88 } })}
        aria-label={item.done ? `Desfazer ${item.title}` : `Concluir ${item.title}`}
        className={cn(
          'relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition-colors',
          // 44px de alvo real sem mexer no desenho: o quadrado continua com 24px
          // e a área de toque cresce por fora dele, que é onde o polegar erra numa
          // lista de doze linhas.
          "before:absolute before:-inset-2.5 before:content-['']",
          item.done
            ? 'border-positive bg-positive/20 text-positive'
            : 'border-line-hi text-transparent hover:border-brand',
        )}
        /*
          A cor do eixo vive na borda do próprio check, e não numa faixa ao
          lado. A faixa era um terceiro elemento colorido na mesma linha, ao
          lado do ponto do objetivo, e roubava a largura que o título precisa.
        */
        {...(!item.done && item.axisColor
          ? { style: { borderColor: item.axisColor } }
          : {})}
      >
        <Icon name="check" className="size-4" strokeWidth={2.5} />
      </motion.button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[0.95rem] font-medium text-pretty',
            resolved ? 'text-ink-faint line-through' : 'text-ink',
          )}
        >
          {item.title}
        </p>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          <span className={item.isMainPriority ? 'text-brand-ink' : undefined}>{item.role}</span>
          {/*
            O papel do hábito já carrega o alvo ("Hábito · 20 minutos"), então
            repetir os minutos ao lado seria a mesma informação duas vezes na
            mesma linha. A ação não tem alvo, e aí o tempo é a única pista de
            tamanho que ela dá.
          */}
          {item.kind === 'acao' && item.minutes ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{item.minutes} min</span>
            </>
          ) : null}
          {objective ? (
            <>
              <span aria-hidden="true">·</span>
              <ObjectiveLink objective={objective} />
            </>
          ) : null}
          {late ? (
            <>
              <span aria-hidden="true">·</span>
              {/* Sem "atrasado": o horário é intenção, e a frase diz o fato. */}
              <span>Planejado para {item.time}</span>
            </>
          ) : null}
        </div>
      </div>

      {/*
        Um alvo só no fim da linha, e não três.

        Começar, versão mínima e adiar eram três ícones de 44px numa tela de
        390px: 132px que saíam do título, e ainda assim faltava lugar pra
        reagendar, pular e editar. O menu devolve a largura ao texto e cabe o
        resto, com o mesmo toque.
      */}
      <button
        type="button"
        onClick={() => onOpenMenu(item)}
        aria-haspopup="dialog"
        className="-mr-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:text-ink active:bg-surface-hi active:text-ink"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ⋯
        </span>
        <span className="sr-only">Opções de {item.title}</span>
      </button>
    </li>
  )
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h${String(minutes).padStart(2, '0')}`
}
