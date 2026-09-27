import { cn } from '@/shared/lib/cn'

/**
 * O selo da conta PRO.
 *
 * É o único emblema preenchido do app, todo o resto é desenho de traço. A
 * exceção é o ponto: um selo em contorno, do lado de um nome, lê como ícone de
 * função ("editar", "configurar") e não como carimbo. Carimbo é sólido.
 *
 * ## Quem tem
 *
 * Só quem assina o PRO, e o app decide isso num lugar só (`isPro`), a partir do
 * plano que o servidor escreveu. Não existe selo concedido à mão, nem por
 * tempo de casa, nem por nível: no dia em que a assinatura cai, o selo cai
 * junto, sem ninguém precisar lembrar de tirar.
 *
 * ## O que ele NÃO diz
 *
 * Não é verificação de identidade. O Momentumm não confere documento de
 * ninguém, e um selo azul que todo mundo lê como "essa pessoa é quem diz ser"
 * seria uma mentira pequena contada todo dia. Por isso o texto pro leitor de
 * tela é "Conta PRO", e é isso que ele significa em qualquer lugar do produto.
 *
 * ## O desenho
 *
 * A borda serrilhada é gerada, não desenhada à mão: um círculo cujo raio
 * oscila doze vezes ao redor da volta. Doze lóbulos é o que faz a silhueta ser
 * reconhecida como selo a 16px, que é o tamanho em que ele quase sempre
 * aparece.
 */

const LOBES = 12
const BASE_RADIUS = 10.2
const AMPLITUDE = 1.15
const CENTER = 12
/** Um ponto a cada 3 graus: mais que isso não muda nada aos olhos. */
const STEP = 3

const BURST_PATH = buildBurst()

function buildBurst(): string {
  const points: string[] = []

  for (let angle = 0; angle < 360; angle += STEP) {
    const radians = (angle * Math.PI) / 180
    const radius = BASE_RADIUS + AMPLITUDE * Math.cos(LOBES * radians)
    const x = CENTER + radius * Math.cos(radians)
    const y = CENTER + radius * Math.sin(radians)
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }

  return `M${points[0]}L${points.slice(1).join('L')}Z`
}

export function VerifiedBadge({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('size-5 shrink-0', className)}>
      <path d={BURST_PATH} fill="var(--color-verified)" />
      {/*
        O check em branco, e sempre branco: ele precisa sobreviver ao tema
        claro, ao escuro e a qualquer fundo atrás do selo.
      */}
      <path
        d="m8.2 12.3 2.6 2.6 5-5.4"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
