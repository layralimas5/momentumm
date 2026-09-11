import { Link } from 'react-router-dom'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { CTA, SITE, type SocialIconName } from './site'

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
  { label: 'Ver o app em modo demo', href: '/app' },
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
          <ul className="mt-5 flex gap-2">
            {SITE.social.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="grid size-9 place-items-center rounded-lg border border-line text-ink-muted transition-colors hover:border-line-hi hover:text-ink"
                >
                  <span className="sr-only">{item.label}</span>
                  <SocialIcon name={item.icon} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <FooterNav title="Produto" links={PRODUCT} />
        <FooterNav title="Recursos" links={RESOURCES} />

        <div>
          <h2 className="text-sm font-medium text-ink">Contato e legal</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <a
                href={`mailto:${SITE.contactEmail}`}
                className="text-sm text-ink-muted transition-colors hover:text-ink"
              >
                {SITE.contactEmail}
              </a>
            </li>
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

function SocialIcon({ name }: { name: SocialIconName }) {
  if (name === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (name === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M16.5 3c.4 2.2 1.7 3.5 3.9 3.7v2.6c-1.4.1-2.7-.3-3.9-1v6.2a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.1v2.7a3.2 3.2 0 1 0 2.3 3V3h2.7Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8A26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  )
}
