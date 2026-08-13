import { cn } from '@/shared/lib/cn'

/**
 * A marca é o "M" de momento virando movimento: a linha sobe, desce e sobe de
 * novo, com o ponto laranja marcando o dia em que a sequência continua.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('size-7', className)}
      fill="none"
    >
      <path
        d="M6 23V11.6c0-.8.9-1.1 1.4-.5l4.4 5.3c.5.6 1.4.6 1.9 0l4.4-5.3c.5-.6 1.4-.3 1.4.5V23"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="25.5" cy="11.5" r="2.5" className="fill-flame" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <LogoMark className="text-brand" />
      Momentumm
    </span>
  )
}
