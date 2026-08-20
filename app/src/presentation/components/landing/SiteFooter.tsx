import { Link } from 'react-router-dom'
import { Wordmark } from '@/presentation/components/brand/Logo'

const EXPLORE = [
  { label: 'Recursos', href: '/#recursos' },
  { label: 'Eixos', href: '/#eixos' },
  { label: 'Ferramentas', href: '/ferramentas' },
  { label: 'Momentumm PRO', href: '/#pro' },
  { label: 'Dúvidas', href: '/#faq' },
] as const

const INFO = [
  { label: 'Termos de uso', href: '/termos' },
  { label: 'Privacidade', href: '/privacidade' },
  { label: 'Preferências de cookies', href: '/cookies' },
] as const

const SOCIAL = [
  { label: 'Instagram', href: 'https://instagram.com', icon: 'instagram' },
  { label: 'TikTok', href: 'https://tiktok.com', icon: 'tiktok' },
  { label: 'YouTube', href: 'https://youtube.com', icon: 'youtube' },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-pretty text-sm text-ink-muted">
            Clareza pra registrar a rotina. Constância pra enxergar a evolução.
          </p>
          <ul className="mt-5 flex gap-2">
            {SOCIAL.map((item) => (
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

        <nav aria-label="Explorar">
          <h2 className="text-sm font-medium text-ink">Explorar</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {EXPLORE.map((link) => (
              <li key={link.label}>
                <Link to={link.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Informações">
          <h2 className="text-sm font-medium text-ink">Informações</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {INFO.map((link) => (
              <li key={link.label}>
                <Link to={link.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-medium text-ink">Comece agora</h2>
          <p className="mt-3 text-sm text-ink-muted">
            Roda no navegador do celular e do computador. Sem instalar nada.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <QrPlaceholder />
            <p className="text-xs text-ink-faint">
              Aponte a câmera
              <br />
              pra abrir no celular
            </p>
          </div>
          <Link
            to="/entrar"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hi"
          >
            Criar conta grátis
          </Link>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Momentumm. Todos os direitos reservados.</p>
          <p>
            Desenvolvido por{' '}
            <a
              href="https://limadigitalstudio.com.br"
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted transition-colors hover:text-ink"
            >
              Layra Lima
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}

/** Placeholder do QR: vira imagem real quando o domínio estiver de pé. */
function QrPlaceholder() {
  return (
    <span
      aria-hidden="true"
      className="grid size-20 shrink-0 grid-cols-5 gap-0.5 rounded-lg border border-line bg-surface p-2"
    >
      {Array.from({ length: 25 }, (_, index) => (
        <span
          key={index}
          className={index % 3 === 0 || index % 7 === 0 ? 'rounded-[1px] bg-ink-faint' : ''}
        />
      ))}
    </span>
  )
}

function SocialIcon({ name }: { name: 'instagram' | 'tiktok' | 'youtube' }) {
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
