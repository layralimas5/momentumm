import { motion } from 'framer-motion'
import type { Win } from '@/domain/entities/win'
import { Icon } from '@/presentation/components/ui/Icon'

/**
 * Dia fechado: hábitos concluídos e nada pendente.
 *
 * O banner marca o fim do dia em vez de oferecer mais coisa pra fazer. Sugerir
 * tarefa extra aqui transformaria constância em cobrança, que é exatamente o
 * que o produto não quer.
 */
export function DayCompleteBanner({ win }: { win: Win | null }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start gap-3 rounded-card border border-positive/30 bg-positive/8 px-4 py-3.5 text-sm"
      role="status"
    >
      <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
      <span className="text-ink">
        <strong className="font-semibold">Dia cumprido.</strong> Tudo que estava planejado pra hoje
        saiu.{' '}
        <span className="text-ink-muted">
          {win
            ? 'Amanhã continua daqui. Hoje já está fechado.'
            : 'Registra a vitória do dia e encerra por aqui.'}
        </span>
      </span>
    </motion.p>
  )
}
