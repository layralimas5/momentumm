import { Link } from 'react-router-dom'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { CTA, SITE } from './site'

const PRODUCT = [
  { label: 'O método', href: '/#metodo' },
  { label: 'Por dentro', href: '/#telas' },
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

/**
 * O rodapé vai de ponta a ponta, escuro, logo abaixo da seção final roxa.
 */
export function SiteFooter() {
  return (
    <footer className="relative bg-surface">
      <div className="relative">
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
