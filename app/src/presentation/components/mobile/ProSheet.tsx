import { Link } from 'react-router-dom'
import { Button } from '@/presentation/components/ui/Button'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'

interface ProSheetProps {
  readonly open: boolean
  /** O recurso que a pessoa tentou usar agora. Sem isso vira propaganda solta. */
  readonly feature: string | null
  readonly onClose: () => void
}

const BENEFITS = [
  'Metas e hábitos sem limite de quantidade',
  'Insights contínuos, com histórico completo',
  'Sessões de foco de 45 e 60 minutos',
  'Comparação semanal e relatório mensal',
] as const

/**
 * O PRO no celular.
 *
 * Aparece só quando a pessoa esbarra num limite de verdade, explicando o que
 * aquilo destrava naquele momento. Nada de pop-up ao abrir o app: interromper
 * quem veio registrar dez minutos de leitura é o jeito mais rápido de fazer
 * essa pessoa não voltar.
 */
export function ProSheet({ open, feature, onClose }: ProSheetProps) {
  return (
    <BottomSheet
      open={open}
      title={feature ?? 'Momentumm PRO'}
      description="Esse recurso faz parte do PRO."
      onClose={onClose}
    >
      <p className="text-sm text-ink-muted">
        O essencial continua gratuito: check-in, prioridade do dia, hábitos, foco e progresso da
        semana. O PRO aprofunda o que você já está fazendo.
      </p>

      <ul className="mt-4 flex flex-col gap-2.5">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex gap-2.5 text-sm text-ink">
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
            {benefit}
          </li>
        ))}
      </ul>

      <Link
        to="/#pro"
        onClick={onClose}
        className="mt-5 inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-white transition-colors active:bg-brand-hi"
      >
        <Icon name="raio" className="size-4" />
        Conhecer o PRO
      </Link>

      <Button variant="ghost" size="lg" className="mt-2 h-12 w-full" onClick={onClose}>
        Agora não
      </Button>
    </BottomSheet>
  )
}
