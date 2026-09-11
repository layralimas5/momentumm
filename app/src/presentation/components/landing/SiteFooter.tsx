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
  { label: 'Ferramentas grátis', href: '/ferramentas' },
  { label: 'Entrar', href: '/entrar' },
] as const

const LEGAL = [
  { label: 'Termos de uso', href: '/termos' },
  { label: 'Política de privacidade', href: '/privacidade' },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-pretty text-sm text-ink-muted">
            Objetivo vira plano. Plano vira o que você faz hoje. Um sistema de progresso
            pessoal, não mais um app de hábitos.
          </p>
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
                <Link to={link.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to={CTA.primary.to}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hi"
          >
            {CTA.primary.label}
          </Link>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-center text-sm text-ink-faint sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} {SITE.name}. Todos os direitos reservados.</p>
          <p>Roda no navegador do celular e do computador. Sem instalar nada.</p>
        </div>
      </div>
    </footer>
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
            <Link to={link.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
