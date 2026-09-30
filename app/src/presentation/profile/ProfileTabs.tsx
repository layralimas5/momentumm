import { Link } from 'react-router-dom'
import { LogoMark } from '@/presentation/components/brand/Logo'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

export const PROFILE_TABS = ['atividades', 'progresso', 'perfil'] as const
export type ProfileTab = (typeof PROFILE_TABS)[number]

export const PROFILE_TAB_LABELS: Readonly<Record<ProfileTab, string>> = {
  atividades: 'Atividades',
  progresso: 'Progresso',
  perfil: 'Perfil',
}

/**
 * As três leituras do mesmo perfil.
 *
 *   Atividades  o que aconteceu, em ordem, o histórico.
 *   Progresso   o quanto mudou: o calendário do mês, o nível e os números.
 *   Perfil      os ajustes: quem vê, o que aparece, e o resto do app.
 *
 * Elas existem porque a página tinha oito blocos empilhados e respondia as três
 * perguntas ao mesmo tempo, sem separar nenhuma: rolar até as conquistas
 * passava por gráfico, por lista de momento e por painel de privacidade.
 *
 * Não são rotas. A aba não muda o endereço de propósito: é a mesma tela vista
 * de três ângulos, e um link que abrisse "o perfil na aba de progresso" seria
 * um endereço que ninguém tem por que mandar pra ninguém.
 */
export function ProfileTabs({
  value,
  onChange,
}: {
  readonly value: ProfileTab
  readonly onChange: (tab: ProfileTab) => void
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 flex items-center gap-1 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur-md lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
      <LogoMark className="size-7 shrink-0 lg:hidden" />

      <nav aria-label="Seções do perfil" className="flex min-w-0 flex-1 justify-center gap-1">
        {PROFILE_TABS.map((tab) => {
          const active = tab === value
          return (
            <button
              key={tab}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onChange(tab)}
              className={cn(
                'relative min-h-11 rounded-lg px-3 text-[0.9375rem] font-medium transition-colors',
                active ? 'text-ink' : 'text-ink-faint active:text-ink-muted',
              )}
            >
              {PROFILE_TAB_LABELS[tab]}
              {/* O traço embaixo é o que sobrevive ao sol e ao daltonismo: só a
                  diferença de cinza pra branco não marca aba nenhuma. */}
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-brand-hi"
                />
              ) : null}
            </button>
          )
        })}
      </nav>

      {/*
        A engrenagem leva pros ajustes da conta, plano, segurança, dados. Ela
        fica aqui, e não dentro da aba Perfil, porque é o caminho que a pessoa
        procura sem ler: canto de cima, à direita, como em todo lugar.
      */}
      <Link
        to="/app/configuracoes"
        aria-label="Ajustes da conta"
        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors active:bg-surface"
      >
        <Icon name="config" className="size-5" />
      </Link>
    </div>
  )
}
