import { DEFAULT_BANNER, isBannerPreset, type BannerPreset } from '@/domain/entities/profile-banner'
import { cn } from '@/shared/lib/cn'

/** Cada preset é um gradiente. A chave mora no domínio; a cor mora aqui. */
export const BANNER_PRESET_CLASSES: Readonly<Record<BannerPreset, string>> = {
  aurora: 'bg-[linear-gradient(120deg,#2b1d6b_0%,#6d5cff_55%,#9b8cff_100%)]',
  brasa: 'bg-[linear-gradient(120deg,#3a0f1f_0%,#c2410c_55%,#f59e0b_100%)]',
  mar: 'bg-[linear-gradient(120deg,#082f49_0%,#0369a1_55%,#22d3ee_100%)]',
  floresta: 'bg-[linear-gradient(120deg,#052e16_0%,#15803d_55%,#84cc16_100%)]',
  noite: 'bg-[linear-gradient(120deg,#0b0b12_0%,#1e1b4b_60%,#312e81_100%)]',
  areia: 'bg-[linear-gradient(120deg,#78350f_0%,#d6a35c_55%,#fde68a_100%)]',
}

/**
 * A capa atrás do avatar. Preset vira gradiente; foto vira `background`
 * cobrindo a faixa. Sem nada escolhido, o preset padrão: o card nunca fica
 * com um buraco cinza em cima.
 */
export function ProfileBanner({ banner, className }: { readonly banner: string | null; readonly className?: string }) {
  const preset = banner && isBannerPreset(banner) ? banner : banner ? null : DEFAULT_BANNER
  return (
    <div
      aria-hidden="true"
      className={cn('w-full bg-cover bg-center', preset ? BANNER_PRESET_CLASSES[preset] : '', className)}
      style={preset ? undefined : { backgroundImage: `url(${banner})` }}
    />
  )
}
