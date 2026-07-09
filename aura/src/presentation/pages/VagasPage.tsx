import { Link } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { AuraMark } from '@/presentation/components/AuraMark'

/**
 * Página do funil quando o checkout ainda não está configurado. Comunica a
 * abertura das vagas de fundadora — ninguém entra no app sem passar por aqui.
 */
export function VagasPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-black px-5 py-12 text-center text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-80 w-[600px] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-600/25 to-blush-500/20 blur-[130px]"
      />
      <Link to="/" className="mb-10" aria-label="Aura — início">
        <AuraMark light />
      </Link>

      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-brand-300">
        <Sparkles className="h-3.5 w-3.5" />
        Vagas de fundadora
      </span>

      <h1 className="mt-6 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        As vagas de fundadora estão abrindo.
      </h1>
      <p className="mx-auto mt-4 max-w-md text-pretty text-zinc-400">
        As 10 primeiras garantem R$ 14,90/mês pra sempre. Estamos finalizando os últimos
        detalhes do pagamento — em breve você garante a sua.
      </p>

      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao início
      </Link>
    </div>
  )
}
