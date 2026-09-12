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
 * O rodapé vai de ponta a ponta. O efeito fica na SEÇÃO ANTERIOR: a página
 * termina num bloco de cantos arredondados embaixo, com uma névoa da marca
 * subindo pela borda e a fita curvada atravessando a emenda, como uma onda
 * encostando no fim da página. A fita é SVG puro (duas passadas, a de trás
 * mais escura pra dar volume).
 */
export function SiteFooter() {
  return (
    <footer className="relative bg-surface">
      <PreviousSectionTail />

      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_15%_0%,rgb(109_92_255_/_0.18),transparent_70%),radial-gradient(40%_50%_at_90%_100%,rgb(109_92_255_/_0.1),transparent_70%)]"
        />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-20 sm:px-6 sm:pt-24 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-pretty text-sm text-ink-muted">
              Objetivo vira plano. Plano vira o que você faz hoje. Um sistema de progresso pessoal,
              não mais um app de hábitos.
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
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-center text-sm text-ink-faint sm:flex-row sm:px-6 sm:text-left">
            <p>
              © {new Date().getFullYear()} {SITE.name}. Todos os direitos reservados.
            </p>
            <p>Roda no navegador do celular e do computador. Sem instalar nada.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

/**
 * Cauda da seção anterior: continua o fundo da página num bloco de cantos
 * arredondados, por cima do rodapé. A névoa sobe do canto de baixo e a fita
 * cruza a emenda entre os dois.
 */
function PreviousSectionTail() {
  return (
    <div aria-hidden="true" className="relative mx-3 sm:mx-6">
      <div className="relative h-24 overflow-hidden rounded-b-[2rem] bg-canvas sm:h-32">
        <div className="absolute inset-x-0 bottom-0 h-full bg-[radial-gradient(70%_100%_at_50%_100%,rgb(109_92_255_/_0.28),transparent_70%)]" />
        <div className="absolute inset-x-[15%] -bottom-10 h-20 rounded-full bg-brand/30 blur-3xl" />
      </div>
      <WaveRibbon />
    </div>
  )
}

/**
 * Faixa curvada que cruza a borda de baixo da cauda. `preserveAspectRatio="none"`
 * deixa a onda esticar com a largura sem mudar de altura; as duas passadas
 * têm curvas ligeiramente diferentes pra parecer uma fita dobrada.
 */
function WaveRibbon() {
  return (
    <svg
      viewBox="0 0 1440 160"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -inset-x-2 bottom-0 h-24 w-[calc(100%+1rem)] translate-y-[45%] sm:-inset-x-4 sm:h-32 sm:w-[calc(100%+2rem)]"
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
