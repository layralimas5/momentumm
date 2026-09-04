import { BUILTIN_ACTIVITY_TYPES } from '@/domain/entities/activity-type'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * Grade de prova social (as 12 fotos da referência). Como ainda não existem
 * usuários reais pra fotografar, cada bloco é um recorte de tela do produto,
 * não foto de banco de imagem fingindo ser comunidade.
 */

type Tile =
  | { kind: 'record'; axis: keyof typeof BUILTIN_ACTIVITY_TYPES; value: string; note: string }
  | { kind: 'streak'; days: number }
  | { kind: 'goal'; label: string; done: string; percent: number }
  | { kind: 'quote'; text: string }

const TILES: readonly Tile[] = [
  { kind: 'record', axis: 'leitura', value: '32 páginas', note: 'Hábitos Atômicos, cap. 4' },
  { kind: 'streak', days: 18 },
  { kind: 'goal', label: 'Treino', done: '150 de 150 min', percent: 100 },
  { kind: 'quote', text: 'Dez minutos contam. Zero não.' },
  { kind: 'record', axis: 'treino', value: '45 minutos', note: 'Perna, sem vontade e foi' },
  { kind: 'goal', label: 'Leitura', done: '26 de 20 páginas', percent: 100 },
  { kind: 'record', axis: 'meditacao', value: '10 minutos', note: 'Antes de abrir o celular' },
  { kind: 'streak', days: 42 },
  { kind: 'record', axis: 'estudo', value: '90 minutos', note: 'Inglês, listening' },
  { kind: 'goal', label: 'Estudo', done: '180 de 300 min', percent: 60 },
  { kind: 'quote', text: 'Não perdi o dia. De novo.' },
  { kind: 'record', axis: 'leitura', value: '18 páginas', note: 'No ônibus, ida e volta' },
]

export function Gallery() {
  return (
    <Section className="border-t border-line bg-surface/30">
      <SectionHeading
        eyebrow="Na prática"
        title="É assim que a evolução aparece"
        description="Registro pequeno, todo dia, somando. Sem foto de antes e depois, sem discurso."
      />

      <ul className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3">
        {TILES.map((tile, index) => (
          <Reveal key={index} delay={(index % 6) * 0.05}>
            <li className="h-full">
              <TileCard tile={tile} />
            </li>
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}

function TileCard({ tile }: { tile: Tile }) {
  switch (tile.kind) {
    case 'record': {
      const type = BUILTIN_ACTIVITY_TYPES[tile.axis]
      return (
        <article className="flex h-full flex-col rounded-card border border-line bg-surface p-4">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: type.colorToken }}
            />
            <span className="text-xs font-medium text-ink-muted">{type.label}</span>
          </span>
          <p className="mt-3 text-lg font-semibold text-ink">{tile.value}</p>
          <p className="mt-auto pt-2 text-xs text-ink-faint">{tile.note}</p>
        </article>
      )
    }

    case 'streak':
      return (
        <article className="flex h-full flex-col justify-between rounded-card border border-line bg-surface p-4">
          <span className="text-xs font-medium text-ink-muted">Sequência</span>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="tabular text-3xl font-semibold text-ink">{tile.days}</span>
            <span className="text-xs text-ink-muted">dias</span>
          </p>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: 7 }, (_, index) => (
              <span
                key={index}
                className={cn('h-5 flex-1 rounded', index === 3 ? 'bg-surface-hi' : 'bg-brand')}
              />
            ))}
          </div>
        </article>
      )

    case 'goal':
      return (
        <article className="flex h-full flex-col justify-between rounded-card border border-line bg-surface p-4">
          <span className="text-xs font-medium text-ink-muted">Meta · {tile.label}</span>
          <p className="tabular mt-3 text-sm text-ink">{tile.done}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-hi">
            <span
              className={cn(
                'block h-full rounded-full',
                tile.percent >= 100 ? 'bg-positive' : 'bg-brand',
              )}
              style={{ width: `${tile.percent}%` }}
            />
          </div>
        </article>
      )

    case 'quote':
      return (
        <article className="grid h-full place-items-center rounded-card border border-brand/30 bg-brand-dim/30 p-4 text-center">
          <p className="text-balance text-sm font-medium text-ink">{tile.text}</p>
        </article>
      )
  }
}
