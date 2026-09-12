import { Link } from 'react-router-dom'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { CTA, SITE } from './site'

const PRODUCT = [
  { label: 'O método', href: '/#metodo' },
  { label: 'Por dentro', href: '/#telas' },
  { label: 'Momentum Score', href: '/#momentum-score' },
  { label: 'Momentumm AI', href: '/#ia' },
  { label: 'Planos', href: '/#planos' },
  { label: 'Dúvidas', href: '/#faq' },
] as const

const RESOURCES = [
  { label: 'Depoimentos', href: '/#depoimentos' },
  { label: 'Ferramentas grátis', href: '/ferramentas' },
  { label: 'Entrar', href: '/entrar' },
] as const

const LEGAL = [
  { label: 'Termos de uso', href: '/termos' },
  { label: 'Política de privacidade', href: '/privacidade' },
] as const

/**
 * O rodapé é um bloco arredondado que sobe por baixo de uma faixa curvada
 * da marca, como uma onda encostando na última seção. A faixa é SVG puro
 * (duas passadas, a de trás mais escura pra dar volume), e o brilho difuso
 * atrás dela é o que faz a curva parecer luz, não um recorte.
 */
export function SiteFooter() {
  return (
    <footer className="px-3 pb-3 pt-14 sm:px-6 sm:pb-6 sm:pt-20">
      <div className="relative mx-auto max-w-6xl">
        <WaveRibbon />

        <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_0%,rgb(109_92_255_/_0.22),transparent_70%),radial-gradient(40%_40%_at_90%_100%,rgb(109_92_255_/_0.12),transparent_70%)]"
          />

          <div className="relative grid gap-10 px-6 pb-10 pt-20 sm:px-10 sm:pt-28 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Wordmark />
              <p className="mt-4 max-w-xs text-pretty text-sm text-ink-muted">
                Objetivo vira plano. Plano vira o que você faz hoje. Um sistema de progresso
                pessoal, não mais um app de hábitos.
              </p>
              <Link
                to={CTA.primary.to}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-medium text-white shadow-lg shadow-brand/30 transition-colors hover:bg-brand-hi"
              >
                {CTA.primary.label}
              </Link>
            </div>

            <FooterNav title="Produto" links={PRODUCT} />
            <FooterNav title="Recursos" links={RESOURCES} />

            <div>
              <h2 className="text-sm font-medium text-ink">
                {SITE.contactEmail ? 'Contato e legal' : 'Legal'}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {SITE.contactEmail ? (
                  <li>
                    <a
                      href={`mailto:${SITE.contactEmail}`}
                      className="text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {SITE.contactEmail}
                    </a>
                  </li>
                ) : null}
                {LEGAL.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="relative border-t border-line/70">
            <div className="flex flex-col items-center justify-between gap-2 px-6 py-5 text-center text-sm text-ink-faint sm:flex-row sm:px-10 sm:text-left">
              <p>
                © {new Date().getFullYear()} {SITE.name}. Todos os direitos reservados.
              </p>
              <p>Roda no navegador do celular e do computador. Sem instalar nada.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

/**
 * Faixa curvada que encosta no topo do bloco. `preserveAspectRatio="none"`
 * deixa a onda esticar com a largura sem mudar de altura; as duas passadas
 * têm curvas ligeiramente diferentes pra parecer uma fita dobrada.
 */
function WaveRibbon() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -inset-x-2 -top-10 z-10 h-24 sm:-inset-x-4 sm:-top-12 sm:h-32"
    >
      <div className="absolute inset-x-[10%] top-1/2 h-24 -translate-y-1/2 rounded-full bg-brand/30 blur-3xl" />
      <svg
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-full w-full"
      >
        <path
          className="fill-brand-deep"
          d="M0 106 C200 46 420 40 720 84 C1020 128 1240 138 1440 72 L1440 106 C1240 172 1020 162 720 118 C420 74 200 80 0 140 Z"
        />
        <path
          className="fill-brand"
          d="M0 120 C260 64 520 58 800 98 C1080 138 1220 144 1440 92 L1440 122 C1220 174 1080 168 800 128 C520 88 260 94 0 150 Z"
        />
      </svg>
    </div>
  )
}

function FooterNav({
  title,
  links,
}: {
  title: string
  links: readonly { readonly label: string; readonly href: string }[]
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              to={link.href}
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
